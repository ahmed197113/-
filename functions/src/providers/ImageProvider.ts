export interface GenerateInput {
  /** Short-lived signed HTTPS URLs to the user's selfies. */
  selfieUrls: string[];
  prompt: string;
  negativePrompt: string;
  model: string;
  aspectRatio: '9:16' | '1:1' | '4:5';
  count: number;
  styleStrength: number;
  timeoutMs: number;
}

export interface GeneratedImage {
  url: string;
  /** Provider-side safety flag, when available. */
  flaggedNsfw?: boolean;
}

export interface GenerateResult {
  images: GeneratedImage[];
  /** Estimated cost in USD, for the cost guard. */
  costUsd: number;
  provider: string;
}

/** Every AI backend implements this; swap via `config/runtime.primaryProvider`. */
export interface ImageProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<GenerateResult>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

export const SIZE: Record<GenerateInput['aspectRatio'], { width: number; height: number }> = {
  '9:16': { width: 768, height: 1344 },
  '4:5': { width: 896, height: 1120 },
  '1:1': { width: 1024, height: 1024 },
};

export async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.text();
  if (!res.ok) {
    throw new ProviderError(`HTTP ${res.status}: ${body.slice(0, 300)}`, res.status >= 500 || res.status === 429);
  }
  return body ? JSON.parse(body) : {};
}
