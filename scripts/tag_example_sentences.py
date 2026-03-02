#!/usr/bin/env python3
# /// script
# dependencies = ["python-dotenv", "stanza", "psycopg2-binary"]
# ///
"""
tag_example_sentences.py

POS-tags Norwegian example sentences using Stanza and populates the
eksempler_no_oppslag table, which maps each sentence to the oppslag
entries (dictionary headwords) that appear in it.

Usage:
    pip install psycopg2-binary stanza python-dotenv
    python scripts/tag_example_sentences.py

Re-running is safe — truncates eksempler_no_oppslag first.
"""

import os
from pathlib import Path
import psycopg2
import psycopg2.extras
import stanza
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BATCH_SIZE = 200

UPOS_TO_BOY_TABELL = {
    "NOUN":  "subst",
    "PROPN": "egennavn",
    "VERB":  "verb",
    "AUX":   "verb",
    "ADJ":   "adj",
    "ADV":   "adv",
    "DET":   "det",
    "PRON":  "pron",
    "ADP":   "preposisjon",
    "CCONJ": "konjunksjon",
    "SCONJ": "subjunksjon",
    "INTJ":  "interjeksjon",
    "SYM":   "symbol",
    "X":     "forkorting",
    "PART":  "adv",
}

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

repo_root = Path(__file__).resolve().parent.parent
load_dotenv(repo_root / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    host = os.getenv("DB_HOST_NODE", "localhost")
    port = os.getenv("DB_PORT_NODE", "5432")
    user = os.getenv("DB_USER_ADMIN_NODE")
    dbname = os.getenv("DB_NAME_NODE")
    password = os.getenv("DB_PASS_ADMIN_NODE")
    DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def build_lemma_lookup(conn):
    """Return dict mapping (headword_lower, boy_tabell) -> lemma_id."""
    with conn.cursor() as cur:
        cur.execute("SELECT oppslag, lemma_id, boy_tabell FROM oppslag")
        rows = cur.fetchall()
    lookup = {}
    for oppslag, lemma_id, boy_tabell in rows:
        key = (oppslag.lower(), boy_tabell)
        lookup.setdefault(key, lemma_id)
    return lookup


def fetch_sentences(conn, offset, limit):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT no_id, no_setning FROM eksempler_no ORDER BY no_id LIMIT %s OFFSET %s",
            (limit, offset),
        )
        return cur.fetchall()


def extract_pairs(no_id, stanza_sentence, lemma_lookup):
    """Return list of (no_id, lemma_id) pairs for all recognised tokens."""
    seen = set()
    pairs = []
    for token in stanza_sentence.words:
        boy_tabell = UPOS_TO_BOY_TABELL.get(token.upos)
        if boy_tabell is None or token.lemma is None:
            continue
        lemma_id = lemma_lookup.get((token.lemma.lower(), boy_tabell))
        if lemma_id is not None:
            key = (no_id, lemma_id)
            if key not in seen:
                seen.add(key)
                pairs.append(key)
    return pairs


def insert_pairs(conn, pairs):
    if not pairs:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            "INSERT INTO eksempler_no_oppslag (eksempler_no_id, lemma_id) VALUES %s ON CONFLICT DO NOTHING",
            pairs,
        )
    conn.commit()


def process_single(nlp, no_id, text, lemma_lookup):
    """Process one sentence individually (fallback)."""
    doc = nlp(text)
    pairs = []
    for sent in doc.sentences:
        pairs.extend(extract_pairs(no_id, sent, lemma_lookup))
    return pairs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)

    print("Building lemma lookup table...")
    lemma_lookup = build_lemma_lookup(conn)
    print(f"  {len(lemma_lookup)} (headword, pos) entries loaded")

    print("Downloading/loading Stanza Norwegian model...")
    stanza.download("no", processors="tokenize,pos,lemma", verbose=False)
    nlp = stanza.Pipeline("no", processors="tokenize,pos,lemma", verbose=False)

    print("Truncating eksempler_no_oppslag...")
    with conn.cursor() as cur:
        cur.execute("TRUNCATE eksempler_no_oppslag")
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM eksempler_no")
        total = cur.fetchone()[0]
    print(f"Processing {total} sentences in batches of {BATCH_SIZE}...")

    processed = 0
    offset = 0

    while True:
        rows = fetch_sentences(conn, offset, BATCH_SIZE)
        if not rows:
            break

        # Attempt batched NLP: join sentences with \n\n so Stanza treats each
        # as a separate paragraph/sentence boundary.
        batch_text = "\n\n".join(r[1] for r in rows)
        doc = nlp(batch_text)

        pairs = []
        if len(doc.sentences) == len(rows):
            # Sentence count matches — use fast batch mapping
            for (no_id, _), stanza_sent in zip(rows, doc.sentences):
                pairs.extend(extract_pairs(no_id, stanza_sent, lemma_lookup))
        else:
            # Mismatch (Stanza re-split or merged): fall back to per-sentence
            for no_id, text in rows:
                pairs.extend(process_single(nlp, no_id, text, lemma_lookup))

        insert_pairs(conn, pairs)

        processed += len(rows)
        offset += BATCH_SIZE
        print(f"  {processed}/{total} processed, {len(pairs)} pairs in last batch")

        if len(rows) < BATCH_SIZE:
            break

    print(f"Done. {processed} sentences processed.")
    conn.close()


if __name__ == "__main__":
    main()
