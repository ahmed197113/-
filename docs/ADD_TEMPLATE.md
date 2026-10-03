# Add a new template (no app update)

1. Admin panel → Templates → New (or call `adminUpsertTemplate`). Required: `id`, `title_ar`, `title_en`, `category`, `prompt_template` (with `{gender}`, `{outfit}`, `{background}` slots), `text_presets`.
2. Optional scheduling: `active_from` / `active_to` (ISO dates) and `country_tags` (empty = all countries).
3. Upload `cover_image_url` / `sample_images` (otherwise the app draws a procedural cover from `cover_style.motif` + `colors`; motifs: lantern, crescent, mosque, pattern, balloons, stars, gradcap, rings, baby, cake, flag, studio).
4. Test-generate with a test face, then set `is_published: true`.
5. Safety rules (modest clothing, no text, identity preservation) are appended server-side to every prompt — you don't need to repeat them.

To ship a template inside the app bundle too, add it to `app/assets/templates/templates.json` (unit tests validate the schema).
