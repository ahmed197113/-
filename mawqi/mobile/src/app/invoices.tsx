import { useState } from 'react'
import { router } from 'expo-router'
import { fmt, sar, shortDate, type Invoice } from '../lib/api'
import { useData } from '../lib/sync'
import { AppScreen } from '../components/AppScreen'
import { Badge, C, Card, Chip, Empty, ErrorBox, Header, Loading, Row, T } from '../components/ui'

const STATUS: Record<Invoice['status'], { label: string; color: string; bg: string }> = {
  draft: { label: 'مسودة', color: C.ink2, bg: C.leaveBg },
  submitted: { label: 'مقدم', color: C.over, bg: C.overBg },
  approved: { label: 'معتمد', color: C.good, bg: C.goodBg },
  paid: { label: 'مدفوع', color: '#fff', bg: C.good },
  rejected: { label: 'مرفوض', color: C.bad, bg: C.badBg },
}

export default function Invoices() {
  const { data, error, loading, refreshing, refresh } = useData<Invoice[]>('/api/invoices')
  const [kind, setKind] = useState<Invoice['kind']>('client')
  const rows = (data ?? []).filter((v) => v.kind === kind)
  const total = rows.reduce((a, v) => a + v.total, 0)

  return (
    <AppScreen onRefresh={refresh} refreshing={refreshing} header={<Header title="المستخلصات" sub="عرض فقط" onBack={() => router.back()} />}>
      <Row>
        <Chip label="مستخلصات المالك" active={kind === 'client'} onPress={() => setKind('client')} />
        <Chip label="مقاولو الباطن" active={kind === 'subcontractor'} onPress={() => setKind('subcontractor')} color={C.amber} />
      </Row>
      {!data ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />) : !rows.length ? (
        <Empty icon="receipt-outline" title="لا توجد مستخلصات" />
      ) : (
        <>
          <Card style={{ backgroundColor: C.navy, borderColor: C.navy }}>
            <T style={{ color: '#c9c4ea' }}>الإجمالي شامل الضريبة ({fmt(rows.length)})</T>
            <T w="black" style={{ color: '#fff', fontSize: 26 }}>{sar(total)}</T>
          </Card>
          {rows.map((v) => (
            <Card key={v.id} style={{ gap: 6 }}>
              <Row>
                <T w="black" style={{ fontSize: 17, color: C.navy, flex: 1 }}>مستخلص {v.number}</T>
                <Badge {...STATUS[v.status]} />
              </Row>
              <T style={{ color: C.muted }}>{v.project}{v.subcontractor ? ` · ${v.subcontractor}` : ''}</T>
              {!!(v.period_from && v.period_to) && <T style={{ color: C.muted, fontSize: 14 }}>من {shortDate(v.period_from)} إلى {shortDate(v.period_to)}</T>}
              <Row style={{ justifyContent: 'space-between' }}><T style={{ color: C.ink2 }}>قيمة الأعمال</T><T w="bold">{sar(v.gross)}</T></Row>
              <Row style={{ justifyContent: 'space-between' }}><T style={{ color: C.ink2 }}>المحتجز والخصومات</T><T w="bold" style={{ color: C.bad }}>{sar(v.retention + v.deductions)}</T></Row>
              <Row style={{ justifyContent: 'space-between' }}><T style={{ color: C.ink2 }}>الإجمالي مع الضريبة</T><T w="black" style={{ color: C.good, fontSize: 18 }}>{sar(v.total)}</T></Row>
            </Card>
          ))}
        </>
      )}
    </AppScreen>
  )
}
