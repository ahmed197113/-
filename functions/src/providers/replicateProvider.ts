import { fetchJson, GenerateInput, GenerateResult, ImageProvider, ProviderError, SIZE } from './ImageProvider';

/** Replicate predictions API (model given as "owner/name" or "owner/name:version"). */
export class ReplicateProvider implements ImageProvider {
  readonly name = 'replicate';
  constructor(private readonly token: string, private readonly costPerImageUsd = 0.04) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const headers = { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', Prefer: 'wait=60' };
    const [model, version] = input.model.split(':');
    const url = version
      ? 'https://api.replicate.com/v1/predictions'
      : `https://api.replicate.com/v1/models/${model}/predictions`;
    const size = SIZE[input.aspectRatio];
    let pred = await fetchJson(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...(version ? { version } : {}),
          input: {
            prompt: input.prompt,
            negative_prompt: input.negativePrompt,
            main_face_image: input.selfieUrls[0],
            width: size.width,
            height: size.height,
            num_outputs: input.count,
            id_weight: input.styleStrength,
          },
        }),
      },
      input.timeoutMs,
    );
    const deadline = Date.now() + input.timeoutMs;
    while (pred.status === 'starting' || pred.status === 'processing') {
      if (Date.now() > deadline) throw new ProviderError('replicate timeout', true);
      await new Promise((r) => setTimeout(r, 1500));
      pred = await fetchJson(pred.urls.get, { headers }, 10_000);
    }
    if (pred.status !== 'succeeded') throw new ProviderError(`replicate ${pred.status}: ${pred.error ?? ''}`, true);
    const urls: string[] = Array.isArray(pred.output) ? pred.output : [pred.output];
    return { images: urls.map((u) => ({ url: u })), costUsd: urls.length * this.costPerImageUsd, provider: this.name };
  }
}
