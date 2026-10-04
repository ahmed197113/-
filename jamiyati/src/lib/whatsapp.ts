// رسائل واتساب جاهزة بنص لطيف وقابل للتعديل — تُفتح عبر wa.me دون أي خادم
import { L } from './i18n';
import { date, money } from './format';

export type TemplateKind = 'before3' | 'dueDay' | 'late' | 'turn' | 'invite' | 'thanks' | 'lottery' | 'statement';

export interface TemplateVars {
  name: string;
  circle: string;
  amount: number;
  currency: string;
  dueDate?: string;
  cycle?: number;
  recipient?: string;
  pot?: number;
  code?: string;
  link?: string;
  organizer?: string;
  order?: string;
  statement?: string;
}

export function template(kind: TemplateKind, v: TemplateVars): string {
  const amt = money(v.amount, v.currency);
  const d = v.dueDate ? date(v.dueDate) : '';
  switch (kind) {
    case 'before3':
      return L(
        `السلام عليكم ${v.name} 🌿\nتذكير ودّي: قسط "${v.circle}" (${amt}) موعده ${d} إن شاء الله.\nبعد التحويل ارفع الإثبات من التطبيق أو أرسله هنا. جزاك الله خيراً 🤍`,
        `Hi ${v.name} 🌿\nFriendly reminder: your "${v.circle}" installment (${amt}) is due on ${d}.\nPlease share the transfer proof after paying. Thank you 🤍`,
      );
    case 'dueDay':
      return L(
        `صباح الخير ${v.name} ☀️\nاليوم موعد قسط "${v.circle}" (${amt}).\nإذا حوّلت فشكراً لك، وارفع الإثبات ليتأكد التسجيل 🙏`,
        `Good morning ${v.name} ☀️\nToday is the due date for "${v.circle}" (${amt}).\nIf you've already paid, thank you! Please upload the proof 🙏`,
      );
    case 'late':
      return L(
        `أهلاً ${v.name} 🤍\nأتمنى أن تكون بخير. لاحظت أن قسط "${v.circle}" (${amt}) المستحق في ${d} لم يُسجَّل بعد.\nإذا كان هناك ظرف فأخبرني ونتفاهم، والجميع ينتظر دوره 🙏`,
        `Hi ${v.name} 🤍\nHope you're well. The "${v.circle}" installment (${amt}) due on ${d} isn't recorded yet.\nIf something came up, just let me know so we can sort it out 🙏`,
      );
    case 'turn':
      return L(
        `📢 "${v.circle}" — الدورة ${v.cycle}\nدور ${v.recipient} هذه المرة، والمبلغ ${money(v.pot ?? 0, v.currency)} 🎉\nموعد القسط ${d}. بارك الله للجميع.`,
        `📢 "${v.circle}" — cycle ${v.cycle}\nIt's ${v.recipient}'s turn, payout ${money(v.pot ?? 0, v.currency)} 🎉\nInstallment due ${d}.`,
      );
    case 'invite':
      return L(
        `السلام عليكم 🌿\nأدعوك للانضمام إلى جمعية "${v.circle}" على تطبيق جمعيتي.\nالقسط: ${amt}\nكود الدعوة: ${v.code}\n${v.link ?? ''}`,
        `Hi 🌿\nYou're invited to join "${v.circle}" on Jamiyati.\nInstallment: ${amt}\nInvite code: ${v.code}\n${v.link ?? ''}`,
      );
    case 'lottery':
      return L(
        `🎲 نتيجة قرعة "${v.circle}"\n(البذرة: ${v.code} — يمكن لأي عضو التحقق منها في التطبيق)\n\n${v.order}\n\nبالتوفيق للجميع 🤍`,
        `🎲 "${v.circle}" lottery result\n(seed: ${v.code} — verifiable in the app)\n\n${v.order}`,
      );
    case 'statement':
      return L(
        `📋 كشف حساب ${v.name} — "${v.circle}"\n${v.statement}\n\nللاستفسار تواصل معي. شكراً لالتزامك 🤍`,
        `📋 ${v.name}'s statement — "${v.circle}"\n${v.statement}`,
      );
    case 'thanks':
      return L(
        `شكراً ${v.name} 🌷 تم تأكيد دفعتك (${amt}) في "${v.circle}".`,
        `Thanks ${v.name} 🌷 Your payment (${amt}) in "${v.circle}" is confirmed.`,
      );
  }
}

/** رابط واتساب: الرقم دولي بلا + أو أصفار بادئة */
export function waLink(phone: string | undefined, text: string): string {
  const p = (phone ?? '').replace(/\D/g, '').replace(/^00/, '');
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
