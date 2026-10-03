import { GenerateInput, GenerateResult, ImageProvider } from './ImageProvider';

/** Echoes the selfie back; used by the emulator and integration tests. */
export class MockProvider implements ImageProvider {
  readonly name = 'mock';
  constructor(private readonly failTimes = 0) {}
  private calls = 0;

  async generate(input: GenerateInput): Promise<GenerateResult> {
    this.calls++;
    if (this.calls <= this.failTimes) throw new Error('mock failure');
    return {
      images: Array.from({ length: input.count }, () => ({ url: input.selfieUrls[0] })),
      costUsd: 0,
      provider: this.name,
    };
  }
}
