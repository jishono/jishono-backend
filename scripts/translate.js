/**
 * AI Translation Script
 *
 * Generates Norwegian→Japanese definitions for oppslag entries that have none.
 * Pre-fetches definitions from Bokmålsordboka (JSON API) and NAOB (HTML scraping)
 * to guide Claude on the number and scope of meanings per word.
 * Outputs an SQL file that can be applied directly to the production database.
 *
 * Usage:
 *   npm run translate -- --boy-tabell adj              # translate adjectives (required)
 *   npm run translate -- --boy-tabell adj --limit 30   # translate first 30 words only
 *   npm run translate -- --boy-tabell adj --dry-run    # preview without generating SQL file
 *   npm run translate -- --boy-tabell adj --batch-size 10 # override words per API call (default: 30)
 *   npm run translate -- --boy-tabell adj --skip-lookup   # skip dictionary lookups
 *   npm run translate -- --boy-tabell adj --no-examples  # exclude usage examples from context
 *   npm run translate -- --boy-tabell adj --insert     # insert directly into the database (default: false)
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.prod') });

const fs = require('fs');
const path = require('path');
const db = require('../app/db/database');
const {
  SOURCE_LABEL,
  CLASS_SPECIFIC_RULES,
  buildSystemPrompt,
  fetchConcepts,
  fetchDictionaryContext,
  translateBatch,
  generateSqlStatements,
  sleep,
} = require('../app/services/translateService');
const Anthropic = require('@anthropic-ai/sdk');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const VALID_BOY_TABELLER = Object.keys(CLASS_SPECIFIC_RULES);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: null, dryRun: false, insert: false, batchSize: 30, skipLookup: false, noExamples: false, boyTabell: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--insert') opts.insert = true;
    if (args[i] === '--skip-lookup') opts.skipLookup = true;
    if (args[i] === '--no-examples') opts.noExamples = true;
    if (args[i] === '--limit') opts.limit = parseInt(args[++i], 10);
    if (args[i] === '--batch-size') opts.batchSize = parseInt(args[++i], 10);
    if (args[i] === '--boy-tabell') opts.boyTabell = args[++i];
  }
  if (!opts.boyTabell) {
    console.error(`Usage: npm run translate -- --boy-tabell <${VALID_BOY_TABELLER.join('|')}> [--limit N] [--batch-size N] [--dry-run] [--insert] [--skip-lookup] [--no-examples]`);
    process.exit(1);
  }
  if (!VALID_BOY_TABELLER.includes(opts.boyTabell)) {
    console.error(`[translate] Invalid --boy-tabell "${opts.boyTabell}". Must be one of: ${VALID_BOY_TABELLER.join(', ')}`);
    process.exit(1);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------
async function fetchUntranslatedWords(boyTabell, limit) {
  const params = [boyTabell];
    let query = `
    SELECT o.lemma_id, o.oppslag, o.boy_tabell, o.bmo_article_id
    FROM oppslag AS o
    LEFT JOIN frekvens AS f ON f.lemma = o.oppslag
    WHERE o.lemma_id NOT IN (SELECT lemma_id FROM definisjon)
      AND o.is_hidden = false
    AND o.boy_tabell = $1
      AND LENGTH(o.oppslag) > 1
      AND o.oppslag NOT IN ('Æ', 'æ', 'Ø', 'ø', 'Å', 'å')
      AND o.ledd IS null
      --AND NOT EXISTS (
      --  SELECT 1 FROM oppslag o2
      --  WHERE o2.oppslag = o.oppslag AND o2.boy_tabell = o.boy_tabell AND o2.lemma_id != o.lemma_id
      --)
    ORDER BY f.score ASC NULLS LAST
  `;
  if (limit) {
    query += ` LIMIT $2`;
    params.push(limit);
  }
  return db.query(query, params);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[translate] ANTHROPIC_API_KEY is not set in .env');
    process.exit(1);
  }

  const client = new Anthropic();
  const systemPrompt = buildSystemPrompt(opts.boyTabell);

  await fetchConcepts();

  console.log(`[translate] Word class: ${opts.boyTabell}`);
  console.log(`[translate] Fetching untranslated words${opts.limit ? ` (limit: ${opts.limit})` : ''}...`);
  const words = await fetchUntranslatedWords(opts.boyTabell, opts.limit);
  console.log(`[translate] Found ${words.length} untranslated ${opts.boyTabell} words`);

  if (words.length === 0) {
    console.log('[translate] Nothing to do.');
    process.exit(0);
  }

  // Phase 1: Enrich all words with dictionary context
  let enrichedWords;
  if (opts.skipLookup) {
    enrichedWords = words.map(({ lemma_id, oppslag, boy_tabell, bmo_article_id }) => ({
      lemma_id, oppslag, boy_tabell, bmo_article_id, bokmaal: [],
    }));
  } else {
    const lookupBatches = [];
    for (let i = 0; i < words.length; i += opts.batchSize) {
      lookupBatches.push(words.slice(i, i + opts.batchSize));
    }

    console.log(`[translate] Looking up ${words.length} words in dictionaries (${lookupBatches.length} batch(es))...`);
    enrichedWords = [];
    const skippedWords = [];
    for (let i = 0; i < lookupBatches.length; i++) {
      process.stdout.write(`[translate] Lookup batch ${i + 1}/${lookupBatches.length}: ${lookupBatches[i].length} words... `);
      const enriched = await fetchDictionaryContext(lookupBatches[i]);
      for (const w of enriched) {
        if (w.bokmaal.length > 0) {
          enrichedWords.push(w);
        } else {
          skippedWords.push(w);
        }
      }
      const found = enriched.filter((w) => w.bokmaal.length > 0).length;
      const noId = lookupBatches[i].filter((w) => !w.bmo_article_id).length;
      console.log(`${found}/${lookupBatches[i].length} found${noId > 0 ? ` (${noId} had no bmo_article_id)` : ''}`);
    }
    if (skippedWords.length > 0) {
      console.log(`[translate] ${skippedWords.length} words skipped (no senses): ${skippedWords.map((w) => w.oppslag).join(', ')}`);
    }
  }

  if (enrichedWords.length === 0) {
    console.log('[translate] No words with dictionary context. Nothing to do.');
    process.exit(0);
  }

  // Phase 2: Batch enriched words into full-sized batches for Claude
  const batches = [];
  for (let i = 0; i < enrichedWords.length; i += opts.batchSize) {
    batches.push(enrichedWords.slice(i, i + opts.batchSize));
  }

  console.log(`[translate] Translating ${enrichedWords.length} words in ${batches.length} batch(es) of up to ${opts.batchSize}${opts.dryRun ? ' (dry run)' : ''}${opts.insert ? ' (inserting into DB)' : ''}`);

  const allSqlLines = [];
  let totalDefinitions = 0;
  let skippedBatches = 0;

  for (let i = 0; i < batches.length; i++) {
    const enrichedBatch = batches[i];

    process.stdout.write(`[translate] Batch ${i + 1}/${batches.length}: translating ${enrichedBatch.length} words... `);

    const result = await translateBatch(client, enrichedBatch, systemPrompt, { includeExamples: !opts.noExamples });

    if (!result) {
      console.log('SKIPPED (parse error)');
      skippedBatches++;
    } else {
      const wordLookup = new Map(enrichedBatch.map((w) => [w.lemma_id, w]));
      const { lines, count } = generateSqlStatements(result, wordLookup);
      allSqlLines.push(...lines);
      totalDefinitions += count;
      console.log(`${count} definitions generated`);

      if (opts.insert && lines.length > 0) {
        await db.query('BEGIN');
        try {
          for (const line of lines) {
            const sql = line.replace(/--.*$/, '').trim();
            if (sql) await db.query(sql);
          }
          await db.query('COMMIT');
          console.log(`[translate] Batch ${i + 1}: ${count} definitions inserted`);
        } catch (err) {
          await db.query('ROLLBACK');
          throw err;
        }
      }
    }

    if (i < batches.length - 1) await sleep(500);
  }

  if (opts.dryRun) {
    console.log('\n-- DRY RUN: SQL that would be generated --');
    for (const line of allSqlLines) console.log(line);
    console.log(`\n[translate] Dry run complete. ${totalDefinitions} definitions would be generated.`);
  } else if (allSqlLines.length > 0) {
    if (opts.insert) {
      console.log(`\n[translate] Done. ${totalDefinitions} definitions inserted across ${batches.length - skippedBatches} batch(es).`);
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `translations_${opts.boyTabell}_${timestamp}.sql`;
      const outPath = path.join(__dirname, filename);
      const header = `-- Generated by translate.js on ${new Date().toISOString()}\n-- Model: ${SOURCE_LABEL}\n-- Word class: ${opts.boyTabell}\n-- ${totalDefinitions} definitions\n\nBEGIN;\n\n`;
      const footer = '\nCOMMIT;\n';
      fs.writeFileSync(outPath, header + allSqlLines.join('\n') + footer);
      console.log(`\n[translate] Done. ${totalDefinitions} definitions written to ${outPath}`);
    }
  } else {
    console.log('\n[translate] No definitions generated.');
  }

  if (skippedBatches > 0) {
    console.log(`[translate] ${skippedBatches} batch(es) skipped due to errors.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[translate] Fatal error:', err);
  process.exit(1);
});
