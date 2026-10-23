import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

/** First run on a new server: create the general manager account. */
export default function Setup() {
  const { setup, status } = useAuth()
  const [companyName, setCompanyName] = useState(status?.companyName ?? '')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [demo, setDemo] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await setup({ companyName, name, username: username.trim(), password, demo })
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
        <h1>إعداد «موقعي»</h1>
        <p className="muted">أول تشغيل على هذا الخادم: أنشئ حساب المدير العام.</p>
        <label>اسم الشركة<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
        <label>اسم المدير العام<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>اسم المستخدم<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label>كلمة المرور (8 أحرف على الأقل)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <label className="check">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>إضافة بيانات تجريبية (5 مشاريع و60 عاملاً وحضور 30 يوماً). حسابات التجربة تأخذ نفس كلمة المرور.</span>
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn primary big" disabled={busy}>{busy ? 'جارٍ الإعداد…' : 'إنشاء الحساب والبدء'}</button>
      </form>
    </div>
  )
}
