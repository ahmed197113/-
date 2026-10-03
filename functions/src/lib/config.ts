import { defineSecret, defineString } from 'firebase-functions/params';

/** Region close to Arab users; see docs/ARCHITECTURE.md for the rationale. */
export const REGION = 'europe-west1';

export const FAL_KEY = defineSecret('FAL_KEY');
export const REPLICATE_TOKEN = defineSecret('REPLICATE_TOKEN');
export const REVENUECAT_WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');
export const ALERT_WEBHOOK_URL = defineString('ALERT_WEBHOOK_URL', { default: '' });

/** Mutable runtime knobs live in Firestore `config/runtime` (admin-editable). */
export interface RuntimeConfig {
  primaryProvider: 'fal' | 'replicate' | 'mock';
  fallbackProvider: 'fal' | 'replicate' | 'mock' | 'none';
  /** Provider model id per logical model ("default" etc.). */
  models: Record<string, string>;
  variations: number;
  dailyBudgetUsd: number;
  killSwitch: boolean;
  jobsPerHourPerUser: number;
  providerTimeoutMs: number;
}

export const DEFAULT_RUNTIME: RuntimeConfig = {
  primaryProvider: 'fal',
  fallbackProvider: 'replicate',
  models: { default: 'fal-ai/flux-pulid' },
  variations: 4,
  dailyBudgetUsd: 50,
  killSwitch: false,
  jobsPerHourPerUser: 20,
  providerTimeoutMs: 90_000,
};
