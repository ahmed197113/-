import { useState } from 'react'
import { ActivityIndicator, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { deleteFile, mediaUri, pickFromGallery, takeWithCamera, TAGS, uploadAll, type Entity, type MediaFile, type Picked } from '../lib/media'
import { useAuth } from '../lib/auth'
import { useSync } from '../lib/sync'
import { confirm, useToast } from './Toast'
import { C, Row, T } from './ui'

// ---------- full-screen viewer ----------
function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.play() })
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />
}

export function Viewer({ files, index, onClose }: { files: MediaFile[]; index: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [i, setI] = useState(index)
  const f = files[i]
  if (!f) return null
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#0b0920' }}>
        <Row style={[s.vTop, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={s.vBtn} accessibilityLabel="إغلاق"><Ionicons name="close" size={28} color="#fff" /></Pressable>
          <View style={{ flex: 1 }}>
            <T w="bold" style={{ color: '#fff' }}>{i + 1} / {files.length}{f.tag && TAGS[f.tag] ? ` · ${TAGS[f.tag]}` : ''}</T>
            <T style={{ color: '#b8b3d6', fontSize: 13 }}>{f.by ?? ''} · {f.created_at.replace('T', ' ')}</T>
          </View>
          {f.kind === 'file' && (
            <Pressable onPress={() => Linking.openURL(mediaUri(f.url))} style={s.vBtn} accessibilityLabel="فتح"><Ionicons name="open-outline" size={24} color="#fff" /></Pressable>
          )}
        </Row>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {f.kind === 'image' && <Image source={{ uri: mediaUri(f.url) }} style={{ width, height: height * 0.75 }} resizeMode="contain" />}
          {f.kind === 'video' && <VideoPlayer key={f.id} uri={mediaUri(f.url)} />}
          {f.kind === 'file' && (
            <Pressable onPress={() => Linking.openURL(mediaUri(f.url))} style={{ alignItems: 'center', gap: 12 }}>
              <Ionicons name="document-text" size={80} color={C.amber} />
              <T w="bold" style={{ color: '#fff', textAlign: 'center' }}>{f.name ?? 'ملف PDF'}{'\n'}اضغط للفتح</T>
            </Pressable>
          )}
        </View>
        {!!f.caption && <T style={[s.caption, { paddingBottom: insets.bottom + 10 }]}>{f.caption}</T>}
        {files.length > 1 && (
          <Row style={[s.vNav, { bottom: insets.bottom + 50 }]}>
            <Pressable disabled={i === 0} onPress={() => setI(i - 1)} style={[s.vNavBtn, i === 0 && { opacity: 0.3 }]}><Ionicons name="chevron-forward" size={30} color="#fff" /></Pressable>
            <Pressable disabled={i === files.length - 1} onPress={() => setI(i + 1)} style={[s.vNavBtn, i === files.length - 1 && { opacity: 0.3 }]}><Ionicons name="chevron-back" size={30} color="#fff" /></Pressable>
          </Row>
        )}
      </View>
    </Modal>
  )
}

// ---------- thumbnails ----------
export function Thumb({ f, size = 92, onPress, onLongPress }: { f: MediaFile | Picked; size?: number; onPress?: () => void; onLongPress?: () => void }) {
  const uri = 'url' in f ? mediaUri(f.url) : f.uri
  const kind = f.kind
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={[s.thumb, { width: size, height: size }]}>
      {kind === 'image' && <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
      {kind === 'video' && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1d1846', alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="play-circle" size={size * 0.42} color="#fff" /><T style={{ color: '#cfcbe8', fontSize: 11 }}>فيديو</T></View>}
      {kind === 'file' && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.amberSoft }]}><Ionicons name="document-text" size={size * 0.4} color={C.amber} /><T style={{ fontSize: 11, color: C.ink2 }}>PDF</T></View>}
      {'tag' in f && f.tag && TAGS[f.tag] && <View style={s.tag}><T w="bold" style={{ color: '#fff', fontSize: 11 }}>{TAGS[f.tag]}</T></View>}
    </Pressable>
  )
}

/** A row of thumbnails; tap to open, long-press to delete (when allowed). */
export function MediaStrip({ files, size = 86, max, deletable = true }: { files: MediaFile[]; size?: number; max?: number; deletable?: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const { user, can } = useAuth()
  const { poke } = useSync()
  const toast = useToast()
  if (!files.length) return null
  const shown = max ? files.slice(0, max) : files
  const remove = async (f: MediaFile) => {
    if (!deletable || !(can('delete') || f.created_by === user?.id)) return
    if (!(await confirm('حذف الملف', 'هل تريد حذف هذا الملف نهائياً؟'))) return
    try { await deleteFile(f.id); toast('تم حذف الملف'); poke() } catch (e) { toast((e as Error).message, 'error') }
  }
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {shown.map((f, i) => <Thumb key={f.id} f={f} size={size} onPress={() => setOpen(i)} onLongPress={() => remove(f)} />)}
        {max && files.length > max && (
          <Pressable onPress={() => setOpen(max)} style={[s.thumb, s.more, { width: size, height: size }]}><T w="black" style={{ color: C.navy, fontSize: 18 }}>+{files.length - max}</T></Pressable>
        )}
      </ScrollView>
      {open !== null && <Viewer files={files} index={open} onClose={() => setOpen(null)} />}
    </>
  )
}

/** A full grid (project gallery). */
export function MediaGrid({ files }: { files: MediaFile[] }) {
  const { width } = useWindowDimensions()
  const [open, setOpen] = useState<number | null>(null)
  // Screen padding (16×2) + card padding (16×2) + two 8px gaps.
  const size = Math.floor((Math.min(width, 700) - 64 - 16) / 3)
  return (
    <>
      <FlatList data={files} numColumns={3} scrollEnabled={false} keyExtractor={(f) => String(f.id)} columnWrapperStyle={{ gap: 8 }} contentContainerStyle={{ gap: 8 }}
        renderItem={({ item, index }) => <Thumb f={item} size={size} onPress={() => setOpen(index)} />} />
      {open !== null && <Viewer files={files} index={open} onClose={() => setOpen(null)} />}
    </>
  )
}

// ---------- picking ----------
/** Camera / video / gallery buttons plus the picked files, kept until the record is saved. */
export function MediaPicker({ value, onChange, onlyImages, label = 'الصور والفيديو' }: { value: Picked[]; onChange: (p: Picked[]) => void; onlyImages?: boolean; label?: string }) {
  const toast = useToast()
  const run = async (fn: () => Promise<{ picked: Picked[]; error?: string }>) => {
    const r = await fn()
    if (r.error) toast(r.error, 'error')
    if (r.picked.length) onChange(onlyImages ? r.picked.slice(-1) : [...value, ...r.picked])
  }
  return (
    <View style={{ gap: 10 }}>
      <T w="bold" style={{ color: C.ink2 }}>{label}</T>
      <Row style={{ gap: 8 }}>
        <PickBtn icon="camera" label="صورة" onPress={() => run(() => takeWithCamera('image'))} />
        {!onlyImages && <PickBtn icon="videocam" label="فيديو 3 د" onPress={() => run(() => takeWithCamera('video'))} />}
        <PickBtn icon="images" label="المعرض" onPress={() => run(() => pickFromGallery(onlyImages))} />
      </Row>
      {value.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {value.map((p, i) => (
            <View key={p.uri + i}>
              <Thumb f={p} size={84} />
              <Pressable onPress={() => onChange(value.filter((_, k) => k !== i))} style={s.remove} hitSlop={8} accessibilityLabel="إزالة"><Ionicons name="close" size={16} color="#fff" /></Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function PickBtn({ icon, label, onPress }: { icon: 'camera' | 'videocam' | 'images'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.pick, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <Ionicons name={icon} size={24} color={C.navy} />
      <T w="bold" style={{ color: C.navy, fontSize: 14 }}>{label}</T>
    </Pressable>
  )
}

/** Add files straight to an existing record (gallery, worker photo…), with progress. */
export function AddMedia({ entity, id, tag, onlyImages, label = 'إضافة صور أو فيديو' }: { entity: Entity; id: number; tag?: string; onlyImages?: boolean; label?: string }) {
  const toast = useToast()
  const { poke } = useSync()
  const [busy, setBusy] = useState<string | null>(null)
  const go = async (fn: () => Promise<{ picked: Picked[]; error?: string }>) => {
    const r = await fn()
    if (r.error) toast(r.error, 'error')
    if (!r.picked.length) return
    const res = await uploadAll(entity, id, r.picked, tag, (d, t, p) => setBusy(`جارٍ الرفع ${d + 1} من ${t} — ${Math.round(p * 100)}%`))
    setBusy(null)
    if (res.ok) { toast(res.ok === 1 ? 'تم رفع الملف' : `تم رفع ${res.ok} ملفات`); poke() }
    if (res.error) toast(res.error, 'error')
  }
  return (
    <View style={{ gap: 8 }}>
      {busy ? (
        <Row style={s.busy}><ActivityIndicator color={C.good} /><T w="bold" style={{ color: C.good, flex: 1 }}>{busy}</T></Row>
      ) : (
        <Row style={{ gap: 8 }}>
          <PickBtn icon="camera" label="صورة" onPress={() => go(() => takeWithCamera('image'))} />
          {!onlyImages && <PickBtn icon="videocam" label="فيديو" onPress={() => go(() => takeWithCamera('video'))} />}
          <PickBtn icon="images" label="المعرض" onPress={() => go(() => pickFromGallery(onlyImages))} />
        </Row>
      )}
      {!busy && <T style={{ color: C.muted, fontSize: 13 }}>{label}</T>}
    </View>
  )
}

const s = StyleSheet.create({
  thumb: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#ece8e4', borderWidth: 1, borderColor: C.line },
  more: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.navySoft },
  tag: { position: 'absolute', bottom: 4, start: 4, backgroundColor: 'rgba(18,12,58,.8)', borderRadius: 99, paddingHorizontal: 6 },
  remove: { position: 'absolute', top: 4, end: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: C.bad, alignItems: 'center', justifyContent: 'center' },
  pick: { flex: 1, minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 2 },
  busy: { minHeight: 56, borderRadius: 14, backgroundColor: C.goodBg, paddingHorizontal: 14, gap: 10 },
  vTop: { paddingHorizontal: 12, paddingBottom: 10, gap: 10 },
  vBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  caption: { color: '#fff', textAlign: 'center', paddingHorizontal: 16 },
  vNav: { position: 'absolute', start: 0, end: 0, justifyContent: 'space-between', paddingHorizontal: 16 },
  vNavBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,.15)', alignItems: 'center', justifyContent: 'center' },
})
