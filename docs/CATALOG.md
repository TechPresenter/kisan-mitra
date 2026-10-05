# Kisan Mitra 2.0 — Content Catalog

Static, versioned content that ships inside the app bundle (`data/`). It works offline and needs no API. Every figure is **general guidance** taken from public package-of-practices (PoP) documents. Local KVK advice, state recommendations and the farmer's soil test always take precedence. Screens that show fertilizer or seed figures must say so.

Last reviewed: 2026-10-05.

## Crops

### Files

| File | What it holds |
|---|---|
| `data/crop-keys.ts` | Canonical `CropKey` list (24 crops) and `CROP_NAMES` (hi/en). Not owned by the catalog, but it is the source of truth for keys. |
| `data/crops.ts` | `CROPS` / `CROP_LIST` crop profiles with season variants, the timeline helpers (stage, harvest, season, day 0), units and date validation, and `STAGE_NAMES` / `SEASON_NAMES` / `CATEGORY_NAMES` labels. |
| `data/task-templates.ts` | Calendar tasks per crop (10–14 per sowing window, 286 for the base seasons), resolved per season, plus `GENERIC_TEMPLATES` for crops outside the catalog. |

### Conventions

- **Day 0.** Stage `startDay`, `durationDays` and task `dayOffset` all count from day 0. Day 0 is the field sowing date, or the **transplanting** date for nursery crops (`transplanted: true`: paddy, onion, tomato, brinjal, cauliflower, chilli). Nursery work and field preparation have negative offsets.
- **Crop records.** `Crop.sowingDate` is the date the seed went in the ground. For nursery crops that is the **nursery** sowing, not transplanting.
  - Always resolve a record with `timelineFor(crop)` (or `day0For` / `seasonForCrop` / `stageForCrop` / `expectedHarvestForCrop` / `datedTemplatesForCrop`). Never pass `crop.sowingDate` straight to `stageFor()` for a nursery crop.
  - Without a transplant date, day 0 is the nursery date plus the window's typical nursery length (paddy 26 days, onion 45, spring chilli 105).
  - The helpers also read `transplantDate` and `season` when a record has them. Both are proposed shared fields on `Crop` (see "Shared model" under Known limitations).
  - Date inputs: ask "बुवाई की तारीख" for direct-sown crops. For nursery crops ask "रोपाई की तारीख" and, optionally, "नर्सरी बुवाई की तारीख".
- **Seasons and sowing months.** `sowingMonths` lists, per season, the months when seed is sown (the nursery month for nursery crops). `seasons` is derived from it, and its first entry is the season the base profile describes.
  - `cropsSowableIn(month)` answers "अभी क्या बोएं".
  - `currentSeason(date)` is only a display label (Mar–May zaid, Jun–Sep kharif, Oct–Feb rabi). It is not a sowing recommendation: spring maize, summer groundnut and okra are sown in Jan–Feb, and North Indian cotton in Apr–May.
- **Variants.** `variants[season]` replaces the duration, stages and/or nursery length for one season. It can be limited to some of that season's sowing months. Each (season, months) pair is a *sowing window* (`sowingWindowsFor(key)`).
  - The window is chosen from the seed date when known, else from day 0 minus the window's nursery length. An explicit `season` restricts the choice to that season. Dates outside every window go to the nearest window by month, and the earlier (base) window wins ties.
  - Variant stage lists have the same number of entries as the base, so task timings can be mapped across.
- **Duration and harvest.** `durationDays` runs from day 0 to harvest for a mid-duration variety. For multi-pick crops (cotton, tomato, brinjal, chilli, okra) it runs to the *first* picking, and `harvestSpanDays` says how long pickings continue.
  - `expectedHarvestDate()` uses the midpoint of the window's `durationDays`. The calendar's harvest task is anchored to the same day, and a dev check asserts that they match for every window.
  - `stageFor()` returns `harvested` only after `durationDays.max + harvestSpanDays + 15` grace days. Before day 0 it returns `planned` ("रोपाई से पहले" for nursery crops).
- **Stages.** Each crop has an ordered list of sub-stages. Each maps to a `CropStage` (germination → vegetative → flowering → fruiting → maturity) and has `labelHi` (English term in brackets) and `labelEn`.
  - Several sub-stages can share one `CropStage`; wheat has "CRI/Tillering" and "Jointing" (day 60), both `vegetative`.
  - For nursery crops the first entry is "Establishment" (mapped to `germination`). `planned` and `harvested` are derived, never stored.
- **Task timing.** Templates are written for the base season and resolved per window:
  - nursery tasks are anchored to nursery sowing, so they move with the window's nursery length;
  - harvest, "stop irrigation / drain / cut haulms before harvest" and "N after the first picking" tasks are anchored to the expected harvest;
  - stage-tied tasks are mapped onto a variant's stage days (rabi maize: knee-high N moves from day 30 to day 55);
  - weather-bound jobs get per-season offsets that land in the right calendar months. Example: autumn sugarcane earthing in June, tying in late August, and frost irrigation in December;
  - season-only tasks exist, e.g. the frost-protection irrigation for rabi maize.
- **Weeds.** Pre-emergence herbicide is its own task at day 1–2 (paddy, maize, moong, urad, soybean), because it only works in the first 0–3 days. The day 20–25 task is hand weeding.
- **Task ids and language.** Every task has a stable `id`. `DatedTaskTemplate.templateId` is `cropKey:id` (`generic:id` outside the catalog). Store it on the task and render the text at display time with `findTemplate()` + `templateText(tpl, lang)`, so a language switch also changes existing tasks.
- **Language.** Every farmer-facing catalog text has a Hindi and an English field: stage labels, task titles and descriptions, sowing window, spacing, irrigation, soil, nutrient notes, seed notes, seed options and varieties. `catalogText(lang, hi, en)` picks English for `en` and Hindi for every other language, the same fallback as `lib/i18n`.
- **Seed rate.** `seedRateKgPerAcre` is always kg per acre. `noteHi` / `noteEn` explain units where needed:
  - nursery crops: seed for the nursery that plants one acre, so tomato's 0.06–0.16 kg is 60–160 g;
  - potato: seed tubers (1200–1800 kg = 12–18 q);
  - sugarcane: setts (25–32 q);
  - groundnut: shelled kernels;
  - garlic: cloves.

  Where the seed type changes the rate a lot, `seedOptions` gives one rate per type: cotton, paddy, wheat, gram, moong and groundnut. Seed calculators should offer these instead of using the overall range. Cotton is the clearest case: Bt hybrid 2×475 g packets with refuge mixed in, Bt variety 4 + 1 kg refuge, desi/straight 3–3.5 kg.
- **Nutrients.** `recommendedNPKKgPerHa` is kg/ha of N, P₂O₅ and K₂O for a medium-fertility soil, i.e. a general recommendation.
  - Screens show it per acre with `npkPerAcre()`. They never show kg/ha.
  - `npkNoteHi` / `npkNoteEn` are always written per acre ("किलो/एकड़").
  - Every fertilizer task says "मिट्टी जांच के अनुसार" (as per the soil test).
- **Dates.** `isValidISODate()` rejects malformed and impossible dates. With an invalid date:
  - `expectedHarvestDate()` returns `undefined`;
  - `stageFor()` returns `planned`;
  - `datedTemplatesFor()` returns `[]`;
  - `currentSeason()` falls back to today.
- **Crop protection.** Tasks name cultural, mechanical and biological measures plus common seed treatments. For sprays they send the farmer to KVK or an agriculture expert for the product and dose instead of prescribing pesticide doses.
- **Varieties.** `commonVarietiesHi` / `commonVarietiesEn` list well-known public varieties as examples only, never as an endorsement or yield promise.
- **Disease and pest ids.** Ids in `majorPestsDiseases` follow `<cropKey>-<issue>` and resolve in `data/diseases.ts`, which is maintained in the "Diseases & techniques" section below. There are 136 ids.

### API (`data/crops.ts`, `data/task-templates.ts`)

| Need | Use |
|---|---|
| A crop record's timeline | `timelineFor(crop)` → `{ season, day0, profile }`; `day0For`, `seasonForCrop` |
| Stage and progress | `stageForCrop(crop, today?)`, or `stageFor(cropKey, day0, today?, season?)` |
| Expected harvest | `expectedHarvestForCrop(crop)`, or `expectedHarvestDate(cropKey, day0, season?)` (`undefined` for a bad date) |
| Calendar tasks | `datedTemplatesForCrop(crop)`, or `datedTemplatesFor(cropKey, day0, season?)`; `templatesFor(cropKey, season?, day0?)` |
| Re-render a stored task | `findTemplate(templateId)` + `templateText(tpl, lang)` |
| What to sow now | `cropsSowableIn(month)`; `sowingWindowsFor(cropKey)` for a season picker |
| Season profile | `profileFor(cropKey, season?, day0?)`, `harvestDayFor(...)`, `seasonFromSowingDate`, `seasonFromDay0` |
| Units, language, dates | `npkPerAcre(info)`, `catalogText(lang, hi, en)`, `isValidISODate(s)` |

### Coverage

DAS = days after sowing, DAT = days after transplanting. Seasons are listed with the base season first; * marks a season variant. Sowing months are seed (nursery) months. Seed rates are per acre (q = quintal). NPK is N:P₂O₅:K₂O in kg/acre, with kg/ha in brackets. Tasks are counted per sowing window.

| Crop | Key | Category | Seasons (sowing months) | Duration | Seed rate | NPK kg/acre (kg/ha) | Stages | Tasks |
|---|---|---|---|---|---|---|---|---|
| Wheat (गेहूं) | `wheat` | cereal | rabi (Oct–Dec) | 120–160 DAS | 40–50 kg | 49:24:16 (120:60:40) | 6 | 14 |
| Paddy (धान) | `paddy` | cereal | kharif (May–Jul) | 95–120 DAT | 6–12 kg (nursery/DSR) | 49:24:16 (120:60:40) | 6 | 14 |
| Maize (मक्का) | `maize` | cereal | kharif (Jun–Jul), rabi* (Oct–Nov), zaid* (Jan–Mar) | 90–115 DAS; rabi 150–175; spring 105–125 | 8–10 kg | 49:24:16 (120:60:40) | 6 | 13 (rabi 14) |
| Pearl millet (बाजरा) | `bajra` | millet | kharif (Jun–Jul), zaid (Feb–Mar) | 75–95 DAS | 1.5–2 kg | 24:12:8 (60:30:20) | 6 | 11 |
| Sorghum (ज्वार) | `jowar` | millet | kharif (Jun–Jul), rabi (Sep–Oct) | 100–120 DAS | 3–5 kg | 32:16:16 (80:40:40) | 6 | 12 |
| Barley (जौ) | `barley` | cereal | rabi (Oct–Nov) | 115–150 DAS | 35–50 kg | 24:12:8 (60:30:20) | 6 | 10 |
| Chickpea (चना) | `gram` | pulse | rabi (Oct–Nov) | 100–170 DAS | 25–40 kg | 8:16:8 (20:40:20) | 5 | 11 |
| Pigeon pea (अरहर) | `arhar` | pulse | kharif (May–Jul) | 150–200 DAS | 5–8 kg | 8:20:8 (20:50:20) | 6 | 12 |
| Green gram (मूंग) | `moong` | pulse | kharif (Jun–Jul), zaid (Mar–Apr) | 60–75 DAS | 6–12 kg | 8:16:8 (20:40:20) | 5 | 11 |
| Black gram (उड़द) | `urad` | pulse | kharif (Jun–Jul), zaid (Mar–Apr) | 70–90 DAS | 6–10 kg | 8:16:8 (20:40:20) | 5 | 11 |
| Lentil (मसूर) | `masoor` | pulse | rabi (Oct–Nov) | 110–150 DAS | 12–20 kg | 8:16:8 (20:40:20) | 5 | 10 |
| Mustard (सरसों) | `mustard` | oilseed | rabi (Sep–Nov) | 120–150 DAS | 1.5–2 kg | 32:16:16 (80:40:40) | 6 | 11 |
| Soybean (सोयाबीन) | `soybean` | oilseed | kharif (Jun–Jul) | 90–110 DAS | 26–32 kg | 8:24:16 (20:60:40) | 5 | 11 |
| Groundnut (मूंगफली) | `groundnut` | oilseed | kharif (Jun–Jul), zaid (Jan–Mar) | 100–130 DAS | 40–60 kg kernels | 8:16:16 (20:40:40) | 6 | 11 |
| Cotton (कपास) | `cotton` | cash | kharif (Apr–Jul) | 140–160 DAS (+45 picking) | 0.95–5 kg by seed type | 49:24:24 (120:60:60) | 6 | 14 |
| Sugarcane (गन्ना) | `sugarcane` | cash | zaid / spring (Feb–Mar), rabi* / autumn (Sep–Nov) | spring 300–365 DAS; autumn 400–480 | 25–32 q setts | 61:24:24 (150:60:60) | 4 | 14 |
| Potato (आलू) | `potato` | vegetable | rabi (Sep–Nov, Jan) | 90–120 DAS | 12–18 q tubers | 61:32:40 (150:80:100) | 5 | 12 |
| Onion (प्याज) | `onion` | vegetable | rabi (Oct–Nov), kharif (May–Jun) | 100–130 DAT | 3–4 kg (nursery) | 40:20:20 (100:50:50) | 5 | 13 |
| Tomato (टमाटर) | `tomato` | vegetable | kharif (Jul–Aug), rabi* (Sep–Oct), zaid* (Nov–Dec) | 60–75 DAT (+60 picking) | 60–160 g (nursery) | 49:32:24 (120:80:60) | 5 | 14 |
| Brinjal (बैंगन) | `brinjal` | vegetable | kharif (May–Jul), rabi (Sep–Oct), zaid* (Nov–Dec, Feb–Mar) | 55–70 DAT (+90 picking) | 80–200 g (nursery) | 40:24:20 (100:60:50) | 5 | 12 |
| Cauliflower (फूलगोभी) | `cauliflower` | vegetable | kharif (May–Aug), rabi (Sep–Oct) | 75–100 DAT | 200–500 g (nursery) | 49:24:24 (120:60:60) | 5 | 12 |
| Chilli (मिर्च) | `chilli` | vegetable | kharif (May–Aug), rabi (Sep), zaid* (Oct–Nov) | 60–80 DAT (+90 picking) | 80–200 g (nursery) | 40:20:20 (100:50:50) | 5 | 12 |
| Okra (भिंडी) | `okra` | vegetable | zaid (Feb–Mar), kharif (Jun–Jul) | 45–55 DAS (+50 picking) | 4–8 kg | 40:20:20 (100:50:50) | 5 | 10 |
| Garlic (लहसुन) | `garlic` | vegetable | rabi (Sep–Nov) | 130–170 DAS | 200–250 kg cloves | 40:20:20 (100:50:50) | 5 | 11 |

#### Season variants

| Crop | Season | Sowing months covered | What changes | Basis |
|---|---|---|---|---|
| Maize | rabi | Oct–Nov | 150–175 days; slow winter growth (knee-high ~55 DAS, tasseling ~105 DAS); frost-protection irrigation task | Rabi maize in Bihar/South is harvested in April |
| Maize | zaid (spring) | Jan–Feb (a March sowing keeps the base profile) | 105–125 days | PAU spring maize (sown 20 Jan–15 Feb) matures in ~115–120 days |
| Sugarcane | rabi (autumn) | Sep–Nov | 400–480 days; grand growth from ~day 230; nitrogen at planting, end of March and end of April | PAU: plant 20 Sep–20 Oct, crush Plant (A) in Dec–Jan of the next year |
| Tomato | rabi (winter main crop) | Sep–Oct | Nursery 30–40 days | PAU: nursery October, transplant November–December |
| Tomato | zaid (spring) | Nov–Dec | Nursery 50–80 days | PAU: nursery end of November, transplant February |
| Brinjal | zaid (spring) | Nov–Dec (Feb–Mar summer nursery keeps the base length) | Nursery 75–90 days | PAU: nursery November, transplant first fortnight of February |
| Chilli | zaid (spring) | Oct–Nov | Nursery 90–120 days | PAU: nursery end October–mid November, transplant February–March |

Each crop also carries:

- a sowing window (Hindi and English);
- spacing;
- critical irrigation stages;
- an irrigation count;
- suitable soils;
- example varieties;
- disease and pest ids;
- source URLs.

Every crop's task list covers:

- field preparation;
- seed treatment;
- sowing or transplanting with the basal dose;
- irrigations at critical stages;
- split fertilizer doses;
- weeding;
- pest scouting and crop-protection checks;
- harvest.

Nursery crops add nursery-bed preparation and nursery sowing before transplanting. Unknown crops (`cropKey: 'other'`) use a generic 10-task template and a generic 90–130 day stage profile.

### Sources

The main cross-check for numbers was the Punjab Agricultural University Package of Practices: Rabi 2025-26, Kharif 2026 and Vegetables. National and other-zone figures were checked against ICAR institutes, the TNAU Agritech Portal and Vikaspedia.

| Source | Used for |
|---|---|
| [PAU PoP Rabi 2025-26](https://pau.edu/content/ccil/pf/pp_rabi.pdf) | wheat, barley, spring maize, gram, lentil, summer moong/urad, mustard, sugarcane (rabi maturity days: wheat 145–158 d, gram 153–170 d, lentil 140–146 d) |
| [PAU PoP Kharif 2026](https://pau.edu/content/ccil/pf/pp_kharif.pdf) | paddy, maize, bajra, cotton (seed table, PAU Bt 2/3), moong, urad (mash), arhar, soybean, groundnut, sugarcane (spring and autumn schedules, zinc and gypsum doses) |
| [PAU PoP Vegetables](https://pau.edu/content/ccil/pf/pp_veg.pdf) | potato, onion, garlic, tomato, brinjal, chilli (nursery and transplanting months), okra, cauliflower |
| [TNAU Agritech Portal](https://agritech.tnau.ac.in/) | wheat, rice, maize, cumbu, sorghum, pulses, groundnut, sugarcane and vegetable pages (linked per crop) |
| [Vikaspedia package of practices](https://agriculture.vikaspedia.in/viewcontent/agriculture/crop-production/package-of-practices?lgn=en) | wheat, barley, chickpea, pigeon pea, lentil, mustard, groundnut |
| [ICAR-IIMR](https://iimr.icar.gov.in/?page_id=148) | maize |
| [ICAR-IIMR millets](https://millets.res.in/technologies/Recommended_package_of_practices-Pearl_millet.pdf) and [AICRP Pearl Millet](http://www.aicpmip.res.in/technologies.html) | bajra, and jowar ([kharif](https://www.millets.res.in/farmer/Recommended_package_of_Practices_Kharif.pdf), [rabi](https://www.millets.res.in/farmer/Recommended_packages_of_practices_Rabi_sorghum.pdf)) |
| [ICAR-IIPR](https://iipr.icar.gov.in/mandate-crops-old/) | chickpea |
| [ICAR-DRMR](https://www.drmr.res.in/technologies_developed.php) | mustard |
| [ICAR-IISR Indore](https://iisrindore.icar.gov.in/goodagripractices.html) | soybean |
| [ICAR-CICR](https://cicr.org.in/famers-corner/farm-corner-front-line-demo/) | cotton |
| [ICAR-SBI Coimbatore](https://sugarcane.icar.gov.in/index.php/en/2014-04-28-06-09-34/schedule-of-operations) | sugarcane |
| [ICAR-CPRI](https://cpri.icar.gov.in/Content/Index/?qlid=4190&Ls_is=5415&lngid=1) and [NHB](https://nhb.gov.in/pdf/vegetable/potato/pot010.pdf) | potato |
| [ICAR-DOGR](https://dogr.icar.gov.in/index.php?Itemid=189&id=118&lang=en&option=com_content&view=article) and [NHRDF](http://nhrdf.org/Onion.php) | onion, garlic |
| [ICAR-IIVR seed rates](https://iivr.icar.gov.in/seed-rate-list) and [varieties](https://iivr.icar.gov.in/varieties/tomato) | tomato, brinjal, chilli, cauliflower, okra |

The exact per-crop URLs are in each entry's `sources` array in `data/crops.ts`.

### Known limitations

- **Regional baseline.** Figures mostly describe North and Central Indian irrigated conditions, with rainfed notes. Southern and eastern sowing windows are mentioned only where they are common (rabi jowar, rabi maize, kharif onion, rabi chilli).
- **Rabi durations are a compromise.** Wheat, gram, barley and lentil ranges span Central India and the NW plains. The midpoint sits between the two: wheat 140 days against ~120–130 in MP and 145–158 in Punjab. Expected harvest can therefore be 1–2 weeks off in either region. There is no state-based variant yet, so let the farmer correct `expectedHarvestDate`.
- **Variants are per season, not per region or variety.** Not modelled:
  - South Indian sugarcane (adsali 16–18 months, pre-seasonal);
  - boro rice;
  - late-kharif onion;
  - the hill potato crop.
- **Calendar-bound sugarcane jobs** assume planting inside the window (mid Feb–Mar, or Sep–Oct). Plantings far outside it shift earthing, tying and frost irrigation away from their months.
- **Shared model.** `Crop` has no `transplantDate`, `season` or task `templateId` yet. Until those fields land:
  - a nursery crop's day 0 is estimated from its nursery length, which can be off by about a week;
  - the season is inferred from dates;
  - stored tasks cannot re-render in another language.
- **No variety adjustment.** Stage days are for a mid-duration variety. Early or late varieties shift every stage, so treat `stageFor()` as an estimate and let the farmer correct it.
- **Ageing variety lists.** Varieties change often, so review `commonVarietiesHi` every season against state recommendations.

## Diseases & techniques

Last reviewed: 2026-10-05 (`DISEASES_REVIEWED_ON`, `TECHNIQUES_REVIEWED_ON`).

### Files

| File | What it holds |
|---|---|
| `data/diseases.ts` | `DISEASES` (75 disease/pest entries), `DISEASE_ID_ALIASES` (36 alternate ids), `CHEMICAL_NOTE_HI`, and the lookups `getDisease()`, `getDiseases()`, `resolveDiseaseId()`, `diseasesForCrop()`, `searchDiseases()`, `normalizeSearch()`. |
| `data/techniques.ts` | `TECHNIQUES` (16 farming techniques), `TECHNIQUE_TAGS`, and the lookups `getTechnique()`, `techniquesForCrop()`, `searchTechniques()`. |

### Conventions

- **Ids.** Disease ids are `<cropKey>-<slug>`. The first entry in `cropKeys` is the crop named in the id. One entry can cover several crops; for example, `wheat-yellow-rust` also covers barley. Saved items and AI results store these ids, so never rename one. Add an alias instead.
- **Aliases.** Other modules sometimes use a different id for something that already has an entry. `getDisease()` and `getDiseases()` resolve these aliases. When you show or save a result, use the returned `d.id`, not the id you looked up. Three kinds of alias exist:
  - the same organism on another crop (`barley-yellow-rust` → `wheat-yellow-rust`);
  - a different slug (`groundnut-tikka-leaf-spot` → `groundnut-tikka`);
  - a vector pest mapped to the virus entry it spreads, because that entry carries the vector-control advice (`moong-whitefly` → `moong-yellow-mosaic`).
- **Chemical advice.**
  - `chemicalHi` lists only actives registered in India (CIB&RC), at typical doses from ICAR, SAU or DPPQS advisories.
  - Doses are given per litre and, where the source gives one, per acre. Knapsack sprays assume about 200 L of water per acre.
  - Every list ends with `CHEMICAL_NOTE_HI`, which starts "लेबल पर दी गई मात्रा का पालन करें" and adds the label-crop and waiting-period caveat.
  - No product banned by the Insecticides (Prohibition) Order 2023 (dicofol, dinocap, methomyl, monocrotophos) is suggested. Streptomycin + tetracycline is flagged as being phased out, not recommended.
  - Some advisory doses are for crops whose labels may not list the active (for example okra or moong). Those lines say "लेबल पर … दर्ज हो तभी".
- **Hedged numbers.** Doses use "लगभग" and ranges, and ETLs appear only where the source gives one. Virus entries say plainly that no spray cures the virus, only vector control helps. Wilt and root-rot entries say that a plant already wilting cannot be cured.
- **Severity.** `severityHint` (high, medium or low) is a rough measure of yield loss if the problem is ignored. Use it for ordering and badges, never as a diagnosis. `diseasesForCrop()` sorts high first, and within the same severity it lists the crop's own entries first.
- **Search.**
  - `searchDiseases()` and `searchTechniques()` fold Hindi spelling variants: nukta, chandrabindu to anusvara, and ZWJ/ZWNJ. English is lowercased.
  - Every word of the query must match somewhere.
  - Disease ranking puts name and alias matches first, then crop-name matches, then symptom and condition matches. A match on the whole phrase adds a bonus.
  - Conditions are searched so that a vector query like "सफेद मक्खी" also returns the viruses it spreads.
- **Techniques.**
  - The first four (`vermicompost`, `mulching`, `drone-spray`, `soil-test`) match the original app's technique cards and keep their colours: green, blue, purple and amber.
  - `forAllCrops` marks techniques that suit every crop, so a screen can show "सभी फसलें" instead of 24 crop chips.
  - `relatedSchemeHint` names a scheme but never an amount. `costHi` is indicative and hedged. The only rupee figures quoted are PMKSY's official indicative drip and sprinkler costs, with a caveat about their age, and the reported nano urea bottle price.
- **Nano urea.** The entry states both sides:
  - the government/ICAR trials found comparable yield with the full basal nitrogen plus two foliar sprays, saving 25–50% of the top-dressed urea;
  - PAU's two-year trial found lower yield when basal nitrogen was halved.

  It tells farmers not to cut basal nitrogen.

### Coverage: diseases and pests

There are 75 entries: 33 fungal, 28 pest, 7 viral, 4 bacterial, 2 nutrient and 1 physiological. Every crop has at least three entries. Each entry lists symptoms, favourable conditions, organic/biological steps, chemical steps, prevention and sources.

| Crop | Own entries | Shared entries that also apply |
|---|---|---|
| Wheat (गेहूं) | `wheat-yellow-rust`, `wheat-brown-rust`, `wheat-loose-smut`, `wheat-termite`, `wheat-aphid`, `wheat-karnal-bunt` | — |
| Paddy (धान) | `paddy-blast`, `paddy-bacterial-leaf-blight`, `paddy-brown-planthopper`, `paddy-stem-borer`, `paddy-sheath-blight`, `paddy-leaf-folder`, `paddy-false-smut`, `paddy-khaira` | — |
| Maize (मक्का) | `maize-fall-armyworm`, `maize-stem-borer`, `maize-leaf-blight` | `wheat-termite` |
| Pearl millet (बाजरा) | `bajra-downy-mildew`, `bajra-ergot` | `maize-stem-borer`, `groundnut-white-grub` |
| Sorghum (ज्वार) | `jowar-shoot-fly` | `maize-fall-armyworm`, `maize-stem-borer`, `soybean-charcoal-rot` |
| Barley (जौ) | — | `wheat-yellow-rust`, `wheat-brown-rust`, `wheat-loose-smut`, `wheat-termite`, `wheat-aphid` |
| Chickpea (चना) | `gram-pod-borer`, `gram-wilt`, `gram-ascochyta-blight` | `wheat-termite`, `soybean-charcoal-rot` |
| Pigeon pea (अरहर) | `arhar-wilt`, `arhar-spotted-pod-borer`, `arhar-sterility-mosaic` | `gram-pod-borer` |
| Green gram (मूंग) | `moong-yellow-mosaic`, `moong-cercospora-leaf-spot` | `urad-powdery-mildew` |
| Black gram (उड़द) | `urad-powdery-mildew` | `moong-yellow-mosaic`, `moong-cercospora-leaf-spot` |
| Lentil (मसूर) | `masoor-rust` | `gram-pod-borer`, `gram-wilt` |
| Mustard (सरसों) | `mustard-aphid`, `mustard-white-rust`, `mustard-alternaria-blight`, `mustard-sclerotinia-rot` | — |
| Soybean (सोयाबीन) | `soybean-yellow-mosaic`, `soybean-girdle-beetle`, `soybean-charcoal-rot` | — |
| Groundnut (मूंगफली) | `groundnut-tikka`, `groundnut-collar-rot`, `groundnut-white-grub` | `wheat-termite` |
| Cotton (कपास) | `cotton-pink-bollworm`, `cotton-whitefly`, `cotton-jassid`, `cotton-thrips`, `cotton-leaf-curl-virus`, `cotton-boll-rot` | — |
| Sugarcane (गन्ना) | `sugarcane-red-rot`, `sugarcane-early-shoot-borer`, `sugarcane-top-borer`, `sugarcane-pyrilla`, `sugarcane-smut` | `wheat-termite`, `groundnut-white-grub` |
| Potato (आलू) | `potato-late-blight`, `potato-black-scurf` | `groundnut-white-grub`, `tomato-early-blight`, `tomato-bacterial-wilt` |
| Onion (प्याज) | `onion-purple-blotch`, `onion-thrips`, `onion-damping-off`, `onion-basal-rot` | — |
| Tomato (टमाटर) | `tomato-early-blight`, `tomato-late-blight`, `tomato-leaf-curl-virus`, `tomato-fruit-borer`, `tomato-blossom-end-rot`, `tomato-bacterial-wilt`, `tomato-pinworm` | `onion-damping-off` |
| Brinjal (बैंगन) | `brinjal-fruit-shoot-borer`, `brinjal-little-leaf` | `cotton-jassid`, `onion-damping-off`, `tomato-bacterial-wilt` |
| Cauliflower (फूलगोभी) | `cauliflower-diamondback-moth`, `cauliflower-boron-deficiency`, `cauliflower-black-rot` | `onion-damping-off` |
| Chilli (मिर्च) | `chilli-thrips`, `chilli-leaf-curl`, `chilli-anthracnose`, `chilli-mites` | `onion-damping-off`, `tomato-bacterial-wilt` |
| Okra (भिंडी) | `okra-yellow-vein-mosaic`, `okra-fruit-borer` | `cotton-jassid` |
| Garlic (लहसुन) | — | `onion-purple-blotch`, `onion-thrips`, `onion-basal-rot` |

#### Ids from `data/crops.ts`

Of the 136 ids in `majorPestsDiseases`, 103 resolve: 67 directly and 36 through `DISEASE_ID_ALIASES`. These 33 have no entry yet, so `getDisease()` returns `undefined` for them and screens should skip them:

`maize-shoot-fly`, `maize-stalk-rot`, `bajra-smut`, `bajra-rust`, `bajra-shoot-fly`, `jowar-midge`, `jowar-grain-mold`, `barley-covered-smut`, `barley-stripe-disease`, `gram-cutworm`, `arhar-pod-fly`, `arhar-phytophthora-blight`, `moong-thrips`, `urad-leaf-crinkle`, `urad-pod-borer`, `masoor-stemphylium-blight`, `masoor-aphid`, `mustard-painted-bug`, `mustard-sawfly`, `soybean-stem-fly`, `soybean-semilooper`, `soybean-anthracnose`, `groundnut-leaf-miner`, `sugarcane-wilt`, `potato-aphid`, `potato-cutworm`, `brinjal-whitefly`, `brinjal-phomopsis-blight`, `cauliflower-aphid`, `cauliflower-downy-mildew`, `chilli-fruit-borer`, `okra-enation-leaf-curl`, `okra-powdery-mildew`.

### Coverage: techniques

| Id | Title | Tag | Tone | Crops |
|---|---|---|---|---|
| `vermicompost` | वर्मीकम्पोस्ट (Vermicompost) | जैविक | green | all |
| `mulching` | मल्चिंग (Mulching) | सिंचाई | blue | vegetables, potato, sugarcane |
| `drone-spray` | ड्रोन से छिड़काव (Drone spraying) | तकनीक | purple | paddy, wheat, maize, cotton, groundnut, arhar, soybean, sugarcane (the crops with ICAR drone SOPs) |
| `soil-test` | मिट्टी जांच (Soil testing) | स्मार्ट खेती | amber | all |
| `drip-irrigation` | ड्रिप सिंचाई (Drip irrigation) | सिंचाई | blue | sugarcane, cotton, maize, potato, vegetables |
| `sprinkler-irrigation` | स्प्रिंकलर सिंचाई (Sprinkler irrigation) | सिंचाई | teal | wheat, barley, pulses, mustard, groundnut, millets, potato, onion, garlic |
| `natural-farming` | प्राकृतिक खेती — जीवामृत, बीजामृत (Natural farming) | जैविक | green | all |
| `ipm` | समेकित कीट प्रबंधन (IPM) | फसल सुरक्षा | orange | all |
| `seed-treatment` | बीज उपचार (Seed treatment) | फसल सुरक्षा | orange | all |
| `crop-rotation` | फसल चक्र (Crop rotation) | मिट्टी की सेहत | green | all |
| `green-manure` | हरी खाद (Green manuring) | जैविक | green | paddy, wheat, maize, sugarcane, cotton, potato |
| `crop-residue-management` | फसल अवशेष (पराली) प्रबंधन (Crop residue management) | पराली प्रबंधन | orange | paddy, wheat |
| `inm` | समेकित पोषक तत्व प्रबंधन (INM) | मिट्टी की सेहत | amber | all |
| `rainwater-harvesting` | वर्षा जल संचयन — खेत तालाब (Rainwater harvesting) | जल संरक्षण | teal | all |
| `nano-urea` | नैनो यूरिया (Nano urea) | तकनीक | purple | wheat, paddy, maize, mustard, tomato, onion (the crops in the ICAR trials) |
| `dsr` | धान की सीधी बुवाई (DSR) | जल संरक्षण | teal | paddy |

### Sources

Each entry's `sources` array has the exact URLs; 69 distinct URLs are used by diseases alone. The main ones are:

| Source | Used for |
|---|---|
| [CIB&RC major uses of pesticides (31.03.2024)](https://ppqs.gov.in/sites/default/files/major_uses_of_pesticides_insecticides_bio_insecticides_as_on_31.03.2024.pdf) and the [Insecticides (Prohibition) Order 2023](https://indiaenvironmentportal.org.in/reports-and-documents/insecticides-prohibition-order-2023) | registered actives; excluding banned ones |
| [DPPQS yellow rust advisory](https://ppqs.gov.in/sites/default/files/advisroy_yellow_rust.pdf) and [chilli thrips booklet](https://ppqs.gov.in/sites/default/files/adhoc_management_strategies_on_thrips_parvispinus.pdf) | wheat rusts; chilli thrips label doses and waiting periods; silver mulch |
| [ICAR-CICR advisory 2024-25](https://nsai.co.in/storage/app/media/uploaded-files/ICAR-CICR_Advisory%20Pest%20and%20Disease%20Management%202024.pdf) and [ICAR pink bollworm strategy](https://icar.org.in/sites/default/files/Circulars/PBW-Management-strategies-2019.pdf) | all cotton entries, including ETLs |
| [ICAR-NRRI agro-advisory](https://icar-crri.in/wp-content/uploads/2023/10/AAS_October_2023_II_English.pdf) and [TNAU rice blast](https://agritech.tnau.ac.in/crop_protection/rice_diseases/another%20methods_rice_1.html) | paddy BPH, blast, sheath blight, BLB, false smut |
| [CPRI late blight advisory](https://indianpotato.com/cpri-issues-advisory-to-safeguard-potato-crops-from-late-blight-disease-threat/) | potato and tomato late blight |
| [ICAR-IIMR disease management](https://iimr.icar.gov.in/?p=1223) and [ICAR fall armyworm insecticide trial](https://krishi.icar.gov.in/jspui/handle/123456789/84061) | maize |
| [ICAR-IISR (sugarcane) technologies](https://www.indiascienceandtechnology.gov.in/technologies/management-insect-pests-termite-early-shoot-borer-and-root-borer) and [Vikaspedia red rot](https://en.vikaspedia.in/viewcontent/agriculture/crop-production/integrated-pest-managment/ipm-for-commercial-crops/ipm-strategies-for-sugarcane/red-rot-management-in-sugarcane?lgn=en) | sugarcane |
| [NHB disorders: tomato](https://nhb.gov.in/pdf/vegetable/tomato/tom003.pdf), [NHB disorders: cauliflower](https://www.nhb.gov.in/pdf/vegetable/cauliflower/cau003.pdf) | blossom-end rot, boron deficiency |
| TNAU Agritech, Kerala Agricultural University (celkau.in), ICAR-DOGR, ICAR-IISR Indore, ICAR-DRMR, ICAR-IIPR, ICAR-DGR, ICAR-IIHR/IIVR | crop-specific pages linked per entry |
| [PMKSY](https://pmksy.gov.in) and [Vikaspedia irrigation schemes](https://en.vikaspedia.in/viewcontent/agriculture/national-schemes-for-farmers/irrigation?lgn=en) | drip and sprinkler, including indicative costs |
| [Vikaspedia nano urea](https://en.vikaspedia.in/viewcontent/agriculture/agri-inputs/inorganic-inputs/nano-urea), [Lok Sabha reply on ICAR trials](https://eparlib.sansad.in/bitstream/123456789/2987393/1/AU4347_8SvEMI.pdf), [PAU trial report](https://www.global-agriculture.com/india-region/use-of-nano-urea-decreases-wheat-yield-by-20-pau/) | nano urea |
| [PAU tar-wattar DSR](https://www.global-agriculture.com/state-news/pau-and-nabard-initiate-a-project-on-tar-wattar-direct-seeded-rice/) and [IJWS DSR weed management](https://isws.org.in/IJWSn/File/2025_57_Issue-2_155-159.pdf) | DSR |
| [Rajya Sabha reply on CRM and Pusa decomposer](https://rsdebate.nic.in/bitstream/123456789/748574/1/PQ_265_09082024_U2105_p135_p136.pdf) | crop residue management |
| [Drone SOP release](https://indbiz.gov.in/sops-to-utilize-drones-in-farm-sector-released/) and [Rajya Sabha reply on crop-wise drone SOPs](https://rsdebate.nic.in/bitstream/123456789/753215/1/PQ_266_20122024_U2897_p75_p76.pdf) | drone spraying |
| [Vikaspedia Soil Health Card](https://en.vikaspedia.in/viewcontent/agriculture/policies-and-schemes/crops-related/krishi-unnati-yojana/soil-health-card?lgn=en) and [TNAU soil sampling](https://agritech.tnau.ac.in/agriculture/agri_soil_sampling.html) | soil test |
| [Vikaspedia NMNF](https://en.vikaspedia.in/viewcontent/schemesall/schemes-for-farmers/national-mission-on-natural-farming?lgn=en) and [ICAR jeevamrit training](https://icar.org.in/en/farmers-training-programme-preparation-jeevamrit-and-beejamrit-under-natural-farming-khamar-village) | natural farming |
| [Vikaspedia vermicompost](https://static.vikaspedia.in/media/files_en/agriculture/farm-based-enterprises/vermicompost-production-and-practices.pdf), [ICAR dhaincha](https://icar.org.in/en/icar-mgifri-motihari-promotes-dhaincha-based-soil-health-management-under-khet-bachao-abhiyan), [ICAR farm pond](https://epubs.icar.org.in/index.php/IndFarm/article/view/131369) | vermicompost, green manure, rainwater harvesting |

### Known limitations

- **Labels change.** Label claims and bans change. Re-check every chemical line each season against the latest CIB&RC list. Brand labels can differ from the advisory dose, and `CHEMICAL_NOTE_HI` tells the farmer the label wins.
- **Secondary sources.** A few doses come from research papers or news reports of ICAR advisories, not from a label. Examples: the CPRI advisory via Indian Potato, and the IISR soybean doses via Global Agriculture. Replace them with the primary page when one becomes reachable.
- **Hindi-only body text.** English exists only in `nameEn`, `titleEn`, `summaryEn` and `tagEn`; all body text is Hindi.
- **Regional baseline.** Content describes North and Central India first; timings such as "दिसंबर–फरवरी" are North-Indian.
- **Missing ids.** 33 ids referenced by `data/crops.ts` still have no entry (listed above).
