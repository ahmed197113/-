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
