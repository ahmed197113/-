import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { fmt, longDate, sar, shortDate, today, type AttStatus, type Report } from '../../lib/api'
import type { MediaFile } from '../../lib/media'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { AddMedia, MediaGrid, MediaStrip } from '../../components/Media'
import { Badge, C, Card, Empty, ErrorBox, Header, Loading, Meter, Row, T } from '../../components/ui'

interface Detail {
  id: number; name: string; city: string | null; client: string | null; start_date: string; end_date: string; progress: number; status: string
  planned_workers: number; assigned: number; present: number; open_issues: number; cost_month: number; cost_total: number; contract_value: number
  manager: string | null; supervisor: string | null; invoiced: number; last_report: string | null
  workers: { id: number; name: string; profession: string; today: AttStatus | null }[]
  issues: { id: number; title: string; severity: string; status: string; due_at: string | null }[]
  series: { date: string; present: number; absent: number }[]
  gallery: MediaFile[]; documents: MediaFile[]
}

const ATT: Record<AttStatus, { label: string; color: string; bg: string }> = {
  present: { label: 'حاضر', color: C.good, bg: C.goodBg }, late: { label: 'متأخر', color: '#8a5a00', bg: C.lateBg },
  overtime: { label: 'إضافي', color: C.over, bg: C.overBg }, absent: { label: 'غائب', color: C.bad, bg: C.badBg }, leave: { label: 'إجازة', color: C.leave, bg: C.leaveBg },
}
const SEV: Record<string, string> = { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }
const days = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 864e5)

/** Everything about one project on one screen: where it stands, its people, photos, issues and reports. */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { can } = useAuth()
  const { data: p, error, loading, refreshing, refresh } = useData<Detail>(`/api/projects/${id}`)
  const reports = useData<Report[]>(`/api/daily-reports?project=${id}`)
  const [tab, setTab] = useState<'photos' | 'workers' | 'issues' | 'reports'>('photos')

  if (!p) {
    return <AppScreen header={<Header title="المشروع" onBack={() => router.back()} />}>{loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />}</AppScreen>
  }
  const total = Math.max(1, days(p.start_date, p.end_date))
  const used = Math.max(0, Math.min(100, (days(p.start_date, today()) / total) * 100))
  const gap = used - p.progress
  const remaining = days(today(), p.end_date)
  const verdict = gap > 15 ? { text: `متأخر عن الجدول: أُنجز ${fmt(p.progress)}% بينما انقضى ${Math.round(used)}% من المدة`, color: C.bad, bg: C.badBg }
    : gap < -5 ? { text: `متقدم على الجدول: أُنجز ${fmt(p.progress)}% مقابل ${Math.round(used)}% من المدة`, color: C.good, bg: C.goodBg }
    : { text: `يسير حسب الجدول: أُنجز ${fmt(p.progress)}% وانقضى ${Math.round(used)}% من المدة`, color: C.good, bg: C.goodBg }
  const present = p.workers.filter((w) => w.today && ['present', 'late', 'overtime'].includes(w.today)).length

  return (
    <AppScreen onRefresh={() => { refresh(); reports.refresh() }} refreshing={refreshing} header={<Header title={p.name} sub={[p.city, p.client].filter(Boolean).join(' · ') || undefined} onBack={() => router.back()} />}>
      <View style={[s.verdict, { backgroundColor: verdict.bg }]}>
        <Ionicons name={gap > 15 ? 'alert-circle' : 'checkmark-circle'} size={24} color={verdict.color} />
        <T w="bold" style={{ color: verdict.color, flex: 1 }}>{verdict.text}</T>
      </View>

      <Card style={{ gap: 10 }}>
        <Row><T w="semibold" style={{ flex: 1, color: C.ink2 }}>الإنجاز</T><T w="black" style={{ color: C.amber, fontSize: 20 }}>{fmt(p.progress)}%</T></Row>
        <Meter value={p.progress / 100} color={C.amber} />
        <Row><T w="semibold" style={{ flex: 1, color: C.ink2 }}>المدة المنقضية</T><T w="black" style={{ fontSize: 18 }}>{Math.round(used)}%</T></Row>
        <Meter value={used / 100} color={gap > 15 ? C.late : C.navy} />
        <T style={{ color: C.muted, fontSize: 14 }}>
          {shortDate(p.start_date)} ← {shortDate(p.end_date)} · {remaining >= 0 ? `متبقٍ ${fmt(remaining)} يوماً` : `متأخر ${fmt(-remaining)} يوماً عن التسليم`}
        </T>
      </Card>

      <View style={s.kpis}>
        <Box label="الحضور اليوم" value={`${fmt(present)} / ${fmt(p.planned_workers)}`} color={present < p.planned_workers * 0.8 ? C.bad : C.good} />
        <Box label="بلاغات مفتوحة" value={fmt(p.open_issues)} color={p.open_issues ? C.amber : C.good} />
        {p.cost_month !== undefined && <Box label="عمالة الشهر" value={sar(p.cost_month)} color={C.navy} />}
        <Box label="المستخلصات المعتمدة" value={sar(p.invoiced)} color={C.good} />
      </View>

      {!!(p.manager || p.supervisor) && (
        <Card style={{ gap: 6 }}>
          {!!p.manager && <T><T w="bold">مديرو المشروع: </T>{p.manager}</T>}
          {!!p.supervisor && <T><T w="bold">المشرفون: </T>{p.supervisor}</T>}
        </Card>
      )}

      <Row style={s.tabs}>
        {([['photos', `الصور (${p.gallery.length})`], ['workers', `العمال (${p.workers.length})`], ['issues', `البلاغات (${p.issues.length})`], ['reports', 'التقارير']] as const).map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <T w="bold" style={{ color: tab === k ? C.navy : C.muted, fontSize: 13, textAlign: 'center' }}>{l}</T>
          </Pressable>
        ))}
      </Row>

      {tab === 'photos' && (
        <Card style={{ gap: 12 }}>
          {(can('projects') || can('dailyReports')) && <AddMedia entity="project" id={p.id} label="صوّر الموقع أو ارفع من المعرض — تظهر هنا أيضاً صور التقارير والبلاغات" />}
          {p.gallery.length ? <MediaGrid files={p.gallery} /> : <Empty icon="images-outline" title="لا توجد صور بعد" />}
          {p.documents.length > 0 && (
            <>
              <T w="black" style={{ color: C.navy }}>العقود والمستندات</T>
              <MediaStrip files={p.documents} size={76} />
            </>
          )}
        </Card>
      )}

      {tab === 'workers' && (p.workers.length ? p.workers.map((w) => {
        const st = w.today ? ATT[w.today] : null
        return (
          <Pressable key={w.id} onPress={() => router.push(`/workers/${w.id}`)}>
            <Card style={s.row}>
              <View style={s.avatar}><T w="black" style={{ color: C.navy }}>{w.name.trim()[0]}</T></View>
              <View style={{ flex: 1 }}><T w="bold">{w.name}</T><T style={{ color: C.muted, fontSize: 14 }}>{w.profession}</T></View>
              {st ? <Badge label={st.label} color={st.color} bg={st.bg} /> : <Badge label="لم يُسجل" color={C.ink2} bg={C.leaveBg} />}
            </Card>
          </Pressable>
        )
      }) : <Empty icon="people-outline" title="لا يوجد عمال على المشروع" sub="انقل العمال إليه من قائمة العمال" />)}

      {tab === 'issues' && (p.issues.length ? p.issues.map((i) => (
        <Card key={i.id} style={{ gap: 4 }}>
          <Row><T w="bold" style={{ flex: 1 }}>{i.title}</T><Badge label={SEV[i.severity] ?? i.severity} color={i.severity === 'critical' || i.severity === 'high' ? C.bad : '#8a5a00'} bg={i.severity === 'critical' || i.severity === 'high' ? C.badBg : C.lateBg} /></Row>
          {!!i.due_at && <T style={{ color: C.muted, fontSize: 14 }}>المهلة {shortDate(i.due_at.slice(0, 10))}</T>}
        </Card>
      )) : <Empty icon="happy-outline" title="لا توجد بلاغات مفتوحة" />)}

      {tab === 'reports' && (!reports.data ? <Loading /> : reports.data.length ? reports.data.slice(0, 15).map((r) => (
        <Card key={r.id} style={{ gap: 6 }}>
          <Row><T w="black" style={{ flex: 1, color: C.navy }}>{longDate(r.date)}</T>{r.progress !== null && <Badge label={`${r.progress}%`} color={C.amber} bg={C.amberSoft} />}</Row>
          <T style={{ color: C.ink2 }}>{r.work_done}</T>
          {!!r.obstacles && <T style={{ color: '#8a5a00' }}>العوائق: {r.obstacles}</T>}
          {!!r.media?.length && <MediaStrip files={r.media} size={74} />}
          <T style={{ color: C.muted, fontSize: 13 }}>{r.author ?? ''} · حاضر {r.present} · غائب {r.absent}</T>
        </Card>
      )) : <Empty icon="document-text-outline" title="لا توجد تقارير يومية بعد" />)}
    </AppScreen>
  )
}

function Box({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={s.kpi}>
      <T style={{ color: C.ink2, fontSize: 14 }}>{label}</T>
      <T w="black" style={{ color, fontSize: 20 }} adjustsFontSizeToFit numberOfLines={1}>{value}</T>
    </Card>
  )
}

const s = StyleSheet.create({
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexBasis: '46%', flexGrow: 1, padding: 14, gap: 2 },
  tabs: { backgroundColor: '#ebe7e2', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabOn: { backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.navySoft, alignItems: 'center', justifyContent: 'center' },
})
