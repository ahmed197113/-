import { fetchJson, GenerateInput, GenerateResult, ImageProvider, ProviderError, SIZE } from './ImageProvider';

/** fal.ai queue API with an identity-preserving model (e.g. fal-ai/flux-pulid). */
export class FalProvider implements ImageProvider {
  readonly name = 'fal';
  constructor(private readonly key: string, private readonly costPerImageUsd = 0.035) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const headers = { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' };
    const deadline = Date.now() + input.timeoutMs;
    const submit = await fetchJson(
      `https://queue.fal.run/${input.model}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: input.prompt,
          negative_prompt: input.negativePrompt,
          reference_image_url: input.selfieUrls[0],
          image_size: SIZE[input.aspectRatio],
          num_images: input.count,
          id_weight: input.styleStrength,
          enable_safety_checker: true,
        }),
      },
      15_000,
    );
    const statusUrl: string = submit.status_url;
    const responseUrl: string = submit.response_url;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await fetchJson(statusUrl, { headers }, 10_000);
      if (st.status === 'COMPLETED') break;
      if (st.status === 'FAILED' || st.status === 'ERROR') throw new ProviderError('fal job failed', true);
    }
    if (Date.now() >= deadline) throw new ProviderError('fal timeout', true);
    const out = await fetchJson(responseUrl, { headers }, 15_000);
    const flags: boolean[] = out.has_nsfw_concepts ?? [];
    const images = (out.images ?? []).map((im: { url: string }, i: number) => ({ url: im.url, flaggedNsfw: flags[i] ?? false }));
    if (!images.length) throw new ProviderError('fal returned no images', true);
    return { images, costUsd: images.length * this.costPerImageUsd, provider: this.name };
  }
}
