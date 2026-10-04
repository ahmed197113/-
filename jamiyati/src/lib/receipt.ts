// رسم الإيصال الرقمي كصورة PNG عبر Canvas (بلا مكتبات) — يدعم العربية واتجاه RTL
import { L, getLang } from './i18n';

export interface ReceiptData {
  receiptNo: string;
  circle: string;
  member: string;
  amount: string;
  cycle: string;
  paidAt: string;
  confirmedAt: string;
  confirmedBy: string;
  method: string;
  watermark: boolean;
}

export function renderReceiptPNG(d: ReceiptData): Promise<Blob> {
  const W = 720, H = 960, rtl = getLang() === 'ar';
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.direction = rtl ? 'rtl' : 'ltr';
  const font = (w: number, s: number) => `${w} ${s}px "IBM Plex Sans Arabic", Tahoma, sans-serif`;
  g.fillStyle = '#eef5f3';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  roundRect(g, 32, 32, W - 64, H - 64, 28);
  g.fill();
  g.fillStyle = '#0f766e';
  roundRect(g, 32, 32, W - 64, 170, 28);
  g.fill();
  g.fillRect(32, 150, W - 64, 52);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = font(800, 40);
  g.fillText(L('إيصال دفعة', 'Payment receipt'), W / 2, 110);
  g.font = font(500, 22);
  g.fillText(`${L('رقم', 'No.')} ${d.receiptNo}`, W / 2, 150);
  // علامة الصح
  g.beginPath();
  g.arc(W / 2, 270, 46, 0, Math.PI * 2);
  g.fillStyle = '#dcfce7';
  g.fill();
  g.strokeStyle = '#15803d';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W / 2 - 20, 270);
  g.lineTo(W / 2 - 4, 286);
  g.lineTo(W / 2 + 22, 254);
  g.stroke();
  g.fillStyle = '#0f2a27';
  g.font = font(800, 54);
  g.fillText(d.amount, W / 2, 390);
  g.font = font(600, 22);
  g.fillStyle = '#15803d';
  g.fillText(L('دفعة مؤكدة ✓', 'Confirmed ✓'), W / 2, 428);
  const rows: [string, string][] = [
    [L('الجمعية', 'Circle'), d.circle],
    [L('العضو', 'Member'), d.member],
    [L('الدورة', 'Cycle'), d.cycle],
    [L('تاريخ الدفع', 'Paid on'), d.paidAt],
    [L('طريقة الدفع', 'Method'), d.method],
    [L('أكّدها', 'Confirmed by'), d.confirmedBy],
    [L('وقت التأكيد', 'Confirmed at'), d.confirmedAt],
  ];
  let y = 500;
  const xs = rtl ? W - 80 : 80, xe = rtl ? 80 : W - 80;
  for (const [k, v] of rows) {
    g.strokeStyle = '#e3ece9';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(80, y + 18);
    g.lineTo(W - 80, y + 18);
    g.stroke();
    g.textAlign = rtl ? 'right' : 'left';
    g.fillStyle = '#5b7470';
    g.font = font(500, 22);
    g.fillText(k, xs, y);
    g.textAlign = rtl ? 'left' : 'right';
    g.fillStyle = '#0f2a27';
    g.font = font(700, 22);
    g.fillText(v, xe, y, 380);
    y += 54;
  }
  g.textAlign = 'center';
  g.fillStyle = '#7b918d';
  g.font = font(500, 17);
  g.fillText(L('التطبيق أداة توثيق فقط ولا يحتفظ بالأموال', 'Jamiyati documents payments only and never holds money'), W / 2, H - 70);
  if (d.watermark) {
    g.save();
    g.translate(W / 2, H / 2 + 60);
    g.rotate(-0.4);
    g.fillStyle = 'rgba(15,118,110,0.07)';
    g.font = font(900, 120);
    g.fillText(L('جمعيتي', 'Jamiyati'), 0, 0);
    g.restore();
  }
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
