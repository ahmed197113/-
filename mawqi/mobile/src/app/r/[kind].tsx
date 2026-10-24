import { useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { fileUrl, fmt, sar, today, type Meta } from '../../lib/api'
import { useData } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { useToast } from '../../components/Toast'
import { Button, C, Card, Chip, Empty, ErrorBox, Field, Header, Loading, Row, Search, Sheet, T } from '../../components/ui'

export interface ReportDef { group: string; kind: string; title: string; text: string; filters: string[]; options?: Record<string, { value: string; label: string }[]> }
export interface Catalog { reports: ReportDef[]; professions: string[] }
interface Col { key: string; label: string; type: string; sum?: boolean; strong?: boolean; tone?: boolean }
interface Result { columns: Col[]; rows: Record<string, string | number | null>[]; cards: { label: string; value: number; type: string; tone?: string }[]; note: string | null }

const OPT: Record<string, string> = { status: 'الحالة', kind: 'النوع', severity: 'الخطورة' }
const add = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
function periods() {
  const t = today(); const m = t.slice(0, 7)
  const p = new Date(`${m}-01T12:00:00Z`); p.setUTCMonth(p.getUTCMonth() - 1)
  return [
    { key: 'today', label: 'اليوم', from: t, to: t },
    { key: 'week', label: 'آخر 7 أيام', from: add(t, -6), to: t },
    { key: 'month', label: 'هذا الشهر', from: `${m}-01`, to: t },
    { key: 'prev', label: 'الشهر الماضي', from: `${p.toISOString().slice(0, 7)}-01`, to: add(`${m}-01`, -1) },
    { key: 'q', label: 'آخر 3 أشهر', from: add(t, -89), to: t },
    { key: 'year', label: 'هذه السنة', from: `${t.slice(0, 4)}-01-01`, to: t },
  ]
}
const val = (c: { type: string }, v: unknown) => {
  if (v === null || v === undefined || v === '') return '—'
  if (c.type === 'm') return sar(Number(v))
  if (c.type === 'n') return fmt(Number(v))
  if (c.type === 'p') return `${fmt(Number(v))}%`
  return String(v)
}
const toneColor = (c: Col, v: unknown) => (c.tone && typeof v === 'number' ? (v < 0 ? C.bad : v > 0 ? C.good : C.ink) : c.strong ? C.navy : C.ink)

/** Any report from the library, with filters for period, site, profession, status and search. */
export default function ReportScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>()
  const toast = useToast()
  const cat = useData<Catalog>('/api/r')
  const meta = useData<Meta>('/api/meta')
  const def = cat.data?.reports.find((r) => r.kind === kind)
  const P = useMemo(periods, [])
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState(P[2].from)
  const [to, setTo] = useState(P[2].to)
  const [custom, setCustom] = useState(false)
  const [cf, setCf] = useState({ from: P[2].from, to: P[2].to })
  const [project, setProject] = useState<number | null>(null)
  const [profession, setProfession] = useState('')
  const [opt, setOpt] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const has = (f: string) => !!def?.filters.includes(f)
  const params = new URLSearchParams()
  if (has('range')) { params.set('from', from); params.set('to', to) }
  if (project) params.set('project', String(project))
  if (profession) params.set('profession', profession)
  for (const [k, v] of Object.entries(opt)) if (v) params.set(k, v)
  const qs = params.toString()
  const r = useData<Result>(kind ? `/api/r/${kind}?${qs}` : null)

  const rows = useMemo(() => {
    const t = q.trim()
    const list = r.data?.rows ?? []
    return t ? list.filter((row) => Object.values(row).some((v) => String(v ?? '').includes(t))) : list
  }, [r.data, q])
  const totals = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of r.data?.columns ?? []) if (c.sum) out[c.key] = Math.round(rows.reduce((s, row) => s + (Number(row[c.key]) || 0), 0) * 100) / 100
    return out
  }, [rows, r.data])

  const places = meta.data?.projects ?? []
  const active = [project && 'موقع', profession && 'مهنة', ...Object.values(opt).filter(Boolean)].filter(Boolean).length
  const excel = async () => {
    try { await Linking.openURL(fileUrl(`/api/r/${kind}?${qs}${q ? `&q=${encodeURIComponent(q)}` : ''}&format=csv`)) } catch { toast('تعذر فتح الملف', 'error') }
  }

  const cols = r.data?.columns ?? []
  const [title, ...rest] = cols

  return (
    <AppScreen onRefresh={r.refresh} refreshing={r.refreshing}
      header={<Header title={def?.title ?? 'تقرير'} sub={def?.text} onBack={() => router.back()}
        right={<Pressable onPress={excel} hitSlop={10} accessibilityLabel="تصدير Excel"><Ionicons name="download-outline" size={26} color="#fff" /></Pressable>} />}>
      {!cat.data ? (cat.loading ? <Loading /> : <ErrorBox text={cat.error ?? ''} onRetry={cat.refresh} />) : !def ? <Empty icon="lock-closed-outline" title="التقرير غير متاح" /> : (
        <>
          {has('range') && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {P.map((p) => <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => { setPeriod(p.key); setFrom(p.from); setTo(p.to) }} />)}
              <Chip label={period === 'custom' ? `${from} ← ${to}` : 'فترة مخصصة'} active={period === 'custom'} onPress={() => { setCf({ from, to }); setCustom(true) }} />
            </ScrollView>
          )}
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}><Search value={q} onChangeText={setQ} placeholder="بحث داخل التقرير" /></View>
            {(has('project') || has('profession') || !!def.options) && (
              <Pressable onPress={() => setShowFilters(true)} style={[s.filterBtn, active > 0 && { backgroundColor: C.navy }]} accessibilityLabel="الفلاتر">
                <Ionicons name="options-outline" size={22} color={active ? '#fff' : C.navy} />
                <T w="bold" style={{ color: active ? '#fff' : C.navy }}>فلتر{active ? ` (${active})` : ''}</T>
              </Pressable>
            )}
          </Row>

          {!r.data ? (r.loading ? <Loading /> : <ErrorBox text={r.error ?? ''} onRetry={r.refresh} />) : (
            <>
              {r.data.cards.length > 0 && (
                <View style={s.cards}>
                  {r.data.cards.map((c) => (
                    <View key={c.label} style={s.card}>
                      <T style={{ color: C.muted, fontSize: 13 }}>{c.label}</T>
                      <T w="black" style={{ fontSize: 19, color: c.tone === 'bad' ? C.bad : c.tone === 'good' ? C.good : C.navy }}>{val(c, c.value)}</T>
                    </View>
                  ))}
                </View>
              )}
              {!!r.data.note && <T style={{ color: C.muted, fontSize: 13 }}>{r.data.note}</T>}
              {rows.length === 0 ? <Empty icon="document-text-outline" title="لا توجد بيانات" sub="جرّب فترة أخرى أو غيّر الفلتر" /> : (
                <>
                  <T style={{ color: C.muted, fontSize: 13 }}>{fmt(rows.length)} سطر</T>
                  {rows.slice(0, 300).map((row, i) => (
                    <Card key={i} style={{ gap: 4, padding: 12 }}>
                      <T w="black" style={{ fontSize: 16, color: C.navy }}>{val(title, row[title.key])}</T>
                      {rest.map((c) => (row[c.key] === null || row[c.key] === '' ? null : (
                        <Row key={c.key} style={{ alignItems: 'flex-start' }}>
                          <T style={{ color: C.muted, fontSize: 14, minWidth: 110 }}>{c.label}</T>
                          <T w={c.strong ? 'black' : 'semibold'} style={{ flex: 1, fontSize: 14, color: toneColor(c, row[c.key]) }}>{val(c, row[c.key])}</T>
                        </Row>
                      )))}
                    </Card>
                  ))}
                  {rows.length > 300 && <T style={{ color: C.muted, textAlign: 'center' }}>يُعرض أول 300 سطر — صدّر Excel لرؤية الكل</T>}
                  {Object.keys(totals).length > 0 && (
                    <Card style={{ gap: 4, borderColor: C.navy, borderWidth: 2 }}>
                      <T w="black" style={{ fontSize: 16, color: C.navy }}>الإجمالي</T>
                      {cols.filter((c) => c.sum).map((c) => (
                        <Row key={c.key}><T style={{ color: C.muted, fontSize: 14, minWidth: 110 }}>{c.label}</T><T w="black" style={{ flex: 1, fontSize: 15, color: toneColor(c, totals[c.key]) }}>{val(c, totals[c.key])}</T></Row>
                      ))}
                    </Card>
                  )}
                </>
              )}
              <Button label="تصدير Excel" icon="download-outline" kind="ghost" onPress={excel} />
            </>
          )}

          <Sheet visible={custom} title="فترة مخصصة" onClose={() => setCustom(false)}>
            <Field label="من تاريخ" value={cf.from} onChangeText={(v) => setCf((x) => ({ ...x, from: v }))} placeholder="2026-01-01" ltr />
            <Field label="إلى تاريخ" value={cf.to} onChangeText={(v) => setCf((x) => ({ ...x, to: v }))} placeholder="2026-12-31" ltr />
            <Button label="تطبيق" icon="checkmark" kind="accent" onPress={() => {
              const ok = /^\d{4}-\d{2}-\d{2}$/
              if (!ok.test(cf.from) || !ok.test(cf.to)) return toast('اكتب التاريخ بالشكل 2026-10-01', 'error')
              setFrom(cf.from <= cf.to ? cf.from : cf.to); setTo(cf.from <= cf.to ? cf.to : cf.from); setPeriod('custom'); setCustom(false)
            }} />
          </Sheet>

          <Sheet visible={showFilters} title="الفلاتر" onClose={() => setShowFilters(false)}>
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
              {has('project') && (
                <>
                  <T w="bold">الموقع</T>
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Chip label="الكل" active={!project} onPress={() => setProject(null)} />
                    {places.map((p) => <Chip key={p.id} label={`${p.kind === 'factory' ? '🏭 ' : p.kind === 'office' ? '🏢 ' : ''}${p.name}`} active={project === p.id} onPress={() => setProject(p.id)} />)}
                  </Row>
                </>
              )}
              {has('profession') && !!cat.data.professions.length && (
                <>
                  <T w="bold">المهنة</T>
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Chip label="الكل" active={!profession} onPress={() => setProfession('')} />
                    {cat.data.professions.map((p) => <Chip key={p} label={p} active={profession === p} onPress={() => setProfession(p)} />)}
                  </Row>
                </>
              )}
              {Object.entries(def.options ?? {}).map(([k, list]) => (
                <View key={k} style={{ gap: 8 }}>
                  <T w="bold">{OPT[k] ?? k}</T>
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Chip label="الكل" active={!opt[k]} onPress={() => setOpt((o) => ({ ...o, [k]: '' }))} />
                    {list.map((o) => <Chip key={o.value} label={o.label} active={opt[k] === o.value} onPress={() => setOpt((x) => ({ ...x, [k]: o.value }))} />)}
                  </Row>
                </View>
              ))}
            </ScrollView>
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="تم" icon="checkmark" kind="accent" onPress={() => setShowFilters(false)} /></View>
              {active > 0 && <View style={{ flex: 1 }}><Button label="مسح الفلاتر" icon="close" kind="ghost" onPress={() => { setProject(null); setProfession(''); setOpt({}) }} /></View>}
            </Row>
          </Sheet>
        </>
      )}
    </AppScreen>
  )
}

const s = StyleSheet.create({
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.navy, backgroundColor: '#fff' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, gap: 2 },
})
