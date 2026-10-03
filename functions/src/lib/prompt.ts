/** Safety clauses appended to every prompt (non-negotiable, see spec §3). */
export const SAFETY_SUFFIX =
  'modest clothing fully covering shoulders, arms and legs, respectful and dignified, ' +
  "preserve the person's real facial identity, face shape and natural skin tone exactly, do not westernize features";

export const SAFETY_NEGATIVE =
  'text, letters, words, typography, writing, calligraphy, watermark, logo, signature, ' +
  'nudity, revealing clothing, cleavage, bare shoulders, alcohol, religious figures, prophets, ' +
  'deformed face, distorted features, extra limbs, lowres, blurry';

export interface TemplateDoc {
  prompt_template: string;
  negative_prompt?: string;
  outfit?: string;
  background?: string;
  gender_variant?: 'male' | 'female' | 'unisex';
  model_id?: string;
  style_strength?: number;
  credits_cost?: number;
  is_premium?: boolean;
  is_published?: boolean;
  active_from?: string | null;
  active_to?: string | null;
}

const GENDER_WORD: Record<string, string> = { male: 'man', female: 'woman' };

export function buildPrompt(t: TemplateDoc, gender: string): { prompt: string; negative: string } {
  const g = GENDER_WORD[gender] ?? GENDER_WORD[t.gender_variant ?? ''] ?? 'person';
  let prompt = t.prompt_template
    .replaceAll('{gender}', g)
    .replaceAll('{outfit}', t.outfit ?? '')
    .replaceAll('{background}', t.background ?? '');
  if (gender === 'female') prompt += ', wearing an elegant hijab or modest head covering';
  prompt = `${prompt.replace(/,\s*,/g, ',').trim()}, ${SAFETY_SUFFIX}`;
  const negative = [t.negative_prompt ?? '', SAFETY_NEGATIVE].filter(Boolean).join(', ');
  return { prompt, negative };
}

export function isTemplateActive(t: TemplateDoc, now: Date): boolean {
  if (t.is_published === false) return false;
  if (t.active_from && now < new Date(t.active_from)) return false;
  if (t.active_to && now > new Date(t.active_to)) return false;
  return true;
}
