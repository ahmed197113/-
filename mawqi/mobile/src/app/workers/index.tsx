import { useMemo, useState } from 'react'
import { Image, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { AttStatus, Worker } from '../../lib/api'
import { mediaUri } from '../../lib/media'
import { useData } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { iqamaState } from '../../components/iqama'
import { Badge, C, Chip, Empty, ErrorBox, Header, Loading, Row, Search, T } from '../../components/ui'

const TODAY: Record<AttStatus, { label: string; color: string }> = {
  present: { label: 'حاضر', color: C.good }, late: { label: 'متأخر', color: C.late }, overtime: { label: 'إضافي', color: C.over },
  absent: { label: 'غائب', color: C.bad }, leave: { label: 'إجازة', color: C.leave },
}

/** Every worker of the company, grouped by where they work today: the factory, each project, or unassigned. */
export default function Workers() {
  const { data, error, loading, refreshing, refresh } = useData<Worker[]>('/api/workers?active=1')
  const [q, setQ] = useState('')
  const [onlyIqama, setOnlyIqama] = useState(false)

  const expiring = (data ?? []).filter((w) => iqamaState(w.iqama_expiry)).length
  const sections = useMemo(() => {
    const t = q.trim()
    const rows = (data ?? []).filter((w) => (!onlyIqama || iqamaState(w.iqama_expiry)) &&
      (!t || w.name.includes(t) || w.iqama_no.includes(t) || (w.profession ?? '').includes(t) || (w.project ?? '').includes(t)))
    const groups = new Map<string, { title: string; icon: string; order: number; data: Worker[] }>()
    for (const w of rows) {
      const key = w.project_id ? String(w.project_id) : 'none'
      if (!groups.has(key)) {
        groups.set(key, {
          title: w.project ?? 'غير موزّع',
          icon: !w.project_id ? '⏸️' : w.location_kind === 'factory' ? '🏭' : '🏗️',
          order: !w.project_id ? 2 : w.location_kind === 'factory' ? 0 : 1,
          data: [],
        })
      }
      groups.get(key)!.data.push(w)
    }
    return [...groups.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ar'))
  }, [data, q, onlyIqama])

  return (
    <AppScreen scroll={false} header={<Header title="العمال" sub={data ? `${data.length} عامل · موزعون على ${sections.length} موقع` : undefined} onBack={() => router.back()} />}>
      <SectionList
        sections={sections}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 6 }}>
            <Search value={q} onChangeText={setQ} placeholder="ابحث بالاسم أو رقم الإقامة أو المهنة" />
            {expiring > 0 && (
              <Row>
                <Chip label="الكل" active={!onlyIqama} onPress={() => setOnlyIqama(false)} />
                <Chip label={`إقامات تنتهي (${expiring})`} active={onlyIqama} onPress={() => setOnlyIqama(true)} color={C.bad} />
              </Row>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => {
          const present = section.data.filter((w) => w.today && ['present', 'late', 'overtime'].includes(w.today)).length
          return (
            <Row style={s.section}>
              <T style={{ fontSize: 22 }}>{section.icon}</T>
              <T w="black" style={{ flex: 1, fontSize: 17, color: C.navy }}>{section.title}</T>
              <T style={{ color: C.muted, fontSize: 14 }}>{section.data.length} عامل{section.title !== 'غير موزّع' ? ` · حاضر ${present}` : ''}</T>
            </Row>
          )
        }}
        ListEmptyComponent={!data ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />)
          : <Empty icon="people-outline" title={q ? 'لا توجد نتائج' : 'لا يوجد عمال'} sub={q ? `لا يوجد عامل يطابق «${q}»` : 'أضف العمال من لوحة الموقع'} />}
        renderItem={({ item: w }) => {
          const iq = iqamaState(w.iqama_expiry)
          const st = w.today ? TODAY[w.today] : null
          return (
            <Pressable onPress={() => router.push(`/workers/${w.id}`)} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
              {w.photo
                ? <Image source={{ uri: mediaUri(w.photo) }} style={[s.avatar, st && { borderWidth: 3, borderColor: st.color }]} />
                : <View style={[s.avatar, st && { borderWidth: 3, borderColor: st.color }]}><T w="black" style={{ color: C.navy, fontSize: 20 }}>{w.name.trim()[0]}</T></View>}
              <View style={{ flex: 1, gap: 2 }}>
                <T w="bold" style={{ fontSize: 17 }} numberOfLines={1}>{w.name}</T>
                <T style={{ color: C.muted, fontSize: 14 }} numberOfLines={1}>{w.profession}{st ? ` · ` : ''}{st && <T w="bold" style={{ color: st.color, fontSize: 14 }}>{st.label}</T>}</T>
                {iq && <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Badge label={`${iq.label} ${w.iqama_expiry}`} color={iq.color} bg={iq.bg} /></View>}
              </View>
              <Ionicons name="chevron-back" size={22} color={C.muted} />
            </Pressable>
          )
        }}
      />
    </AppScreen>
  )
}

const s = StyleSheet.create({
  section: { marginTop: 10, marginBottom: 2, gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, minHeight: 72 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.navySoft, alignItems: 'center', justifyContent: 'center' },
})
