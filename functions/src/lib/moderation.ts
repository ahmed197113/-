import { fetchJson } from '../providers/ImageProvider';

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * NSFW moderation for inputs and outputs. Uses fal's image safety model;
 * outputs are additionally screened by the provider's own safety checker.
 */
export class Moderator {
  constructor(private readonly falKey: string | undefined, private readonly threshold = 0.5) {}

  async check(imageUrl: string): Promise<ModerationResult> {
    if (!this.falKey) return { allowed: true, reason: 'moderation_unconfigured' };
    try {
      const out = await fetchJson(
        'https://fal.run/fal-ai/imageutils/nsfw',
        {
          method: 'POST',
          headers: { Authorization: `Key ${this.falKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl }),
        },
        20_000,
      );
      const p = Number(out.nsfw_probability ?? 0);
      return p >= this.threshold ? { allowed: false, reason: 'nsfw' } : { allowed: true };
    } catch {
      // Fail closed: if moderation is down we do not ship unchecked images.
      return { allowed: false, reason: 'moderation_unavailable' };
    }
  }
}
