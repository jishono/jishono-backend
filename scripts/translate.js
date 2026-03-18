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
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../app/db/database');

const MODEL = 'claude-sonnet-4-6';
const SOURCE_LABEL = 'AI';

// ---------------------------------------------------------------------------
// Word class mapping: boy_tabell → Ordbøkene POS tag
// ---------------------------------------------------------------------------
const BOY_TABELL_MAP = {
  subst:         { tag: 'NOUN' },
  verb:          { tag: 'VERB' },
  adj:           { tag: 'ADJ' },
  adv:           { tag: 'ADV' },
  pron:          { tag: 'PRON' },
  det:           { tag: 'DET' },
  preposisjon:   { tag: 'ADP' },
  konjunksjon:   { tag: 'CCONJ' },
  subjunksjon:   { tag: 'SCONJ' },
  interjeksjon:  { tag: 'INTJ' },
  symbol:        { tag: 'SYM' },
  egennavn:      { tag: 'PROPN' },
};

// ---------------------------------------------------------------------------
// System prompt for Claude — base + per-class sections
// ---------------------------------------------------------------------------
const BASE_PROMPT_START = `You are a professional Norwegian–Japanese dictionary translator.
For each Norwegian word provided, output all distinct Japanese meanings as separate entries.

## How many definitions should a word have?
Each unique meaning/concept of the Norwegian word gets its own definition (separate field) in Japanese.
Each field can (and very often does) contain multiple Japanese words that together represent a good translation. Separate each word with a Japanese comma 、

Example: "bilde" ->
1: 画、絵、写真、映像
2: 象徴、典型
3: 描写
4: たとえ、直喩
5: 活動状況、情勢

Norwegian dictionary definitions and usage examples are provided for each word when available. Use them to guide the number and scope of Japanese translations. Usage examples (marked with "ex:") show how the word is used in context — use these to disambiguate meanings and choose more accurate Japanese translations. If a word has N distinct senses in the Norwegian dictionaries, produce approximately N Japanese meanings.
When no dictionary context is provided, limit to the 3 most common meanings.

## Contextual annotations
Only add parenthetical annotations in Japanese when the translation would be ambiguous without context, i.e. the word is clearly restricted to a specific domain or context.
Example: "anmeldelse" -> 1:（警察などへの）届け出、報告 2:（映画などの）評価、レビュー
Do NOT annotate words whose meaning is obvious from the Japanese translation alone. Most words need no annotation.

When a Bokmålsordboka sense says "brukt som [word class]", prefix the translation with the Japanese word class label in parentheses: （形容詞として）, （副詞として）, （間投詞として）, etc.
Do NOT add a word class label that matches the word's own boy_tabell — it is redundant. For example, do not prefix interjections with （間投詞として）.
When a sense starts with "brukt [qualifier]:" and the qualifier is NOT a word class, translate it as a contextual annotation in Japanese parentheses. Example: "brukt forsterkende: helt" -> （強調を表して）まったく、すっかり. Other examples: "brukt i overført betydning" -> （比喩的に）, "brukt nedsettende" -> （軽蔑的に）.

Mark slang or very informal words with（俗語）
Mark vulgar words/swear words with（卑語）
Example: "faen" ->（卑語）ちくしょう！、くそ！`;

const WORD_CLASS_NAMES = {
  adj:           'adjektiv (形容詞)',
  adv:           'adverb (副詞)',
  subst:         'substantiv (名詞)',
  verb:          'verb (動詞)',
  symbol:        'symbol (記号)',
  interjeksjon:  'interjeksjon (間投詞)',
  preposisjon:   'preposisjon (前置詞)',
};

const CLASS_SPECIFIC_RULES = {
  adj: `### Rules for adjektiv
- Na-adjectives must end with な. Example: behagelig -> 快適な (NOT 快適)
- Japanese verbs translating an adjective should end in past form ～た (exceptions: use ～ている when ～た is unnatural). Example: lei -> 飽きた (NOT 飽きる)
- Japanese nouns translating an adjective should end with ～の, ～のある, ～のない, or ～となる as natural. Example: aktuell -> 実際の、見込みのある (NOT 実際、見込み)
- If one of the Bokmålsordboka senses is an adverbial use of the adjective, include it but prefix with（副詞として）. Example: svær -> ...（副詞として）非常に、とても`,

  adv: `### Rules for adverb
- Translate so the Japanese word is also a natural adverb. Example: likevel -> それでも、それにもかかわらず
- If a Japanese adverb can take both に and で as particle, add に・で at the end. Example: framme -> 前方に・で (NOT 前方)`,

  subst: `### Rules for substantiv
- Translate to the standard base form in Japanese. Example: billett -> 切符、チケット、入場券
- Plants and animals with kanji that are not 常用漢字 should be written in katakana. Example: einstape -> ワラビ (NOT 蕨)
- For plants and animals: if the dictionary provides a Latin scientific name, include it in the translation. Example: joer -> トウゾクカモメ科（Stercorariidae）`,

  verb: `### Rules for verb
- Translate to ru-form (dictionary form), NOT te-iru form or other forms. Example: spise -> 食べる (NOT 食べた・食べ・食べている)
- Pay attention to whether the Norwegian definition describes a transitive action (doing something to an object) or intransitive (something the subject does), and reflect that in the Japanese. Example: "duppe ned i vann" (transitive) -> 水に沈める, "gå under vann" (intransitive) -> 水に潜る`,

  symbol: `### Rules for symbol
- For abbreviations of units/terms: translate to the Japanese word and include the source word in parentheses. Example: ml -> （milliliterの略として）ミリリットル
- For chemical element symbols: translate to the Japanese element name followed by （の元素記号）. Example: Cl -> 塩素（の元素記号）
- For unit symbols of measurements: translate to the Japanese unit name followed by （の単位記号）. Example: Hz -> ヘルツ（の単位記号）`,

  interjeksjon: `### Rules for interjeksjon
- Translate naturally as Japanese interjections. Do NOT prefix with（間投詞として）— it is redundant for this word class.`,

  preposisjon: `### Rules for preposisjon
- Translate the prepositional meaning. Japanese does not have prepositions as such — use the closest particle or expression.`,
};

const BASE_PROMPT_END = `## Output format
- Each meaning must be 100 characters or fewer
- All translations must be in Japanese only — never include English or Norwegian words. Use katakana for loanwords. Exception: Latin scientific names are allowed.
- Output ONLY a raw JSON array — no explanation, no markdown fences, no \`\`\`
- Each element must have "lemma_id" (integer, from input) and "meanings" (array of strings)
- Example output:
[{"lemma_id":123,"meanings":["画、絵、写真、映像","象徴、典型","描写"]}]`;

function buildSystemPrompt(boyTabell) {
  const className = WORD_CLASS_NAMES[boyTabell] || boyTabell;
  const classSection = `## Word class
All words in this batch are ${boyTabell} (${className}).
The Japanese translations MUST match the word class of the Norwegian word as closely as possible.
Some Norwegian words are spelled identically but have different word classes — the boy_tabell confirms which one to translate.`;

  const rules = CLASS_SPECIFIC_RULES[boyTabell] || '';

  return [BASE_PROMPT_START, classSection, rules, BASE_PROMPT_END].filter(Boolean).join('\n\n');
}

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
// Concurrency helper
// ---------------------------------------------------------------------------
function makeSemaphore(concurrency) {
  let running = 0;
  const queue = [];
  return async function run(fn) {
    if (running >= concurrency) {
      await new Promise((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      if (queue.length > 0) queue.shift()();
    }
  };
}

// ---------------------------------------------------------------------------
// Bokmålsordboka lookup (JSON API)
// ---------------------------------------------------------------------------
let conceptMap = {};

async function fetchConcepts() {
  try {
    const res = await fetch('https://ord.uib.no/bm/concepts.json');
    if (!res.ok) return;
    const data = await res.json();
    conceptMap = data.concepts || {};
    console.log(`[translate] Loaded ${Object.keys(conceptMap).length} BMO concepts`);
  } catch {
    console.warn('[translate] Failed to fetch BMO concepts, using raw IDs');
  }
}

function resolveConceptId(id) {
  const concept = conceptMap[id];
  return concept ? concept.expansion : id;
}

function extractExplanations(elements) {
  const results = [];
  if (!Array.isArray(elements)) return results;
  for (const el of elements) {
    if (el.type_ === 'explanation' && el.content) {
      // Skip label-only placeholders (e.g. "$" -> "foreldet") — these qualify sub-definitions, not standalone senses
      // But keep bare "$" when it resolves to an article_ref (synonym like "rommelig", "vid")
      const items_ = el.items || [];
      if (el.content.trim() === '$' && !items_.some((i) => i.type_ === 'article_ref')) continue;
      let text = el.content;
      // Resolve $ placeholders with referenced lemma names or entity IDs
      const items = el.items || [];
      for (const item of items) {
        if (item.type_ === 'article_ref') {
          const lemma = item.lemmas?.[0]?.lemma;
          if (lemma) text = text.replace('$', lemma);
        } else if (item.id) {
          text = text.replace('$', resolveConceptId(item.id));
        }
      }
      const trimmed = text.trim();
      // Skip label-only explanations (e.g. "brukt som substantiv:" with no definition)
      // But keep longer definitions that happen to end with a colon (they describe usage context before examples)
      if (trimmed.endsWith(':') && /^brukt (som|i|ved)\b/.test(trimmed)) continue;
      // Skip cross-references (e.g. "jamfør skogsnar", "se dann")
      if (trimmed.startsWith('jamfør ') || /^se \S+$/.test(trimmed)) continue;
      results.push(trimmed);
    }
    if (Array.isArray(el.elements)) {
      results.push(...extractExplanations(el.elements));
    }
  }
  return results;
}

function resolveExampleQuote(quote) {
  if (!quote || !quote.content) return null;
  let text = quote.content;
  for (const item of (quote.items || [])) {
    if (item.type_ === 'usage' && item.text) {
      text = text.replace('$', item.text);
    }
  }
  return text.trim();
}

function extractExamplesFromElements(elements) {
  const examples = [];
  if (!Array.isArray(elements)) return examples;
  for (const el of elements) {
    if (el.type_ === 'example' && el.quote) {
      const resolved = resolveExampleQuote(el.quote);
      if (resolved) examples.push(resolved);
    }
  }
  return examples;
}

async function fetchBokmaalSenses(oppslag, boyTabell) {
  const mapping = BOY_TABELL_MAP[boyTabell];
  if (!mapping) return [];

  const searchUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(oppslag)}&dict=bm&scope=e`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return [];

  const searchData = await searchRes.json();
  const articleIds = searchData.articles?.bm || [];
  if (articleIds.length === 0) return [];

  for (const id of articleIds) {
    const artRes = await fetch(`https://ord.uib.no/bm/article/${id}.json`);
    if (!artRes.ok) continue;

    const article = await artRes.json();

    // Check if this article matches the word class
    const lemmas = article.lemmas || [];
    const matches = lemmas.some((lemma) =>
      (lemma.paradigm_info || []).some((pi) =>
        (pi.tags || []).includes(mapping.tag)
      )
    );
    if (!matches) continue;

    // Extract senses: each "definition"-typed element is a distinct sense
    const definitions = article.body?.definitions || [];
    const senses = [];
    for (const def of definitions) {
      // sub_definition entries at the top level are subordinate to the preceding sense, not standalone
      if (def.sub_definition) continue;
      const elements = def.elements || [];
      // Extract top-level explanations and join into one sense (siblings are synonyms/cross-refs)
      const topExplanations = elements.filter((el) => el.type_ === 'explanation');
      if (topExplanations.length > 0) {
        const parts = [];
        for (const el of topExplanations) {
          const extracted = extractExplanations([el]);
          if (extracted.length > 0) parts.push(extracted[0]);
        }
        if (parts.length > 0) {
          const examples = extractExamplesFromElements(elements);
          senses.push({ text: parts.join('; '), examples });
        }
      }
      // Extract from sub-definitions (e.g. "brukt som adv: ...")
      const senseElements = elements.filter((el) => el.type_ === 'definition');
      for (const sense of senseElements) {
        const explanations = extractExplanations(sense.elements || []);
        if (explanations.length > 0) {
          const examples = extractExamplesFromElements(sense.elements || []);
          senses.push({ text: explanations[0], examples });
        }
      }
    }
    return senses;
  }

  return [];
}

// ---------------------------------------------------------------------------
// Fetch dictionary context for a batch of words
// ---------------------------------------------------------------------------
async function fetchDictionaryContext(words) {
  const sem = makeSemaphore(5);

  const enriched = await Promise.all(
    words.map((word) =>
      sem(async () => {
        const bokmaal = await fetchBokmaalSenses(word.oppslag, word.boy_tabell).catch(() => []);
        await sleep(200);
        return { ...word, bokmaal };
      })
    )
  );

  return enriched;
}

// ---------------------------------------------------------------------------
// Build per-word context string for the Claude prompt
// ---------------------------------------------------------------------------
function buildWordContext(word, { includeExamples = true } = {}) {
  let ctx = `Word: "${word.oppslag}" (${word.boy_tabell}) [lemma_id: ${word.lemma_id}]`;

  if (word.bokmaal && word.bokmaal.length > 0) {
    ctx += `\nBokmålsordboka (${word.bokmaal.length} senses):`;
    for (let i = 0; i < word.bokmaal.length; i++) {
      const sense = word.bokmaal[i];
      ctx += `\n  ${i + 1}. ${sense.text}`;
      if (includeExamples && sense.examples && sense.examples.length > 0) {
        ctx += `\n     ex: ${JSON.stringify(sense.examples)}`;
      }
    }
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------
async function fetchUntranslatedWords(boyTabell, limit) {
  const params = [boyTabell];
    let query = `
    SELECT o.lemma_id, o.oppslag, o.boy_tabell
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
// Translation
// ---------------------------------------------------------------------------
async function translateBatch(client, words, systemPrompt, { includeExamples = true } = {}) {
  const wordBlocks = words.map((w) => buildWordContext(w, { includeExamples }));
  const userMessage = `Translate these Norwegian words to Japanese:\n\n${wordBlocks.join('\n\n')}`;

  console.log('\n[translate] --- Request to model ---');
  console.log(userMessage);
  console.log('[translate] --- End request ---\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  let raw = response.content[0].text.trim();

  // Strip markdown fences if present
  const fenceMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  try {
    return JSON.parse(raw);
  } catch {
    console.error('[translate] Failed to parse JSON response for batch:');
    console.error(raw);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

function generateSqlStatements(words, wordLookup) {
  const lines = [];
  let count = 0;

  for (const { lemma_id, meanings } of words) {
    if (!Array.isArray(meanings) || meanings.length === 0) continue;

    const info = wordLookup.get(lemma_id);
    const comment = info ? ` -- ${info.oppslag} (${info.boy_tabell})` : '';

    for (let i = 0; i < meanings.length; i++) {
      let text = String(meanings[i]).trim();
      if (text.length > 100) {
        console.warn(`[translate] Truncating meaning for lemma_id ${lemma_id}: "${text}"`);
        text = text.slice(0, 100);
      }
      lines.push(
        `INSERT INTO definisjon (lemma_id, prioritet, definisjon, oversatt_av, source) VALUES (${lemma_id}, ${i + 1}, '${escapeSql(text)}', NULL, '${escapeSql(SOURCE_LABEL)}');${comment}`
      );
      count++;
    }
  }

  return { lines, count };
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
    enrichedWords = words.map(({ lemma_id, oppslag, boy_tabell }) => ({
      lemma_id, oppslag, boy_tabell, bokmaal: [],
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
      console.log(`${enriched.filter((w) => w.bokmaal.length > 0).length}/${lookupBatches[i].length} found`);
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
