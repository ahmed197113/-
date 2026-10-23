import { ActivityIndicator, I18nManager, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo'
import { AuthProvider, useAuth } from '../lib/auth'
import { C } from '../components/ui'

// The native builds force RTL through the expo-localization plugin; this covers Expo Go.
I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

function Gate() {
  const { user, ready } = useAuth()

  if (!ready) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.navy }}><ActivityIndicator color={C.amber} size="large" /></View>
  }
  // Screens are only mounted for the matching auth state, so nothing calls the server before login.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold })
  if (!fontsLoaded) return null
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
