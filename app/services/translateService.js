'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db/database');

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
  prefiks:       { tag: null },
  uttrykk:       { tag: null },
  forkorting:    { tag: null },
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
  det:           'determinativ (限定詞)',
  pron:          'pronomen (代名詞)',
  preposisjon:   'preposisjon (前置詞)',
  prefiks:       'prefiks (接頭辞)',
  uttrykk:       'uttrykk (表現・慣用句)',
  subjunksjon:   'subjunksjon (従属接続詞)',
  forkorting:    'forkorting (略語)',
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

  pron: `### Rules for pronomen
- Translate to the standard Japanese pronoun or equivalent expression. Example: jeg -> 私、僕、俺
- Personal pronouns: reflect the range of Japanese equivalents (formal/informal, gender) where relevant.
- Reflexive pronouns (seg, seg selv): translate to ～自身、自分. Example: seg selv -> 自分自身
- Relative/interrogative pronouns (som, hva, hvem): translate to the closest Japanese equivalent. Example: hvem -> 誰`,

  det: `### Rules for determinativ
- Translate as the Japanese equivalent determiner or prenominal expression. Example: denne -> この、この…のこと
- Demonstratives (denne, det, slik): use この/その/あの/こんな/そんな as appropriate.
- Possessives (min, din, vår): translate to the Japanese possessive pronoun + の. Example: min -> 私の
- Quantifiers (noen, all, ingen): translate to the closest Japanese quantifier. Example: ingen -> ない、何も…ない`,

  preposisjon: `### Rules for preposisjon
- Translate the prepositional meaning. Japanese does not have prepositions as such — use the closest particle or expression.`,

  prefiks: `### Rules for prefiks
- Translate the meaning of the prefix element itself, not a full word. Use ～ to indicate attachment. Example: mis- -> ～し損なう、～を誤る`,

  uttrykk: `### Rules for uttrykk
- Translate as a natural Japanese phrase or set expression. Example: for eksempel -> 例えば
- If the expression has multiple distinct uses, give each as a separate meaning.`,

  subjunksjon: `### Rules for subjunksjon
- Translate the conjunctional meaning as a natural Japanese subordinating conjunction or connective expression.
- Example: fordi -> なぜなら、～だから　/ hvis -> もし～ならば / selv om -> ～にもかかわらず、たとえ～でも
- If the conjunction introduces different clause types (conditional, concessive, temporal, etc.), give each as a separate meaning.`,

  forkorting: `### Rules for forkorting
- Translate to what the abbreviation stands for in Japanese. Include the expanded Norwegian form in parentheses if helpful. Example: f.eks. ->（for eksempelの略）例えば
- If the abbreviation is a well-known loanword acronym, use katakana. Example: NB ->（nota beneの略）注意、ノーテーション`,
};

const BASE_PROMPT_END = `## Output format
- Each meaning must be 100 characters or fewer
- All translations must be in Japanese only — never include English or Norwegian words. Use katakana for loanwords. Exception: Latin scientific names are allowed.
- Output ONLY a raw JSON array — no explanation, no markdown fences, no \`\`\`
- Each element must have "lemma_id" (integer, from input) and "meanings" (array of strings)
- Example output:
[{"lemma_id":123,"meanings":["画、絵、写真、映像","象徴、典型","描写"]}]`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
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
      const items_ = el.items || [];
      if (el.content.trim() === '$' && !items_.some((i) => i.type_ === 'article_ref')) continue;
      let text = el.content;
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
      if (trimmed.endsWith(':') && /^brukt (som|i|ved)\b/.test(trimmed)) continue;
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

function extractArticleSenses(article) {
  const definitions = article.body?.definitions || [];
  const senses = [];
  for (const def of definitions) {
    if (def.sub_definition) continue;
    const elements = def.elements || [];
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

async function fetchBokmaalSenses(oppslag, boyTabell, articleId) {
  if (articleId) {
    const artRes = await fetch(`https://ord.uib.no/bm/article/${articleId}.json`);
    if (!artRes.ok) return [];
    const article = await artRes.json();
    return extractArticleSenses(article);
  }

  const mapping = BOY_TABELL_MAP[boyTabell];
  if (!mapping) return [];

  const searchRes = await fetch(`https://ord.uib.no/api/articles?w=${encodeURIComponent(oppslag)}&dict=bm&scope=e`);
  if (!searchRes.ok) return [];

  const searchData = await searchRes.json();
  const articleIds = searchData.articles?.bm || [];
  if (articleIds.length === 0) return [];

  for (const id of articleIds) {
    const artRes = await fetch(`https://ord.uib.no/bm/article/${id}.json`);
    if (!artRes.ok) continue;

    const article = await artRes.json();

    if (mapping.tag !== null) {
      const matches = (article.lemmas || []).some((lemma) =>
        (lemma.paradigm_info || []).some((pi) =>
          (pi.tags || []).includes(mapping.tag)
        )
      );
      if (!matches) continue;
    }

    return extractArticleSenses(article);
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
        const bokmaal = await fetchBokmaalSenses(word.oppslag, word.boy_tabell, word.bmo_article_id).catch(() => []);
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

  const fenceMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  try {
    return JSON.parse(raw);
  } catch {
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch { /* fall through */ }
    }
    console.error('[translate] Failed to parse JSON response for batch:');
    console.error(raw);
    return null;
  }
}

// ---------------------------------------------------------------------------
// SQL generation (used by CLI script)
// ---------------------------------------------------------------------------
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
// High-level: translate a list of words (mixed word classes)
// ---------------------------------------------------------------------------
async function translateWords(words, { batchSize = 30, includeExamples = true } = {}) {
  const client = new Anthropic();
  await fetchConcepts();

  // Group words by boy_tabell so each group gets the correct system prompt
  const byClass = {};
  for (const w of words) {
    if (!byClass[w.boy_tabell]) byClass[w.boy_tabell] = [];
    byClass[w.boy_tabell].push(w);
  }

  const allResults = [];

  for (const [boyTabell, classWords] of Object.entries(byClass)) {
    const systemPrompt = buildSystemPrompt(boyTabell);

    // Enrich with dictionary context
    const enriched = await fetchDictionaryContext(classWords);
    const withContext = enriched.filter((w) => w.bokmaal.length > 0);
    const skipped = enriched.filter((w) => w.bokmaal.length === 0);

    if (skipped.length > 0) {
      console.log(`[translate] ${boyTabell}: ${skipped.length} words skipped (no senses): ${skipped.map((w) => w.oppslag).join(', ')}`);
    }

    if (withContext.length === 0) continue;

    // Batch and translate
    for (let i = 0; i < withContext.length; i += batchSize) {
      const batch = withContext.slice(i, i + batchSize);
      console.log(`[translate] ${boyTabell}: translating batch ${Math.floor(i / batchSize) + 1} (${batch.length} words)...`);

      const result = await translateBatch(client, batch, systemPrompt, { includeExamples });
      if (result) {
        allResults.push(...result);
      } else {
        console.error(`[translate] ${boyTabell}: batch ${Math.floor(i / batchSize) + 1} failed (parse error)`);
      }

      if (i + batchSize < withContext.length) await sleep(500);
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// High-level: translate untranslated ønsker and insert into DB
// ---------------------------------------------------------------------------
async function translateAndInsertØnsker(words) {
  console.log(`[translateØnsker] Found ${words.length} untranslated ønsker`);
  const results = await translateWords(words);

  if (results.length === 0) {
    console.log('[translateØnsker] No translations produced.');
    return 0;
  }

  let count = 0;
  await db.query('BEGIN');
  try {
    for (const { lemma_id, meanings } of results) {
      if (!Array.isArray(meanings) || meanings.length === 0) continue;
      for (let i = 0; i < meanings.length; i++) {
        const text = String(meanings[i]).trim().slice(0, 100);
        await db.query(
          'INSERT INTO definisjon (lemma_id, prioritet, definisjon, oversatt_av, source) VALUES ($1, $2, $3, NULL, $4)',
          [lemma_id, i + 1, text, SOURCE_LABEL]
        );
        count++;
      }
    }
    await db.query('COMMIT');
    console.log(`[translateØnsker] Done. ${count} definitions inserted for ${results.length} words.`);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('[translateØnsker] Error inserting definitions:', err);
    throw err;
  }

  return count;
}

module.exports = {
  MODEL,
  SOURCE_LABEL,
  BOY_TABELL_MAP,
  CLASS_SPECIFIC_RULES,
  buildSystemPrompt,
  fetchConcepts,
  fetchBokmaalSenses,
  fetchDictionaryContext,
  buildWordContext,
  translateBatch,
  generateSqlStatements,
  translateWords,
  translateAndInsertØnsker,
  makeSemaphore,
  sleep,
  escapeSql,
};
