import { router } from 'expo-router'
import { View } from 'react-native'
import Constants from 'expo-constants'
import { getServer } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useSync } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { confirm } from '../../components/Toast'
import { C, Card, Header, ListItem, T } from '../../components/ui'

export default function More() {
  const { user, can, logout } = useAuth()
  const { queue } = useSync()

  const signOut = async () => {
    const warn = queue.length ? `\nتنبيه: ${queue.length} عملية لم تُرسل بعد وستُحذف.` : ''
    if (await confirm('تسجيل الخروج', `هل تريد تسجيل الخروج؟${warn}`, 'خروج')) logout()
  }
  const changeServer = async () => {
    if (await confirm('تغيير عنوان الخادم', 'سيتم تسجيل خروجك لتدخل عنوان الخادم الجديد في شاشة الدخول.', 'متابعة')) logout()
  }

  return (
    <AppScreen inTabs header={<Header title="المزيد" sub={`${user?.name ?? ''} · ${user?.roleLabel ?? ''}`} />}>
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="people" title="العمال" sub="بحث وبطاقة العامل والإقامات" onPress={() => router.push('/workers')} />
        {can('invoices') && <Sep />}
        {can('invoices') && <ListItem icon="receipt" title="المستخلصات" sub="عرض المستخلصات وحالتها" color={C.amber} onPress={() => router.push('/invoices')} />}
        {can('directOrders') && <Sep />}
        {can('directOrders') && <ListItem icon="briefcase" title="الإسناد المباشر" sub="أوامر الإسناد ونسب التنفيذ" color={C.amber} onPress={() => router.push('/orders')} />}
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="key" title="تغيير كلمة المرور" onPress={() => router.push('/password')} />
        <Sep />
        <ListItem icon="server" title="عنوان الخادم" sub={getServer()} onPress={changeServer} />
        <Sep />
        <ListItem icon="log-out" title="تسجيل الخروج" color={C.bad} onPress={signOut} end={<View />} />
      </Card>
      <T style={{ color: C.muted, textAlign: 'center', fontSize: 14 }}>
        المشاريع · شركة الخطوط المعدنية للمقاولات العامة{'\n'}الإصدار {Constants.expoConfig?.version ?? ''}
      </T>
    </AppScreen>
  )
}

const Sep = () => <View style={{ height: 1, backgroundColor: C.line, marginStart: 62 }} />
