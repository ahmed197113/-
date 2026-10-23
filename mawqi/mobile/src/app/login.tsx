import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getServer } from '../lib/api'
import { useAuth } from '../lib/auth'
import { C, T } from '../components/ui'

const DEMO = [['admin', 'مدير عام'], ['pm1', 'مدير مشروع'], ['sup1', 'مشرف موقع'], ['acc1', 'محاسب']]

export default function Login() {
  const { login } = useAuth()
  const [server, setServerUrl] = useState('')
  const [username, setUsername] = useState('sup1')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setServerUrl(getServer() || 'http://192.168.1.10:4000'), [])

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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={s.logo}><T w="black" style={{ fontSize: 34, color: C.navy }}>م</T></View>
          <T w="black" style={s.title}>موقعي</T>
          <T style={s.sub}>إدارة مواقع المشاريع والعمالة</T>

          <View style={s.card}>
            <Field label="عنوان خادم الشركة" value={server} onChangeText={setServerUrl} keyboardType="url" ltr />
            <Field label="اسم المستخدم" value={username} onChangeText={setUsername} ltr />
            <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry ltr />
            {!!error && <T w="semibold" style={s.error}>{error}</T>}
            <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color={C.navy} /> : <T w="black" style={{ fontSize: 20, color: C.navy }}>دخول</T>}
            </Pressable>
            <T style={s.demoLabel}>حسابات تجريبية (كلمة المرور 123456)</T>
            <View style={s.chips}>
              {DEMO.map(([u, l]) => (
                <Pressable key={u} onPress={() => { setUsername(u); setPassword('123456') }} style={[s.chip, username === u && s.chipOn]}>
                  <T w="semibold" style={{ fontSize: 14, color: username === u ? '#fff' : C.ink2 }}>{l}</T>
                </Pressable>
              ))}
            </View>
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
  logo: { width: 72, height: 72, borderRadius: 18, backgroundColor: C.amber, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 36, color: '#fff', textAlign: 'center', marginTop: 10 },
  sub: { color: '#9fb3c8', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontFamily: 'Cairo_400Regular', color: C.ink },
  error: { backgroundColor: C.badBg, color: C.bad, padding: 10, borderRadius: 10, textAlign: 'center' },
  btn: { backgroundColor: C.amber, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  demoLabel: { fontSize: 13, color: C.muted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
})
