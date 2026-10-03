/**
 * Seeds Firestore `templates/*` from the app's bundled catalogue.
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=... npm run seed
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

initializeApp();
const templates = JSON.parse(readFileSync(join(__dirname, '../../../app/assets/templates/templates.json'), 'utf8')) as Array<{ id: string }>;

(async () => {
  const db = getFirestore();
  const batch = db.batch();
  for (const { id, ...t } of templates) batch.set(db.doc(`templates/${id}`), { ...t, is_published: true }, { merge: true });
  await batch.commit();
  console.log(`seeded ${templates.length} templates`);
})();
