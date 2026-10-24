import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Alert, Animated, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { C, T } from './ui'

type Kind = 'success' | 'error' | 'info'
const ToastContext = createContext<(msg: string, kind?: Kind) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const [msg, setMsg] = useState<{ text: string; kind: Kind } | null>(null)
  const anim = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((text: string, kind: Kind = 'success') => {
    clearTimeout(timer.current)
    setMsg({ text, kind })
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start()
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(() => setMsg(null))
    }, kind === 'error' ? 4500 : 2500)
  }, [anim])

  const color = msg?.kind === 'error' ? C.bad : msg?.kind === 'info' ? C.navy : C.good
  const icon = msg?.kind === 'error' ? 'alert-circle' : msg?.kind === 'info' ? 'information-circle' : 'checkmark-circle'
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <Animated.View pointerEvents="none" style={[s.wrap, { top: insets.top + 10, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
          <View style={[s.toast, { backgroundColor: color }]}>
            <Ionicons name={icon} size={24} color="#fff" />
            <T w="bold" style={{ color: '#fff', flex: 1, fontSize: 16 }}>{msg.text}</T>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

/** Asks before a destructive action. Alert buttons do not work in the web preview, so it falls back to confirm(). */
export function confirm(title: string, message: string, okLabel = 'حذف'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n${message}`) ?? false)
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'إلغاء', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 1000, elevation: 20 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
})
