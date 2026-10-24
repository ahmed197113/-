import { Tabs } from 'expo-router/js-tabs'
import type { ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useSync } from '../../lib/sync'
import { C, type IconName } from '../../components/ui'

const icon = (on: IconName, off: IconName) => ({ color, focused }: { color: ColorValue; focused: boolean }) =>
  <Ionicons name={focused ? on : off} size={27} color={color as string} />

export default function TabsLayout() {
  const { can } = useAuth()
  const { queue } = useSync()
  const insets = useSafeAreaInsets()
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.navy,
      tabBarInactiveTintColor: '#8d879a',
      tabBarLabelStyle: { fontFamily: 'Tajawal_700Bold', fontSize: 14 },
      tabBarStyle: { height: 66 + insets.bottom, paddingTop: 6, paddingBottom: 8 + insets.bottom, borderTopColor: C.line, backgroundColor: '#fff' },
      tabBarActiveBackgroundColor: '#fff',
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="attendance" options={{
        title: 'الحضور', tabBarIcon: icon('people', 'people-outline'), href: can('attendance') ? undefined : null,
        tabBarBadge: queue.length ? queue.length : undefined, tabBarBadgeStyle: { backgroundColor: C.amber, fontFamily: 'Tajawal_700Bold' },
      }} />
      <Tabs.Screen name="site" options={{ title: 'الموقع', tabBarIcon: icon('construct', 'construct-outline'), href: can('dailyReports') || can('issues') ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: 'المزيد', tabBarIcon: icon('grid', 'grid-outline') }} />
    </Tabs>
  )
}
