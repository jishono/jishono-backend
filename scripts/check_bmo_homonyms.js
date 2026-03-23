'use strict';

/**
 * check_bmo_homonyms.js
 *
 * Finds homonym groups (same oppslag + boy_tabell, multiple lemma_ids) where at least one
 * entry has both a bmo_article_id and definisjon entries. Fetches the Norwegian senses from
 * BMO for each bmo_article_id and prints them alongside the Japanese definitions so the
 * entries can be inspected for mismatches.
 *
 * Usage:
 *   node scripts/check_bmo_homonyms.js
 *   node scripts/check_bmo_homonyms.js --boy-tabell subst
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.prod') });

const fs = require('fs');
const path = require('path');
const db = require('../app/db/database');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { boyTabell: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--boy-tabell') opts.boyTabell = args[++i];
  }
  return opts;
}

// ---------------------------------------------------------------------------
// DB: fetch homonym groups that have at least one entry with bmo_article_id + definitions
// ---------------------------------------------------------------------------
async function fetchHomonymGroups(boyTabell) {
  const params = [];
  let boyFilter = '';
  if (boyTabell) {
    params.push(boyTabell);
    boyFilter = `AND o.boy_tabell = $${params.length}`;
  }

  const query = `
    WITH groups AS (
      SELECT oppslag, boy_tabell
      FROM oppslag
      WHERE is_hidden = false AND ledd IS NULL
      ${boyFilter}
      GROUP BY oppslag, boy_tabell
      HAVING COUNT(*) > 1
    )
    SELECT
      o.lemma_id,
      o.oppslag,
      o.boy_tabell,
      o.bmo_article_id,
      COALESCE(
        json_agg(d.definisjon ORDER BY d.prioritet) FILTER (WHERE d.def_id IS NOT NULL),
        '[]'
      ) AS definisjoner
    FROM oppslag o
    JOIN groups g ON g.oppslag = o.oppslag AND g.boy_tabell = o.boy_tabell
    LEFT JOIN definisjon d ON d.lemma_id = o.lemma_id
    WHERE o.is_hidden = false AND o.ledd IS NULL
    GROUP BY o.lemma_id, o.oppslag, o.boy_tabell, o.bmo_article_id
    ORDER BY o.oppslag, o.boy_tabell, o.lemma_id
  `;

  const rows = await db.query(query, params);

  const map = new Map();
  for (const row of rows) {
    const key = `${row.oppslag}|||${row.boy_tabell}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  // Keep only groups where at least one entry has bmo_article_id + definitions
  const filtered = new Map();
  for (const [key, group] of map) {
    const hasUsable = group.some(
      (r) => r.bmo_article_id !== null && Array.isArray(r.definisjoner) && r.definisjoner.length > 0
    );
    if (hasUsable) filtered.set(key, group);
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// BMO: fetch senses for a single article by ID
// ---------------------------------------------------------------------------
function resolveExplanationText(el) {
  if (!el.content) return null;
  let text = el.content;
  for (const item of (el.items || [])) {
    if (item.type_ === 'article_ref' && item.lemmas?.[0]?.lemma) {
      text = text.replace('$', item.lemmas[0].lemma);
    } else if (item.id) {
      text = text.replace('$', String(item.id));
    }
  }
  const trimmed = text.trim();
  if (!trimmed || trimmed === '$') return null;
  if (trimmed.endsWith(':') && /^brukt (som|i|ved)\b/.test(trimmed)) return null;
  if (trimmed.startsWith('jamfør ') || /^se \S+$/.test(trimmed)) return null;
  return trimmed;
}

function extractSenses(definitions) {
  const senses = [];
  for (const def of definitions) {
    if (def.sub_definition) continue;
    const elements = def.elements || [];

    const topExpl = elements.filter((el) => el.type_ === 'explanation');
    if (topExpl.length > 0) {
      const parts = topExpl.map(resolveExplanationText).filter(Boolean);
      if (parts.length > 0) senses.push(parts.join('; '));
    }

    for (const subDef of elements.filter((el) => el.type_ === 'definition')) {
      const subExpls = (subDef.elements || []).filter((el) => el.type_ === 'explanation');
      const parts = subExpls.map(resolveExplanationText).filter(Boolean);
      if (parts.length > 0) senses.push(parts.join('; '));
    }
  }
  return senses;
}

async function fetchBmoArticleSenses(articleId) {
  try {
    const res = await fetch(`https://ord.uib.no/bm/article/${articleId}.json`);
    if (!res.ok) return null;
    const article = await res.json();
    const senses = extractSenses(article.body?.definitions || []);
    const lemmaForms = (article.lemmas || []).map((l) => l.lemma).join(', ');
    return { senses, lemmaForms };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();
  const groups = await fetchHomonymGroups(opts.boyTabell);

  const suffix = opts.boyTabell ? `_${opts.boyTabell}` : '';
  const outPath = path.join(__dirname, `bmo_homonyms${suffix}.txt`);
  const out = fs.createWriteStream(outPath);
  const log = (line = '') => out.write(line + '\n');

  log(`Found ${groups.size} homonym group(s) with translatable entries`);
  log();

  for (const [key, group] of groups) {
    const [oppslag, boyTabell] = key.split('|||');
    log(`=== ${oppslag} (${boyTabell}) ===`);

    for (const entry of group) {
      log(`  lemma_id=${entry.lemma_id}  bmo_article_id=${entry.bmo_article_id ?? 'null'}`);

      if (entry.bmo_article_id !== null) {
        const bmo = await fetchBmoArticleSenses(entry.bmo_article_id);
        if (bmo) {
          log(`    BMO lemmas: ${bmo.lemmaForms}`);
          if (bmo.senses.length > 0) {
            bmo.senses.forEach((s, i) => log(`    BMO ${i + 1}: ${s}`));
          } else {
            log(`    BMO: (no senses extracted)`);
          }
        } else {
          log(`    BMO: (fetch failed)`);
        }
        await sleep(100);
      }

      const defs = Array.isArray(entry.definisjoner) && entry.definisjoner.length > 0
        ? entry.definisjoner
        : null;
      if (defs) {
        defs.forEach((d, i) => log(`    JA  ${i + 1}: ${d}`));
      } else {
        log(`    JA: (no definitions)`);
      }
    }

    log();
    process.stdout.write(`\r[${groups.size} groups] processed: ${oppslag}          `);
  }

  await new Promise((resolve) => out.end(resolve));
  console.log(`\nWritten to ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
