import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DEFAULT_SERVER, getServer } from '../lib/api'
import { useAuth } from '../lib/auth'
import { C, T } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const [server, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setServerUrl(getServer() || DEFAULT_SERVER), [])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await login(server, username.trim(), password)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navyDark }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={s.logo}><Image source={require('../../assets/logo.png')} style={{ width: 70, height: 88 }} resizeMode="contain" /></View>
          <T w="black" style={s.title}>موقعي</T>
          <T style={s.sub}>شركة الخطوط المعدنية للمقاولات العامة{'\n'}نظام إدارة المواقع والعمالة</T>

          <View style={s.card}>
            <Field label="عنوان خادم الشركة" value={server} onChangeText={setServerUrl} keyboardType="url" ltr />
            <Field label="اسم المستخدم" value={username} onChangeText={setUsername} ltr />
            <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry ltr />
            {!!error && <T w="semibold" style={s.error}>{error}</T>}
            <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <T w="black" style={{ fontSize: 20, color: '#fff' }}>دخول</T>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Field({ label, ltr, ...p }: { label: string; ltr?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <T w="semibold" style={{ color: C.ink2 }}>{label}</T>
      <TextInput {...p} autoCapitalize="none" autoCorrect={false} style={[s.input, ltr && { textAlign: 'left', writingDirection: 'ltr' }]} placeholderTextColor={C.muted} />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20, alignItems: 'stretch' },
  logo: { width: 96, height: 112, borderRadius: 20, backgroundColor: '#fff', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 36, color: '#fff', textAlign: 'center', marginTop: 10 },
  sub: { color: '#b9b3dc', textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontFamily: 'Tajawal_400Regular', color: C.ink },
  error: { backgroundColor: C.badBg, color: C.bad, padding: 10, borderRadius: 10, textAlign: 'center' },
  btn: { backgroundColor: C.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
})
