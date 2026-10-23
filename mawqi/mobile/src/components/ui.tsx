import { Text as RNText, View, StyleSheet, type TextProps, type ViewProps } from 'react-native'

export const C = {
  // هوية الخطوط المعدنية
  navy: '#1e1757',
  navy2: '#2a2178',
  navyDark: '#120c3a',
  amber: '#c0743f',
  sand: '#c8a78e',
  bg: '#f5f3f1',
  surface: '#ffffff',
  line: '#e6e0da',
  ink: '#19162b',
  ink2: '#4d475c',
  muted: '#6b6578',
  good: '#0ca30c',
  goodBg: '#e7f6e7',
  warn: '#b7791f',
  warnBg: '#fff4dc',
  bad: '#d03b3b',
  badBg: '#fdecec',
  blue: '#2a2178',
  leave: '#a3a29b',
  late: '#fab219',
}

const weights = { regular: 'Tajawal_400Regular', semibold: 'Tajawal_500Medium', bold: 'Tajawal_700Bold', black: 'Tajawal_800ExtraBold' }

export function T({ w = 'regular', style, ...p }: TextProps & { w?: keyof typeof weights }) {
  return <RNText {...p} style={[{ fontFamily: weights[w], color: C.ink, fontSize: 16, textAlign: 'left', writingDirection: 'rtl' }, style]} />
}

export function Card({ style, ...p }: ViewProps) {
  return <View {...p} style={[s.card, style]} />
}

export function Meter({ value, color = C.blue }: { value: number; color?: string }) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16 },
  track: { height: 8, backgroundColor: '#edf0f3', borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
})
