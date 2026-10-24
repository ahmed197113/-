import { useState } from 'react'
import { router } from 'expo-router'
import { api } from '../lib/api'
import { AppScreen } from '../components/AppScreen'
import { useToast } from '../components/Toast'
import { Button, C, Card, Field, Header, T } from '../components/ui'

export default function Password() {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (next.length < 6) return toast('كلمة المرور الجديدة 6 أحرف على الأقل', 'error')
    if (next !== again) return toast('كلمتا المرور غير متطابقتين', 'error')
    setBusy(true)
    try {
      await api('/api/me/password', { method: 'PUT', body: JSON.stringify({ current, next }) })
      toast('تم تغيير كلمة المرور')
      router.back()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppScreen header={<Header title="تغيير كلمة المرور" onBack={() => router.back()} />}>
      <Card style={{ gap: 14 }}>
        <Field label="كلمة المرور الحالية" value={current} onChangeText={setCurrent} secureTextEntry ltr autoCapitalize="none" />
        <Field label="كلمة المرور الجديدة" value={next} onChangeText={setNext} secureTextEntry ltr autoCapitalize="none" />
        <Field label="تأكيد كلمة المرور الجديدة" value={again} onChangeText={setAgain} secureTextEntry ltr autoCapitalize="none" />
        <T style={{ color: C.muted, fontSize: 14 }}>6 أحرف على الأقل</T>
        <Button label="حفظ" icon="checkmark" busy={busy} onPress={submit} />
      </Card>
    </AppScreen>
  )
}
