/** يضغط صورة الإثبات (أقصى بعد 1100px، JPEG 0.72) ليبقى حجم التخزين صغيراً */
export function compressImage(file: File, max = 1000, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('الملف ليس صورة'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    img.src = url;
  });
}

import { isNative, saveFileNative } from './native';

export function downloadBlob(blob: Blob, filename: string) {
  if (isNative()) {
    saveFileNative(blob, filename, true);
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** مشاركة ملف عبر قائمة المشاركة في الجوال، وإلا تنزيله */
export async function shareOrDownload(blob: Blob, filename: string, title: string) {
  if (isNative()) {
    await saveFileNative(blob, filename, true);
    return;
  }
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch {
      /* ألغى المستخدم المشاركة */
    }
  }
  downloadBlob(blob, filename);
}
