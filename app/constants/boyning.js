const ALLOWED_BOY_TABLES = ['adj_boy', 'adv_boy', 'det_boy', 'pron_boy', 'subst_boy', 'verb_boy'];

const ALLOWED_BOY_COLUMNS = {
  adj_boy:   new Set(['lemma_id', 'pos', 'paradigme', 'boy_skjema', 'm_entall', 'f_entall', 'n_entall', 'bestemt_entall', 'flertall', 'komparativ', 'superlativ', 'superlativ_bestemt']),
  adv_boy:   new Set(['lemma_id', 'pos', 'paradigme', 'boy_skjema', 'positiv', 'komparativ', 'superlativ']),
  det_boy:   new Set(['lemma_id', 'pos', 'paradigme', 'boy_skjema', 'm_entall', 'f_entall', 'n_entall', 'bestemt_entall', 'flertall']),
  pron_boy:  new Set(['lemma_id', 'pos', 'paradigme', 'boy_skjema', 'subjektsform', 'objektsform']),
  subst_boy: new Set(['lemma_id', 'pos', 'paradigme', 'boy_skjema', 'ubestemt_entall', 'bestemt_entall', 'ubestemt_flertall', 'bestemt_flertall']),
  verb_boy:  new Set(['lemma_id', 'pos', 'paradigme', 'boy_skjema', 'infinitiv', 'presens', 'preteritum', 'presens_perfektum', 'imperativ', 'perf_part_mf', 'perf_part_n', 'perf_part_bestemt', 'perf_part_flertall', 'presens_partisipp']),
};

module.exports = { ALLOWED_BOY_TABLES, ALLOWED_BOY_COLUMNS };
