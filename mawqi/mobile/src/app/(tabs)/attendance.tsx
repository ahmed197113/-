import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { addDays, fmt, longDate, today, type AttRow, type AttStatus, type Meta } from '../../lib/api'
import { useData, useSync } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { confirm, useToast } from '../../components/Toast'
import { Button, C, Chip, Empty, ErrorBox, Header, Loading, Row, Search, T, type IconName } from '../../components/ui'

const STATUSES: { key: AttStatus; label: string; icon: IconName; color: string; bg: string }[] = [
  { key: 'present', label: 'حاضر', icon: 'checkmark-circle', color: C.good, bg: C.goodBg },
  { key: 'late', label: 'متأخر', icon: 'time', color: C.late, bg: C.lateBg },
  { key: 'overtime', label: 'إضافي', icon: 'add-circle', color: C.over, bg: C.overBg },
  { key: 'absent', label: 'غائب', icon: 'close-circle', color: C.bad, bg: C.badBg },
  { key: 'leave', label: 'إجازة', icon: 'airplane', color: C.leave, bg: C.leaveBg },
]
const DEFAULT_OT = 2

interface Mark { status: AttStatus | null; ot: number }
interface Entry { worker_id: number; status: AttStatus | null; overtime_hours: number; check_in?: string | null; check_out?: string | null }

export default function Attendance() {
  const toast = useToast()
  const { send, queue } = useSync()
  const meta = useData<Meta>('/api/meta')
  // Real projects first, the factory last.
  const projects = [...(meta.data?.projects ?? [])].sort((a, b) => Number(a.kind === 'factory') - Number(b.kind === 'factory'))
  const [projectId, setProjectId] = useState<number | null>(null)
  const [date, setDate] = useState(today())
  const [q, setQ] = useState('')
  const [edits, setEdits] = useState<Map<number, Mark>>(new Map())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (projects.length && !projects.some((p) => p.id === projectId)) setProjectId(projects[0].id)
  }, [projects, projectId])

  const att = useData<{ date: string; rows: AttRow[] }>(projectId ? `/api/attendance?date=${date}&project=${projectId}` : null)

  // Attendance saved offline is shown as recorded until it reaches the server.
  const pending = useMemo(() => {
    const m = new Map<number, Mark>()
    for (const it of queue) {
      const b = it.body as { date?: string; entries?: Entry[] }
      if (it.path !== '/api/attendance' || b.date !== date) continue
      for (const e of b.entries ?? []) m.set(e.worker_id, { status: e.status, ot: e.overtime_hours })
    }
    return m
  }, [queue, date])

  const rows = att.data?.date === date ? att.data.rows : []
  const base = useCallback((r: AttRow): Mark => pending.get(r.worker_id) ?? { status: r.status, ot: r.overtime_hours || DEFAULT_OT }, [pending])
  const markOf = (r: AttRow) => edits.get(r.worker_id) ?? base(r)

  const shown = useMemo(() => {
    const t = q.trim()
    return t ? rows.filter((r) => r.name.includes(t) || (r.profession ?? '').includes(t)) : rows
  }, [rows, q])

  const counts = { present: 0, absent: 0, other: 0, none: 0 }
  for (const r of rows) {
    const st = markOf(r).status
    if (st === 'present' || st === 'late' || st === 'overtime') counts.present++
    else if (st === 'absent') counts.absent++
    else if (st === 'leave') counts.other++
    else counts.none++
  }

  const setMark = useCallback((r: AttRow, next: Mark) => {
    setEdits((prev) => {
      const m = new Map(prev)
      const b = base(r)
      if (b.status === next.status && (next.status !== 'overtime' || b.ot === next.ot)) m.delete(r.worker_id)
      else m.set(r.worker_id, next)
      return m
    })
  }, [base])

  const tap = useCallback((r: AttRow, st: AttStatus, cur: Mark) => {
    // Tapping the current status again clears it.
    setMark(r, { status: cur.status === st ? null : st, ot: cur.ot || DEFAULT_OT })
  }, [setMark])

  const restPresent = () => {
    const missing = rows.filter((r) => !markOf(r).status)
    if (!missing.length) return toast('كل العمال مسجلون', 'info')
    setEdits((prev) => {
      const m = new Map(prev)
      for (const r of missing) m.set(r.worker_id, { status: 'present', ot: DEFAULT_OT })
      return m
    })
    toast(`تم تحديد ${missing.length} عامل حاضر — اضغط حفظ`, 'info')
  }

  const switchTo = async (fn: () => void) => {
    if (edits.size && !(await confirm('تغييرات غير محفوظة', 'هل تريد تجاهل التغييرات التي لم تُحفظ؟', 'تجاهل'))) return
    setEdits(new Map())
    setQ('')
    fn()
  }

  const save = async () => {
    if (!edits.size) return
    setBusy(true)
    const byId = new Map(rows.map((r) => [r.worker_id, r]))
    // The server replaces the whole record, so keep check-in times recorded by the QR scanner.
    const entries: Entry[] = [...edits].map(([worker_id, m]) => ({
      worker_id, status: m.status, overtime_hours: m.status === 'overtime' ? m.ot : 0,
      check_in: byId.get(worker_id)?.check_in ?? null, check_out: byId.get(worker_id)?.check_out ?? null,
    }))
    try {
      const res = await send('POST', '/api/attendance', { date, entries }, `حضور ${date}`)
      setEdits(new Map())
      toast(res === 'sent' ? `تم حفظ حضور ${entries.length} عامل` : 'لا يوجد اتصال — حُفظ الحضور وسيُرسل تلقائياً', res === 'sent' ? 'success' : 'info')
      if (res === 'sent') att.reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const isToday = date >= today()
  const controls = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      {projects.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {projects.map((p) => <Chip key={p.id} label={p.name} active={p.id === projectId} onPress={() => p.id !== projectId && switchTo(() => setProjectId(p.id))} />)}
        </ScrollView>
      )}
      <View style={s.dateBar}>
        <Pressable style={s.dateBtn} onPress={() => switchTo(() => setDate(addDays(date, -1)))} accessibilityLabel="اليوم السابق">
          <Ionicons name="chevron-forward" size={26} color={C.navy} />
        </Pressable>
        <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => !isToday && switchTo(() => setDate(today()))}>
          <T w="black" style={{ fontSize: 17, color: C.navy, textAlign: 'center' }}>{longDate(date)}</T>
          <T style={{ fontSize: 13, color: isToday ? C.good : C.amber, textAlign: 'center' }}>{isToday ? 'اليوم' : 'اضغط للعودة إلى اليوم'}</T>
        </Pressable>
        <Pressable style={[s.dateBtn, isToday && { opacity: 0.3 }]} disabled={isToday} onPress={() => switchTo(() => setDate(addDays(date, 1)))} accessibilityLabel="اليوم التالي">
          <Ionicons name="chevron-back" size={26} color={C.navy} />
        </Pressable>
      </View>
      {rows.length > 0 && (
        <>
          <Row style={{ gap: 8 }}>
            <Count n={counts.present} label="حاضر" color={C.good} />
            <Count n={counts.absent} label="غائب" color={C.bad} />
            <Count n={counts.other} label="إجازة" color={C.leave} />
            <Count n={counts.none} label="لم يُسجَّل" color={C.muted} />
          </Row>
          <Search value={q} onChangeText={setQ} placeholder="ابحث باسم العامل" />
          {counts.none > 0 && <Button label={`الباقي حاضر (${counts.none})`} icon="checkmark-done" kind="ghost" onPress={restPresent} />}
        </>
      )}
    </View>
  )

  const body = !projects.length
    ? (meta.loading ? <Loading /> : meta.error && !meta.data ? <ErrorBox text={meta.error} onRetry={meta.refresh} /> : <Empty icon="business-outline" title="لا توجد مشاريع" sub="لم يُسند إليك أي مشروع بعد" />)
    : !att.data && att.loading ? <Loading label="جارٍ تحميل العمال…" />
    : !att.data && att.error ? <ErrorBox text={att.error} onRetry={att.refresh} />
    : rows.length === 0 ? <Empty icon="people-outline" title="لا يوجد عمال في هذا المشروع" sub="أضف العمال من لوحة التحكم على الويب" />
    : shown.length === 0 ? <Empty icon="search" title="لا توجد نتائج" sub={`لا يوجد عامل باسم «${q}»`} />
    : null

  return (
    <AppScreen inTabs scroll={false}
      header={<Header title="تسجيل الحضور" sub={projects.find((p) => p.id === projectId)?.name ?? 'اختر المشروع'} />}
      footer={edits.size ? <Button label={`حفظ الحضور (${edits.size})`} icon="save" kind="accent" busy={busy} onPress={save} /> : undefined}>
      <FlatList
        data={body ? [] : shown}
        keyExtractor={(r) => String(r.worker_id)}
        ListHeaderComponent={controls}
        ListEmptyComponent={body ?? undefined}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: edits.size ? 110 : 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={att.refreshing} onRefresh={att.refresh} colors={[C.navy]} />}
        renderItem={({ item }) => <WorkerRow r={item} mark={markOf(item)} dirty={edits.has(item.worker_id)} queued={pending.has(item.worker_id)} onTap={tap} onOt={setMark} />}
      />
    </AppScreen>
  )
}

function Count({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={s.count}>
      <T w="black" style={{ fontSize: 22, color, textAlign: 'center' }}>{fmt(n)}</T>
      <T style={{ fontSize: 13, color: C.ink2, textAlign: 'center' }}>{label}</T>
    </View>
  )
}

const WorkerRow = memo(function WorkerRow({ r, mark, dirty, queued, onTap, onOt }: {
  r: AttRow; mark: Mark; dirty: boolean; queued: boolean
  onTap: (r: AttRow, st: AttStatus, cur: Mark) => void; onOt: (r: AttRow, m: Mark) => void
}) {
  const cur = STATUSES.find((x) => x.key === mark.status)
  return (
    <View style={[s.worker, { borderStartColor: cur?.color ?? C.line }, dirty && { borderColor: C.amber }]}>
      <Row>
        <View style={{ flex: 1 }}>
          <T w="bold" style={{ fontSize: 17 }} numberOfLines={1}>{r.name}</T>
          <T style={{ fontSize: 14, color: C.muted }}>{r.profession}{r.check_in ? ` · دخول ${r.check_in}` : ''}</T>
        </View>
        {dirty ? <Tag text="لم يُحفظ" color={C.amber} /> : queued ? <Tag text="بانتظار الإرسال" color={C.late} /> : null}
      </Row>
      <View style={s.btns}>
        {STATUSES.map((x) => {
          const on = mark.status === x.key
          return (
            <Pressable key={x.key} onPress={() => onTap(r, x.key, mark)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${r.name} ${x.label}`}
              style={({ pressed }) => [s.st, { backgroundColor: on ? x.color : x.bg, borderColor: on ? x.color : 'transparent' }, pressed && { opacity: 0.7 }]}>
              <Ionicons name={x.icon} size={22} color={on ? '#fff' : x.color} />
              <T w="bold" style={{ fontSize: 14, color: on ? '#fff' : x.color, textAlign: 'center' }}>{x.label}</T>
            </Pressable>
          )
        })}
      </View>
      {mark.status === 'overtime' && (
        <Row style={s.ot}>
          <T w="semibold" style={{ flex: 1, color: C.over }}>ساعات العمل الإضافي</T>
          <Pressable style={s.otBtn} onPress={() => onOt(r, { ...mark, ot: Math.max(1, mark.ot - 1) })} accessibilityLabel="إنقاص"><Ionicons name="remove" size={22} color={C.over} /></Pressable>
          <T w="black" style={{ fontSize: 20, minWidth: 30, textAlign: 'center' }}>{mark.ot}</T>
          <Pressable style={s.otBtn} onPress={() => onOt(r, { ...mark, ot: Math.min(12, mark.ot + 1) })} accessibilityLabel="زيادة"><Ionicons name="add" size={22} color={C.over} /></Pressable>
        </Row>
      )}
    </View>
  )
})

function Tag({ text, color }: { text: string; color: string }) {
  return <View style={[s.tag, { borderColor: color }]}><T w="bold" style={{ fontSize: 12, color }}>{text}</T></View>
}

const s = StyleSheet.create({
  dateBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 4 },
  dateBtn: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navySoft },
  count: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 6 },
  worker: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.line, borderStartWidth: 5, padding: 12, gap: 10 },
  btns: { flexDirection: 'row', gap: 6 },
  st: { flex: 1, minHeight: 60, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 },
  ot: { backgroundColor: C.overBg, borderRadius: 12, padding: 6, paddingStart: 12 },
  otBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  tag: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
})
