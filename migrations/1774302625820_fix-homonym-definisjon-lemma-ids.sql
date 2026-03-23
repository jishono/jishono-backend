-- Up Migration
-- Fix definisjon rows that were translated for the wrong homonym.
-- In each case the Japanese definitions match a different BMO article than the one
-- attached to the oppslag they currently live on.
-- bank: 銀行/貯蔵所 belong to the financial-institution entry (4903), not the hitting sense (4902)
UPDATE
    definisjon
SET
    lemma_id = 4903
WHERE
    lemma_id = 4902;

-- bråk: 騒ぎ/騒音 belong to the commotion entry (82793), not the flax-breaking tool (9068)
UPDATE
    definisjon
SET
    lemma_id = 82793
WHERE
    lemma_id = 9068;

-- buss: バス belongs to the bus-vehicle entry (9469), not the chewing-tobacco entry (9470)
UPDATE
    definisjon
SET
    lemma_id = 9469
WHERE
    lemma_id = 9470;

-- fil: definitions are fully swapped between the file-tool entry (16668) and the lane/computer-file entry (16669)
-- Step 1: move やすり (file tool) from 16669 onto 16668 temporarily
UPDATE
    definisjon
SET
    lemma_id = 16668
WHERE
    lemma_id = 16669;

-- Step 2: move the file/lane defs from 16668 to 16669
UPDATE
    definisjon
SET
    lemma_id = 16669
WHERE
    lemma_id = 16668
    AND definisjon != 'やすり';

-- fly: 飛行機 belongs to the aircraft entry (17849), not the mountain-plateau entry (17847)
UPDATE
    definisjon
SET
    lemma_id = 17849
WHERE
    lemma_id = 17847;

-- gir: ギヤ belongs to the gear-mechanism entry (22803), not the nautical-deviation entry (22805)
UPDATE
    definisjon
SET
    lemma_id = 22803
WHERE
    lemma_id = 22805;

-- golf: ゴルフ belongs to the sport entry (23722); 湾 (bay) correctly stays on 23721
UPDATE
    definisjon
SET
    lemma_id = 23722,
    prioritet = 1
WHERE
    lemma_id = 23721
    AND definisjon = 'ゴルフ';

UPDATE
    definisjon
SET
    prioritet = 1
WHERE
    lemma_id = 23721
    AND definisjon = '湾';

-- jakt: 狩り/追跡 belong to the hunting entry (32454), not the sailing-vessel entry (32453)
UPDATE
    definisjon
SET
    lemma_id = 32454
WHERE
    lemma_id = 32453;

-- jus: definitions are fully swapped between the juice entry (33184) and the legal-science entry (33185)
-- Step 1: move ジュース from 33185 onto 33184 temporarily
UPDATE
    definisjon
SET
    lemma_id = 33184
WHERE
    lemma_id = 33185;

-- Step 2: move 法学 from 33184 to 33185
UPDATE
    definisjon
SET
    lemma_id = 33185
WHERE
    lemma_id = 33184
    AND definisjon = '法学';

-- kikke: 覗く/見る belongs to the peek entry (34420), not the criticize entry (34418)
UPDATE
    definisjon
SET
    lemma_id = 34420
WHERE
    lemma_id = 34418;

-- kjede: 退屈させる belongs to the bore/tire entry (34699), not the chain-together entry (34698)
UPDATE
    definisjon
SET
    lemma_id = 34699
WHERE
    lemma_id = 34698;

-- kokk: definitions are fully swapped between the chef entry (36152) and the bacterium entry (36153)
-- Step 1: move 料理人、シェフ from 36153 onto 36152 temporarily
UPDATE
    definisjon
SET
    lemma_id = 36152
WHERE
    lemma_id = 36153;

-- Step 2: move 球菌 from 36152 to 36153
UPDATE
    definisjon
SET
    lemma_id = 36153
WHERE
    lemma_id = 36152
    AND definisjon = '球菌';

-- Down Migration