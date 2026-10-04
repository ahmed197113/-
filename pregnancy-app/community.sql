-- جداول مجتمع الأمهات — نبضٌ صغير
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  uid text not null, nick text, anon boolean default false,
  cat text, title text not null check (char_length(title) between 8 and 120),
  body text not null check (char_length(body) between 10 and 1500),
  stage text, t bigint not null, ac int default 0, lt bigint
);
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  qid uuid references questions(id) on delete cascade,
  uid text not null, nick text, anon boolean default false, ai boolean default false,
  body text not null check (char_length(body) between 3 and 4000),
  stage text, t bigint not null, hp int default 0
);
create table if not exists reports (id bigserial primary key, ref text, by text, t bigint);

alter table questions enable row level security;
alter table answers enable row level security;
alter table reports enable row level security;
create policy "read questions" on questions for select using (true);
create policy "add questions" on questions for insert with check (ac = 0);
create policy "delete own question" on questions for delete using (true);
create policy "read answers" on answers for select using (true);
create policy "add answers" on answers for insert with check (hp = 0);
create policy "add reports" on reports for insert with check (true);

create or replace function inc_answers(q uuid) returns void language sql security definer as
$$ update questions set ac = ac + 1, lt = (extract(epoch from now()) * 1000)::bigint where id = q; $$;
create or replace function inc_helpful(a uuid) returns void language sql security definer as
$$ update answers set hp = hp + 1 where id = a; $$;
