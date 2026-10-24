import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api, longDate, shortDate, today, type Issue, type Meta, type Report, type Severity } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useData, useSync } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { confirm, useToast } from '../../components/Toast'
import { Badge, Button, C, Card, Chip, Empty, ErrorBox, Field, Header, Loading, Picker, Row, Sheet, T } from '../../components/ui'

const SEVERITY: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: 'حرجة', color: '#fff', bg: C.bad },
  high: { label: 'عالية', color: C.bad, bg: C.badBg },
  medium: { label: 'متوسطة', color: '#8a5a00', bg: C.lateBg },
  low: { label: 'منخفضة', color: C.ink2, bg: C.leaveBg },
}
const SEV_EDGE: Record<Severity, string> = { critical: C.bad, high: C.bad, medium: C.late, low: C.line }
const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']
const STATUS_AR = { open: 'مفتوح', in_progress: 'قيد المعالجة', closed: 'مغلق' }

export default function Site() {
  const { can } = useAuth()
  const [tab, setTab] = useState<'report' | 'issues'>(can('dailyReports') ? 'report' : 'issues')
  const meta = useData<Meta>('/api/meta')
  const projects = meta.data?.projects ?? []
  const [projectId, setProjectId] = useState<number | null>(null)
  useEffect(() => {
    if (projects.length && !projects.some((p) => p.id === projectId)) setProjectId(projects[0].id)
  }, [projects, projectId])

  return (
    <AppScreen inTabs scroll={false} header={<Header title="الموقع" sub={projects.find((p) => p.id === projectId)?.name} />}>
      <View style={s.top}>
        {can('dailyReports') && can('issues') && (
          <View style={s.seg}>
            <Seg label="التقرير اليومي" icon="document-text" active={tab === 'report'} onPress={() => setTab('report')} />
            <Seg label="البلاغات" icon="warning" active={tab === 'issues'} onPress={() => setTab('issues')} />
          </View>
        )}
        {projects.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {projects.map((p) => <Chip key={p.id} label={p.name} active={p.id === projectId} onPress={() => setProjectId(p.id)} />)}
          </ScrollView>
        )}
      </View>
      {!projects.length ? (
        <View style={{ padding: 16 }}>
          {meta.loading ? <Loading /> : meta.error && !meta.data ? <ErrorBox text={meta.error} onRetry={meta.refresh} /> : <Empty icon="business-outline" title="لا توجد مشاريع" sub="لم يُسند إليك أي مشروع بعد" />}
        </View>
      ) : projectId && tab === 'report' ? <DailyReport projectId={projectId} key={`r${projectId}`} />
        : projectId ? <Issues projectId={projectId} projects={projects} key={`i${projectId}`} /> : null}
    </AppScreen>
  )
}

function Seg({ label, icon, active, onPress }: { label: string; icon: 'document-text' | 'warning'; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.segBtn, active && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Ionicons name={active ? icon : (`${icon}-outline` as 'warning-outline')} size={22} color={active ? '#fff' : C.navy} />
      <T w="bold" style={{ color: active ? '#fff' : C.navy, fontSize: 17 }}>{label}</T>
    </Pressable>
  )
}

// ---------- daily report ----------
const EMPTY_REPORT = { work_done: '', next_plan: '', obstacles: '', weather: '', progress: '' }

function DailyReport({ projectId }: { projectId: number }) {
  const toast = useToast()
  const { send, queue } = useSync()
  const { data, error, loading, refreshing, refresh } = useData<Report[]>(`/api/daily-reports?project=${projectId}`)
  const date = today()
  const existing = data?.find((r) => r.date === date)
  const [form, setForm] = useState(EMPTY_REPORT)
  const [busy, setBusy] = useState(false)
  const queued = queue.some((q) => q.path.startsWith('/api/daily-reports') && (q.body as { project_id?: number; date?: string }).project_id === projectId && (q.body as { date?: string }).date === date)

  useEffect(() => {
    if (existing) {
      setForm({ work_done: existing.work_done ?? '', next_plan: existing.next_plan ?? '', obstacles: existing.obstacles ?? '', weather: existing.weather ?? '', progress: existing.progress === null ? '' : String(existing.progress) })
    }
    // Only when the report itself changes on the server.
  }, [existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof EMPTY_REPORT) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.work_done.trim()) return toast('اكتب الأعمال المنفذة اليوم', 'error')
    const pr = form.progress.trim()
    if (pr && (Number.isNaN(Number(pr)) || Number(pr) < 0 || Number(pr) > 100)) return toast('نسبة الإنجاز من 0 إلى 100', 'error')
    setBusy(true)
    const body = { project_id: projectId, date, ...form, progress: pr === '' ? null : Number(pr), equipment: existing?.equipment ?? null, materials: existing?.materials ?? null }
    try {
      const res = existing
        ? await send('PUT', `/api/daily-reports/${existing.id}`, body, `تقرير ${date}`)
        : await send('POST', '/api/daily-reports', body, `تقرير ${date}`)
      toast(res === 'sent' ? (existing ? 'تم تحديث التقرير' : 'تم رفع التقرير اليومي') : 'لا يوجد اتصال — حُفظ التقرير وسيُرفع تلقائياً', res === 'sent' ? 'success' : 'info')
      if (res === 'sent') refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const past = (data ?? []).filter((r) => r.date !== date).slice(0, 10)
  return (
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 14 }}>
        <Row>
          <Ionicons name="calendar" size={22} color={C.amber} />
          <T w="black" style={{ fontSize: 18, color: C.navy, flex: 1 }}>تقرير اليوم</T>
          {existing ? <Badge label="مرفوع" color={C.good} bg={C.goodBg} /> : queued ? <Badge label="بانتظار الإرسال" color="#8a5a00" bg={C.lateBg} /> : null}
        </Row>
        <T style={{ color: C.muted, marginTop: -8 }}>{longDate(date)}</T>
        <Field label="الأعمال المنفذة اليوم *" value={form.work_done} onChangeText={set('work_done')} multiline placeholder="مثال: صب خرسانة سقف الدور الأول" />
        <Field label="خطة الغد" value={form.next_plan} onChangeText={set('next_plan')} multiline placeholder="ما سيتم تنفيذه غداً" />
        <Field label="المعوقات" value={form.obstacles} onChangeText={set('obstacles')} placeholder="إن وجدت" />
        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="نسبة الإنجاز %" value={form.progress} onChangeText={set('progress')} keyboardType="number-pad" placeholder="0 - 100" maxLength={3} /></View>
          <View style={{ flex: 1 }}><Field label="الطقس" value={form.weather} onChangeText={set('weather')} placeholder="مشمس" /></View>
        </Row>
        <Button label={existing ? 'تحديث التقرير' : 'رفع التقرير'} icon="cloud-upload" kind="accent" busy={busy} onPress={submit} />
      </Card>

      <T w="black" style={{ fontSize: 18, color: C.navy }}>التقارير السابقة</T>
      {!data ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />)
        : past.length ? past.map((r) => (
          <Card key={r.id} style={{ gap: 6 }}>
            <Row>
              <T w="bold" style={{ flex: 1, color: C.navy }}>{shortDate(r.date)}</T>
              {r.progress !== null && <Badge label={`${r.progress}%`} color={C.amber} bg={C.amberSoft} />}
            </Row>
            <T style={{ color: C.ink2 }} numberOfLines={3}>{r.work_done}</T>
            <T style={{ color: C.muted, fontSize: 14 }}>{r.author ?? ''} · حاضر {r.present} · غائب {r.absent}</T>
          </Card>
        )) : <Empty icon="document-text-outline" title="لا توجد تقارير سابقة" />}
      {refreshing && <Loading label="جارٍ التحديث…" />}
    </ScrollView>
  )
}

// ---------- issues ----------
function Issues({ projectId, projects }: { projectId: number; projects: Meta['projects'] }) {
  const toast = useToast()
  const { can } = useAuth()
  const { poke } = useSync()
  const { data, error, loading, refresh } = useData<Issue[]>(`/api/issues?project=${projectId}`)
  const [showClosed, setShowClosed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [closing, setClosing] = useState<Issue | null>(null)

  const list = useMemo(() => {
    const rows = (data ?? []).filter((i) => (showClosed ? i.status === 'closed' : i.status !== 'closed'))
    return rows.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
  }, [data, showClosed])
  const openCount = (data ?? []).filter((i) => i.status !== 'closed').length

  const remove = async (i: Issue) => {
    if (!(await confirm('حذف البلاغ', `هل تريد حذف «${i.title}» نهائياً؟`))) return
    try {
      await api(`/api/issues/${i.id}`, { method: 'DELETE' })
      toast('تم حذف البلاغ')
      poke()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 110 }]}>
        <Row style={{ gap: 8 }}>
          <Chip label={`المفتوحة (${openCount})`} active={!showClosed} onPress={() => setShowClosed(false)} />
          <Chip label="المغلقة" active={showClosed} onPress={() => setShowClosed(true)} color={C.good} />
        </Row>
        {!data ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />)
          : !list.length ? <Empty icon={showClosed ? 'archive-outline' : 'happy-outline'} title={showClosed ? 'لا توجد بلاغات مغلقة' : 'لا توجد بلاغات مفتوحة'} sub={showClosed ? undefined : 'الموقع بلا مشاكل حالياً 👍'} />
          : list.map((i) => {
            const sev = SEVERITY[i.severity]
            return (
              <Card key={i.id} style={[{ gap: 8, borderStartWidth: 5, borderStartColor: SEV_EDGE[i.severity] }]}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <T w="bold" style={{ fontSize: 17, flex: 1 }}>{i.title}</T>
                  <Badge label={sev.label} color={sev.color} bg={sev.bg} />
                </Row>
                {!!i.description && <T style={{ color: C.ink2 }}>{i.description}</T>}
                <T style={{ color: C.muted, fontSize: 14 }}>
                  {STATUS_AR[i.status]} · {shortDate(i.created_at)}{i.reporter ? ` · ${i.reporter}` : ''}{i.overdue ? ' · متأخر ⚠' : ''}
                </T>
                {i.status === 'closed' && !!i.resolution && (
                  <View style={s.resolution}><T style={{ color: C.good }}><T w="bold" style={{ color: C.good }}>الحل: </T>{i.resolution}</T></View>
                )}
                {(i.status !== 'closed' && can('issues')) || can('delete') ? (
                  <Row style={{ gap: 8 }}>
                    {i.status !== 'closed' && can('issues') && <Button label="إغلاق البلاغ" icon="checkmark-circle" kind="ghost" onPress={() => setClosing(i)} style={{ flex: 1 }} />}
                    {can('delete') && <Button label="حذف" icon="trash" kind="danger" onPress={() => remove(i)} />}
                  </Row>
                ) : null}
              </Card>
            )
          })}
      </ScrollView>
      {can('issues') && (
        <View style={s.fabWrap}><Button label="بلاغ جديد" icon="add-circle" kind="accent" onPress={() => setAdding(true)} /></View>
      )}
      <NewIssue visible={adding} onClose={() => setAdding(false)} projects={projects} projectId={projectId} onDone={refresh} />
      <CloseIssue issue={closing} onClose={() => setClosing(null)} onDone={refresh} />
    </View>
  )
}

function NewIssue({ visible, onClose, projects, projectId, onDone }: { visible: boolean; onClose: () => void; projects: Meta['projects']; projectId: number; onDone: () => void }) {
  const toast = useToast()
  const { send } = useSync()
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [project, setProject] = useState(projectId)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (visible) { setTitle(''); setSeverity('medium'); setProject(projectId) } }, [visible, projectId])

  const submit = async () => {
    if (!title.trim()) return toast('اكتب عنوان البلاغ', 'error')
    setBusy(true)
    try {
      const res = await send('POST', '/api/issues', { project_id: project, title: title.trim(), severity, category: 'other' }, `بلاغ: ${title.trim()}`)
      toast(res === 'sent' ? 'تم إضافة البلاغ' : 'لا يوجد اتصال — حُفظ البلاغ وسيُرسل تلقائياً', res === 'sent' ? 'success' : 'info')
      onClose()
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet visible={visible} title="بلاغ جديد" onClose={onClose}>
      <Field label="عنوان البلاغ" value={title} onChangeText={setTitle} placeholder="مثال: نقص في حديد التسليح" autoFocus />
      <T w="semibold" style={{ color: C.ink2 }}>الخطورة</T>
      <Picker value={severity} onChange={setSeverity} options={SEV_ORDER.map((k) => ({ value: k, label: SEVERITY[k].label }))}
        color={(k) => (k === 'critical' || k === 'high' ? C.bad : k === 'medium' ? C.late : C.leave)} />
      {projects.length > 1 && (
        <>
          <T w="semibold" style={{ color: C.ink2 }}>المشروع</T>
          <Picker value={project} onChange={setProject} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </>
      )}
      <Button label="إرسال البلاغ" icon="send" kind="accent" busy={busy} onPress={submit} />
    </Sheet>
  )
}

function CloseIssue({ issue, onClose, onDone }: { issue: Issue | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const { send } = useSync()
  const [resolution, setResolution] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setResolution(''), [issue?.id])

  const submit = async () => {
    if (!issue) return
    if (!resolution.trim()) return toast('اكتب كيف تم حل المشكلة', 'error')
    setBusy(true)
    try {
      const res = await send('PUT', `/api/issues/${issue.id}`, { status: 'closed', resolution: resolution.trim() }, `إغلاق: ${issue.title}`)
      toast(res === 'sent' ? 'تم إغلاق البلاغ' : 'لا يوجد اتصال — سيُغلق البلاغ عند عودة الاتصال', res === 'sent' ? 'success' : 'info')
      onClose()
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet visible={!!issue} title="إغلاق البلاغ" onClose={onClose}>
      <T w="bold" style={{ fontSize: 17 }}>{issue?.title}</T>
      <Field label="الحل" value={resolution} onChangeText={setResolution} multiline placeholder="ماذا تم لحل المشكلة؟" autoFocus />
      <Button label="إغلاق البلاغ" icon="checkmark-circle" busy={busy} onPress={submit} />
    </Sheet>
  )
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  seg: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  segOn: { backgroundColor: C.navy },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  resolution: { backgroundColor: C.goodBg, borderRadius: 10, padding: 10 },
  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
})
