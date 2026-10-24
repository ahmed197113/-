import { useEffect, useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ALT_SERVER, DEFAULT_SERVER, getServer, isWebApp, normalizeServer } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, C, Chip, Field, T } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const [server, setServerUrl] = useState(DEFAULT_SERVER)
  const [editServer, setEditServer] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = getServer()
    if (saved) setServerUrl(saved)
  }, [])

  const submit = async () => {
    if (!username.trim() || !password) return setError('أدخل اسم المستخدم وكلمة المرور')
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
          <View style={s.logo}><Image source={require('../../assets/logo.png')} style={{ width: 84, height: 105 }} resizeMode="contain" /></View>
          <T w="black" style={s.title}>المشاريع</T>
          <T style={s.sub}>شركة الخطوط المعدنية للمقاولات العامة</T>

          <View style={s.card}>
            <Field label="اسم المستخدم" value={username} onChangeText={setUsername} ltr autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            <View style={{ gap: 6 }}>
              <T w="semibold" style={{ color: C.ink2 }}>كلمة المرور</T>
              <View>
                <Field value={password} onChangeText={setPassword} secureTextEntry={!show} ltr autoCapitalize="none" onSubmitEditing={submit} returnKeyType="go" style={{ paddingEnd: 52 }} />
                <Pressable onPress={() => setShow(!show)} style={s.eye} hitSlop={8} accessibilityLabel="إظهار كلمة المرور">
                  <Ionicons name={show ? 'eye-off' : 'eye'} size={24} color={C.muted} />
                </Pressable>
              </View>
            </View>
            {!!error && (
              <View style={s.error}>
                <Ionicons name="alert-circle" size={22} color={C.bad} />
                <T w="semibold" style={{ color: C.bad, flex: 1 }}>{error}</T>
              </View>
            )}
            <Button label="دخول" icon="log-in" busy={busy} onPress={submit} />

            {!isWebApp && <Pressable onPress={() => setEditServer(!editServer)} style={s.serverToggle}>
              <Ionicons name="server-outline" size={18} color={C.muted} />
              <T style={{ color: C.muted, fontSize: 14, flex: 1 }} numberOfLines={1}>الخادم: {normalizeServer(server).replace(/^https?:\/\//, '')}</T>
              <T w="bold" style={{ color: C.navy, fontSize: 14 }}>{editServer ? 'إخفاء' : 'تغيير'}</T>
            </Pressable>}
            {editServer && !isWebApp && (
              <View style={{ gap: 10 }}>
                <Field label="عنوان خادم الشركة" value={server} onChangeText={setServerUrl} keyboardType="url" ltr autoCapitalize="none" autoCorrect={false} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip label="الرئيسي" active={normalizeServer(server) === DEFAULT_SERVER} onPress={() => setServerUrl(DEFAULT_SERVER)} />
                  <Chip label="البديل" active={normalizeServer(server) === ALT_SERVER} onPress={() => setServerUrl(ALT_SERVER)} />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logo: { width: 112, height: 128, borderRadius: 24, backgroundColor: '#fff', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 36, color: '#fff', textAlign: 'center', marginTop: 14 },
  sub: { color: '#c9c4ea', textAlign: 'center', marginBottom: 24, fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 20, gap: 16 },
  eye: { position: 'absolute', end: 0, top: 0, bottom: 0, width: 52, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.badBg, padding: 12, borderRadius: 12 },
  serverToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, borderTopWidth: 1, borderColor: C.line, paddingTop: 8 },
})
