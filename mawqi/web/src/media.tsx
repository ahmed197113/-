// Photos, videos and PDFs: pick, shrink, upload with progress, show in a grid and a full-screen viewer.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getToken } from './api'
import { Icon } from './icons'
import { toast, useCan } from './ui'
import { useAuth } from './auth'

export interface MediaFile {
  id: number; kind: 'image' | 'video' | 'file'; tag: string | null; caption: string | null; mime: string; size: number; name: string | null
  url: string; created_at: string; by: string | null; created_by?: number | null; entity?: string; entity_id?: number
}

/** The uploader can remove their own file; the general manager and the system manager can remove any. */
export function useCanDeleteFile() {
  const can = useCan()
  const { user } = useAuth()
  return (f: MediaFile) => can('delete') || (!!user && f.created_by === user.id)
}
export type Entity = 'daily_report' | 'issue' | 'worker' | 'project' | 'invoice' | 'direct_order'

/** File URLs carry the token because <img> and <video> cannot send headers. */
export const src = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(getToken() ?? '')}`

export const MAX_MB = 500
export const ACCEPT_MEDIA = 'image/*,video/*'
export const ACCEPT_ALL = 'image/*,video/*,application/pdf'

/** Phone photos are 3–8 MB; shrinking to 1920px keeps them sharp at ~300 KB. */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400_000) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export function uploadFile(entity: Entity, id: number, file: File, opts: { tag?: string; caption?: string; onProgress?: (p: number) => void } = {}): Promise<MediaFile> {
  return new Promise(async (resolve, reject) => {
    if (file.size > MAX_MB * 1024 * 1024) return reject(new Error(`«${file.name}» أكبر من ${MAX_MB} ميجا — قلّل مدة الفيديو أو جودته`))
    const body = await shrink(file)
    const q = new URLSearchParams({ entity, id: String(id) })
    if (opts.tag) q.set('tag', opts.tag)
    if (opts.caption) q.set('caption', opts.caption)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/attachments?${q}`)
    xhr.setRequestHeader('authorization', `Bearer ${getToken() ?? ''}`)
    xhr.setRequestHeader('content-type', body.type || file.type || 'application/octet-stream')
    xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name))
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total) }
    xhr.onload = () => {
      let out: { error?: string } & MediaFile = {} as MediaFile
      try { out = JSON.parse(xhr.responseText) } catch { /* not json */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(out)
      else reject(new Error(out.error || (xhr.status === 413 ? 'الملف أكبر مما تسمح به الاستضافة' : 'تعذر رفع الملف')))
    }
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء رفع الملف'))
    xhr.send(body)
  })
}

/** Uploads a list one after another and reports overall progress; returns how many succeeded. */
export async function uploadAll(entity: Entity, id: number, files: File[], tag?: string, onProgress?: (done: number, total: number, part: number) => void) {
  let ok = 0
  for (let i = 0; i < files.length; i++) {
    try {
      await uploadFile(entity, id, files[i], { tag, onProgress: (p) => onProgress?.(i, files.length, p) })
      ok++
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  if (ok) window.dispatchEvent(new Event('mawqi:changed'))
  return ok
}

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} ميجا` : `${Math.max(1, Math.round(b / 1024))} ك.ب`)

// ---------- viewer ----------
export function Lightbox({ files, index, onClose }: { files: MediaFile[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)
  const f = files[i]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setI((x) => Math.min(files.length - 1, x + 1))
      if (e.key === 'ArrowRight') setI((x) => Math.max(0, x - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [files.length, onClose])
  if (!f) return null
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <div className="lb-top" onClick={(e) => e.stopPropagation()}>
        <span>{i + 1} / {files.length}{f.caption ? ` · ${f.caption}` : ''}{f.by ? ` · ${f.by}` : ''} · {f.created_at.replace('T', ' ')}</span>
        <a className="lb-btn" href={src(`${f.url}?download=1`)} title="تحميل"><Icon name="download" size={20} /></a>
        <button className="lb-btn" onClick={onClose} aria-label="إغلاق">×</button>
      </div>
      <div className="lb-body" onClick={(e) => e.stopPropagation()}>
        {f.kind === 'image' && <img src={src(f.url)} alt={f.caption ?? ''} />}
        {f.kind === 'video' && <video src={src(f.url)} controls autoPlay playsInline />}
        {f.kind === 'file' && <iframe src={src(f.url)} title={f.name ?? 'ملف'} />}
      </div>
      {i > 0 && <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); setI(i - 1) }} aria-label="السابق">›</button>}
      {i < files.length - 1 && <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); setI(i + 1) }} aria-label="التالي">‹</button>}
    </div>
  )
}

// ---------- grid ----------
export function MediaGrid({ files, onDelete, small, max }: { files: MediaFile[]; onDelete?: (f: MediaFile) => void; small?: boolean; max?: number }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!files.length) return null
  const shown = max ? files.slice(0, max) : files
  const more = max && files.length > max ? files.length - max : 0
  return (
    <>
      <div className={`mgrid ${small ? 'small' : ''}`}>
        {shown.map((f, i) => (
          <div key={f.id} className={`mcell k-${f.kind}`} onClick={(e) => { e.stopPropagation(); setOpen(i) }} title={f.caption ?? f.name ?? ''}>
            {f.kind === 'image' && <img src={src(f.url)} alt={f.caption ?? ''} loading="lazy" />}
            {f.kind === 'video' && <><video src={`${src(f.url)}#t=0.5`} preload="metadata" muted playsInline /><span className="play">▶</span></>}
            {f.kind === 'file' && <span className="doc"><Icon name="contracts" size={small ? 22 : 30} /><small>{f.name ?? 'PDF'}</small></span>}
            {f.tag && TAGS[f.tag] && !small && <em className="mtag">{TAGS[f.tag]}</em>}
            {i === shown.length - 1 && more > 0 && <span className="more">+{more}</span>}
            {onDelete && !small && (
              <button className="mdel" onClick={(e) => { e.stopPropagation(); if (window.confirm('حذف هذا الملف؟')) onDelete(f) }} aria-label="حذف"><Icon name="trash" size={15} /></button>
            )}
          </div>
        ))}
      </div>
      {open !== null && <Lightbox files={files} index={open} onClose={() => setOpen(null)} />}
    </>
  )
}
export const TAGS: Record<string, string> = { before: 'قبل', after: 'بعد الحل', photo: 'الصورة الشخصية', iqama: 'الإقامة' }

// ---------- pick (before the record exists) ----------
/** Collects files inside a form; they are uploaded after the record is saved. */
export function PickFiles({ files, onChange, accept = ACCEPT_MEDIA, label = 'إضافة صور أو فيديو' }: { files: File[]; onChange: (f: File[]) => void; accept?: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const u = files.map((f) => (f.type.startsWith('image/') || f.type.startsWith('video/') ? URL.createObjectURL(f) : ''))
    setUrls(u)
    return () => u.forEach((x) => x && URL.revokeObjectURL(x))
  }, [files])
  return (
    <div className="pickfiles">
      <div className="mgrid">
        {files.map((f, i) => (
          <div key={i} className="mcell">
            {f.type.startsWith('image/') && <img src={urls[i]} alt="" />}
            {f.type.startsWith('video/') && <><video src={urls[i]} muted playsInline preload="metadata" /><span className="play">▶</span></>}
            {!f.type.startsWith('image/') && !f.type.startsWith('video/') && <span className="doc"><Icon name="contracts" size={28} /><small>{f.name}</small></span>}
            <em className="msize">{fmtSize(f.size)}</em>
            <button type="button" className="mdel" onClick={() => onChange(files.filter((_, k) => k !== i))} aria-label="إزالة"><Icon name="trash" size={15} /></button>
          </div>
        ))}
        <button type="button" className="mcell add" onClick={() => ref.current?.click()}>
          <Icon name="plus" size={28} /><small>{label}</small>
        </button>
      </div>
      <input ref={ref} type="file" accept={accept} multiple hidden onChange={(e) => {
        const picked = Array.from(e.target.files ?? [])
        const big = picked.filter((f) => f.size > MAX_MB * 1048576)
        if (big.length) toast(`تم تجاهل ${big.length} ملف أكبر من ${MAX_MB} ميجا`, 'err')
        onChange([...files, ...picked.filter((f) => f.size <= MAX_MB * 1048576)])
        e.target.value = ''
      }} />
    </div>
  )
}

// ---------- live attachments of an existing record ----------
export function Attachments({ entity, id, files, canAdd, canDelete, tag, accept = ACCEPT_MEDIA, title, empty, compact }: {
  entity: Entity; id: number; files: MediaFile[]; canAdd: boolean; canDelete?: (f: MediaFile) => boolean; tag?: string; accept?: string
  title?: ReactNode; empty?: string; compact?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number; part: number } | null>(null)
  const list = tag ? files.filter((f) => f.tag === tag) : files
  const add = async (picked: File[]) => {
    if (!picked.length) return
    setProgress({ done: 0, total: picked.length, part: 0 })
    const ok = await uploadAll(entity, id, picked, tag, (done, total, part) => setProgress({ done, total, part }))
    setProgress(null)
    if (ok) toast(ok === 1 ? 'تم رفع الملف' : `تم رفع ${ok} ملفات`)
  }
  const del = async (f: MediaFile) => {
    try {
      const r = await fetch(`/api/attachments/${f.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${getToken() ?? ''}` } })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error || 'تعذر الحذف')
      toast('تم حذف الملف')
      window.dispatchEvent(new Event('mawqi:changed'))
    } catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <div className={`attach ${compact ? 'compact' : ''}`}>
      {(title || canAdd) && (
        <div className="attach-head">
          {title && <h3>{title} {list.length > 0 && <em>{list.length}</em>}</h3>}
          {canAdd && <button type="button" className="btn sm" onClick={() => ref.current?.click()} disabled={!!progress}><Icon name="plus" size={16} /> إضافة</button>}
        </div>
      )}
      {progress && (
        <div className="upbar">
          <span>جارٍ الرفع {progress.done + 1} من {progress.total} — {Math.round(progress.part * 100)}%</span>
          <div className="meter"><i className="good" style={{ width: `${((progress.done + progress.part) / progress.total) * 100}%` }} /></div>
        </div>
      )}
      {list.length ? <MediaGrid files={list} onDelete={canDelete ? (f) => (canDelete(f) ? del(f) : toast('الحذف متاح لمن رفع الملف أو للمدير العام', 'err')) : undefined} />
        : !progress && empty ? <p className="muted attach-empty">{empty}</p> : null}
      <input ref={ref} type="file" accept={accept} multiple hidden onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = '' }} />
    </div>
  )
}
