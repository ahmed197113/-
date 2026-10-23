'use strict';
const path = require('node:path');
const { createApp } = require('./app');
const { startJobs } = require('./jobs');
const push = require('./push');
const { seed } = require('./seed');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const { app, db } = createApp({ dbFile: path.join(dataDir, 'mawqii.db'), dataDir });

if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  seed(db);
  console.log('تمت إضافة البيانات التجريبية');
}
push.enable(db);
startJobs(db);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`«موقعي» يعمل على http://localhost:${port}`));
