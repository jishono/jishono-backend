'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const readline = require('readline');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

const connectionString = process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER_ADMIN_NODE}:${process.env.DB_PASS_ADMIN_NODE}@${process.env.DB_HOST_NODE}:${process.env.DB_PORT_NODE}/${process.env.DB_NAME_NODE}`;
const pool = new Pool({ connectionString });

const db = {
  query: (text, params) => pool.query(text, params),
  bulkInsert: async (baseQuery, rows, columnsPerRow) => {
    if (rows.length === 0) return;
    const values = rows.map((row, i) => {
      const offset = i * columnsPerRow;
      return `(${row.map((_, j) => `$${offset + j + 1}`).join(', ')})`;
    }).join(', ');
    await pool.query(`${baseQuery} VALUES ${values}`, rows.flat());
  },
};

const URLS = {
  no: 'https://downloads.tatoeba.org/exports/per_language/nob/nob_sentences.tsv.bz2',
  links: 'https://downloads.tatoeba.org/exports/links.tar.bz2',
  ja: 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2',
};

const BATCH_SIZE = 5000;

async function parseTsv(filePath, onLine) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) onLine(line.split('\t'));
  }
}

async function bulkInsertBatched(baseQuery, rows, columnsPerRow) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.bulkInsert(baseQuery, rows.slice(i, i + BATCH_SIZE), columnsPerRow);
  }
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regen_examples_'));
  console.log(`Working in temp dir: ${tmpDir}`);

  const cleanup = () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(1));
  process.on('SIGTERM', () => process.exit(1));

  // --- Downloads ---

  const noBzPath = path.join(tmpDir, 'nob_sentences.tsv.bz2');
  console.log('Downloading Norwegian sentences...');
  await download(URLS.no, noBzPath);
  execSync(`bunzip2 "${noBzPath}"`, { stdio: 'inherit' });
  const noPath = noBzPath.slice(0, -4); // strip .bz2

  const linksTarBzPath = path.join(tmpDir, 'links.tar.bz2');
  console.log('Downloading links...');
  await download(URLS.links, linksTarBzPath);
  execSync(`tar -xjf "${linksTarBzPath}" -C "${tmpDir}"`, { stdio: 'inherit' });
  const linksPath = path.join(tmpDir, 'links.csv');

  const jaBzPath = path.join(tmpDir, 'jpn_sentences.tsv.bz2');
  console.log('Downloading Japanese sentences...');
  await download(URLS.ja, jaBzPath);
  execSync(`bunzip2 "${jaBzPath}"`, { stdio: 'inherit' });
  const jaPath = jaBzPath.slice(0, -4); // strip .bz2

  // --- Parse ---

  console.log('Parsing Norwegian sentences...');
  const noArray = [];
  const noSet = new Set();
  await parseTsv(noPath, ([id, , text]) => {
    noSet.add(id);
    noArray.push([parseInt(id, 10), text]);
  });
  console.log(`  ${noArray.length} sentences`);

  console.log('Building Japanese ID set...');
  const jaSet = new Set();
  await parseTsv(jaPath, ([id]) => jaSet.add(id));

  console.log('Parsing links (keeping NO↔JA pairs only)...');
  const linksArray = [];
  const keepJaSet = new Set();
  await parseTsv(linksPath, ([noId, jaId]) => {
    if (noSet.has(noId) && jaSet.has(jaId)) {
      linksArray.push([parseInt(noId, 10), parseInt(jaId, 10)]);
      keepJaSet.add(jaId);
    }
  });
  console.log(`  ${linksArray.length} links`);

  console.log('Parsing Japanese sentences (linked ones only)...');
  const jaArray = [];
  await parseTsv(jaPath, ([id, , text]) => {
    if (keepJaSet.has(id)) {
      jaArray.push([parseInt(id, 10), text]);
    }
  });
  console.log(`  ${jaArray.length} sentences`);

  // --- Database ---

  console.log('Truncating tables...');
  await db.query('TRUNCATE eksempler_lenker, eksempler_no, eksempler_ja');

  console.log('Inserting Norwegian sentences...');
  await bulkInsertBatched('INSERT INTO eksempler_no (no_id, no_setning)', noArray, 2);

  console.log('Inserting Japanese sentences...');
  await bulkInsertBatched('INSERT INTO eksempler_ja (ja_id, ja_setning)', jaArray, 2);

  console.log('Inserting links...');
  await bulkInsertBatched('INSERT INTO eksempler_lenker (no_id, ja_id)', linksArray, 2);

  console.log('\nDone!');
  console.log(`  Norwegian sentences: ${noArray.length}`);
  console.log(`  Japanese sentences:  ${jaArray.length}`);
  console.log(`  Links:               ${linksArray.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
