# Switch AI provider (no app update)

Edit Firestore `config/runtime` (or `adminSetConfig`):
```json
{ "primaryProvider": "replicate", "fallbackProvider": "fal",
  "models": { "default": "owner/model:version" } }
```
Providers: `fal`, `replicate`, `mock`. Keys: `firebase functions:secrets:set FAL_KEY` / `REPLICATE_TOKEN`.

To add a provider: implement `ImageProvider` (`functions/src/providers/`), register it in `makeProvider`, add a secret, deploy.
