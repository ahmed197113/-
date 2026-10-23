'use strict';
const path = require('node:path');
const multer = require('multer');
const { token, HttpError } = require('./util');

const KINDS = { image: /^image\/(jpeg|png|webp|gif)$/, video: /^video\//, audio: /^audio\// };
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

function kindOf(mime) {
  for (const [k, re] of Object.entries(KINDS)) if (re.test(mime)) return k;
  return null;
}

function uploader(dir, { maxMb = 100, imagesOnly = false } = {}) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => {
        const ext = EXT[file.mimetype] || path.extname(file.originalname).replace(/[^.\w]/g, '').slice(0, 6) || '.bin';
        cb(null, `${Date.now()}-${token(8)}${ext}`);
      },
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 20 },
    fileFilter: (req, file, cb) => {
      const k = kindOf(file.mimetype);
      if (!k || (imagesOnly && k !== 'image')) return cb(new HttpError(400, 'نوع الملف غير مدعوم'));
      cb(null, true);
    },
  });
}

module.exports = { uploader, kindOf };
