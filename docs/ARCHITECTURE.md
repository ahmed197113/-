# Architecture

## Generation flow
1. App: ML Kit on-device checks (one face, size, yaw, sharpness, light, eyes) → auto-crop 4:5 → upload to `uploads/{uid}/{uploadId}/n.jpg`.
2. `createGenerationJob` (callable, App Check): validate → template active/premium → rate limit (20/h) → **Firestore transaction: check balance → deduct → create `jobs/{id}` (queued)**.
3. `processJob` (Firestore trigger): signed URLs → input moderation → prompt (+ safety suffix/negative) → `ImageProvider` (retries, fallback) → cost recorded → output moderation (provider flag + NSFW model, fail-closed) → Storage `results/…` → `done` → FCM push. Any failure → `failed` + **exactly-once refund**.
4. App: results grid → editor composites Arabic text with Flutter's text engine (HarfBuzz shaping + ICU bidi) on a `RepaintBoundary` → PNG at 1080 px (free, watermark) or 2160 px (Pro, 4K).

## Arabic text
The AI is told never to draw text (negative prompt) and the app never asks it to. All text is rendered by the app using bundled OFL fonts. `test/golden/` renders 54 tricky strings (لا، الله، ة/ى/ء، tashkeel, mixed `Ahmed أحمد 2026`, long wrapping greetings) in all 10 fonts, plus RTL-placement and lam-alef ligature assertions.

## Credits
Server is the source of truth (`users/{uid}.credits`, `pro_until`, `pro_used_week`). Clients cannot write these (rules). RevenueCat webhook grants are idempotent by event id. Pure rules in `functions/src/lib/credits.ts` mirror `app/lib/features/credits/application/credit_ledger.dart`; both are unit-tested.

## Cost guard
Each job's AI cost is added to `costs/{yyyy-mm-dd}`. Reaching `config/runtime.dailyBudgetUsd` flips `killSwitch` and posts to `ALERT_WEBHOOK_URL` (Slack-compatible). Credits are always deducted before any AI call.

## Region
`europe-west1` (Belgium) for Functions, Firestore and Storage: the lowest-latency Firebase region with full product support (Firestore, Functions v2, Storage triggers) for both the Gulf and North Africa. `me-central1/2` is closer to the Gulf but some Firebase products/features (e.g. scheduled functions, Storage default buckets) have had partial availability there; revisit for PDPL data-residency if required.

## Privacy
Selfies deleted after 24 h (hourly sweep), results after 30 days, "delete my photos" and full "delete account" callables, consent screen with own-photo + 18+ confirmations, report button on every result (`reports` collection).
Minors: on-device detection cannot estimate age; the consent gate blocks child photos by policy and moderation runs server-side. An age-estimation model can be added to `Moderator` before production launch.
