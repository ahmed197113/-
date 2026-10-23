import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

const DEMO = [
  ['admin', 'مدير عام'],
  ['pm1', 'مدير مشروع'],
  ['sup1', 'مشرف موقع'],
  ['acc1', 'محاسب'],
]

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.svg" alt="" width={72} height={72} />
        <h1>موقعي</h1>
        <p className="muted">نظام إدارة مواقع المشاريع والعمالة</p>
        <label>اسم المستخدم<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
        <label>كلمة المرور<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn primary big" disabled={busy}>{busy ? 'جارٍ الدخول…' : 'دخول'}</button>
        <div className="demo">
          <span>حسابات تجريبية (كلمة المرور 123456):</span>
          <div>
            {DEMO.map(([u, l]) => (
              <button type="button" key={u} className="chip" onClick={() => { setUsername(u); setPassword('123456') }}>{l}</button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
