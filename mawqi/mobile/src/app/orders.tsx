import { router } from 'expo-router'
import { fmt, sar, shortDate, type DirectOrder } from '../lib/api'
import { useData } from '../lib/sync'
import { AppScreen } from '../components/AppScreen'
import { Badge, C, Card, Empty, ErrorBox, Header, Loading, Meter, Row, T } from '../components/ui'

const STATUS: Record<DirectOrder['status'], { label: string; color: string; bg: string }> = {
  open: { label: 'مفتوح', color: C.over, bg: C.overBg },
  in_progress: { label: 'قيد التنفيذ', color: '#8a5a00', bg: C.lateBg },
  done: { label: 'منجز', color: C.good, bg: C.goodBg },
  cancelled: { label: 'ملغي', color: C.ink2, bg: C.leaveBg },
}

export default function Orders() {
  const { data, error, loading, refreshing, refresh } = useData<DirectOrder[]>('/api/direct-orders')
  return (
    <AppScreen onRefresh={refresh} refreshing={refreshing} header={<Header title="الإسناد المباشر" sub="عرض فقط" onBack={() => router.back()} />}>
      {!data ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />) : !data.length ? (
        <Empty icon="briefcase-outline" title="لا توجد أوامر إسناد" />
      ) : data.map((o) => {
        const ratio = o.value ? o.done_value / o.value : 0
        return (
          <Card key={o.id} style={{ gap: 8 }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <T w="black" style={{ fontSize: 17, color: C.navy, flex: 1 }}>{o.title}</T>
              <Badge {...STATUS[o.status]} />
            </Row>
            <T style={{ color: C.muted }}>أمر {o.number} · {o.project}{o.subcontractor ? ` · ${o.subcontractor}` : ''}</T>
            <T style={{ color: C.muted, fontSize: 14 }}>{shortDate(o.date)}{o.due_date ? ` ← التسليم ${shortDate(o.due_date)}` : ''} · {fmt(o.items_count)} بند</T>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ color: C.ink2 }}>المنفذ {sar(o.done_value)}</T>
              <T w="bold">{sar(o.value)}</T>
            </Row>
            <Meter value={ratio} color={C.amber} />
            <T w="bold" style={{ color: C.amber }}>نسبة التنفيذ {Math.round(ratio * 100)}%</T>
          </Card>
        )
      })}
    </AppScreen>
  )
}
