import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { api, fmt, sar, shortDate, type AttStatus, type WorkerDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useData, useSync } from '../../lib/sync'
import { useState } from 'react'
import { Image, Pressable } from 'react-native'
import { mediaUri } from '../../lib/media'
import { AddMedia, MediaStrip } from '../../components/Media'
import type { Meta } from '../../lib/api'
import { AppScreen } from '../../components/AppScreen'
import { iqamaState } from '../../components/iqama'
import { confirm, useToast } from '../../components/Toast'
import { Button, C, Card, ErrorBox, Field, Header, Loading, Row, Sheet, T, type IconName } from '../../components/ui'

const ST: Record<AttStatus, { label: string; color: string }> = {
  present: { label: 'حاضر', color: C.good }, late: { label: 'متأخر', color: C.late }, overtime: { label: 'إضافي', color: C.over },
  absent: { label: 'غائب', color: C.bad }, leave: { label: 'إجازة', color: C.leave },
}

export default function WorkerCard() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { can } = useAuth()
  const { poke } = useSync()
  const toast = useToast()
  const { data: w, error, loading, refreshing, refresh } = useData<WorkerDetail>(`/api/workers/${id}`)
  const meta = useData<Meta>(can('moveWorkers') ? '/api/meta' : null)
  const [moving, setMoving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [renew, setRenew] = useState(false)
  const [rf, setRf] = useState({ amount: '', new_expiry: '', note: '' })
  const openRenew = () => {
    if (!w) return
    const base = w.iqama_expiry.startsWith('9999') ? new Date().toISOString().slice(0, 10) : w.iqama_expiry
    const d = new Date(`${base}T12:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + 1)
    setRf({ amount: '', new_expiry: d.toISOString().slice(0, 10), note: '' }); setRenew(true)
  }
  const saveRenew = async () => {
    if (!w) return
    if (!(Number(rf.amount) > 0)) return toast('اكتب مبلغ التجديد', 'error')
    if (rf.new_expiry && !/^\d{4}-\d{2}-\d{2}$/.test(rf.new_expiry)) return toast('اكتب التاريخ بالشكل 2027-05-30', 'error')
    setBusy(true)
    try {
      await api(`/api/workers/${w.id}/iqama-renewal`, { method: 'POST', body: JSON.stringify({ amount: Number(rf.amount), new_expiry: rf.new_expiry || null, note: rf.note }) })
      toast('تم تسجيل تجديد الإقامة'); setRenew(false); poke(); refresh()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const move = async (projectId: number | null, label: string) => {
    if (!w) return
    setBusy(true)
    try {
      await api(`/api/workers/${w.id}/move`, { method: 'POST', body: JSON.stringify({ project_id: projectId }) })
      toast(`تم نقل ${w.name} إلى ${label}`)
      setMoving(false)
      poke()
      refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const iq = w ? iqamaState(w.iqama_expiry) : null
  const month = (w?.attendance ?? []).slice(0, 31)
  const worked = month.filter((a) => a.status === 'present' || a.status === 'late' || a.status === 'overtime').length
  const absent = month.filter((a) => a.status === 'absent').length

  const remove = async () => {
    if (!w || !(await confirm('حذف العامل', `سيُحذف «${w.name}» وكل سجلات حضوره نهائياً. هل أنت متأكد؟`))) return
    try {
      await api(`/api/workers/${w.id}`, { method: 'DELETE' })
      toast('تم حذف العامل')
      poke()
      router.back()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <AppScreen onRefresh={refresh} refreshing={refreshing} header={<Header title={w?.name ?? 'بطاقة العامل'} sub={w?.profession} onBack={() => router.back()} />}>
      {!w ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />) : (
        <>
          <Card style={[s.row, { gap: 14 }]}>
            {w.photo ? <Image source={{ uri: mediaUri(w.photo) }} style={s.photo} /> : <View style={[s.photo, s.noPhoto]}><T w="black" style={{ fontSize: 36, color: C.navy }}>{w.name.trim()[0]}</T></View>}
            <View style={{ flex: 1, gap: 4 }}>
              <T w="black" style={{ fontSize: 20, color: C.navy }}>{w.name}</T>
              <T style={{ color: C.muted }}>{w.profession} · {w.nationality}</T>
              <T w="bold">{w.project ? `${w.location_kind === 'factory' ? '🏭 ' : w.location_kind === 'office' ? '🏢 ' : '🏗️ '}${w.project}` : 'غير موزّع'}</T>
            </View>
          </Card>
          {iq && (
            <Card style={[s.row, { backgroundColor: iq.bg, borderColor: iq.bg }]}>
              <Ionicons name="warning" size={26} color={iq.color} />
              <View style={{ flex: 1 }}>
                <T w="black" style={{ color: iq.color, fontSize: 17 }}>{iq.label}</T>
                <T style={{ color: iq.color }}>تاريخ الانتهاء {w.iqama_expiry} — جدّدها قبل انتهائها</T>
              </View>
            </Card>
          )}
          <Row style={{ gap: 10 }}>
            <Stat label="أيام عمل" value={fmt(worked)} color={C.good} />
            <Stat label="غياب" value={fmt(absent)} color={C.bad} />
          </Row>
          <Card style={{ gap: 2 }}>
            <Info icon="business" label="الموقع الحالي" value={w.project ? `${w.location_kind === 'factory' ? '🏭 ' : w.location_kind === 'office' ? '🏢 ' : ''}${w.project}` : 'غير موزّع'} />
            <Info icon="card" label="رقم الإقامة" value={w.iqama_no} />
            <Info icon="calendar" label="انتهاء الإقامة" value={w.iqama_expiry.startsWith('9999') ? 'غير محدد' : w.iqama_expiry} />
            <Info icon="flag" label="الجنسية" value={w.nationality} />
            {!!w.phone && <Info icon="call" label="الجوال" value={w.phone} />}
            {!!w.subcontractor && <Info icon="people" label="مقاول الباطن" value={w.subcontractor} />}
            <Info icon="cash" label="الأجر" value={`${sar(w.wage)} ${w.wage_type === 'daily' ? 'يومياً' : 'شهرياً'}`} />
          </Card>
          <Card style={{ gap: 8 }}>
            <T w="black" style={{ fontSize: 18, color: C.navy }}>أين عمل كل يوم</T>
            {month.length ? month.slice(0, 14).map((a) => (
              <Row key={a.date} style={s.att}>
                <View style={[s.dot, { backgroundColor: ST[a.status].color }]} />
                <View style={{ flex: 1 }}><T>{shortDate(a.date)}</T>{!!a.project && <T style={{ color: C.muted, fontSize: 13 }}>{a.project}</T>}</View>
                <T w="bold" style={{ color: ST[a.status].color }}>{ST[a.status].label}{a.overtime_hours ? ` +${a.overtime_hours} س` : ''}</T>
              </Row>
            )) : <T style={{ color: C.muted }}>لا يوجد حضور مسجل بعد</T>}
          </Card>
          <Card style={{ gap: 8 }}>
            <T w="black" style={{ fontSize: 18, color: C.navy }}>تجديدات الإقامة ومصاريفها</T>
            {(w.renewals ?? []).length ? (w.renewals ?? []).map((r) => (
              <Row key={r.id} style={s.att}>
                <View style={{ flex: 1 }}><T w="bold">{sar(r.amount)}</T><T style={{ color: C.muted, fontSize: 13 }}>{shortDate(r.date)}{r.new_expiry ? ` · حتى ${r.new_expiry}` : ''}{r.project ? ` · ${r.project}` : ''}</T></View>
              </Row>
            )) : <T style={{ color: C.muted }}>لا توجد تجديدات مسجلة</T>}
            {can('costs') && <Button label="تسجيل تجديد إقامة" icon="card" kind="ghost" onPress={openRenew} />}
          </Card>
          <Sheet visible={renew} title={`تجديد إقامة ${w.name}`} onClose={() => setRenew(false)}>
            <Field label="المبلغ المدفوع (ر.س)" value={rf.amount} onChangeText={(v) => setRf((x) => ({ ...x, amount: v }))} keyboardType="decimal-pad" autoFocus />
            <Field label="تاريخ الانتهاء الجديد" value={rf.new_expiry} onChangeText={(v) => setRf((x) => ({ ...x, new_expiry: v }))} placeholder="2027-05-30" ltr />
            <Field label="ملاحظة" value={rf.note} onChangeText={(v) => setRf((x) => ({ ...x, note: v }))} />
            <T style={{ color: C.muted }}>{w.location_kind === 'office' ? 'موظف إدارة: يُوزَّع المبلغ بالتساوي على المشاريع الجارية.' : `يُحمَّل المبلغ على ${w.project ?? 'موقع العامل'}.`}</T>
            <Button label="حفظ التجديد" icon="checkmark-circle" kind="accent" busy={busy} onPress={saveRenew} />
          </Sheet>
          <Card style={{ gap: 10 }}>
            <T w="black" style={{ fontSize: 18, color: C.navy }}>الصورة والإقامة والمستندات</T>
            {(w.media ?? []).length ? <MediaStrip files={w.media ?? []} /> : <T style={{ color: C.muted }}>لا توجد صور بعد</T>}
            {(can('workers') || can('moveWorkers')) && (
              <>
                <T w="bold" style={{ color: C.ink2 }}>الصورة الشخصية</T>
                <AddMedia entity="worker" id={w.id} tag="photo" onlyImages label="صورة واضحة للوجه" />
                <T w="bold" style={{ color: C.ink2 }}>صورة الإقامة</T>
                <AddMedia entity="worker" id={w.id} tag="iqama" onlyImages label="صوّر الإقامة من الأمام والخلف" />
              </>
            )}
          </Card>
          {can('moveWorkers') && <Button label="نقل العامل (مشروع / المصنع / الإدارة)" icon="swap-horizontal" kind="accent" onPress={() => setMoving(true)} />}
          {can('delete') && <Button label="حذف العامل" icon="trash" kind="danger" onPress={remove} />}
          <Sheet visible={moving} title={`أين يعمل ${w.name}؟`} onClose={() => setMoving(false)}>
            <T style={{ color: C.muted }}>الموقع الحالي: {w.project ?? 'غير موزّع'}</T>
            {(meta.data?.places ?? (meta.data?.projects ?? []).filter((p) => p.status === 'active')).map((p) => (
              <Pressable key={p.id} disabled={busy} onPress={() => move(p.id, p.name)} style={[s.place, w.project_id === p.id && s.placeOn]}>
                <T style={{ fontSize: 24 }}>{p.kind === 'factory' ? '🏭' : p.kind === 'office' ? '🏢' : '🏗️'}</T>
                <T w="bold" style={{ flex: 1, fontSize: 17 }}>{p.name}</T>
                {w.project_id === p.id && <Ionicons name="checkmark-circle" size={24} color={C.navy} />}
              </Pressable>
            ))}
            <Pressable disabled={busy} onPress={() => move(null, 'غير موزّع')} style={[s.place, !w.project_id && s.placeOn]}>
              <T style={{ fontSize: 24 }}>⏸️</T>
              <T w="bold" style={{ flex: 1, fontSize: 17 }}>غير موزّع</T>
            </Pressable>
          </Sheet>
        </>
      )}
    </AppScreen>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', padding: 12 }}>
      <T w="black" style={{ fontSize: 28, color, textAlign: 'center' }}>{value}</T>
      <T style={{ color: C.ink2, textAlign: 'center' }}>{label}</T>
    </Card>
  )
}

function Info({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <Row style={s.info}>
      <Ionicons name={icon} size={20} color={C.amber} />
      <T style={{ color: C.muted, width: 110 }}>{label}</T>
      <T w="bold" style={{ flex: 1 }}>{value}</T>
    </Row>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { minHeight: 44, borderBottomWidth: 1, borderColor: '#f1ede9', gap: 10 },
  att: { minHeight: 40, gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2, borderColor: C.line, backgroundColor: '#fff' },
  placeOn: { borderColor: C.navy, backgroundColor: C.navySoft },
  photo: { width: 88, height: 88, borderRadius: 20 },
  noPhoto: { backgroundColor: C.navySoft, alignItems: 'center', justifyContent: 'center' },
})
