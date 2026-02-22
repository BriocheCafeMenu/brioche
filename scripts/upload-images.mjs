#!/usr/bin/env node

/**
 * Converts local images to WebP and uploads to R2 via wrangler CLI.
 * Requires: sharp (npm install sharp), wrangler authenticated.
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TMP = join(__dirname, '.tmp-webp');

const BUCKET = 'brioche-menu';

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

async function main() {
  console.log('=== Converting and uploading images ===\n');

  // Create temp directory
  if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

  const seen = new Set();
  let uploaded = 0;
  let skipped = 0;

  for (const [r2Path, localPath] of Object.entries(IMAGE_MAP)) {
    if (seen.has(r2Path)) continue;
    seen.add(r2Path);

    const fullPath = join(ROOT, localPath);
    if (!existsSync(fullPath)) {
      console.log(`  SKIP (not found): ${localPath}`);
      skipped++;
      continue;
    }

    // Convert to WebP
    const tmpFile = join(TMP, r2Path.replace(/\//g, '_'));
    const originalSize = readFileSync(fullPath).length;

    await sharp(fullPath)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(tmpFile);

    const webpSize = readFileSync(tmpFile).length;

    // Upload via wrangler
    try {
      execSync(
        `npx wrangler r2 object put "${BUCKET}/${r2Path}" --file="${tmpFile}" --content-type=image/webp --remote`,
        { cwd: ROOT, stdio: 'pipe' }
      );
      console.log(`  OK: ${localPath} (${(originalSize / 1024).toFixed(0)}KB) -> ${r2Path} (${(webpSize / 1024).toFixed(0)}KB)`);
      uploaded++;
    } catch (err) {
      console.error(`  FAIL: ${r2Path} - ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped`);

  // Cleanup
  execSync(`rm -rf "${TMP}"`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
