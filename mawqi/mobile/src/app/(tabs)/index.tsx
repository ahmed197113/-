import { useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fmt, longDate, sar, today, type Alert, type Dashboard, type ProjectRow } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useData, useSync } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { C, Card, Empty, ErrorBox, Header, Loading, Meter, Row, T, type IconName } from '../../components/ui'

const LEVEL = { high: C.bad, medium: C.late, low: C.navy2 }
const ALERT_ICON: Record<Alert['type'], IconName> = { understaffed: 'people', absence_streak: 'person-remove', overdue_issue: 'time', iqama_expiry: 'card' }

function greeting() {
  const h = new Date(Date.now() + 3 * 3600_000).getUTCHours()
  return h < 12 ? 'صباح الخير' : 'مساء الخير'
}

export default function Home() {
  const { user } = useAuth()
  const { online } = useSync()
  const { data, error, loading, refreshing, refresh } = useData<Dashboard>('/api/dashboard')

  return (
    <AppScreen inTabs onRefresh={refresh} refreshing={refreshing}
      header={
        <Header title={`${greeting()}، ${user?.name?.split(' ')[0] ?? ''}`} sub={`${user?.roleLabel ?? ''} · ${longDate(data?.date ?? today())}`}
          right={
            <View style={s.logo}><Image source={require('../../../assets/logo.png')} style={{ width: 30, height: 38 }} resizeMode="contain" /></View>
          } />
      }>
      {!data ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />) : <Content d={data} />}
      {!!data && !!error && online && <T style={{ color: C.bad, textAlign: 'center' }}>{error}</T>}
    </AppScreen>
  )
}

function Content({ d }: { d: Dashboard }) {
  const c = d.cards
  return (
    <>
      <View style={s.kpis}>
        <Kpi icon="checkmark-circle" label="الحاضرون" value={fmt(c.presentToday)} color={C.good} sub={`من ${fmt(c.totalWorkers)} عامل`} />
        <Kpi icon="close-circle" label="الغائبون" value={fmt(c.absentToday)} color={C.bad} sub={c.notRecorded ? `${fmt(c.notRecorded)} لم يُسجَّل` : `${fmt(c.onLeaveToday)} إجازة`} />
        <Kpi icon="warning" label="بلاغات مفتوحة" value={fmt(c.openIssues)} color={C.amber} />
        <Kpi icon="cash" label="تكلفة اليوم" value={fmt(c.costToday)} unit="ر.س" color={C.navy} />
      </View>
      <Alerts alerts={d.alerts} />
      <T w="black" style={s.h2}>المشاريع</T>
      {d.projects.length ? d.projects.map((p) => <ProjectCard key={p.id} p={p} />) : (
        <Card><Empty icon="business-outline" title="لا توجد مشاريع بعد" sub="ستظهر هنا المشاريع المسندة إليك" /></Card>
      )}
    </>
  )
}

function Kpi({ icon, label, value, unit, color, sub }: { icon: IconName; label: string; value: string; unit?: string; color: string; sub?: string }) {
  return (
    <Card style={s.kpi}>
      <Row>
        <Ionicons name={icon} size={22} color={color} />
        <T w="bold" style={{ color: C.ink2, fontSize: 16, flex: 1 }}>{label}</T>
      </Row>
      <T w="black" style={{ fontSize: 34, color, lineHeight: 44 }} adjustsFontSizeToFit numberOfLines={1}>
        {value}{unit ? <T w="bold" style={{ fontSize: 16, color }}> {unit}</T> : null}
      </T>
      {!!sub && <T style={{ color: C.muted, fontSize: 14 }}>{sub}</T>}
    </Card>
  )
}

function Alerts({ alerts }: { alerts: Alert[] }) {
  const [all, setAll] = useState(false)
  if (!alerts.length) {
    return (
      <Card style={[s.row, { backgroundColor: C.goodBg, borderColor: C.goodBg }]}>
        <Ionicons name="shield-checkmark" size={26} color={C.good} />
        <T w="bold" style={{ color: C.good, flex: 1 }}>لا توجد تنبيهات — كل شيء على ما يرام</T>
      </Card>
    )
  }
  const shown = all ? alerts : alerts.slice(0, 3)
  return (
    <Card style={{ gap: 10 }}>
      <Row>
        <Ionicons name="notifications" size={22} color={C.bad} />
        <T w="black" style={{ fontSize: 18, color: C.navy, flex: 1 }}>تنبيهات ({alerts.length})</T>
      </Row>
      {shown.map((a, i) => (
        <View key={i} style={[s.alert, { borderStartColor: LEVEL[a.level] }]}>
          <Ionicons name={ALERT_ICON[a.type]} size={20} color={LEVEL[a.level]} />
          <View style={{ flex: 1 }}>
            <T w="bold" style={{ fontSize: 16 }}>{a.title}</T>
            <T style={{ fontSize: 14, color: C.muted }} numberOfLines={2}>{a.detail}</T>
          </View>
        </View>
      ))}
      {alerts.length > 3 && (
        <Pressable onPress={() => setAll(!all)} style={s.more}>
          <T w="bold" style={{ color: C.navy }}>{all ? 'عرض أقل' : `عرض الكل (${alerts.length})`}</T>
        </Pressable>
      )}
    </Card>
  )
}

function ProjectCard({ p }: { p: ProjectRow }) {
  const planned = Math.max(1, p.planned_workers)
  const ratio = p.present / planned
  const short = ratio < 0.8
  return (
    <Card style={{ gap: 10 }}>
      <View>
        <T w="black" style={{ fontSize: 18, color: C.navy }}>{p.name}</T>
        {!!(p.city || p.supervisor) && <T style={{ fontSize: 14, color: C.muted }}>{[p.city, p.supervisor].filter(Boolean).join(' · ')}</T>}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="semibold" style={{ color: C.ink2 }}>الإنجاز</T>
        <T w="black" style={{ color: C.amber, fontSize: 18 }}>{fmt(p.progress)}%</T>
      </Row>
      <Meter value={p.progress / 100} color={C.amber} />
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="semibold" style={{ color: C.ink2 }}>الحضور اليوم</T>
        <T w="black" style={{ color: short ? C.bad : C.good, fontSize: 18 }}>{fmt(p.present)} / {fmt(p.planned_workers)}</T>
      </Row>
      <Meter value={ratio} color={short ? C.bad : C.good} />
      <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
        <T style={s.stat}>غائب <T w="bold" style={s.stat}>{fmt(p.absent)}</T></T>
        <T style={s.stat}>بلاغات <T w="bold" style={s.stat}>{fmt(p.open_issues)}</T></T>
        <T style={s.stat}>اليوم <T w="bold" style={s.stat}>{sar(p.cost_today)}</T></T>
      </Row>
    </Card>
  )
}

const s = StyleSheet.create({
  logo: { width: 46, height: 52, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { flexBasis: '46%', flexGrow: 1, gap: 4, padding: 14 },
  h2: { fontSize: 20, color: C.navy, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alert: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: C.line, borderStartWidth: 4, borderRadius: 12, padding: 10 },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 12, backgroundColor: C.navySoft },
  stat: { fontSize: 15, color: C.ink2 },
})
