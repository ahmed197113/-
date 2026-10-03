import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

import { REGION } from './lib/config';

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 20 });

export { createGenerationJob, processJob } from './jobs';
export { revenuecatWebhook } from './billing';
export { scheduledCleanup, deleteMyPhotos, deleteAccount } from './privacy';
export { redeemReferral } from './referrals';
export { adminUpsertTemplate, adminGrantCredits, adminMetrics, adminSetConfig } from './admin';
