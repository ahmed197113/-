import { useEffect } from 'react'
import { ActivityIndicator, I18nManager, Platform, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal'
import { AuthProvider, useAuth } from '../lib/auth'
import { SyncProvider } from '../lib/sync'
import { ToastProvider } from '../components/Toast'
import { C } from '../components/ui'

// Installed from the website: register the offline worker and pick up new releases by themselves.
if (Platform.OS === 'web' && typeof window !== 'undefined') setupWebApp()
function setupWebApp() {
  const head = document.head
  if (!head.querySelector('link[rel=manifest]')) {
    const add = (tag: string, attrs: Record<string, string>) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); head.appendChild(el) }
    add('link', { rel: 'manifest', href: '/m/manifest.webmanifest' })
    add('link', { rel: 'apple-touch-icon', href: '/m/icon-512.png' })
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' })
  }
  document.documentElement.dir = 'rtl'
  document.documentElement.lang = 'ar'
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/m/sw.js', { scope: '/m/' }).catch(() => undefined)
  // A new release is live when version.json changes: reload into it as soon as the app is opened again.
  let current = ''
  const check = async () => {
    try {
      const v = (await (await fetch(`/m/version.json?_=${Date.now()}`, { cache: 'no-store' })).json()).v as string
      if (!current) current = v
      else if (v && v !== current) window.location.reload()
    } catch { /* offline */ }
  }
  check()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  setInterval(check, 5 * 60_000)
}

// The native builds force RTL through the expo-localization plugin; this covers Expo Go.
I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

function Gate() {
  const { user, ready } = useAuth()

  if (!ready) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.navy }}><ActivityIndicator color="#fff" size="large" /></View>
  }
  // Screens are only mounted for the matching auth state, so nothing calls the server before login.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workers/index" />
        <Stack.Screen name="workers/[id]" />
        <Stack.Screen name="invoices" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="projects/[id]" />
        <Stack.Screen name="password" />
        <Stack.Screen name="r/[kind]" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, ...Ionicons.font })
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.dir = 'rtl'
  }, [])
  if (!fontsLoaded) return null
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ToastProvider>
        <AuthProvider>
          <Session />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  )
}

/** Sync (polling and the offline queue) runs only while someone is signed in. */
function Session() {
  const { user } = useAuth()
  return user ? <SyncProvider key={user.id}><Gate /></SyncProvider> : <Gate />
}
