# Government Schemes — Verification Log

Content for the "सरकारी योजनाएं" module lives in `data/schemes.ts`. This file records where each fact came from.

**Rule:** every benefit amount, eligibility condition, document and application step was copied from an official Government of India source. Each source was opened (fetched) during the review of **2026-10-05**. A scheme that could not be verified from an official source, or whose official sources do not show it open to new applicants, was left out (see [Excluded](#excluded-schemes)).

## How verification was done

- **Sources allowed:**
  - the scheme's own `.gov.in` / `.nic.in` portal
  - DA&FW operational guidelines (`agriwelfare.gov.in`, or a state agriculture department's `.gov.in` copy when the central portal has no direct link)
  - Press Information Bureau (PIB) releases and backgrounder PDFs
  - All India Radio (`newsonair.gov.in`)
  - the Union Budget speech (`indiabudget.gov.in`)
- **Access notes:**
  - PIB HTML pages (`pib.gov.in/PressReleasePage.aspx…`) return HTTP 403 to WebFetch. They were fetched with curl using a browser user agent.
  - `pmkisan.gov.in`: WebFetch rejects its certificate chain. Windows curl loads it with a valid certificate, and the "Scheme Exclusion" list and the PM-KMY documents were read there.
  - `pmkmy.gov.in` serves a certificate for a different host (`SEC_E_WRONG_PRINCIPAL`), and its "apply now" link (`maandhan.in/auth/login`) returns 404. `maandhan.in` now only lists the Labour Ministry's PM-SYM and NPS-Traders schemes. Neither host is used as a link.
  - `pmfby.gov.in` is a single-page app with no direct link to the 2023 guidelines. The DA&FW document was read from `krishi.maharashtra.gov.in`, where it is published with its covering letter of 6 Nov 2024.
  - `myscheme.gov.in` scheme pages render only in a browser (JavaScript).
- **Newest source wins.** When two official documents disagreed, the newer one was used, or both were shown with a "confirm with your bank/office" line. The conflicts were:
  - **Soil Health Card frequency:** the Aug 2025 PDF says both "2 years" and "3 years". The Mar 2026 PDF says "every two years", so the app says "हर 2 साल में कार्ड देने का लक्ष्य".
  - **KCC/MISS limit:** three official sources disagree.
    - The Budget 2025-26 speech (para 22) announced that the MISS limit "will be enhanced from ₹3 lakh to ₹5 lakh".
    - The Cabinet decision of 28 May 2025 continued MISS for FY 2025-26 at ₹3 lakh (₹2 lakh for animal husbandry/fisheries only), with "no changes".
    - The PIB backgrounder of Mar 2026 says the limit was raised to ₹5 lakh.
    - The app therefore shows ₹3 lakh as the confirmed 4% limit, and the ₹5 lakh announcement with "अपने बैंक से पक्का करें".
  - **PMFBY:** the 2020 Revamped guidelines and the 2021 PIB FAQ were replaced by the **Operational Guidelines 2023**. The DA&FW advisory of May 2026 applies them from Kharif 2026, together with the Kharif 2026 changes announced on 18 Nov 2025.
- **Helplines.** A helpline number appears only if it was printed on an official page:
  - e-NAM 1800 270 0224 (enam.gov.in registration guideline)
  - PMFBY Krishi Rakshak 14447 (PMFBY OG 2023, para 21.6)
- **List-row highlight.** `benefitsHi[0]` is a short one-line highlight for list rows. It never promises a benefit that a status caveat qualifies. For example, the NMNF highlight says "(2025-26 तक के नियम)".

### What `lastVerified` means

`lastVerified` must never claim more freshness than the sources support:

- **`2026-10-05` (review date):** only for entries confirmed current by a 2026 official source during this review:
  - PM-KISAN: Cabinet continuation, 31 Jul 2026, plus the live portal.
  - PMFBY: OG 2023 applied by the May 2026 advisory, plus the PIB releases of Feb 2026 and Nov 2025.
  - SMAM: guidelines revised Aug 2026.
  - e-NAM: live registration guideline page.
- **Any other date:** the publication date of the newest official document that states the entry's figures. The UI should show this date on the detail screen.

`SCHEMES_LAST_VERIFIED` is the date the whole catalog was last reviewed. It is not a per-scheme claim.

## 16th Finance Commission cycle (read before relying on any amount)

The Department of Expenditure memo of 18 May 2026 (enclosed in the DA&FW PMFBY advisory) says publicly funded schemes received an **interim extension up to 30.09.2026**, pending appraisal for the 16th Finance Commission cycle (2026-2030). Today is after that date.

Only these continuations were found on official pages:

- **PM-KISAN:** Cabinet, 31 Jul 2026 — continued from 2026-27 to 2030-31.
- **PMFBY:** the May 2026 advisory covers Kharif 2026 and Rabi 2026-27.

No official approval for the new cycle was found for:

- MISS (KCC interest subvention): last approved for FY 2025-26
- PM-KMY
- the RKVY / Krishonnati components: PDMC, SMAM, PKVY, Soil Health Card, SMSP
- NMNF

Their entries keep their official figures, but their `lastVerified` dates and status lines show how old those figures are. **Screen owner:** the "आवेदन से पहले आधिकारिक वेबसाइट पर ताज़ा जानकारी देखें" disclaimer and the per-scheme `lastVerified` date should be mandatory on the detail screen.

## Included schemes (12)

| # | Scheme (`id`) | Category | Official URL | What was verified | Sources opened | `lastVerified` |
|---|---|---|---|---|---|---|
| 1 | PM-KISAN (`pm-kisan`) | support | https://pmkisan.gov.in | ₹6,000/year in 3 × ₹2,000 via DBT; land-record seeding, Aadhaar-linked bank account and e-KYC (OTP/biometric/face); **full official exclusion list** (institutional landholders; constitutional posts, ministers, MPs/MLAs/MLCs, mayors, district panchayat chairpersons; serving/retired govt, PSU, autonomous-body and local-body employees; pensioners ≥ ₹10,000/month — MTS/Class IV/Group D exempt; income-tax payers; registered professionals); app self-registration; Kisan-eMitra (11 languages); grievances; continuation 2026-27 to 2030-31 | pmkisan.gov.in "Scheme Exclusion"; PIB Cabinet release (31 Jul 2026); PIB 23rd instalment (20 Jun 2026); PIB 22nd instalment PDF (19 Mar 2026); PIB Jun 2026 and Mar 2026 backgrounders | 2026-10-05 |
| 2 | PM Fasal Bima Yojana (`pmfby`) | insurance | https://pmfby.gov.in | Farmer premium caps 2% / 1.5% / 5%; subsidy 50:50 (NE & Himalayan 90:10); basic cover risks; add-on covers chosen by the state (prevented sowing up to 25% SI, 14-day post-harvest cover, localised calamities); **from Kharif 2026: paddy inundation back under localised calamity, and wild-animal attack as the fifth add-on cover where the state notifies animals and districts, reported within 72 hours with geotagged photos on the Crop Insurance App**; 12% p.a. penal interest to farmers on late claims, auto-calculated on NCIP; exclusions (war, nuclear, malicious damage, theft, grazing by domestic animals); voluntary, with loanee opt-out 7 days before cut-off; eligibility incl. sharecroppers/tenants, FRA forest-land and NER community-land farmers; documents (Aadhaar/e-KYC + mobile, **bank passbook**, RoR/LPC, tenant/sharecropper document, sowing certificate or self-declaration); CSC enrolment free; 72-hour intimation via app or KRPH 14447 | PMFBY Operational Guidelines 2023 (DA&FW, covering letter 6 Nov 2024); DA&FW advisory (May 2026) with DoE memo (18 May 2026); PIB 18 Nov 2025; AIR 18 Nov 2025; PIB 3 Feb 2026 (Lok Sabha reply); PIB PMFBY FAQ (Dec 2021, exclusions) | 2026-10-05 |
| 3 | Kisan Credit Card + MISS (`kcc`) | credit | https://fasalrin.gov.in | Eligible categories (owner-cultivators, tenants, oral lessees, sharecroppers, SHG/JLG, animal husbandry/fisheries); 7% up to ₹3 lakh with up to 3% PRI → 4%; ₹2 lakh limit for animal husbandry/fisheries-only loans (FY 2025-26 Cabinet); ₹5 lakh MISS limit **announced** in Budget 2025-26 (shown with "confirm with bank"); collateral-free ₹2 lakh from 1 Jan 2025; RuPay card, 5-year revolving limit; marginal farmers ₹10,000–₹50,000; one-page form, land records, crop info; form sources; CSC help; saturation-drive camps; MISS is approved year by year | PIB "Kisan Credit Card: Fueling Growth" (11 Mar 2026); PIB Cabinet release on MISS (28 May 2025); Budget Speech 2025-26 (para 22); PIB Mar 2026 and Jun 2026 | 2026-03-11 |
| 4 | PM Kisan Maandhan (`pm-kmy`) | support | PM-KMY FAQ on pmkisan.gov.in | ₹3,000/month after 60; age 18–40; land ≤ 2 ha in records as on 01.08.2019; **exclusions** (NPS/ESIC/EPFO members, PM-SYM/PM-LVM subscribers, higher-economic-status categories); ₹55–₹200/month with equal central match; separate pension for a spouse who joins; family pension 50% (₹1,500); PM-KISAN auto-debit option; exit rules; documents (Aadhaar, passbook/account with IFSC/MICR, DOB, spouse and nominee details, optional mobile); free CSC enrolment (₹30 fee paid by DA&FW) or State Nodal Officer; LIC as fund manager | PM-KMY Operational Guidelines, FAQ and Salient Features (pmkisan.gov.in/Documents); PIB "Five Years of PM-KMY" (9 Sep 2024); PIB PM-KMY FAQ (Jan 2022); PIB 5 Jun 2026 and 26 Mar 2026 (₹3,000 pension still stated) | 2026-06-05 |
| 5 | Soil Health Card (`soil-health-card`) | support | https://soilhealth.dac.gov.in | 12 parameters; for all farmers; card per holding; every 2 years; 22 languages + 5 dialects; ₹190 per sample central funding for the testing process (in the summary, **not** listed as a farmer benefit); sampling method/timing; SHC portal + app; village-level labs (18–27 yrs, SHG, FPO); RKVY component since 2022-23 | PIB "Soil Health Card" (16 Aug 2025); PIB Mar 2026; PIB Jun 2026 | 2026-03-26 |
| 6 | e-NAM (`e-nam`) | support | https://enam.gov.in | 1,656 mandis in 23 States + 4 UTs (Mar 2026); bids from local/outside traders; assaying, e-bidding, e-payment; online farmer registration steps and APMC approval; **farmers without email can register at their e-NAM mandi/APMC**; helpline 1800 270 0224 | enam.gov.in registration guideline (re-read 2026-10-05); enam.gov.in FAQ; PIB Mar 2026; PIB Jun 2026 | 2026-10-05 |
| 7 | Per Drop More Crop (`pdmc`) | irrigation | https://pdmc.da.gov.in | 55% small/marginal, 45% others; 5 ha ceiling; 7-year repeat rule (3 years for sprinkler→drip); lease ≥ 7 years eligible; unit-cost cap (+25% NE/Himalayan/J&K/Ladakh, +15% low-penetration states); BIS-only; Aadhaar biometric/face registration; DBT; under PM-RKVY since 2022-23; state portals | PDMC Operational Guidelines 2025 (PDF dated 15 Oct 2025; the portal, last updated 05 Oct 2026, still lists it as current); PIB Mar 2026 | 2025-10-15 |
| 8 | SMAM (`smam`) | machinery | https://agrimachinery.nic.in | 50% (small/marginal, SC/ST, women, NE & Himalayan) / 40% others; 90% for FRA patta holders; CHC 40% up to ₹250 lakh; Kisan Drone CHC 50% or ₹5 lakh; drone hiring ₹2,000/ha up to 2 ha/year; online lottery; empanelled manufacturers; DBT; state portals + agrimachinery.nic.in | SMAM Operational Guidelines **revised Aug 2026** (agriwelfare.gov.in, re-checked 2026-10-05); Mechanization Division page; PIB Mar 2026 | 2026-10-05 |
| 9 | PKVY (`pkvy`) | subsidy | https://pgsindia-ncof.gov.in | ₹31,500/ha over 3 years (₹15,000 inputs via DBT, ₹4,500 marketing, ₹3,000 certification, ₹9,000 training); ≤ 2 ha; 20 ha clusters; Regional Council process; PGS-India / NPOP certification; Jaivik Kheti portal | PIB "PKVY: Nurturing Organic Farming" (6 Oct 2025); PIB Jun 2026 | 2025-10-06 |
| 10 | National Mission on Natural Farming (`nmnf`) | subsidy | https://naturalfarming.dac.gov.in | ₹4,000/acre/year for 2 years for trained farmers (guideline Feb 2025); support up to 1 acre per farmer; ~50 ha / ~125-farmer clusters in selected GPs; selection criteria; Krishi Sakhi enrolment each season; BRCs; training; **cost norms limited to the 15th FC period — status shown in the summary and list highlight** | NMNF Operational Guidelines (revised 10 Feb 2025); PIB 23rd instalment release (20 Jun 2026: 346 new clusters in West Bengal); PIB Jun 2026 and Mar 2026 | 2025-02-10 |
| 11 | Mission for Aatmanirbharta in Pulses (`pulses-mission`) | seed | PIB backgrounder PDF (no dedicated portal found) | 2025-26 to 2030-31; 88 lakh free seed kits + 126 lakh quintals certified seed; 100% MSP procurement of Tur/Urad/Masoor for 4 years via NAFED/NCCF (PM-AASHA); demonstrations by ICAR/KVK/State; ₹25 lakh/unit for 1,000 processing units; SATHI portal | PIB "India's Mission for Aatmanirbharta in Pulses" (11 Oct 2025); PIB Mar 2026; PIB Jun 2026 | 2025-10-11 |
| 12 | Sub-Mission on Seeds & Planting Material (`smsp`) | seed | https://agriwelfare.gov.in/en/SeedsDiv | Seed Village Programme (SMSP guideline para 8.8): **50% for cereals and 60% for pulses, oilseeds, fodder and green-manure crops, for seed for 1 acre per farmer**; training for 50–150-farmer groups; storage bins 25% (SC/ST 33%), max ₹1,000/₹2,000 (SC/ST ₹1,500/₹3,000) for 10/20-quintal bins, one bin per farmer; beneficiary lists on state websites; ~6.85 lakh seed villages (in the summary); centrally sponsored under Krishonnati Yojana; "rates are from 2014" caveat shown | SMSP Operational Guidelines (13 May 2014, linked from the Seeds Division page); Seeds Division page; PIB Mar 2026; PIB Jun 2026 | 2014-05-13 |

### Source documents (full URLs)

- pmkisan.gov.in ("Scheme Exclusion" section): https://pmkisan.gov.in
- PIB, Cabinet approves continuation of PM-KISAN 2026-27 to 2030-31 (31 Jul 2026): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2292460
- PIB, 23rd Instalment of PM-KISAN (20 Jun 2026): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2275744
- PIB, 22nd Instalment of PM-KISAN (19 Mar 2026): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/mar/doc2026319829701.pdf
- PIB, Empowering India's Annadatas (5 Jun 2026): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jun/doc202665884101.pdf
- PIB, India's Resilient Production Systems in Agriculture (26 Mar 2026): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/mar/doc2026326833901.pdf
- PIB, Kisan Credit Card: Fueling Growth in Agriculture (11 Mar 2026): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/mar/doc2026311819801.pdf
- PIB, Cabinet approves continuation of MISS for FY 2025-26 (28 May 2025): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2131989
- Union Budget 2025-26, Budget Speech (para 22): https://www.indiabudget.gov.in/budget2025-26/doc/Budget_Speech.pdf
- PMFBY Operational Guidelines 2023 ("Operational Guidelines Kharif-23", DA&FW letter of 6 Nov 2024, published by the Maharashtra agriculture department): https://krishi.maharashtra.gov.in/Site/Upload/GR/OG%20titled%20as%20Operational%20Guidelines%20Kharif%2023%20for%20the%20implementation%20of%20PMFBY%20and%20RWBCIS%20From%20Kharif%202023%20onwards-reg%20(2).pdf
- DA&FW advisory on PMFBY/RWBCIS from Kharif 2026 (May 2026), with the DoE memo of 18 May 2026 (published by HP Agriculture): https://agriculture.hp.gov.in/wp-content/uploads/2026/06/PMFBY26-27_merged.pdf
- PIB, Wild animal attack recognised as localised risk; paddy inundation reintroduced (18 Nov 2025): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2191224
- All India Radio, the same decision (18 Nov 2025): https://newsonair.gov.in/wild-animal-attacks-paddy-inundation-to-be-covered-under-pmfby-from-kharif-2026/
- PIB, PMFBY Provides Comprehensive Crop Insurance; States Allowed Add-On Cover for Wild Animal Damage (3 Feb 2026): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2222799
- PIB, PMFBY FAQ (7 Dec 2021): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/dec/doc202112701.pdf
- PIB, Soil Health Card (16 Aug 2025): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/aug/doc2025816613501.pdf
- PDMC Operational Guidelines 2025: https://pdmc.da.gov.in/files/General-Information/Guideline/4-1760756927.pdf
- PDMC portal: https://pdmc.da.gov.in/
- SMAM Operational Guidelines, revised Aug 2026: https://www.agriwelfare.gov.in/Documents/SMAM_2026F_Operational_Guidelines_Revision.pdf
- DA&FW Mechanization Division: https://agriwelfare.gov.in/en/MechanizationDiv
- PIB, PKVY (6 Oct 2025): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/oct/doc2025106657801.pdf
- PM-KMY Operational Guidelines: https://pmkisan.gov.in/Documents/PM-KMY%20-%20Operational%20Guidelines.pdf
- PM-KMY FAQs: https://pmkisan.gov.in/Documents/PM-KMY%20-%20FAQs.pdf
- PM-KMY Salient Features: https://pmkisan.gov.in/Documents/PM-KMY%20-%20Salient%20Features.pdf
- PIB, Five Successful Years of PM-KMY (9 Sep 2024): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2024/sep/doc202499390501.pdf
- PIB, PM-KMY FAQ (18 Jan 2022): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2022/jan/doc20221185101.pdf
- e-NAM Registration Guideline: https://enam.gov.in/resources/registration-guideline
- e-NAM FAQ: https://enam.gov.in/resources/FAQs-of-eNam
- NMNF Operational Guidelines (rev. 10 Feb 2025): https://naturalfarming.dac.gov.in/uploads/NMNF/Guideline_of_NMNF_V2_Revised.pdf
- DA&FW Seeds Division: https://agriwelfare.gov.in/en/SeedsDiv
- SMSP Operational Guidelines (13 May 2014): https://agriwelfare.gov.in/Documents/SMSP13.05.2014_2.pdf
- PIB, Mission for Aatmanirbharta in Pulses (11 Oct 2025): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/oct/doc20251011663801.pdf

## Status caveats shown to farmers

Each caveat below is written into the scheme's own text, so the app shows it to farmers.

- **KCC:** benefit line 3 shows the ₹5 lakh announcement with "confirm with your bank". The last `howToApplyHi` step says MISS is approved each financial year and asks farmers to confirm the 2026-27 rate and limit with their bank.
- **NMNF:** the guideline cost norms are "limited to 15th Finance Commission Period", and the guideline sets 18.75 lakh farmers to be trained by March 2026. PIB (Jun 2026) reports 19 lakh farmers registered, but also new clusters launched in West Bengal on 20 Jun 2026. The summary says the cost rules ran to 2025-26 and asks farmers to confirm new enrolment with the district agriculture office. The list highlight is non-promissory: "प्रशिक्षण और प्रति एकड़ प्रोत्साहन (2025-26 तक के नियम)".
- **SMSP:** rates come from the 2014 guideline, the newest one the Seeds Division publishes. The last `howToApplyHi` step asks farmers to confirm current rates with their agriculture office.
- **PMFBY:** the wild-animal and paddy-inundation covers apply only where the state has notified them. The prevented-sowing, post-harvest and localised-calamity covers are labelled "राज्य ने ऐड-ऑन कवर चुना हो तो", as OG 2023 makes them state-chosen add-ons.

## Excluded schemes

| Scheme | Reason |
|---|---|
| Agriculture Infrastructure Fund (AIF) | The Revised Scheme Guidelines (Sep 2024, section 4) say loan disbursement "will complete in six years, i.e. by the end of Financial Year 2025-26". The scheme itself stays operational to 2032-33. That matches the repayment period of up to 7 years for loans disbursed by then. The newest official figure is "as of March 2026" (PIB, 5 Jun 2026), and the agriinfra.dac.gov.in footer reads "Last updated on 10 Sept 2025". No official page shows a lending window after March 2026. Excluded for the same reason as PM-KUSUM. Add it back if DA&FW publishes an extension for new loans. |
| PM-KUSUM | Official PIB PDF (Dec 2025) says the scheme was extended only **until 31 Mar 2026**. "PM-KUSUM 2.0" appears only in non-official news and is not yet launched. No official page confirms that farmers can apply now (pmkusum.mnre.gov.in renders only a title; the mnre.gov.in page timed out). Add it back once MNRE publishes the 2.0 guidelines. |
| National Beekeeping & Honey Mission | PIB (Nov 2025) gives the period as FY 2020-21 to **FY 2025-26** and no per-farmer benefit amounts. No official continuation was found. |
| Rashtriya Krishi Vikas Yojana (RKVY) | This is an umbrella scheme, and farmer-level benefits depend on the state. Its farmer-facing components are listed separately: SMAM, PDMC, PKVY and Soil Health Card. |

## Updating

1. Re-open each source listed above. Change only the figures that a newer official document changes.
2. Set each changed entry's `lastVerified` by the rule in [What `lastVerified` means](#what-lastverified-means). Set `SCHEMES_LAST_VERIFIED` to the review date.
3. Update the row in this file, including its sources and date.
4. Remove a scheme instead of guessing if its official source no longer confirms it, or if no official page shows it open to new applicants.
5. When a 16th Finance Commission approval appears for a scheme, add the release to its sources. Then re-check its figures, and move its `lastVerified` to the review date.
