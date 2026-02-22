#!/usr/bin/env node

/**
 * Migration script: uploads seed-menu.json and converts/uploads images to R2.
 *
 * Prerequisites:
 *   npm install sharp @aws-sdk/client-s3
 *
 * Usage:
 *   node scripts/migrate.js
 *
 * Environment variables (set before running):
 *   R2_ACCOUNT_ID    - Cloudflare account ID
 *   R2_ACCESS_KEY_ID - R2 API token access key
 *   R2_SECRET_ACCESS_KEY - R2 API token secret
 *   R2_BUCKET_NAME   - R2 bucket name (default: brioche-menu)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- Config ---
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'YOUR_ACCOUNT_ID';
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY';
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || 'YOUR_SECRET_KEY';
const BUCKET = process.env.R2_BUCKET_NAME || 'brioche-menu';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

// Map from seed-menu.json image paths to local source files
const IMAGE_MAP = {
  'images/desserts/miod.webp': 'img/cake/miod.JPG',
  'images/desserts/nappomar.webp': 'img/cake/nappomar.jpeg',
  'images/desserts/miodmal.webp': 'img/cake/miodmal.jpeg',
  'images/desserts/napoleon.webp': 'img/cake/napoleon.JPEG',
  'images/desserts/napchok.webp': 'img/cake/napchok.JPEG',
  'images/desserts/ester.webp': 'img/cake/ester.JPG',
  'images/desserts/shutrus.webp': 'img/cake/shutrus.JPEG',
  'images/desserts/roladabez.webp': 'img/cake/roladabez.JPEG',
  'images/desserts/serncap.webp': 'img/cake/serncap.jpeg',
  'images/desserts/serniklawanda.webp': 'img/cake/serniklawanda.JPEG',
  'images/desserts/tartcyt.webp': 'img/cake/tartcyt.jpg',
  'images/desserts/tartczek.webp': 'img/cake/tartczek.jpeg',
  'images/desserts/tiramis.webp': 'img/cake/tiramis.JPEG',
  'images/desserts/tmojito.webp': 'img/cake/tmojito.JPG',
  'images/briosz/karmeljabl.webp': 'img/briosz/karmeljabl.jpeg',
  'images/briosz/krembud.webp': 'img/briosz/krembud.jpeg',
  'images/briosz/snickersb.webp': 'img/briosz/snickersb.jpeg',
  'images/briosz/malinczekol.webp': 'img/briosz/malinczekol.jpeg',
  'images/briosz/zmakiem.webp': 'img/briosz/zmakiem.jpeg',
  'images/briosz/lotus.webp': 'img/briosz/lotus.jpeg',
  'images/cocktails/grzane_wino.webp': 'img/cocktails/grzane_wino.jpeg',
  'images/cocktails/soksw.webp': 'img/cocktails/Soksw.jpeg',
  'images/lunch/serniki.webp': 'img/lunch/serniki.JPG',
  'images/lunch/szakszuka.webp': 'img/lunch/szakszuka.jpeg',
  'images/lunch/sniad_wiej.webp': 'img/lunch/sniad wiej.jpeg',
  'images/lunch/tost.webp': 'img/lunch/tost.jpeg',
};

async function convertAndUpload(r2Path, localPath) {
  const fullPath = join(ROOT, localPath);
  if (!existsSync(fullPath)) {
    console.warn(`  SKIP (not found): ${localPath}`);
    return false;
  }

  const webpBuffer = await sharp(fullPath)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Path,
    Body: webpBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  const originalSize = readFileSync(fullPath).length;
  console.log(`  OK: ${localPath} (${(originalSize / 1024).toFixed(0)}KB) -> ${r2Path} (${(webpBuffer.length / 1024).toFixed(0)}KB)`);
  return true;
}

async function uploadMenu() {
  const menuJson = readFileSync(join(__dirname, 'seed-menu.json'), 'utf-8');

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: 'menu.json',
    Body: menuJson,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=300',
  }));

  console.log('  OK: menu.json uploaded');
}

async function main() {
  console.log('=== Brioche Menu Migration ===\n');

  console.log('1. Converting and uploading images...');
  let uploaded = 0;
  let skipped = 0;
  const seen = new Set();

  for (const [r2Path, localPath] of Object.entries(IMAGE_MAP)) {
    // Skip duplicates (e.g. krembud.webp used by multiple briosz items)
    if (seen.has(r2Path)) continue;
    seen.add(r2Path);

    const ok = await convertAndUpload(r2Path, localPath);
    if (ok) uploaded++;
    else skipped++;
  }

  console.log(`\n   Images: ${uploaded} uploaded, ${skipped} skipped\n`);

  console.log('2. Uploading menu.json...');
  await uploadMenu();

  console.log('\n=== Migration complete ===');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
