import { RuntimeConfig } from '../lib/config';
import { FalProvider } from './falProvider';
import { GenerateInput, GenerateResult, ImageProvider, ProviderError } from './ImageProvider';
import { MockProvider } from './mockProvider';
import { ReplicateProvider } from './replicateProvider';

export interface ProviderKeys {
  fal?: string;
  replicate?: string;
}

export function makeProvider(name: string, keys: ProviderKeys): ImageProvider | null {
  switch (name) {
    case 'fal':
      return keys.fal ? new FalProvider(keys.fal) : null;
    case 'replicate':
      return keys.replicate ? new ReplicateProvider(keys.replicate) : null;
    case 'mock':
      return new MockProvider();
    default:
      return null;
  }
}

/** Primary with retries (exponential backoff), then the fallback provider. */
export async function generateWithFallback(
  input: GenerateInput,
  primary: ImageProvider | null,
  fallback: ImageProvider | null,
  retries = 2,
  baseDelayMs = 1000,
): Promise<GenerateResult> {
  const chain = [primary, fallback].filter((p): p is ImageProvider => p !== null);
  if (!chain.length) throw new Error('no AI provider configured');
  let last: unknown;
  for (const provider of chain) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await provider.generate(input);
      } catch (e) {
        last = e;
        if (e instanceof ProviderError && !e.retryable) break;
        await new Promise((r) => setTimeout(r, 2 ** attempt * baseDelayMs));
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export function resolveModel(cfg: RuntimeConfig, templateModel: string | undefined): string {
  return cfg.models[templateModel ?? 'default'] ?? cfg.models.default;
}
