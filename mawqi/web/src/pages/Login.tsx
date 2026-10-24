import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

export default function Login() {
  const { login, status } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/logo.png" alt="" />
        <h1>المشاريع</h1>
        <p className="muted">{status?.companyName ?? 'شركة الخطوط المعدنية للمقاولات العامة'}<br />نظام إدارة المواقع والعمالة</p>
        <label>اسم المستخدم<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label>كلمة المرور<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn primary big" disabled={busy}>{busy ? 'جارٍ الدخول…' : 'دخول'}</button>
      </form>
    </div>
  )
}
