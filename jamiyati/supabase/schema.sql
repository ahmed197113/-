-- جمعيتي — مخطط قاعدة البيانات للإنتاج (Supabase / PostgreSQL)
-- يطابق src/domain/types.ts. المبادئ:
--   • كل عضو يرى جمعياته فقط (RLS).
--   • لا حذف للدفعات بعد تأكيدها؛ الإلغاء = تغيير الحالة إلى voided مع السبب.
--   • سجل النشاط إضافة فقط، بسلسلة تجزئة SHA-256 تُحسب داخل trigger.

create extension if not exists pgcrypto;

create type frequency as enum ('weekly', 'biweekly', 'monthly');
create type circle_status as enum ('draft', 'active', 'completed', 'terminated');
create type order_method as enum ('manual', 'lottery', 'requests');
create type member_role as enum ('organizer', 'assistant', 'member');
create type payment_method as enum ('bank', 'wallet', 'cash', 'other');
create type payment_status as enum ('pending', 'confirmed', 'rejected', 'voided');
create type swap_status as enum ('open', 'done', 'rejected');

-- المستخدمون (مرتبط بـ auth.users — تسجيل الدخول بالجوال + OTP)
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone text not null unique,              -- E.164 بلا +
  preferred_payment payment_method,
  share_reputation boolean not null default true,
  show_phone boolean not null default false,
  plan text not null default 'free',       -- free | premium
  created_at timestamptz not null default now()
);

create table circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  installment numeric(14, 2) not null check (installment > 0),
  currency char(3) not null,
  frequency frequency not null,
  start_date date not null,
  grace_days int not null default 3 check (grace_days between 0 and 30),
  shares_count int not null check (shares_count >= 2),
  rules text not null default '',
  organizer_id uuid not null references users (id),
  status circle_status not null default 'draft',
  order_method order_method not null default 'lottery',
  order_locked boolean not null default false,
  invite_code text not null unique,
  lottery_seed bigint,
  lottery_at timestamptz,
  lottery_by uuid references users (id),
  lottery_result uuid[],
  terminated_at timestamptz,
  created_at timestamptz not null default now()
);

-- التأجيلات: كل صف يزيح الدورة before_cycle وما بعدها فترة واحدة
create table postponements (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  before_cycle int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid references users (id),      -- فارغ للعضو المضاف يدوياً بلا تطبيق
  name text not null,
  phone text not null default '',
  role member_role not null default 'member',
  preferred_payment payment_method,
  notes text,
  guarantor_name text,
  guarantor_phone text,
  accepted_rules_at timestamptz,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  replaces_member_id uuid references members (id),
  withdrawn_at timestamptz,
  joined_at timestamptz not null default now()
);
create unique index members_one_active_per_user on members (circle_id, user_id) where status = 'active' and user_id is not null;

-- السهم = دور استلام. نصف السهم = صفّان في share_holders بكسر 0.5
create table shares (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  position int not null default 0,          -- 0 = لم يُحدد
  requested_position int,
  requested_at timestamptz
);
create unique index shares_position_unique on shares (circle_id, position) where position > 0;

create table share_holders (
  share_id uuid not null references shares (id) on delete cascade,
  member_id uuid not null references members (id),
  fraction numeric(3, 2) not null check (fraction in (0.5, 1)),
  primary key (share_id, member_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id),
  cycle_index int not null,
  member_id uuid not null references members (id),
  amount numeric(14, 2) not null check (amount > 0),
  method payment_method not null,
  status payment_status not null default 'pending',
  proof_path text,                           -- مسار في Storage bucket "proofs" (خاص)
  note text,
  paid_at date not null,
  submitted_by uuid not null references users (id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references users (id),
  reviewed_at timestamptz,
  reject_reason text,
  void_reason text,
  receipt_no text unique
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id),
  cycle_index int not null,
  share_id uuid not null references shares (id),
  member_id uuid not null references members (id),
  amount numeric(14, 2) not null,
  method payment_method not null,
  delivered_at timestamptz not null default now(),
  delivered_by uuid not null references users (id),
  recipient_confirmed_at timestamptz,
  unique (circle_id, cycle_index, member_id)
);

create table swap_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id),
  from_share_id uuid not null references shares (id),
  to_share_id uuid not null references shares (id),
  requested_by uuid not null references members (id),
  approved_from_at timestamptz,
  approved_to_at timestamptz,
  approved_organizer_at timestamptz,
  status swap_status not null default 'open',
  note text,
  created_at timestamptz not null default now()
);

create table activity_log (
  id bigserial primary key,
  circle_id uuid not null references circles (id),
  at timestamptz not null default now(),
  actor_id uuid references users (id),
  type text not null,
  message text not null,
  prev_hash text not null,
  hash text not null
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  circle_id uuid references circles (id),
  kind text not null,
  text text not null,
  key text,                                   -- يمنع تكرار التذكير نفسه
  read boolean not null default false,
  at timestamptz not null default now(),
  unique (user_id, key)
);

create table push_subscriptions (
  user_id uuid not null references users (id) on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth text not null
);

-- ───────── سلامة السجل: إضافة فقط + سلسلة تجزئة ─────────
create or replace function log_chain() returns trigger language plpgsql as $$
declare prev text;
begin
  select hash into prev from activity_log where circle_id = new.circle_id order by id desc limit 1;
  new.prev_hash := coalesce(prev, '0');
  new.hash := encode(digest(concat_ws('|', new.circle_id, new.at, new.actor_id, new.type, new.message, new.prev_hash), 'sha256'), 'hex');
  return new;
end $$;
create trigger activity_log_chain before insert on activity_log for each row execute function log_chain();

create or replace function forbid_change() returns trigger language plpgsql as $$
begin raise exception 'سجل النشاط غير قابل للتعديل أو الحذف'; end $$;
create trigger activity_log_immutable before update or delete on activity_log for each row execute function forbid_change();

-- الدفعة المؤكدة لا تُحذف، ولا تتغير إلا إلى voided مع سبب
create or replace function protect_payment() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'confirmed' or old.status = 'voided' then raise exception 'لا يمكن حذف دفعة مؤكدة؛ استخدم الإلغاء مع السبب'; end if;
    return old;
  end if;
  if old.status = 'confirmed' and not (new.status = 'voided' and coalesce(new.void_reason, '') <> '') then
    raise exception 'الدفعة المؤكدة لا تُعدّل إلا بالإلغاء مع ذكر السبب';
  end if;
  if old.status = 'voided' then raise exception 'الدفعة الملغاة نهائية'; end if;
  return new;
end $$;
create trigger payments_protect before update or delete on payments for each row execute function protect_payment();

-- ───────── الصلاحيات (RLS) ─────────
create or replace function my_role(c uuid) returns member_role language sql stable security definer as $$
  select case when exists (select 1 from circles where id = c and organizer_id = auth.uid()) then 'organizer'::member_role
    else (select role from members where circle_id = c and user_id = auth.uid() and status = 'active' limit 1) end
$$;
create or replace function is_member(c uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from members where circle_id = c and user_id = auth.uid())
      or exists (select 1 from circles where id = c and organizer_id = auth.uid())
$$;

alter table users enable row level security;
alter table circles enable row level security;
alter table postponements enable row level security;
alter table members enable row level security;
alter table shares enable row level security;
alter table share_holders enable row level security;
alter table payments enable row level security;
alter table payouts enable row level security;
alter table swap_requests enable row level security;
alter table activity_log enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;

create policy self_rw on users for all using (id = auth.uid()) with check (id = auth.uid());
create policy circle_read on circles for select using (is_member(id));
create policy circle_create on circles for insert with check (organizer_id = auth.uid());
create policy circle_update on circles for update using (my_role(id) = 'organizer');
create policy pp_read on postponements for select using (is_member(circle_id));
create policy pp_write on postponements for insert with check (my_role(circle_id) = 'organizer');
create policy members_read on members for select using (is_member(circle_id));
create policy members_write on members for all using (my_role(circle_id) = 'organizer') with check (my_role(circle_id) = 'organizer');
create policy shares_read on shares for select using (is_member(circle_id));
create policy shares_write on shares for all using (my_role(circle_id) = 'organizer');
create policy holders_read on share_holders for select using (exists (select 1 from shares s where s.id = share_id and is_member(s.circle_id)));
create policy payments_read on payments for select using (is_member(circle_id));
-- العضو يعلن دفعته (pending)، والمنظم/المساعد يسجل ويؤكد
create policy payments_submit on payments for insert with check (
  (status = 'pending' and exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid()))
  or my_role(circle_id) in ('organizer', 'assistant'));
create policy payments_review on payments for update using (my_role(circle_id) in ('organizer', 'assistant'));
create policy payouts_read on payouts for select using (is_member(circle_id));
create policy payouts_write on payouts for insert with check (my_role(circle_id) = 'organizer');
create policy payouts_confirm on payouts for update using (exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid()));
create policy swaps_read on swap_requests for select using (is_member(circle_id));
create policy swaps_write on swap_requests for all using (is_member(circle_id));
create policy log_read on activity_log for select using (is_member(circle_id));
create policy log_insert on activity_log for insert with check (is_member(circle_id));
create policy notif_own on notifications for all using (user_id = auth.uid());
create policy push_own on push_subscriptions for all using (user_id = auth.uid());

-- أرقام الجوالات: واجهة عرض تُخفي الرقم إلا للمنظم/المساعد أو بإذن صاحبه
create view member_directory with (security_invoker = true) as
select m.id, m.circle_id, m.name, m.role, m.status,
  case when my_role(m.circle_id) in ('organizer', 'assistant') or m.user_id = auth.uid()
         or coalesce((select show_phone from users u where u.id = m.user_id), false)
       then m.phone else left(m.phone, 4) || '•••' || right(m.phone, 3) end as phone
from members m;

-- سجل الالتزام يُعرض للمنظمين فقط لمن وافق على المشاركة (share_reputation)
-- ويُحسب بدالة reliability() نفسها المستخدمة في الواجهة (Edge Function: reputation).
