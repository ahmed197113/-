import { Text as RNText, View, StyleSheet, type TextProps, type ViewProps } from 'react-native'

export const C = {
  navy: '#0f2a44',
  navy2: '#173b5c',
  amber: '#f59e0b',
  bg: '#f4f6f8',
  surface: '#ffffff',
  line: '#e3e6ea',
  ink: '#1f2933',
  ink2: '#52606d',
  muted: '#7b8794',
  good: '#0ca30c',
  goodBg: '#e7f6e7',
  warn: '#b7791f',
  warnBg: '#fff4dc',
  bad: '#d03b3b',
  badBg: '#fdecec',
  blue: '#2a78d6',
  leave: '#a3a29b',
  late: '#fab219',
}

const weights = { regular: 'Cairo_400Regular', semibold: 'Cairo_600SemiBold', bold: 'Cairo_700Bold', black: 'Cairo_800ExtraBold' }

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
