// Camera, gallery and uploads for photos, videos and PDFs.
import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import { fileUrl, getServer, getToken } from './api'

export interface MediaFile {
  id: number; kind: 'image' | 'video' | 'file'; tag: string | null; caption: string | null; mime: string; size: number; name: string | null
  url: string; created_at: string; by: string | null; created_by?: number | null
}
export type Entity = 'daily_report' | 'issue' | 'worker' | 'project' | 'invoice' | 'direct_order'

/** A photo or video picked on the phone, waiting to be uploaded. */
export interface Picked { uri: string; kind: 'image' | 'video'; mime: string; size?: number; name?: string; duration?: number }

export const MAX_MB = 500
export const VIDEO_SECONDS = 180

/** File URLs carry the token because images and videos cannot send headers. */
export const mediaUri = (url: string) => fileUrl(url)

const fromAsset = (a: ImagePicker.ImagePickerAsset): Picked => ({
  uri: a.uri,
  kind: a.type === 'video' ? 'video' : 'image',
  mime: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
  size: a.fileSize ?? undefined,
  name: a.fileName ?? undefined,
  duration: a.duration ?? undefined,
})

function tooBig(list: Picked[]) {
  const big = list.filter((p) => (p.size ?? 0) > MAX_MB * 1048576)
  const long = list.filter((p) => p.kind === 'video' && (p.duration ?? 0) > VIDEO_SECONDS * 1000 + 2000)
  return { ok: list.filter((p) => !big.includes(p) && !long.includes(p)), dropped: big.length + long.length }
}

/** Take a photo or record a video (up to 3 minutes) with the camera. */
export async function takeWithCamera(kind: 'image' | 'video'): Promise<{ picked: Picked[]; error?: string }> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) return { picked: [], error: 'اسمح للتطبيق باستخدام الكاميرا من إعدادات الجوال' }
  const r = await ImagePicker.launchCameraAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    quality: 0.8,
    videoMaxDuration: VIDEO_SECONDS,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  })
  if (r.canceled) return { picked: [] }
  const { ok, dropped } = tooBig(r.assets.map(fromAsset))
  return { picked: ok, error: dropped ? `الفيديو أطول من 3 دقائق أو أكبر من ${MAX_MB} ميجا` : undefined }
}

/** Pick photos and videos from the phone's gallery. */
export async function pickFromGallery(onlyImages = false): Promise<{ picked: Picked[]; error?: string }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return { picked: [], error: 'اسمح للتطبيق بالوصول إلى الصور من إعدادات الجوال' }
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: onlyImages ? ['images'] : ['images', 'videos'],
    allowsMultipleSelection: !onlyImages,
    selectionLimit: 10,
    quality: 0.8,
    videoMaxDuration: VIDEO_SECONDS,
  })
  if (r.canceled) return { picked: [] }
  const { ok, dropped } = tooBig(r.assets.map(fromAsset))
  return { picked: ok, error: dropped ? `تم تجاهل ${dropped} فيديو أطول من 3 دقائق أو أكبر من ${MAX_MB} ميجا` : undefined }
}

/** Phone photos are several MB; 1600px JPEG keeps them sharp at a few hundred KB. */
async function shrink(p: Picked): Promise<Picked> {
  if (p.kind !== 'image' || Platform.OS === 'web') return p
  try {
    const out = await manipulateAsync(p.uri, [{ resize: { width: 1600 } }], { compress: 0.72, format: SaveFormat.JPEG })
    return { ...p, uri: out.uri, mime: 'image/jpeg' }
  } catch {
    return p
  }
}

/** Upload one picked file to a record; reports progress from 0 to 1. */
export async function uploadPicked(entity: Entity, id: number, p: Picked, tag?: string, onProgress?: (x: number) => void): Promise<MediaFile> {
  const file = await shrink(p)
  const q = new URLSearchParams({ entity, id: String(id) })
  if (tag) q.set('tag', tag)
  const url = `${getServer()}/api/attachments?${q}`
  const headers = { authorization: `Bearer ${getToken() ?? ''}`, 'content-type': file.mime, 'x-file-name': encodeURIComponent(file.name ?? '') }

  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob()
    const res = await fetch(url, { method: 'POST', headers, body: blob })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'تعذر رفع الملف')
    onProgress?.(1)
    return body as MediaFile
  }

  const task = FileSystem.createUploadTask(url, file.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  }, (e) => { if (e.totalBytesExpectedToSend > 0) onProgress?.(e.totalBytesSent / e.totalBytesExpectedToSend) })
  let res: FileSystem.FileSystemUploadResult | null | undefined
  try {
    res = await task.uploadAsync()
  } catch {
    throw new Error('انقطع الاتصال أثناء رفع الملف — تأكد من الإنترنت وحاول مرة أخرى')
  }
  if (!res) throw new Error('تم إلغاء الرفع')
  let body: { error?: string } & MediaFile = {} as MediaFile
  try { body = JSON.parse(res.body) } catch { /* not json */ }
  if (res.status < 200 || res.status >= 300) throw new Error(body.error || (res.status === 413 ? 'الملف أكبر مما تسمح به الاستضافة' : 'تعذر رفع الملف'))
  return body
}

/** Upload several files one after another; returns how many succeeded and the first error. */
export async function uploadAll(entity: Entity, id: number, list: Picked[], tag?: string, onProgress?: (done: number, total: number, part: number) => void) {
  let ok = 0
  let error: string | undefined
  for (let i = 0; i < list.length; i++) {
    try {
      await uploadPicked(entity, id, list[i], tag, (x) => onProgress?.(i, list.length, x))
      ok++
    } catch (e) {
      error ??= (e as Error).message
    }
  }
  return { ok, error }
}

export async function deleteFile(id: number) {
  const res = await fetch(`${getServer()}/api/attachments/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${getToken() ?? ''}` } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'تعذر حذف الملف')
}

export const TAGS: Record<string, string> = { before: 'قبل', after: 'بعد الحل', photo: 'الصورة الشخصية', iqama: 'الإقامة', doc: 'مستند' }
