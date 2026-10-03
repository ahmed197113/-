# مناسبة | Munasaba — AI Photo Studio for Arab Occasions

Selfie → occasion portrait (Eid, Ramadan, graduation, national days, traditional outfits…) → **perfect Arabic calligraphy** composited by the app (never drawn by the AI) → share to WhatsApp / Snapchat / Instagram / TikTok.

## Install on your phone
Every push builds a signed APK in GitHub Actions and publishes it under **Releases** (`build-N`). Open the release on your Android phone, download `munasaba.apk`, and allow "install unknown apps".

Without backend config the app runs in **demo mode**: everything works on-device (templates, selfie checks, festive preview cards from your photo, the full Arabic editor, export/share, gallery, simulated store). Connect Firebase + an AI key to get real AI portraits.

## Repo layout
| Path | What |
|---|---|
| `app/` | Flutter app (Android + iOS-ready). Feature-first: `lib/features/<feature>/{domain,data,application,presentation}` |
| `functions/` | Cloud Functions (TypeScript): jobs, AI provider abstraction, moderation, RevenueCat webhook, cleanup, referrals, admin API |
| `firestore.rules`, `storage.rules` | Security rules (credits are server-write-only) |
| `docs/` | Architecture, add-a-template, switch-provider, cost table |

## Run locally
```bash
cd app
flutter pub get
flutter test                 # unit + Arabic golden tests
flutter run                  # demo mode
flutter run $(cat ../.env | sed 's/^/--dart-define=/')   # with Firebase (see .env.example)
```

Backend:
```bash
cd functions && npm install && npm test && npm run build
firebase use dev
firebase functions:secrets:set FAL_KEY
firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
firebase deploy --only functions,firestore,storage
npm run seed                 # loads the 41 bundled templates into Firestore
```

## CI secrets (GitHub → Settings → Secrets → Actions)
| Secret | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Release signing (without them the APK is signed with a CI debug key — fine for testing, but each build's key differs, so uninstall before updating) |
| `APP_DART_DEFINES` | Space-separated `KEY=value` list from `.env.example` to build a connected (non-demo) app |

## Environments
Two Firebase projects: `munasaba-dev` and `munasaba-prod` (`.firebaserc`). AI keys live only in Functions secrets, never in the client.
