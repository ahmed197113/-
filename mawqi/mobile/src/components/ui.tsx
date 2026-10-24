import type { ReactNode } from 'react'
import {
  ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  KeyboardAvoidingView, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type ViewProps, type ViewStyle,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

export const C = {
  // هوية الخطوط المعدنية
  navy: '#1e1757',
  navy2: '#2a2178',
  navyDark: '#120c3a',
  navySoft: '#ebe9f6',
  amber: '#c0743f',
  amberSoft: '#f7ece3',
  bg: '#f5f3f1',
  surface: '#ffffff',
  line: '#e6e0da',
  ink: '#19162b',
  ink2: '#4d475c',
  muted: '#6b6578',
  good: '#0ca30c',
  goodBg: '#e7f6e7',
  late: '#f2a516',
  lateBg: '#fef5e2',
  bad: '#d03b3b',
  badBg: '#fdecec',
  over: '#2f6fd6',
  overBg: '#e8f0fc',
  leave: '#7d7a72',
  leaveBg: '#efeeeb',
}
export type IconName = keyof typeof Ionicons.glyphMap

const weights = { regular: 'Tajawal_400Regular', semibold: 'Tajawal_500Medium', bold: 'Tajawal_700Bold', black: 'Tajawal_800ExtraBold' }
// Native RTL mirrors 'left' to the start (right) side; the web preview needs it spelled out.
const START = Platform.OS === 'web' ? 'right' : 'left'

export function T({ w = 'regular', style, ...p }: TextProps & { w?: keyof typeof weights }) {
  return <RNText {...p} style={[{ fontFamily: weights[w], color: C.ink, fontSize: 16, textAlign: START, writingDirection: 'rtl' }, style]} />
}

export function Card({ style, ...p }: ViewProps) {
  return <View {...p} style={[s.card, style]} />
}

export function Meter({ value, color = C.navy }: { value: number; color?: string }) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.max(0, Math.min(1, value || 0)) * 100}%`, backgroundColor: color }]} />
    </View>
  )
}

export function Button({ label, icon, onPress, kind = 'primary', busy, disabled, style }: {
  label: string; icon?: IconName; onPress: () => void; kind?: 'primary' | 'accent' | 'ghost' | 'danger'; busy?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>
}) {
  const bg = { primary: C.navy, accent: C.amber, ghost: C.navySoft, danger: C.badBg }[kind]
  const fg = { primary: '#fff', accent: '#fff', ghost: C.navy, danger: C.bad }[kind]
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={22} color={fg} />}
          <T w="bold" style={{ color: fg, fontSize: 17 }}>{label}</T>
        </>
      )}
    </Pressable>
  )
}

export function Chip({ label, active, onPress, color = C.navy }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}
      style={[s.chip, active ? { backgroundColor: color, borderColor: color } : null]}>
      <T w={active ? 'bold' : 'semibold'} style={{ color: active ? '#fff' : C.ink2, fontSize: 16 }}>{label}</T>
    </Pressable>
  )
}

/** A wrapping row of chips to pick one option. */
export function Picker<V extends string | number>({ value, options, onChange, color }: {
  value: V | null; options: { value: V; label: string }[]; onChange: (v: V) => void; color?: (v: V) => string
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => <Chip key={String(o.value)} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} color={color?.(o.value)} />)}
    </View>
  )
}

export function Field({ label, ltr, style, ...p }: { label?: string; ltr?: boolean } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      {!!label && <T w="semibold" style={{ color: C.ink2 }}>{label}</T>}
      <TextInput placeholderTextColor={C.muted} {...p}
        style={[s.input, p.multiline && { minHeight: 96, textAlignVertical: 'top' }, ltr ? { textAlign: 'left', writingDirection: 'ltr' } : { textAlign: START }, style]} />
    </View>
  )
}

export function Search(p: TextInputProps) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={22} color={C.muted} />
      <TextInput placeholderTextColor={C.muted} {...p} style={[s.searchInput, { textAlign: START }]} />
      {!!p.value && <Pressable hitSlop={12} onPress={() => p.onChangeText?.('')}><Ionicons name="close-circle" size={22} color={C.muted} /></Pressable>}
    </View>
  )
}

export function Empty({ icon = 'leaf-outline', title, sub }: { icon?: IconName; title: string; sub?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={38} color={C.amber} /></View>
      <T w="bold" style={{ fontSize: 18, textAlign: 'center', color: C.navy }}>{title}</T>
      {!!sub && <T style={{ color: C.muted, textAlign: 'center' }}>{sub}</T>}
    </View>
  )
}

export function Loading({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={C.navy} size="large" />
      <T style={{ color: C.muted, textAlign: 'center' }}>{label}</T>
    </View>
  )
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={s.errorBox}>
      <Ionicons name="cloud-offline-outline" size={36} color={C.bad} />
      <T w="semibold" style={{ color: C.bad, textAlign: 'center' }}>{text}</T>
      {onRetry && <Button label="إعادة المحاولة" icon="refresh" kind="ghost" onPress={onRetry} />}
    </View>
  )
}

/** Navy page header with an optional back button and a slot on the end. */
export function Header({ title, sub, onBack, right }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={s.header}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} style={s.back} accessibilityRole="button" accessibilityLabel="رجوع">
          {/* In RTL "back" points to the right. */}
          <Ionicons name="arrow-forward" size={26} color="#fff" />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <T w="black" style={{ color: '#fff', fontSize: 22 }} numberOfLines={1}>{title}</T>
        {!!sub && <T style={{ color: '#c9c4ea', fontSize: 14 }} numberOfLines={1}>{sub}</T>}
      </View>
      {right}
    </View>
  )
}

export function Screen({ header, children, onRefresh, refreshing = false, footer, scroll = true, banner, inTabs }: {
  header: ReactNode; children: ReactNode; onRefresh?: () => void; refreshing?: boolean; footer?: ReactNode; scroll?: boolean; banner?: ReactNode; inTabs?: boolean
}) {
  // The tab bar already keeps clear of the system bar; stand-alone pages do it themselves.
  const insets = useSafeAreaInsets()
  const footerInset = inTabs ? 0 : insets.bottom
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }} edges={['top']}>
      {header}
      {banner}
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={[s.body, { paddingBottom: (footer ? 110 : 32) }]} keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.navy]} tintColor={C.navy} /> : undefined}>
            {children}
          </ScrollView>
        ) : children}
        {footer && <View style={[s.footer, { paddingBottom: 12 + footerInset }]}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** A bottom sheet for short forms (new issue, close issue). */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={s.sheetHead}>
            <T w="black" style={{ fontSize: 20, color: C.navy, flex: 1 }}>{title}</T>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="إغلاق" style={s.close}><Ionicons name="close" size={26} color={C.ink2} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export function Row({ style, ...p }: ViewProps) {
  return <View {...p} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]} />
}

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <View style={[s.badge, { backgroundColor: bg }]}><T w="bold" style={{ color, fontSize: 14 }}>{label}</T></View>
}

export function ListItem({ icon, title, sub, onPress, color = C.navy, end, ...p }: {
  icon: IconName; title: string; sub?: string; color?: string; end?: ReactNode
} & PressableProps) {
  return (
    <Pressable onPress={onPress} {...p} style={({ pressed }) => [s.item, pressed && { backgroundColor: '#faf8f6' }]} accessibilityRole="button">
      <View style={[s.itemIcon, { backgroundColor: color + '18' }]}><Ionicons name={icon} size={24} color={color} /></View>
      <View style={{ flex: 1 }}>
        <T w="bold" style={{ fontSize: 17 }}>{title}</T>
        {!!sub && <T style={{ color: C.muted, fontSize: 14 }} numberOfLines={1}>{sub}</T>}
      </View>
      {end ?? <Ionicons name="chevron-back" size={22} color={C.muted} />}
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16 },
  track: { height: 10, backgroundColor: '#ece8e4', borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
  btn: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontFamily: 'Tajawal_400Regular', color: C.ink, backgroundColor: '#fff' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#fff' },
  searchInput: { flex: 1, fontSize: 17, fontFamily: 'Tajawal_400Regular', color: C.ink, paddingVertical: 10 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.amberSoft, alignItems: 'center', justifyContent: 'center' },
  errorBox: { alignItems: 'center', gap: 12, padding: 20, backgroundColor: C.badBg, borderRadius: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, backgroundColor: C.navy },
  back: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)' },
  body: { padding: 16, gap: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(245,243,241,.97)', borderTopWidth: 1, borderColor: C.line },
  backdrop: { flex: 1, backgroundColor: 'rgba(18,12,58,.45)' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, minHeight: 64 },
  itemIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
