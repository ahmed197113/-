import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../icons'
import { Modal, send, toast, useMeta } from '../ui'

/** Column names we understand (Arabic or English), mapped to the API fields. */
const COLUMNS: { key: string; label: string; names: string[]; required?: boolean; sample: string }[] = [
  { key: 'name', label: 'الاسم', names: ['الاسم', 'اسم العامل', 'name'], required: true, sample: 'محمد أحمد علي' },
  { key: 'iqama_no', label: 'رقم الإقامة', names: ['رقم الإقامة', 'الإقامة', 'رقم الهوية', 'iqama', 'iqama_no', 'id'], required: true, sample: '2412345678' },
  { key: 'iqama_expiry', label: 'انتهاء الإقامة', names: ['انتهاء الإقامة', 'تاريخ انتهاء الإقامة', 'expiry', 'iqama_expiry'], sample: '2027-05-30' },
  { key: 'nationality', label: 'الجنسية', names: ['الجنسية', 'nationality'], sample: 'مصري' },
  { key: 'profession', label: 'المهنة', names: ['المهنة', 'الوظيفة', 'profession'], sample: 'نجار مسلح' },
  { key: 'phone', label: 'الجوال', names: ['الجوال', 'الهاتف', 'رقم الجوال', 'phone'], sample: '0551234567' },
  { key: 'wage_type', label: 'نوع الأجر', names: ['نوع الأجر', 'wage_type'], sample: 'يومي' },
  { key: 'wage', label: 'الأجر', names: ['الأجر', 'الراتب', 'اليومية', 'wage'], sample: '150' },
  { key: 'project', label: 'الموقع', names: ['الموقع', 'المشروع', 'الموقع الحالي', 'project'], sample: 'المصنع' },
  { key: 'subcontractor', label: 'مقاول الباطن', names: ['مقاول الباطن', 'المقاول', 'subcontractor'], sample: '' },
]
type Row = Record<string, string>

const clean = (v: unknown) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v ?? '').trim()
}

function toRows(table: unknown[][]): { rows: Row[]; missing: string[] } {
  const [head = [], ...body] = table
  const idx: Record<string, number> = {}
  head.forEach((h, i) => {
    const n = clean(h).toLowerCase()
    const col = COLUMNS.find((c) => c.names.some((x) => x.toLowerCase() === n))
    if (col && idx[col.key] === undefined) idx[col.key] = i
  })
  const missing = COLUMNS.filter((c) => c.required && idx[c.key] === undefined).map((c) => c.label)
  const rows = body
    .map((r) => Object.fromEntries(COLUMNS.map((c) => [c.key, idx[c.key] === undefined ? '' : clean(r[idx[c.key]])])) as Row)
    .filter((r) => r.name || r.iqama_no)
  return { rows, missing }
}

export default function ImportWorkers({ onClose }: { onClose: () => void }) {
  const meta = useMeta()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; updated: number; errors: { row: number; error: string }[] } | null>(null)

  const load = (table: unknown[][]) => {
    const r = toRows(table)
    setRows(r.rows)
    setMissing(r.missing)
    setResult(null)
    if (!r.rows.length) toast('لم أجد صفوفاً — تأكد أن أول سطر فيه أسماء الأعمدة', 'err')
  }
  const readFile = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      load(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' }) as unknown[][])
    } catch {
      toast('تعذر قراءة الملف — استخدم ملف Excel أو CSV', 'err')
    }
  }
  const readPaste = () => load(paste.trim().split(/\r?\n/).map((l) => l.split('\t')))

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.label), COLUMNS.map((c) => c.sample)])
    ws['!cols'] = COLUMNS.map(() => ({ wch: 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'العمال')
    XLSX.writeFile(wb, 'نموذج-استيراد-العمال.xlsx')
  }

  const go = async () => {
    setBusy(true)
    try {
      const out = (await send('/api/workers/import', 'POST', { rows })) as typeof result
      setResult(out)
      if (out && (out.added || out.updated)) toast(`تمت إضافة ${out.added} وتحديث ${out.updated} عامل`)
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const places = (meta?.places ?? []).map((p) => p.name)
  const unknownPlaces = [...new Set(rows.map((r) => r.project).filter((p) => p && !places.includes(p) && !/^(المصنع|مصنع|الورشة)$/.test(p)))]

  return (
    <Modal title="استيراد العمال من Excel" onClose={onClose} wide footer={
      <>
        <button className="btn ghost" onClick={onClose}>{result ? 'إغلاق' : 'إلغاء'}</button>
        {!result && <button className="btn primary" disabled={!rows.length || !!missing.length || busy} onClick={go}>{busy ? 'جارٍ الاستيراد…' : `استيراد ${rows.length} عامل`}</button>}
      </>
    }>
      {!result ? (
        <div className="import">
          <ol className="steps">
            <li><b>جهّز ملف Excel</b> فيه عمود للاسم ورقم الإقامة على الأقل، أو حمّل النموذج واملأه.
              <button className="btn sm" onClick={template}><Icon name="download" size={16} /> تحميل النموذج</button></li>
            <li><b>ارفع الملف</b> أو انسخ الجدول من Excel والصقه في المربع.</li>
            <li><b>راجع</b> الصفوف ثم اضغط «استيراد». العامل الموجود من قبل (نفس رقم الإقامة) تُحدَّث بياناته.</li>
          </ol>
          <div className="import-src">
            <button className="drop" onClick={() => fileRef.current?.click()}><Icon name="exports" size={30} /><b>اختر ملف Excel أو CSV</b><small>xlsx · xls · csv</small></button>
            <div className="paste">
              <textarea rows={5} placeholder="أو الصق هنا الجدول المنسوخ من Excel (مع سطر العناوين)" value={paste} onChange={(e) => setPaste(e.target.value)} />
              <button className="btn sm" disabled={!paste.trim()} onClick={readPaste}>قراءة الجدول</button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }} />
          <p className="muted">الأعمدة المقبولة: {COLUMNS.map((c) => c.label).join('، ')}. اكتب في «الموقع» اسم المشروع كما هو في النظام أو «المصنع». الأجر يومي ما لم تكتب «شهري».</p>
          {missing.length > 0 && <div className="form-error">الملف ينقصه عمود: {missing.join('، ')}</div>}
          {unknownPlaces.length > 0 && <div className="notice">مواقع غير موجودة في النظام (ستُرفض صفوفها): {unknownPlaces.join('، ')} — أضف المشروع أولاً أو صحّح الاسم.</div>}
          {rows.length > 0 && (
            <div className="table-scroll import-preview">
              <table className="data">
                <thead><tr><th>#</th>{COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className={!r.name || !r.iqama_no ? 'bad-row' : ''}>
                      <td>{i + 1}</td>{COLUMNS.map((c) => <td key={c.key}>{r[c.key] || <span className="muted">—</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 && <p className="muted center">… و{rows.length - 200} صف آخر</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="import-result">
          <div className="facts">
            <div><span>عمال جدد</span><b className="good-t">{result.added}</b></div>
            <div><span>تم تحديثهم</span><b>{result.updated}</b></div>
            <div><span>صفوف بها أخطاء</span><b className={result.errors.length ? 'bad-t' : ''}>{result.errors.length}</b></div>
          </div>
          {result.errors.length > 0 && (
            <ul className="list">{result.errors.slice(0, 100).map((e) => <li key={e.row}><b>صف {e.row}</b><span>{e.error}</span></li>)}</ul>
          )}
        </div>
      )}
    </Modal>
  )
}
