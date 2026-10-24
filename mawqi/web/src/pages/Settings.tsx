import { useState } from 'react'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { Badge, DeleteButton, ErrorBox, Field, FormModal, inp, Loading, PageHead, send, toast, useCan, useData, useMeta } from '../ui'

interface UserRow { id: number; name: string; username: string; role: string; phone: string | null; active: number; projects: number }

export default function SettingsPage() {
  const can = useCan()
  return (
    <div className="page narrow">
      <PageHead title={can('users') ? 'المستخدمون والإعدادات' : 'حسابي'} />
      <PasswordCard />
      {can('users') && <UsersCard />}
      {can('users') && <CompanyCard />}
      {can('users') && <ResetCard />}
    </div>
  )
}

function PasswordCard() {
  const { user } = useAuth()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await send('/api/me/password', 'PUT', { current: cur, next }, 'تم تغيير كلمة المرور'); setCur(''); setNext('') }
    catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2><Icon name="key" /> كلمة المرور</h2><small className="muted">{user?.name} · {user?.username}</small></div>
      <div className="form-grid">
        <Field label="كلمة المرور الحالية"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="كلمة المرور الجديدة" hint="6 أحرف على الأقل"><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
        <div className="field end"><button className="btn primary" onClick={save} disabled={busy || !cur || next.length < 6}>تغيير</button></div>
      </div>
    </section>
  )
}

function UsersCard() {
  const { data, error } = useData<UserRow[]>('/api/users')
  const meta = useMeta()
  const [editing, setEditing] = useState<Partial<UserRow> | null>(null)
  if (error && !data) return <ErrorBox error={error} />
  if (!data) return <Loading />
  return (
    <section className="panel">
      <div className="panel-head">
        <h2><Icon name="workers" /> المستخدمون</h2>
        <button className="btn primary sm" onClick={() => setEditing({ role: 'supervisor' })}><Icon name="plus" size={16} /> مستخدم</button>
      </div>
      <ul className="people">
        {data.map((u) => (
          <li key={u.id} className={u.active ? '' : 'off'}>
            <span className="avatar-s">{u.name.slice(0, 1)}</span>
            <div><strong>{u.name}</strong><small>{u.username} · {meta?.roles[u.role]}{u.projects ? ` · ${u.projects} مشروع` : ''}</small></div>
            {!u.active && <Badge tone="grey">موقوف</Badge>}
            <button className="icon-btn dark" onClick={() => setEditing(u)} title="تعديل"><Icon name="edit" size={18} /></button>
          </li>
        ))}
      </ul>
      {editing && <UserForm u={editing} onClose={() => setEditing(null)} roles={meta?.roles ?? {}} />}
    </section>
  )
}

function UserForm({ u, onClose, roles }: { u: Partial<UserRow>; onClose: () => void; roles: Record<string, string> }) {
  const isNew = !u.id
  const initial = { name: u.name ?? '', username: u.username ?? '', role: u.role ?? 'supervisor', phone: u.phone ?? '', active: u.active ?? 1, password: '' }
  return (
    <FormModal title={isNew ? 'مستخدم جديد' : `تعديل: ${u.name}`} initial={initial} onClose={onClose}
      extra={!isNew ? <DeleteButton path={`/api/users/${u.id}`} what={`المستخدم «${u.name}»`} onDone={onClose} /> : undefined}
      onSubmit={(v) => (isNew ? send('/api/users', 'POST', v, 'تمت إضافة المستخدم') : send(`/api/users/${u.id}`, 'PUT', { ...v, active: Number(v.active) }, 'تم الحفظ'))}>
      {(v, set) => (
        <>
          <Field label="الاسم" span={2}>{inp(v, set, 'name', 'text', { autoFocus: true })}</Field>
          <Field label="الجوال">{inp(v, set, 'phone', 'tel')}</Field>
          <Field label="اسم المستخدم (للدخول)">{inp(v, set, 'username', 'text', { autoCapitalize: 'none', dir: 'ltr' })}</Field>
          <Field label="الدور">
            <select value={v.role} onChange={(e) => set({ role: e.target.value })}>{Object.entries(roles).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          <Field label={isNew ? 'كلمة المرور' : 'كلمة مرور جديدة'} hint={isNew ? '6 أحرف على الأقل' : 'اتركها فارغة للإبقاء على الحالية'}>{inp(v, set, 'password', 'text', { autoComplete: 'off' })}</Field>
          {!isNew && (
            <Field label="الحالة">
              <select value={v.active} onChange={(e) => set({ active: Number(e.target.value) })}><option value={1}>نشط</option><option value={0}>موقوف (لا يستطيع الدخول)</option></select>
            </Field>
          )}
          <p className="muted span-3 hint-box">
            <b>الصلاحيات:</b> المدير العام ومدير النظام: يريان ويعدّلان ويحذفان كل شيء (الحذف لهما فقط) · مدير المشروع: مشاريعه وعمالها وأوامر الإسناد · مشرف الموقع: الحضور والتقرير اليومي والبلاغات لمشروعه · المحاسب: يرى كل المشاريع ويدير المستخلصات والتقارير.
          </p>
        </>
      )}
    </FormModal>
  )
}

function CompanyCard() {
  const meta = useMeta()
  const [name, setName] = useState<string | null>(null)
  const [cutoff, setCutoff] = useState<string | null>(null)
  if (!meta) return null
  const save = async () => {
    try { await send('/api/settings', 'PUT', { companyName: name ?? meta.settings.companyName, absenceCutoff: cutoff ?? meta.settings.absenceCutoff }, 'تم حفظ الإعدادات') }
    catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2><Icon name="settings" /> إعدادات الشركة</h2></div>
      <div className="form-grid">
        <Field label="اسم الشركة" span={2}><input value={name ?? meta.settings.companyName} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="آخر موعد للحضور" hint="بعده يُسجل غير المحضَّرين غائبين تلقائياً"><input type="time" value={cutoff ?? meta.settings.absenceCutoff} onChange={(e) => setCutoff(e.target.value)} /></Field>
        <div className="field end span-3"><button className="btn primary" onClick={save}>حفظ</button></div>
      </div>
    </section>
  )
}

function ResetCard() {
  const [word, setWord] = useState('')
  const go = async () => {
    try { await send('/api/admin/reset', 'POST', { confirm: word }, 'تم مسح البيانات التجريبية — النظام جاهز لبياناتكم'); setWord('') }
    catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <section className="panel danger-zone">
      <div className="panel-head"><h2><Icon name="warning" /> بدء الاستخدام الفعلي</h2></div>
      <p>يمسح <b>كل البيانات التجريبية</b> (المشاريع والعمال والحضور والبلاغات والمستخلصات والمستخدمين الآخرين) ويُبقي حسابك فقط. لا يمكن التراجع.</p>
      <div className="form-grid">
        <Field label="اكتب «ابدأ» للتأكيد"><input value={word} onChange={(e) => setWord(e.target.value)} /></Field>
        <div className="field end"><button className="btn danger-solid" disabled={word !== 'ابدأ'} onClick={go}>مسح البيانات التجريبية</button></div>
      </div>
    </section>
  )
}
