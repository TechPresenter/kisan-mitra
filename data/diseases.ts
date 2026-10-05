// Disease & pest knowledge base for फसल डॉक्टर, diagnosis results, search and AI grounding.
// Content is Hindi-first and deliberately conservative. Every chemical line was checked on
// 2026-10-05 against the CIB&RC major-uses tables (insecticides / fungicides, up to 31.03.2024)
// and a dose source (PAU package of practices, ICAR / SAU / DPPQS advisory, or the label table).
// Where the label lists the active for a different crop or pest, the line says so instead of
// implying a label claim. Doses are hedged ("लगभग") because labels differ by brand — every
// chemical list ends with CHEMICAL_NOTE_HI and CHEMICAL_SAFETY_HI so screens never show a
// dose without the label and handling caveats.
import type { GroundingSource, RiskLevel } from '../types/models';
import { CROP_NAMES, isCropKey, type CropKey } from './crop-keys';

export type DiseaseType = 'fungal' | 'bacterial' | 'viral' | 'pest' | 'nutrient' | 'physiological';

export interface DiseaseInfo {
  /** '<cropKey>-<slug>', stable — saved items and AI results reference it. */
  id: string;
  /** Crops this applies to; the first one is the "home" crop of the id. */
  cropKeys: CropKey[];
  type: DiseaseType;
  nameHi: string;
  nameEn: string;
  /** Latin name of the pathogen / pest, for expert lookup and AI grounding. */
  scientificName?: string;
  /** Local / alternate names farmers search with (Hindi or English). */
  aliases?: string[];
  symptomsHi: string[];
  favourableConditionsHi: string;
  /** Biocontrol, botanicals and cultural fixes. */
  organicHi: string[];
  /**
   * Actives with typical dose, checked against the CIB&RC major-uses tables; always ends with
   * CHEMICAL_NOTE_HI then CHEMICAL_SAFETY_HI (see chem()).
   */
  chemicalHi: string[];
  preventionHi: string[];
  /** Rough yield-loss potential if ignored, used for ordering and badges. */
  severityHint: RiskLevel;
  sources: GroundingSource[];
}

/** Date this content was last checked against its sources. */
export const DISEASES_REVIEWED_ON = '2026-10-05';

/** Second-last line of every chemicalHi list: label dose, label crop and waiting period. */
export const CHEMICAL_NOTE_HI =
  'लेबल पर दी गई मात्रा का पालन करें। केवल वही दवा लें जिसके लेबल पर यह फसल दर्ज हो, और कटाई/तुड़ाई से पहले लेबल पर लिखी प्रतीक्षा अवधि रखें।';

/** Last line of every chemicalHi list: protective gear, drift, containers and poisoning. */
export const CHEMICAL_SAFETY_HI =
  'छिड़काव के समय दस्ताने, मास्क और पूरे कपड़े पहनें; हवा के रुख के साथ छिड़कें, उल्टी दिशा में नहीं; छिड़काव करते समय खाना-पीना, बीड़ी-तंबाकू न लें; खाली डिब्बे धोकर गाड़ दें, घरेलू काम में न लें; चक्कर, उल्टी या ज़्यादा पसीना आए तो तुरंत डॉक्टर/108 पर दवा का लेबल दिखाएं।';

const chem = (...lines: string[]): string[] => [...lines, CHEMICAL_NOTE_HI, CHEMICAL_SAFETY_HI];

// ---------- Sources (checked 2026-10) ----------

const S = {
  // CIB&RC label tables: crop, pest, dose per hectare and waiting period for each registered use.
  // The insecticide table is no longer at its ppqs.gov.in address, so the archived copy is cited.
  cibrcInsecticides: {
    title: 'CIB&RC: कीटनाशकों के पंजीकृत उपयोग — फसल, कीट, मात्रा (31.03.2024 तक; संग्रहित प्रति)',
    uri: 'https://web.archive.org/web/20240913175240/https://ppqs.gov.in/sites/default/files/major_uses_of_pesticides_insecticides_as_on_31.03.2024.pdf',
  },
  cibrcFungicides: {
    title: 'CIB&RC: फफूंदनाशकों के पंजीकृत उपयोग — फसल, रोग, मात्रा (31.03.2024 तक)',
    uri: 'https://ppqs.gov.in/sites/default/files/fungicides_31.03.2024.pdf',
  },
  cibrcBioFungicides: {
    title: 'CIB&RC: जैविक फफूंदनाशकों (ट्राइकोडर्मा, स्यूडोमोनास आदि) के पंजीकृत उपयोग (31.03.2024 तक)',
    uri: 'https://ppqs.gov.in/sites/default/files/bio-fungicide_31.3.2024.pdf',
  },
  // Index of all CIB&RC "major uses" tables (insecticides, fungicides, herbicides, bio-pesticides).
  cibrcUses: {
    title: 'CIB&RC: कीटनाशकों के पंजीकृत उपयोग (Major Uses of Pesticides) — आधिकारिक सूची',
    uri: 'https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides',
  },
  cibrcBioInsecticides: {
    title: 'CIB&RC: जैविक कीटनाशकों (Bt, NPV, नीम आदि) के पंजीकृत उपयोग (31.03.2024 तक)',
    uri: 'https://ppqs.gov.in/sites/default/files/major_uses_of_pesticides_insecticides_bio_insecticides_as_on_31.03.2024.pdf',
  },
  bannedOrder2023: {
    title: 'कीटनाशक (प्रतिबंध) आदेश 2023 — डाइकोफॉल, डाइनोकैप, मिथोमिल, मोनोक्रोटोफॉस पर रोक',
    uri: 'https://indiaenvironmentportal.org.in/reports-and-documents/insecticides-prohibition-order-2023',
  },
  pauRabi: {
    title: 'PAU: रबी फसलों का पैकेज ऑफ प्रैक्टिसेज़ 2025-26',
    uri: 'https://pau.edu/content/ccil/pf/pp_rabi.pdf',
  },
  pauKharif: {
    title: 'PAU: खरीफ फसलों का पैकेज ऑफ प्रैक्टिसेज़ 2026',
    uri: 'https://pau.edu/content/ccil/pf/pp_kharif.pdf',
  },
  pauVeg: {
    title: 'PAU: सब्ज़ियों की खेती का पैकेज ऑफ प्रैक्टिसेज़',
    uri: 'https://pau.edu/content/ccil/pf/pp_veg.pdf',
  },
  tnauGreengram: {
    title: 'TNAU Agritech: मूंग — बीज उपचार (ट्राइकोडर्मा, स्यूडोमोनास, राइज़ोबियम)',
    uri: 'https://agritech.tnau.ac.in/agriculture/pulses_greengram.html',
  },
  yellowRust: {
    title: 'DPPQS: गेहूं के पीले रतुआ पर सलाह व पंजीकृत फफूंदनाशक (2022)',
    uri: 'https://ppqs.gov.in/sites/default/files/advisroy_yellow_rust.pdf',
  },
  iiwbr: { title: 'ICAR-भारतीय गेहूं एवं जौ अनुसंधान संस्थान, करनाल', uri: 'https://iiwbr.icar.gov.in' },
  wheatTermite: {
    title: 'गेहूं में दीमक का समेकित प्रबंधन (Indian Journal of Plant Protection)',
    uri: 'https://epubs.icar.org.in/index.php/IJPP/article/view/106386',
  },
  nrri: {
    title: 'ICAR-राष्ट्रीय चावल अनुसंधान संस्थान: कृषि सलाह (अक्टूबर 2023)',
    uri: 'https://icar-crri.in/wp-content/uploads/2023/10/AAS_October_2023_II_English.pdf',
  },
  tnauBlast: {
    title: 'TNAU Agritech: धान का झोंका रोग — प्रबंधन',
    uri: 'https://agritech.tnau.ac.in/crop_protection/rice_diseases/another%20methods_rice_1.html',
  },
  cowDungBlb: {
    title: 'TNAU शोध: गोबर अर्क से धान के जीवाणु झुलसा में कमी',
    uri: 'https://real.mtak.hu/65893/',
  },
  antibioticBan: {
    title:
      'कृषि मंत्रालय का आदेश (दिसंबर 2021): खेती में स्ट्रेप्टोमाइसिन + टेट्रासाइक्लिन पर रोक — 1 जनवरी 2024 से पूरी रोक (Down To Earth)',
    uri: 'https://www.downtoearth.org.in/amp/story/agriculture/union-agriculture-ministry-prohibits-use-of-tb-antibiotics-on-crops-80785',
  },
  kauStemBorer: { title: 'केरल कृषि विश्वविद्यालय: धान तना छेदक', uri: 'https://celkau.in/crops/cereals/rice/ricestem.php' },
  icarZinc: {
    title: 'ICAR: धान में सूक्ष्म पोषक तत्वों की कमी कैसे सुधारें',
    uri: 'https://icar.org.in/node/6335',
  },
  faw: {
    title: 'ICAR: मक्का में फॉल आर्मीवर्म पर कीटनाशकों का असर',
    uri: 'https://krishi.icar.gov.in/jspui/handle/123456789/84061',
  },
  iimr: { title: 'ICAR-भारतीय मक्का/कदन्न अनुसंधान संस्थान', uri: 'https://www.millets.res.in' },
  shootFly: {
    title: 'ज्वार की प्ररोह मक्खी: बीज उपचार से प्रबंधन (Indian Journal of Entomology)',
    uri: 'https://indianentomology.org/index.php/ije/article/view/107',
  },
  bajraDm: {
    title: 'बाजरे के हरित बाली रोग का मेटालैक्सिल से नियंत्रण (Indian Phytopathology)',
    uri: 'https://epubs.icar.org.in/index.php/IPPJ/article/view/22222',
  },
  iipr: { title: 'ICAR-भारतीय दलहन अनुसंधान संस्थान, कानपुर', uri: 'https://iipr.icar.gov.in' },
  gramPodBorer: {
    title: 'चने में हेलिकोवर्पा: नुकसान, ETL और प्रबंधन (KrishiKosh)',
    uri: 'https://krishikosh.egranth.ac.in/items/117bfe8f-b225-496b-9466-bc70af2a4e90',
  },
  arharWilt: {
    title: 'अरहर उकठा (Fusarium udum) और उसका प्रबंधन (KrishiKosh)',
    uri: 'https://krishikosh.egranth.ac.in/items/78117d85-5b43-4357-b722-cccf086b32c6',
  },
  drmr: { title: 'ICAR-सरसों अनुसंधान निदेशालय, भरतपुर', uri: 'https://www.drmr.res.in' },
  mustardAphid: {
    title: 'सरसों के माहू पर कीटनाशकों का असर (Journal of Oilseed Brassica, 2022)',
    uri: 'https://epubs.icar.org.in/index.php/JOB/article/view/158237',
  },
  iisrSoybean: { title: 'ICAR-भारतीय सोयाबीन अनुसंधान संस्थान, इंदौर', uri: 'https://iisrindore.icar.gov.in' },
  soybeanGirdle: {
    title: 'सोयाबीन गर्डल बीटल: IISR द्वारा सुझाए रसायन (खरीफ 2025)',
    uri: 'https://www.global-agriculture.com/farming-agriculture/girdle-beetle-in-soybean-symptoms-recommended-agrochemicals-and-precautions-kharif-2025/',
  },
  soybeanDiseases: {
    title: 'ICAR-राष्ट्रीय सोयाबीन अनुसंधान संस्थान की सलाह: सोयाबीन के प्रमुख रोग (खरीफ 2025)',
    uri: 'https://www.global-agriculture.com/farming-agriculture/major-soybean-diseases-in-kharif-2025-symptoms-recommended-agrochemicals-and-precautions/',
  },
  soybeanPests: {
    title: 'ICAR-राष्ट्रीय सोयाबीन अनुसंधान संस्थान की सलाह: पत्ती खाने वाली इल्लियां, तना मक्खी, सफेद मक्खी (खरीफ 2025)',
    uri: 'https://www.global-agriculture.com/farming-agriculture/top-recommended-insecticides-to-control-leaf-eating-caterpillars-whitefly-stem-borers-in-soybean/',
  },
  arharPodFly: {
    title: 'अरहर के फली छेदक, विशेषकर फली मक्खी का प्रबंधन (Indian Journal of Agricultural Sciences)',
    uri: 'https://epubs.icar.org.in/index.php/IJAgS/article/view/6583',
  },
  dgr: { title: 'ICAR-मूंगफली अनुसंधान निदेशालय, जूनागढ़', uri: 'https://dgr.icar.gov.in' },
  whiteGrub: {
    title: 'मूंगफली में सफेद लट का प्रबंधन (ICAR KRISHI)',
    uri: 'https://krishi.icar.gov.in/ohs-2.3.1/index.php/record/view/102037',
  },
  cicr: {
    title: 'ICAR-केंद्रीय कपास अनुसंधान संस्थान: कीट-रोग प्रबंधन सलाह 2024-25',
    uri: 'https://nsai.co.in/storage/app/media/uploaded-files/ICAR-CICR_Advisory%20Pest%20and%20Disease%20Management%202024.pdf',
  },
  pbw: {
    title: 'ICAR: गुलाबी सुंडी प्रबंधन रणनीति',
    uri: 'https://icar.org.in/sites/default/files/Circulars/PBW-Management-strategies-2019.pdf',
  },
  redRot: {
    title: 'विकासपीडिया: गन्ने में लाल सड़न का प्रबंधन',
    uri: 'https://en.vikaspedia.in/viewcontent/agriculture/crop-production/integrated-pest-managment/ipm-for-commercial-crops/ipm-strategies-for-sugarcane/red-rot-management-in-sugarcane?lgn=en',
  },
  sugarcaneBorer: {
    title: 'गन्ने में दीमक, अगोला बेधक व जड़ बेधक का प्रबंधन (ICAR-IISR)',
    uri: 'https://www.indiascienceandtechnology.gov.in/technologies/management-insect-pests-termite-early-shoot-borer-and-root-borer',
  },
  cpri: { title: 'ICAR-केंद्रीय आलू अनुसंधान संस्थान, शिमला', uri: 'https://cpri.icar.gov.in' },
  cpriAdvisory: {
    title: 'CPRI की पछेती झुलसा सलाह (Indian Potato)',
    uri: 'https://indianpotato.com/cpri-issues-advisory-to-safeguard-potato-crops-from-late-blight-disease-threat/',
  },
  dogr: { title: 'ICAR-प्याज़ एवं लहसुन अनुसंधान निदेशालय, पुणे', uri: 'https://dogr.icar.gov.in' },
  dogrPurpleBlotch: {
    title: 'खरीफ प्याज़ में बैंगनी धब्बे का नियंत्रण (DOGR जर्नल)',
    uri: 'https://dogr.icar.gov.in/jar/index.php/jar/article/view/13/0',
  },
  iihr: { title: 'ICAR-भारतीय बागवानी अनुसंधान संस्थान, बेंगलुरु', uri: 'https://www.iihr.res.in' },
  nhbTomato: {
    title: 'राष्ट्रीय बागवानी बोर्ड: टमाटर के विकार',
    uri: 'https://nhb.gov.in/pdf/vegetable/tomato/tom003.pdf',
  },
  nhbCauliflower: {
    title: 'राष्ट्रीय बागवानी बोर्ड: फूलगोभी के विकार',
    uri: 'https://www.nhb.gov.in/pdf/vegetable/cauliflower/cau003.pdf',
  },
  kauBrinjal: { title: 'केरल कृषि विश्वविद्यालय: बैंगन तना एवं फल छेदक', uri: 'https://celkau.in/crops/vegetables/brinjal/shoot.php' },
  kauOkra: { title: 'केरल कृषि विश्वविद्यालय: भिंडी फल छेदक', uri: 'https://celkau.in/crops/vegetables/okra/fruitborer.php' },
  tnauOkraOrganic: {
    title: 'TNAU: भिंडी के रोगों का जैविक प्रबंधन',
    uri: 'https://agritech.tnau.ac.in/org_farm/orgfarm_bhendi_diseases.html',
  },
  iivrKashiChaman: {
    title: 'ICAR-IIVR: भिंडी की किस्म काशी चमन (YVMV सहनशील)',
    uri: 'https://icar.org.in/en/icar-iivrs-okra-variety-kashi-chaman-fetches-bumper-yield-farmers-field',
  },
  tnauCole: {
    title: 'TNAU Agritech: गोभी वर्गीय फसलों के कीट',
    uri: 'https://agritech.tnau.ac.in/crop_protection/crop_prot_crop_insect-veg_cole%20crops_pest&disease.html',
  },
  tnauChilli: {
    title: 'TNAU Agritech: मिर्च के कीट व रोग',
    uri: 'https://agritech.tnau.ac.in/crop_protection/crop_prot_crop_insect-veg_chillies_pest&disease.html',
  },
  chilliThrips: {
    title: 'DPPQS: मिर्च में थ्रिप्स प्रबंधन व CIB&RC पंजीकृत कीटनाशक (2022)',
    uri: 'https://ppqs.gov.in/sites/default/files/adhoc_management_strategies_on_thrips_parvispinus.pdf',
  },
  ncipm: { title: 'ICAR-राष्ट्रीय समेकित नाशीजीव प्रबंधन अनुसंधान केंद्र', uri: 'https://ncipm.icar.gov.in' },
  karnalBunt: {
    title: 'पंजाब में रतुआ व करनाल बंट के लिए प्रोपिकोनाज़ोल छिड़काव का सही समय (Seed Research)',
    uri: 'https://epubs.icar.org.in/index.php/SR/article/view/164799',
  },
  iimrDisease: { title: 'ICAR-भारतीय मक्का अनुसंधान संस्थान: रोग प्रबंधन', uri: 'https://iimr.icar.gov.in/?p=1223' },
  bajraErgot: {
    title: 'बाजरे का अर्गट रोग और उसका प्रबंधन — समीक्षा (JPP)',
    uri: 'https://www.phytojournal.com/archives/2020.v9.i2.10866/ergot-of-bajra-and-its-management-review',
  },
  arharPodBorerIpm: {
    title: 'अरहर में फली छेदकों के लिए IPM मॉड्यूल (Indian Journal of Plant Protection)',
    uri: 'https://epubs.icar.org.in/index.php/IJPP/article/view/106042',
  },
  arharPodBorerModules: {
    title: 'अरहर फली छेदकों पर कीटनाशक मॉड्यूल की तुलना (TJRA)',
    uri: 'https://epubs.icar.org.in/index.php/TJRA/article/view/133272',
  },
  sclerotinia: {
    title: 'ICAR-DRMR: सरसों में स्क्लेरोटीनिया तना सड़न का प्रबंधन (GCIRC बुलेटिन)',
    uri: 'https://www.gcirc.org/fileadmin/documents/Bulletins/B28/3._Pankaj_Sharma.pdf',
  },
  sugarcaneTopBorer: {
    title: 'ICAR-IISR AICRP कीट विज्ञान रिपोर्ट (लुधियाना 2012-13): चोटी बेधक',
    uri: 'https://iisr.icar.gov.in/iisr/aicrp/download/AnnualReport-Ludhiana-ENT-2012-13.pdf',
  },
  pyrilla: {
    title: 'गन्ने में पायरिला का प्रबंधन (ICAR-IISR)',
    uri: 'https://www.indiascienceandtechnology.gov.in/technologies/management-insect-pests-pyrilla',
  },
  tnauSugarcaneSmut: {
    title: 'TNAU Agritech: गन्ने का कंडुआ रोग',
    uri: 'https://agritech.tnau.ac.in/crop_protection/sugarcane_diseases/sugarcane_d2.html',
  },
  sbiThermotherapy: {
    title: 'ICAR-गन्ना प्रजनन संस्थान: बीज गन्ने का ताप उपचार',
    uri: 'https://sugarcane.icar.gov.in/wp-content/uploads/2022/08/Thermotherapy.pdf',
  },
  blackScurf: {
    title: 'आलू की काली रूसी के लिए बोरिक एसिड उपचार (Potato Journal)',
    uri: 'https://epubs.icar.org.in/index.php/PotatoJ/article/view/31807',
  },
  tnauDampingOff: {
    title: 'TNAU Agritech: मिर्च नर्सरी में आर्द्र गलन',
    uri: 'https://agritech.tnau.ac.in/crop_protection/chilli_diseases_1.html',
  },
  kauDampingOff: {
    title: 'केरल कृषि विश्वविद्यालय: प्याज़ में आर्द्र गलन',
    uri: 'https://celkau.in/crops/vegetables/onion/dampingoff.php',
  },
  tnauBacterialWilt: {
    title: 'TNAU Agritech: टमाटर का जीवाणु म्लानि रोग',
    uri: 'https://agritech.tnau.ac.in/crop_protection/tomato_diseases_5.html',
  },
  tuta: {
    title: 'टमाटर पिनवर्म (टूटा एब्सोल्यूटा) पॉकेट बुक (KIRAN, ICAR)',
    uri: 'https://www.kiran.nic.in/pdf/publications/2020/Pocket%20book_TUTA_30.12.2019.pdf',
  },
  tutaDte: {
    title: 'भारत में टमाटर के कीट टूटा पर कैसे काबू पाया गया (Down To Earth)',
    uri: 'https://www.downtoearth.org.in/agriculture/how-scientists-contained-a-deadly-tomato-pest-that-travelled-across-the-world-64446',
  },
  tnauLittleLeaf: {
    title: 'TNAU Agritech: बैंगन का छोटी पत्ती रोग',
    uri: 'https://agritech.tnau.ac.in/crop_protection/brinjal/brinjal_6.html',
  },
  kauBlackRot: {
    title: 'केरल कृषि विश्वविद्यालय: फूलगोभी का काला सड़न',
    uri: 'https://celkau.in/crops/vegetables/cauliflower/blackrot.php',
  },
  iivrBlackRot: {
    title: 'ICAR-IIVR: गोभी वर्गीय फसलों में काला सड़न का बीज उपचार से प्रबंधन',
    uri: 'https://krishi.icar.gov.in/jspui/handle/123456789/50233',
  },
  kauChilliMite: {
    title: 'केरल कृषि विश्वविद्यालय: मिर्च में माइट',
    uri: 'https://celkau.in/crops/vegetables/chilli/mite.php',
  },
  ascochyta: {
    title: 'चने में एस्कोकाइटा झुलसा का प्रबंधन (Indian Phytopathology)',
    uri: 'https://epubs.icar.org.in/index.php/IPPJ/article/view/20789',
  },
  sterilityMosaic: {
    title: 'अरहर का बांझपन मोज़ेक रोग: स्थिति और प्रबंधन (समीक्षा, 2024)',
    uri: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11313807/',
  },
  sterilityMosaicResistance: {
    title: 'ICRISAT: बांझपन मोज़ेक रोधी अरहर और माइट वाहक',
    uri: 'https://oar.icrisat.org/7936',
  },
  kauBasalRot: {
    title: 'केरल कृषि विश्वविद्यालय: प्याज़ का आधार सड़न',
    uri: 'https://celkau.in/crops/vegetables/onion/basalrot.php',
  },
  tnauGroundnutStemRot: {
    title: 'TNAU Agritech: मूंगफली का तना सड़न',
    uri: 'https://agritech.tnau.ac.in/crop_protection/groundnut_diseases/groundnut_d4.html',
  },
  groundnutCollarRot: {
    title: 'मूंगफली के कॉलर रॉट का फफूंदनाशक व पोषक तत्वों से प्रबंधन (IJAS)',
    uri: 'https://epubs.icar.org.in/index.php/IJAgS/article/view/122251',
  },
} satisfies Record<string, GroundingSource>;

// ---------- Knowledge base ----------

export const DISEASES: DiseaseInfo[] = [
  // ----- गेहूं / जौ -----
  {
    id: 'wheat-yellow-rust',
    cropKeys: ['wheat', 'barley'],
    type: 'fungal',
    nameHi: 'पीला रतुआ (धारीदार रतुआ)',
    nameEn: 'Yellow (stripe) rust',
    scientificName: 'Puccinia striiformis f. sp. tritici',
    aliases: ['पीली गेरुई', 'गेरुई', 'रतुआ', 'stripe rust', 'yellow rust'],
    symptomsHi: [
      'पत्तियों पर हल्दी जैसे पीले पाउडर की धारियां, जो नसों के साथ-साथ कतार में होती हैं।',
      'पत्ती को उंगली से रगड़ने पर हाथ या कपड़े पर पीला पाउडर लग जाता है।',
      'शुरू में खेत में गोल-गोल पीले घेरे (पैच) दिखते हैं, फिर पूरे खेत में फैल जाते हैं।',
      'ज़्यादा प्रकोप में पत्तियां सूख जाती हैं और दाने छोटे व हल्के रह जाते हैं।',
      'ध्यान दें: बिना पाउडर की पीली पत्ती नाइट्रोजन की कमी या ठंड से भी हो सकती है।',
    ],
    favourableConditionsHi:
      'ठंडा मौसम (लगभग 10–15°C), बीच-बीच में बारिश, ओस और कोहरा। दिसंबर से फरवरी में पंजाब, हरियाणा, हिमाचल, जम्मू-कश्मीर और उत्तर प्रदेश-उत्तराखंड के तराई क्षेत्रों में ज़्यादा आता है।',
    organicHi: [
      'शुरुआती पीले पैच दिखते ही प्रभावित पत्तियां सावधानी से तोड़कर प्लास्टिक थैली में बंद करें और नष्ट करें।',
      'रोगी खेत में घूमने के बाद उन्हीं कपड़ों में दूसरे खेत में न जाएं — बीजाणु कपड़ों से फैलते हैं।',
      'जैविक उपाय केवल बचाव तक सीमित हैं; रोग फैलने लगे तो सिफारिश किया गया फफूंदनाशक ही असरदार है।',
    ],
    chemicalHi: chem(
      'गेहूं में: प्रोपिकोनाज़ोल (Propiconazole) 25% EC — 200 मि.ली. दवा 200 लीटर पानी में प्रति एकड़ (1 मि.ली. प्रति लीटर)।',
      'या टेबुकोनाज़ोल 50% + ट्राइफ्लॉक्सीस्ट्रोबिन 25% WG (Tebuconazole + Trifloxystrobin) — 120 ग्राम प्रति एकड़, 200 लीटर पानी में।',
      'शुरुआत में केवल रोगी पैच और उसके आसपास छिड़कें; निगरानी करते रहें और रोग फिर दिखे तो छिड़काव दोहराएं। आख़िरी छिड़काव और कटाई के बीच प्रोपिकोनाज़ोल में कम से कम 30 दिन और टेबुकोनाज़ोल + ट्राइफ्लॉक्सीस्ट्रोबिन में 40 दिन रखें।',
      'जौ में: CIB&RC सूची में जौ के रतुआ के लिए कोई दवा दर्ज नहीं मिली — छिड़काव से पहले कृषि अधिकारी या KVK से पूछें।',
      'छिड़काव साफ़ मौसम में करें — बारिश, कोहरे या ओस के समय नहीं।',
    ),
    preventionHi: [
      'अपने क्षेत्र के लिए सिफारिश की गई रतुआ-रोधी किस्में बोएं (KVK या कृषि विश्वविद्यालय से पूछें)।',
      'यूरिया ज़रूरत से ज़्यादा न दें; खेत में पानी न रुकने दें।',
      'दिसंबर से फरवरी तक हर हफ्ते खेत जांचें, खासकर पेड़ों की छाया वाले किनारे।',
      'पिछली फसल के अवशेष और खरपतवार नष्ट करें।',
    ],
    severityHint: 'high',
    sources: [S.yellowRust, S.pauRabi, S.cibrcFungicides, S.iiwbr],
  },
  {
    id: 'wheat-brown-rust',
    cropKeys: ['wheat', 'barley'],
    type: 'fungal',
    nameHi: 'भूरा रतुआ (पत्ती रतुआ)',
    nameEn: 'Brown (leaf) rust',
    scientificName: 'Puccinia triticina',
    aliases: ['भूरी गेरुई', 'पत्ती का रतुआ', 'leaf rust', 'brown rust'],
    symptomsHi: [
      'पत्तियों पर नारंगी-भूरे, गोल या अंडाकार छोटे उभरे दाने (फफोले) बिखरे हुए — धारियों में नहीं।',
      'छूने पर हाथ पर भूरा-नारंगी पाउडर लगता है।',
      'बाद में पत्तियां पीली होकर सूखने लगती हैं और दाना सिकुड़ जाता है।',
    ],
    favourableConditionsHi:
      'हल्का गर्म और नम मौसम (लगभग 15–25°C) तथा पत्तियों पर ओस। फरवरी–मार्च में और देर से बोई फसल में ज़्यादा; मध्य और उत्तर भारत में आम।',
    organicHi: [
      'शुरुआती प्रकोप वाली पत्तियां हटाकर नष्ट करें।',
      'जैविक उपाय केवल बचाव तक सीमित हैं; प्रकोप बढ़े तो फफूंदनाशक का छिड़काव करें।',
    ],
    chemicalHi: chem(
      'गेहूं में रोग दिखते ही: प्रोपिकोनाज़ोल (Propiconazole) 25% EC — 200 मि.ली. दवा 200 लीटर पानी में प्रति एकड़ (1 मि.ली. प्रति लीटर)।',
      'आख़िरी छिड़काव और कटाई के बीच कम से कम 30 दिन रखें; साफ़ मौसम में छिड़कें।',
      'जौ में: CIB&RC सूची में जौ के रतुआ के लिए कोई दवा दर्ज नहीं मिली — छिड़काव से पहले कृषि अधिकारी या KVK से पूछें।',
    ),
    preventionHi: [
      'रतुआ-रोधी किस्में और समय पर बुवाई (देर से बुवाई में खतरा ज़्यादा)।',
      'संतुलित खाद — ज़्यादा नाइट्रोजन से बचें।',
      'फरवरी–मार्च में हर हफ्ते निगरानी करें।',
    ],
    severityHint: 'medium',
    sources: [S.pauRabi, S.cibrcFungicides, S.iiwbr],
  },
  {
    id: 'wheat-loose-smut',
    cropKeys: ['wheat', 'barley'],
    type: 'fungal',
    nameHi: 'खुला कंडुआ (लूज़ स्मट)',
    nameEn: 'Loose smut',
    scientificName: 'Ustilago segetum var. tritici',
    aliases: ['कंडुआ', 'काली बाली', 'loose smut'],
    symptomsHi: [
      'बाली निकलते समय दानों की जगह काला पाउडर (बीजाणु) भरा होता है।',
      'कुछ दिनों में पाउडर हवा से उड़ जाता है और सिर्फ खाली डंठल बचता है।',
      'रोगी पौधे की बाली अक्सर स्वस्थ बालियों से कुछ पहले निकलती है।',
    ],
    favourableConditionsHi:
      'यह बीज से फैलने वाला रोग है — संक्रमित बीज बोने पर अगली फसल में आता है। फूल आते समय ठंडा-नम मौसम हवा से फैलाव बढ़ाता है।',
    organicHi: [
      'ट्राइकोडर्मा विरिडी (Trichoderma viride) 1.5% WP — 4 ग्राम प्रति किलो बीज से बीज उपचार।',
      'धूप से बीज उपचार (PAU): मई–जून में किसी साफ़, धूप वाले दिन बीज को सुबह 8 से 12 बजे तक सादे पानी में भिगोएं, फिर पक्के फर्श या तिरपाल पर पतली परत में धूप में पूरा सुखाकर रखें।',
      'रोगी बालियों को काला पाउडर उड़ने से पहले कागज़ या थैली से ढककर तोड़ें और गाड़ दें या जला दें।',
    ],
    chemicalHi: chem(
      'बुवाई से पहले बीज उपचार: कार्बोक्सिन (Carboxin) 75% WP — गेहूं में 2 ग्राम प्रति किलो बीज (80 ग्राम प्रति 40 किलो), जौ में 1.5 ग्राम प्रति किलो बीज।',
      'या गेहूं में टेबुकोनाज़ोल (Tebuconazole) 2% DS — 1 ग्राम प्रति किलो बीज (40 ग्राम प्रति 40 किलो)।',
      'बीज उपचार बुवाई से एक महीने से ज़्यादा पहले न करें — अंकुरण घट सकता है।',
      'खड़ी फसल में छिड़काव से यह रोग ठीक नहीं होता — बचाव बीज उपचार से ही है।',
    ),
    preventionHi: [
      'प्रमाणित बीज लें; रोगी खेत का बीज अगले साल के लिए न रखें।',
      'घर का बीज हो तो हर साल बीज उपचार ज़रूर करें।',
    ],
    severityHint: 'medium',
    sources: [S.pauRabi, S.cibrcFungicides, S.cibrcBioFungicides, S.iiwbr],
  },
  {
    id: 'wheat-termite',
    cropKeys: ['wheat', 'barley', 'gram', 'sugarcane', 'groundnut'],
    type: 'pest',
    nameHi: 'दीमक',
    nameEn: 'Termite',
    scientificName: 'Odontotermes obesus, Microtermes obesi',
    aliases: ['दीमक', 'उदई', 'termite'],
    symptomsHi: [
      'पौधे जगह-जगह मुरझाकर सूख जाते हैं और खींचने पर आसानी से उखड़ जाते हैं।',
      'जड़ें और तने का निचला हिस्सा कुतरा हुआ, उसमें मिट्टी भरी दिखती है।',
      'खेत में टुकड़ों में सूखे पौधे; गेहूं में बालियां सफेद और खाली रह सकती हैं।',
    ],
    favourableConditionsHi:
      'हल्की रेतीली या सूखी मिट्टी, कम सिंचाई वाले बारानी खेत, कच्ची (बिना सड़ी) गोबर खाद और खेत में पड़े पिछली फसल के ठूंठ।',
    organicHi: [
      'केवल अच्छी तरह सड़ी गोबर खाद डालें; कच्ची खाद दीमक को बुलाती है।',
      'जहां दीमक ज़्यादा हो, बुवाई से पहले नीम की खली मिट्टी में मिलाएं (शोध में लगभग 1 टन प्रति हेक्टेयर)।',
    ],
    chemicalHi: chem(
      'गेहूं में बीज उपचार: थायमेथोक्साम (Thiamethoxam) 70% WS — 1 ग्राम, या क्लोरपाइरीफॉस (Chlorpyriphos) 20% EC — 4 मि.ली. प्रति किलो बीज। 40 किलो बीज की दवा लगभग 1 लीटर पानी में घोलकर पक्के फर्श या तिरपाल पर फैले बीज पर छिड़कें, मिलाएं और छाया में सुखाकर बोएं।',
      'गेहूं में ज़्यादा प्रकोप हो तो पहली सिंचाई से पहले: फिप्रोनिल (Fipronil) 0.3% GR — 7 किलो, या क्लोरपाइरीफॉस 20% EC — 1.2 लीटर प्रति एकड़, 20 किलो नम रेत में मिलाकर बिखेरें।',
      'जौ में बीज उपचार: क्लोरपाइरीफॉस 20% EC — लगभग 4–6 मि.ली. प्रति किलो बीज (लेबल मात्रा)।',
      'चने में: लेबल पर चना और दीमक दर्ज दवा ही लें — बीज उपचार की मात्रा कृषि अधिकारी या KVK से पूछें।',
      'गन्ने में बीज उपचार लागू नहीं — बुवाई के समय कूंड़ में सेट्स पर: क्लोरएंट्रानिलिप्रोल (Chlorantraniliprole) 18.5% SC — 200 मि.ली. दवा लगभग 400 लीटर पानी में प्रति एकड़ छिड़ककर सेट्स को मिट्टी से ढकें।',
      'मूंगफली में बीज उपचार: इमिडाक्लोप्रिड 18.5% + हेक्साकोनाज़ोल 1.5% FS — 2 मि.ली. प्रति किलो दाना (यह सफेद लट और कॉलर सड़न से भी बचाता है)।',
    ),
    preventionHi: [
      'खेत की मेड़ और आसपास के दीमक के टीले खोदकर रानी दीमक नष्ट करें।',
      'पिछली फसल के ठूंठ और लकड़ी के टुकड़े खेत से हटाएं।',
      'समय पर सिंचाई करें — सूखी मिट्टी में दीमक ज़्यादा नुकसान करती है।',
    ],
    severityHint: 'medium',
    sources: [S.pauRabi, S.pauKharif, S.cibrcInsecticides, S.wheatTermite, S.iiwbr],
  },
  {
    id: 'wheat-aphid',
    cropKeys: ['wheat', 'barley'],
    type: 'pest',
    nameHi: 'माहू (चेपा)',
    nameEn: 'Wheat aphid',
    scientificName: 'Rhopalosiphum maidis, Sitobion avenae',
    aliases: ['चेपा', 'माहू', 'aphid'],
    symptomsHi: [
      'पत्तियों, तने और बालियों पर छोटे हरे-काले कीड़ों के झुंड रस चूसते हैं।',
      'पत्तियों पर चिपचिपा मीठा पदार्थ और उस पर काली फफूंद।',
      'ज़्यादा प्रकोप में दाने छोटे रह जाते हैं।',
    ],
    favourableConditionsHi:
      'जनवरी से मार्च तक बादल वाला, हल्का ठंडा-नम मौसम; ज़्यादा नाइट्रोजन वाली घनी फसल।',
    organicHi: [
      'लेडीबर्ड बीटल (गुबरैला) और क्राइसोपा जैसे मित्र कीट माहू खाते हैं — कम प्रकोप में दवा न छिड़कें।',
      'घर पर बना नीम अर्क (PAU): 4 किलो नीम की कोमल टहनियां, पत्ते और फल 10 लीटर पानी में 30 मिनट उबालकर मलमल के कपड़े से छानें; 2 लीटर अर्क प्रति एकड़ के दो छिड़काव, एक हफ्ते के अंतर पर।',
      'प्रकोप पहले खेत के किनारों पर दिखता है — शुरुआत वहीं से नियंत्रण करें।',
    ],
    chemicalHi: chem(
      'केवल बाली निकलने के बाद, जब औसतन प्रति बाली 5 या ज़्यादा माहू हों (एकड़ के चारों हिस्सों से 10-10 बालियां देखें), तभी छिड़कें।',
      'गेहूं में: थायमेथोक्साम (Thiamethoxam) 25% WG — 20 ग्राम प्रति एकड़, 80–100 लीटर पानी में (हाथ वाले स्प्रेयर से)।',
      'केवल प्रभावित पट्टी पर छिड़कें; आख़िरी छिड़काव और कटाई के बीच कम से कम 21 दिन रखें।',
      'जौ में: लेबल पर जौ दर्ज दवा ही लें — कृषि अधिकारी से पूछें।',
    ),
    preventionHi: [
      'समय पर बुवाई और संतुलित नाइट्रोजन।',
      'जनवरी से हर हफ्ते खेत के किनारों की जांच करें।',
    ],
    severityHint: 'low',
    sources: [S.pauRabi, S.cibrcInsecticides, S.iiwbr],
  },
  {
    id: 'wheat-karnal-bunt',
    cropKeys: ['wheat'],
    type: 'fungal',
    nameHi: 'करनाल बंट (आंशिक कंडुआ)',
    nameEn: 'Karnal bunt',
    scientificName: 'Tilletia indica',
    aliases: ['करनाल बंट', 'बंट', 'karnal bunt'],
    symptomsHi: [
      'बाली के कुछ ही दाने प्रभावित होते हैं — दाने का एक हिस्सा काला चूर्ण बन जाता है, बाकी सामान्य दिखता है।',
      'दाना दबाने पर काला पाउडर निकलता है और सड़ी मछली जैसी गंध आती है।',
      'खड़ी फसल में पहचानना मुश्किल; अक्सर कटाई के बाद दानों में दिखता है।',
    ],
    favourableConditionsHi:
      'बाली निकलते और फूल आते समय (फरवरी–मार्च) बादल, बूंदाबांदी और ज़्यादा नमी। रोग के बीजाणु मिट्टी और बीज से आते हैं।',
    organicHi: [
      'प्रमाणित, रोगमुक्त बीज बोएं; रोगी खेत का गेहूं बीज के लिए न रखें।',
      'जिस खेत में रोग आया हो वहां 2–3 साल दूसरी फसल लें।',
    ],
    chemicalHi: chem(
      'बाली निकलते समय एक छिड़काव: प्रोपिकोनाज़ोल (Propiconazole) 25% EC — 200 मि.ली. दवा 200 लीटर पानी में प्रति एकड़। PAU यह छिड़काव खासकर बीज के लिए उगाई जा रही फसल में सुझाता है।',
      'आख़िरी छिड़काव और कटाई के बीच कम से कम 30 दिन रखें।',
    ),
    preventionHi: [
      'संतुलित नाइट्रोजन; बाली निकलते समय निगरानी।',
      'बिक्री/निर्यात के लिए साफ़ दाना ज़रूरी — रोगी दाने अलग करें।',
    ],
    severityHint: 'medium',
    sources: [S.pauRabi, S.cibrcFungicides, S.karnalBunt, S.iiwbr],
  },

  // ----- धान -----
  {
    id: 'paddy-blast',
    cropKeys: ['paddy'],
    type: 'fungal',
    nameHi: 'झोंका रोग (ब्लास्ट)',
    nameEn: 'Rice blast',
    scientificName: 'Magnaporthe oryzae (Pyricularia oryzae)',
    aliases: ['झोंका', 'बदरा', 'गर्दन तोड़', 'blast', 'neck blast'],
    symptomsHi: [
      'पत्तियों पर आंख या नाव के आकार के धब्बे — बीच में राख जैसा भूरा-सफेद, किनारे गहरे भूरे।',
      'गांठों पर काले धब्बे; वहीं से तना टूट सकता है।',
      'बाली की गर्दन काली पड़कर टूट जाती है और बाली सफेद या खाली रह जाती है (गर्दन झोंका)।',
      'ज़्यादा प्रकोप में खेत जला हुआ सा दिखता है।',
    ],
    favourableConditionsHi:
      'रात में ठंडक (लगभग 20–25°C), बहुत ज़्यादा नमी, लगातार ओस या बूंदाबांदी और बादल। ज़्यादा नाइट्रोजन और बासमती/सुगंधित किस्मों में अधिक।',
    organicHi: [
      'स्यूडोमोनास फ्लोरेसेंस (Pseudomonas fluorescens) 0.5% WP — 10 ग्राम प्रति किलो बीज से बीज उपचार।',
      'ट्राइकोडर्मा विरिडी 1% WP — लगभग 2 किलो प्रति एकड़ (NRRI सलाह)।',
      'शुरुआती अवस्था में नीम की ताज़ी पत्तियों का अर्क (लगभग 200 ग्राम प्रति लीटर) मदद कर सकता है (NRRI)।',
    ],
    chemicalHi: chem(
      'ट्राइसाइक्लाज़ोल (Tricyclazole) 75% WP — लगभग 120–160 ग्राम प्रति एकड़ (300–400 ग्राम/हेक्टेयर), 200 लीटर पानी में।',
      'या टेबुकोनाज़ोल 50% + ट्राइफ्लॉक्सीस्ट्रोबिन 25% WG — 80 ग्राम प्रति एकड़ (0.4 ग्राम/लीटर)।',
      'या आइसोप्रोथियोलेन (Isoprothiolane) 40% EC — लगभग 300 मि.ली. प्रति एकड़ (1.5 मि.ली./लीटर)।',
      'गर्दन झोंका से बचाव के लिए गभोट (बूट) और बाली निकलते समय छिड़काव करें; हर बार दवा बदलें।',
      'बासमती निर्यात वाले क्षेत्रों में ट्राइसाइक्लाज़ोल जैसे कुछ फफूंदनाशकों पर राज्य की रोक या सलाह हो सकती है — पहले स्थानीय कृषि विभाग से पूछें।',
    ),
    preventionHi: [
      'रोगरोधी किस्में लगाएं; बीज उपचार करें।',
      'नाइट्रोजन 2–3 बार में बांटकर दें; ज़्यादा यूरिया से बचें।',
      'मेड़ और नालियों की घास-खरपतवार साफ़ रखें।',
      'खेत में पानी की कमी (सूखा तनाव) न होने दें।',
    ],
    severityHint: 'high',
    sources: [S.nrri, S.cibrcFungicides, S.cibrcBioFungicides, S.pauKharif, S.tnauBlast],
  },
  {
    id: 'paddy-bacterial-leaf-blight',
    cropKeys: ['paddy'],
    type: 'bacterial',
    nameHi: 'जीवाणु झुलसा (बैक्टीरियल लीफ ब्लाइट)',
    nameEn: 'Bacterial leaf blight',
    scientificName: 'Xanthomonas oryzae pv. oryzae',
    aliases: ['झुलसा', 'BLB', 'कड़ा रोग', 'bacterial blight', 'kresek'],
    symptomsHi: [
      'पत्ती के सिरे और किनारों से पीली-सफेद लहरदार धारियां नीचे की ओर बढ़ती हैं।',
      'पत्तियां सूखकर पुआल जैसी सफेद-भूरी हो जाती हैं।',
      'सुबह पत्तियों पर पीली दूधिया बूंदें (जीवाणु का रिसाव) दिख सकती हैं।',
      'शुरुआती अवस्था में पूरा पौधा मुरझा सकता है (क्रेसेक)।',
    ],
    favourableConditionsHi:
      'गर्म-नम मौसम (लगभग 25–34°C), तेज़ हवा के साथ बारिश, बाढ़ या पानी भराव और ज़्यादा नाइट्रोजन। रोगी खेत का पानी दूसरे खेत में जाने से फैलता है।',
    organicHi: [
      'स्यूडोमोनास फ्लोरेसेंस — 10 ग्राम प्रति किलो बीज से बीज उपचार और रोपाई से पहले पौध की जड़ डुबोना।',
      'शुरुआती अवस्था में ताज़े गोबर को पानी में घोलकर, छानकर (लगभग 20% घोल) छिड़काव — TNAU के शोध में इससे रोग कम हुआ।',
    ],
    chemicalHi: chem(
      'कॉपर ऑक्सीक्लोराइड (Copper oxychloride) 50% WP — 2.5–3 ग्राम प्रति लीटर (लगभग 500 ग्राम प्रति एकड़); 10–12 दिन बाद ज़रूरत हो तो दोहराएं।',
      'स्ट्रेप्टोमाइसिन + टेट्रासाइक्लिन जैसी एंटीबायोटिक दवाएं कृषि में चरणबद्ध रूप से बंद की जा रही हैं — खरीदने से पहले कृषि विभाग से मौजूदा अनुमति की पुष्टि करें।',
    ),
    preventionHi: [
      'रोग आने पर यूरिया की टॉप-ड्रेसिंग रोक दें; पोटाश संतुलित मात्रा में दें।',
      'रोगरोधी किस्में लगाएं।',
      'रोगी खेत का पानी दूसरे खेतों में न जाने दें; ज़रूरत पर पानी निकाल दें।',
      'खेत और मेड़ों से खरपतवार और पिछली फसल के ठूंठ हटाएं।',
    ],
    severityHint: 'high',
    sources: [S.nrri, S.cowDungBlb, S.antibioticBan],
  },
  {
    id: 'paddy-brown-planthopper',
    cropKeys: ['paddy'],
    type: 'pest',
    nameHi: 'भूरा फुदका (ब्राउन प्लांट हॉपर)',
    nameEn: 'Brown planthopper (BPH)',
    scientificName: 'Nilaparvata lugens',
    aliases: ['फुदका', 'BPH', 'हॉपर बर्न', 'planthopper', 'माहू'],
    symptomsHi: [
      'पौधों के निचले हिस्से में, पानी की सतह के पास, तनों पर भूरे छोटे कीड़ों के झुंड।',
      'पौधे पीले-भूरे होकर गोल घेरों में सूखते हैं — इसे “हॉपर बर्न” कहते हैं।',
      'ज़्यादा प्रकोप में पौधे गिर जाते हैं और बालियां खाली रह जाती हैं।',
    ],
    favourableConditionsHi:
      'गर्म-उमस भरा मौसम (अगस्त–अक्टूबर), घनी रोपाई, ज़्यादा यूरिया, खेत में लगातार पानी भरा रहना और बार-बार सिंथेटिक पाइरेथ्रॉइड का छिड़काव (इससे फुदका और बढ़ता है)।',
    organicHi: [
      'हर 2–2.5 मीटर पर 20–30 सेमी चौड़ी पगडंडी (एली) छोड़ें ताकि हवा और धूप नीचे तक पहुंचे।',
      'जहां सिंचाई सुविधा हो, खेत में बारी-बारी से पानी भरें और सुखाएं (AWD) — इससे फुदका कम होता है।',
      'मकड़ी और मिरिड बग जैसे मित्र कीटों को बचाएं; बेवजह छिड़काव न करें।',
    ],
    chemicalHi: chem(
      'प्रति पौधा (हिल) 5–10 फुदके दिखें तब छिड़कें, नोज़ल पौधे के निचले हिस्से की ओर रखें।',
      'ट्राइफ्लूमेज़ोपाइरिम (Triflumezopyrim) 10% SC — 94 मि.ली. प्रति एकड़।',
      'या पाइमेट्रोज़ीन (Pymetrozine) 50% WG — 120 ग्राम प्रति एकड़।',
      'या डाइनोटेफ्यूरान (Dinotefuran) 20% SG — 80 ग्राम प्रति एकड़ (200 लीटर पानी में)।',
      'प्रकोप के समय यूरिया न डालें और सिंथेटिक पाइरेथ्रॉइड (जैसे साइपरमेथ्रिन) से बचें।',
    ),
    preventionHi: [
      'सहनशील किस्में लगाएं और सही दूरी पर रोपाई करें।',
      'नाइट्रोजन संतुलित और बांटकर दें।',
      'अगस्त से हर हफ्ते पौधों के निचले हिस्से की जांच करें।',
    ],
    severityHint: 'high',
    sources: [S.nrri, S.cibrcUses],
  },
  {
    id: 'paddy-stem-borer',
    cropKeys: ['paddy'],
    type: 'pest',
    nameHi: 'तना छेदक (गोभ सूखना / सफेद बाली)',
    nameEn: 'Yellow stem borer',
    scientificName: 'Scirpophaga incertulas',
    aliases: ['तना बेधक', 'डेड हार्ट', 'सफेद बाली', 'white ear', 'stem borer'],
    symptomsHi: [
      'शुरुआती अवस्था में बीच की गोभ सूख जाती है और खींचने पर आसानी से निकल आती है (डेड हार्ट)।',
      'बाली निकलने के बाद पूरी बाली सफेद और खाली — खींचने पर निकल आती है (सफेद बाली)।',
      'पत्तियों के सिरों पर अंडों के भूरे गुच्छे दिखते हैं।',
    ],
    favourableConditionsHi:
      'गर्म-नम मौसम, देर से रोपाई और ज़्यादा नाइट्रोजन। पिछली फसल के ठूंठ में सुंडी सर्दी बिताती है।',
    organicHi: [
      'फेरोमोन ट्रैप — 3 प्रति एकड़; प्रति ट्रैप रोज़ 3 नर पतंगे दिखें तो नियंत्रण शुरू करें।',
      'ट्राइकोग्रामा जैपोनिकम (Trichogramma japonicum) ट्राइकोकार्ड — 1 कार्ड प्रति एकड़, हफ्ते-हफ्ते पर 4–5 बार।',
      'रोपाई से पहले पौध के सिरे तोड़ दें ताकि उन पर दिए अंडे निकल जाएं; अंडों के गुच्छे इकट्ठा कर नष्ट करें।',
    ],
    chemicalHi: chem(
      'क्लोरएंट्रानिलिप्रोल (Chlorantraniliprole) 0.4% GR — 4 किलो प्रति एकड़, खेत में हल्का पानी रखकर बिखेरें।',
      'या कारटैप हाइड्रोक्लोराइड (Cartap hydrochloride) 4% G — 10 किलो प्रति एकड़, बराबर रेत में मिलाकर।',
      'या फ्लूबेंडियामाइड (Flubendiamide) 39.35% SC — 20 मि.ली. प्रति एकड़ 200 लीटर पानी में।',
    ),
    preventionHi: [
      'कटाई ज़मीन से सटाकर करें और ठूंठ जुताई से नष्ट करें।',
      'समय पर रोपाई और संतुलित नाइट्रोजन।',
      'समय-समय पर पानी का स्तर बढ़ाकर निचले हिस्से पर दिए अंडे डुबो दें।',
    ],
    severityHint: 'high',
    sources: [S.kauStemBorer, S.nrri],
  },
  {
    id: 'paddy-sheath-blight',
    cropKeys: ['paddy'],
    type: 'fungal',
    nameHi: 'शीथ झुलसा (पर्णच्छद अंगमारी)',
    nameEn: 'Sheath blight',
    scientificName: 'Rhizoctonia solani',
    aliases: ['शीथ ब्लाइट', 'तना झुलसा', 'sheath blight'],
    symptomsHi: [
      'पानी की सतह के पास पत्ती के आवरण (शीथ) पर अंडाकार धब्बे — बीच में सफेद-भूरा, किनारे गहरे भूरे, सांप की केंचुली जैसे।',
      'धब्बे ऊपर पत्तियों तक फैलते हैं और पत्तियां सूख जाती हैं।',
      'धब्बों पर सरसों के दाने जैसी छोटी भूरी गांठें (स्क्लेरोशिया) बनती हैं।',
    ],
    favourableConditionsHi:
      'गर्म और बहुत नम मौसम (लगभग 28–32°C), घनी फसल और ज़्यादा नाइट्रोजन। मिट्टी व पानी में बची गांठों से फैलता है।',
    organicHi: [
      'स्यूडोमोनास फ्लोरेसेंस — 10 ग्राम प्रति किलो बीज से बीज उपचार; ज़रूरत पर लगभग 1 किलो प्रति एकड़ सड़ी गोबर खाद में मिलाकर खेत में डालें।',
      'मेड़ों की घास साफ़ रखें — फफूंद वहीं से आती है।',
    ],
    chemicalHi: chem(
      '1–2 कल्लों पर लक्षण दिखते ही: हेक्साकोनाज़ोल (Hexaconazole) 5% EC — 2 मि.ली. प्रति लीटर (लगभग 400 मि.ली. प्रति एकड़)।',
      'या वैलिडामाइसिन (Validamycin) 3% L — 2 मि.ली. प्रति लीटर (लगभग 400 मि.ली. प्रति एकड़)।',
      'या प्रोपिकोनाज़ोल 25% EC — 1 मि.ली. प्रति लीटर, या टेबुकोनाज़ोल 50% + ट्राइफ्लॉक्सीस्ट्रोबिन 25% WG — 80 ग्राम प्रति एकड़।',
      'दवा पौधे के निचले हिस्से तक पहुंचनी चाहिए; 7–10 दिन बाद ज़रूरत हो तो दोहराएं।',
    ),
    preventionHi: [
      'सही दूरी पर रोपाई; ज़्यादा घनी फसल न रखें।',
      'नाइट्रोजन संतुलित और बांटकर दें।',
      'गर्मी में गहरी जुताई करें।',
    ],
    severityHint: 'medium',
    sources: [S.nrri, S.cibrcUses],
  },
  {
    id: 'paddy-leaf-folder',
    cropKeys: ['paddy'],
    type: 'pest',
    nameHi: 'पत्ती लपेटक',
    nameEn: 'Rice leaf folder',
    scientificName: 'Cnaphalocrocis medinalis',
    aliases: ['पत्ता मोड़क', 'leaf folder', 'leaf roller'],
    symptomsHi: [
      'पत्तियां लंबाई में मुड़कर नली जैसी बन जाती हैं; अंदर हरी सुंडी होती है।',
      'सुंडी अंदर से हरा भाग खुरचती है — पत्तियों पर सफेद पारदर्शी धारियां।',
      'ज़्यादा प्रकोप में खेत सफेद सा दिखता है।',
    ],
    favourableConditionsHi: 'नम और छायादार मौसम, ज़्यादा नाइट्रोजन और खेत के आसपास घास।',
    organicHi: [
      'ट्राइकोग्रामा काइलोनिस (Trichogramma chilonis) कार्ड — लगभग 2 सीसी प्रति एकड़।',
      'खेत में रस्सी चलाकर मुड़ी पत्तियां खोल दें — सुंडी पानी में गिर जाती है।',
      'नीम बीज अर्क (NSKE) 5% का छिड़काव शुरुआती अवस्था में।',
    ],
    chemicalHi: chem(
      'लगभग 10% पत्तियां प्रभावित हों (फूल आने पर 5%) तब: फ्लूबेंडियामाइड 39.35% SC — 20 मि.ली. प्रति एकड़।',
      'या क्लोरएंट्रानिलिप्रोल 18.5% SC — 60 मि.ली. प्रति एकड़ (200 लीटर पानी में)।',
    ),
    preventionHi: ['संतुलित नाइट्रोजन; मेड़ों की घास साफ़ रखें।', 'हर हफ्ते निगरानी करें।'],
    severityHint: 'medium',
    sources: [S.kauStemBorer, S.cibrcUses],
  },
  {
    id: 'paddy-false-smut',
    cropKeys: ['paddy'],
    type: 'fungal',
    nameHi: 'आभासी कंडुआ (हल्दी रोग)',
    nameEn: 'False smut',
    scientificName: 'Ustilaginoidea virens',
    aliases: ['हल्दी गांठ', 'लाई फूटना', 'false smut'],
    symptomsHi: [
      'बाली के कुछ दानों की जगह पहले पीले-नारंगी, फिर हरे-काले मखमली गोले बन जाते हैं।',
      'छूने पर हाथ पर हल्दी जैसा पाउडर लगता है।',
      'प्रभावित बालियों में दाने हल्के और कम होते हैं।',
    ],
    favourableConditionsHi:
      'बाली निकलते समय बारिश, बादल और ज़्यादा नमी; ज़्यादा नाइट्रोजन वाली, देर से पकने वाली किस्में।',
    organicHi: [
      'रोगी बालियों को थैली में सावधानी से निकालकर नष्ट करें ताकि पाउडर न फैले।',
      'बीज के लिए स्वस्थ खेत का ही धान रखें।',
    ],
    chemicalHi: chem(
      'गभोट (बूट) अवस्था में: कॉपर हाइड्रॉक्साइड (Copper hydroxide) 77% WP — 2 ग्राम प्रति लीटर (लगभग 400 ग्राम प्रति एकड़)।',
      'या प्रोपिकोनाज़ोल 25% EC — 1 मि.ली. प्रति लीटर।',
      '7–10 दिन बाद दूसरा छिड़काव करें।',
    ),
    preventionHi: [
      'नाइट्रोजन ज़रूरत से ज़्यादा न दें।',
      'जिस खेत में यह रोग आया हो, वहां की फसल अवशेष नष्ट करें।',
    ],
    severityHint: 'medium',
    sources: [S.nrri],
  },
  {
    id: 'paddy-khaira',
    cropKeys: ['paddy'],
    type: 'nutrient',
    nameHi: 'खैरा रोग (ज़िंक की कमी)',
    nameEn: 'Khaira (zinc deficiency)',
    aliases: ['खैरा', 'जस्ता की कमी', 'ज़िंक की कमी', 'zinc deficiency'],
    symptomsHi: [
      'रोपाई के 2–4 हफ्ते बाद बीच की पत्तियों पर हल्के पीले, फिर कत्थई (जंग जैसे) धब्बे।',
      'पौधे बौने, कल्ले कम; खेत में जगह-जगह कमज़ोर पौधे।',
      'नई पत्तियों में बीच की नस के पास सफेद-पीलापन।',
      'फूल आने और पकने में देरी।',
    ],
    favourableConditionsHi:
      'क्षारीय (ऊसर, pH 8 से ऊपर) या लगातार पानी भरी मिट्टी, ज़्यादा फॉस्फोरस और कम जैविक खाद। धान-गेहूं फसल चक्र वाले खेतों में आम।',
    organicHi: [
      'सड़ी गोबर खाद या हरी खाद डालें — मिट्टी में ज़िंक की उपलब्धता सुधरती है।',
    ],
    chemicalHi: chem(
      'रोपाई से पहले ज़िंक सल्फेट (21%) — लगभग 10 किलो प्रति एकड़ (25 किलो प्रति हेक्टेयर) मिट्टी में; मात्रा मिट्टी जांच के अनुसार।',
      'खड़ी फसल में लक्षण दिखें तो 0.5% ज़िंक सल्फेट + 0.25% बुझा चूना (5 ग्राम ज़िंक सल्फेट + 2.5 ग्राम चूना प्रति लीटर), लगभग 200 लीटर प्रति एकड़; 10–15 दिन पर 2–3 बार।',
    ),
    preventionHi: [
      'हर 2–3 साल में मिट्टी जांच कराएं।',
      'ज़िंक सल्फेट और DAP/सुपर फॉस्फेट को एक साथ मिलाकर न डालें।',
    ],
    severityHint: 'medium',
    sources: [S.icarZinc],
  },

  // ----- मक्का / ज्वार / बाजरा -----
  {
    id: 'maize-fall-armyworm',
    cropKeys: ['maize', 'jowar'],
    type: 'pest',
    nameHi: 'फॉल आर्मीवर्म (सैनिक कीट)',
    nameEn: 'Fall armyworm',
    scientificName: 'Spodoptera frugiperda',
    aliases: ['आर्मी वर्म', 'FAW', 'सैनिक कीट', 'fall armyworm'],
    symptomsHi: [
      'नई पत्तियों पर खिड़की जैसे पारदर्शी धब्बे, फिर गोभ में बड़े-बड़े छेद और फटी पत्तियां।',
      'गोभ में भूसे जैसा गीला मल (लद्दी) दिखता है।',
      'सुंडी के सिर पर उल्टे “Y” का निशान और पीछे के हिस्से पर वर्ग में 4 काले बिंदु।',
      'बड़ी फसल में भुट्टों में भी छेद।',
    ],
    favourableConditionsHi:
      'गर्म मौसम, अलग-अलग समय पर और देर से बुवाई, लगातार मक्का। पतंगे रात में लंबी दूरी तक उड़कर फैलते हैं।',
    organicHi: [
      'बुवाई के बाद हर हफ्ते निगरानी; फेरोमोन ट्रैप लगभग 4–5 प्रति एकड़।',
      'अंडों के गुच्छे और सुंडियां हाथ से चुनकर नष्ट करें।',
      'शुरुआती अवस्था (लगभग 5% पौधे प्रभावित) में नीम तेल 1500 ppm 5 मि.ली./लीटर या NSKE 5% गोभ में।',
      'मेटाराइज़ियम एनिसोप्ली या ब्यूवेरिया बेसियाना (जैविक फफूंद) लगभग 5 ग्राम/लीटर गोभ में छिड़कें।',
      'गोभ में बारीक रेत और चूना (9:1) डालना भी सुझाया जाता है।',
    ],
    chemicalHi: chem(
      'छिड़काव गोभ के अंदर निशाना लगाकर करें।',
      'क्लोरएंट्रानिलिप्रोल 18.5% SC — 0.4 मि.ली. प्रति लीटर (लगभग 80 मि.ली. प्रति एकड़); शुरुआती 20 दिन में बेहतर।',
      'या स्पिनेटोरम (Spinetoram) 11.7% SC — 0.5 मि.ली. प्रति लीटर।',
      'या इमामेक्टिन बेंज़ोएट (Emamectin benzoate) 5% SG — 0.4 ग्राम प्रति लीटर; 25–40 दिन की फसल में उपयुक्त।',
      'एक ही दवा बार-बार न दोहराएं।',
    ),
    preventionHi: [
      'पूरे क्षेत्र में एक साथ, समय पर बुवाई करें।',
      'मक्का के साथ अरहर, मूंग या उड़द की अंतरफसल।',
      'गर्मी में गहरी जुताई ताकि मिट्टी में छिपे प्यूपा नष्ट हों।',
    ],
    severityHint: 'high',
    sources: [S.faw, S.iimr],
  },
  {
    id: 'maize-stem-borer',
    cropKeys: ['maize', 'jowar', 'bajra'],
    type: 'pest',
    nameHi: 'चित्तीदार तना छेदक',
    nameEn: 'Spotted stem borer',
    scientificName: 'Chilo partellus',
    aliases: ['तना बेधक', 'डेड हार्ट', 'stem borer'],
    symptomsHi: [
      'पत्तियां खुलने पर उन पर कतार में छोटे-छोटे गोल छेद दिखते हैं।',
      'बीच की गोभ सूख जाती है (डेड हार्ट) और खींचने पर निकल आती है।',
      'तने के अंदर सुरंग और सुंडी; भुट्टे छोटे रह जाते हैं।',
    ],
    favourableConditionsHi: 'गर्म-नम खरीफ मौसम; पिछली फसल के ठूंठ में सुंडी बची रहती है।',
    organicHi: [
      'ट्राइकोग्रामा काइलोनिस — अंकुरण के 10–15 दिन बाद ट्राइकोकार्ड लगाएं, 2–3 बार।',
      'डेड हार्ट वाले पौधे उखाड़कर नष्ट करें।',
      'लोबिया या दलहन की अंतरफसल लगाएं।',
    ],
    chemicalHi: chem(
      'क्लोरएंट्रानिलिप्रोल 18.5% SC — 0.3–0.4 मि.ली. प्रति लीटर (लगभग 60–80 मि.ली. प्रति एकड़), गोभ में छिड़काव; ज़रूरत हो तो 15 दिन बाद दोहराएं।',
    ),
    preventionHi: [
      'कटाई के बाद ठूंठ और डंठल नष्ट करें।',
      'समय पर बुवाई और संतुलित नाइट्रोजन।',
    ],
    severityHint: 'medium',
    sources: [S.iimr, S.cibrcUses],
  },
  {
    id: 'maize-leaf-blight',
    cropKeys: ['maize'],
    type: 'fungal',
    nameHi: 'पत्ती झुलसा (टर्सिकम / मेडिस)',
    nameEn: 'Turcicum and maydis leaf blight',
    scientificName: 'Exserohilum turcicum, Bipolaris maydis',
    aliases: ['पत्ती झुलसा', 'टर्सिकम', 'मेडिस', 'leaf blight', 'TLB', 'MLB'],
    symptomsHi: [
      'टर्सिकम: पत्तियों पर लंबे, नाव के आकार के भूरे-स्लेटी धब्बे; नीचे की पत्तियों से शुरू होकर ऊपर बढ़ते हैं।',
      'मेडिस: नसों के बीच छोटे, आयताकार हल्के भूरे धब्बे, किनारे गहरे।',
      'ज़्यादा प्रकोप में पत्तियां झुलसकर सूख जाती हैं और भुट्टे हल्के रह जाते हैं।',
    ],
    favourableConditionsHi:
      'टर्सिकम: मध्यम तापमान, ओस और नमी (रबी मक्का और पहाड़ी क्षेत्र)। मेडिस: गर्म-नम खरीफ मौसम।',
    organicHi: ['फसल अवशेष नष्ट करें और गहरी जुताई करें।', 'सहनशील हाइब्रिड लगाएं।'],
    chemicalHi: chem(
      'लक्षण दिखते ही मैंकोज़ेब 75% WP — 2.5 ग्राम प्रति लीटर; 10–15 दिन बाद दोहराएं।',
      'या एज़ोक्सीस्ट्रोबिन 18.2% + डाइफेनोकोनाज़ोल 11.4% SC — लगभग 1 मि.ली. प्रति लीटर।',
    ),
    preventionHi: ['फसल चक्र अपनाएं।', 'संतुलित नाइट्रोजन और सही दूरी।'],
    severityHint: 'medium',
    sources: [S.iimrDisease],
  },
  {
    id: 'bajra-downy-mildew',
    cropKeys: ['bajra'],
    type: 'fungal',
    nameHi: 'हरित बाली रोग (डाउनी मिल्ड्यू)',
    nameEn: 'Downy mildew (green ear)',
    scientificName: 'Sclerospora graminicola',
    aliases: ['जोगिया', 'हरी बाली', 'green ear', 'downy mildew'],
    symptomsHi: [
      'पत्तियों पर पीली धारियां; निचली सतह पर सफेद रुई जैसी फफूंद, जो सुबह साफ़ दिखती है।',
      'पौधे बौने रह जाते हैं और ज़्यादा कल्ले निकलते हैं।',
      'बाली में दानों की जगह छोटी हरी पत्ती जैसी संरचनाएं बन जाती हैं — “हरित बाली”।',
    ],
    favourableConditionsHi:
      'ज़्यादा नमी वाला मौसम (लगभग 20–30°C), लगातार बाजरा और संवेदनशील हाइब्रिड। रोग मिट्टी में बचे बीजाणुओं और बीज से आता है।',
    organicHi: [
      'शुरुआत में ही रोगी पौधे उखाड़कर नष्ट करें (रोगिंग) — बीजाणु फैलने से पहले।',
    ],
    chemicalHi: chem(
      'बीज उपचार: मेटालैक्सिल (Metalaxyl) 35% SD — 6 ग्राम प्रति किलो बीज।',
      'खड़ी फसल में: मेटालैक्सिल 8% + मैंकोज़ेब 64% WP — 2.5 ग्राम प्रति लीटर, बुवाई के लगभग 20–25 दिन बाद।',
    ),
    preventionHi: [
      'रोगरोधी हाइब्रिड बोएं; हर साल एक ही हाइब्रिड न दोहराएं — उसकी रोग-रोधी क्षमता टूट सकती है।',
      'फसल चक्र अपनाएं और गर्मी में गहरी जुताई करें।',
    ],
    severityHint: 'high',
    sources: [S.bajraDm, S.cibrcUses],
  },
  {
    id: 'bajra-ergot',
    cropKeys: ['bajra'],
    type: 'fungal',
    nameHi: 'अर्गट रोग',
    nameEn: 'Ergot',
    scientificName: 'Claviceps fusiformis',
    aliases: ['अर्गट', 'मधु रस', 'ergot', 'honeydew'],
    symptomsHi: [
      'फूल आने के समय बाली से हल्के गुलाबी, शहद जैसा चिपचिपा रस टपकता है।',
      'बाद में दानों की जगह गहरे भूरे-काले, सख्त, दाने से बड़े टुकड़े (स्क्लेरोशिया) बन जाते हैं।',
      'ऐसे दाने इंसान और पशु दोनों के लिए ज़हरीले हैं।',
    ],
    favourableConditionsHi:
      'फूल आते समय लगातार बादल, बूंदाबांदी और ज़्यादा नमी; बीज में मिले या मिट्टी में बचे स्क्लेरोशिया।',
    organicHi: [
      'बीज को 10–20% नमक के घोल (10 लीटर पानी में 1–2 किलो नमक) में डुबोएं; ऊपर तैरते टुकड़े और हल्के दाने निकालकर नष्ट करें, फिर बीज साफ़ पानी से धोकर सुखाएं।',
      'रोगी बालियां दिखते ही काटकर नष्ट करें।',
    ],
    chemicalHi: chem(
      'फूल आने के समय 0.2% फफूंदनाशक (जैसे मैंकोज़ेब 75% WP — 2 ग्राम प्रति लीटर) के 2–3 छिड़काव, 5–7 दिन के अंतर पर।',
    ),
    preventionHi: [
      'प्रभावित दाने खाने या चारे में न दें।',
      'गहरी जुताई और फसल चक्र।',
      'बुवाई ऐसे समय करें कि फूल लगातार बारिश के दिनों में न आएं।',
    ],
    severityHint: 'medium',
    sources: [S.bajraErgot],
  },
  {
    id: 'jowar-shoot-fly',
    cropKeys: ['jowar'],
    type: 'pest',
    nameHi: 'प्ररोह मक्खी (शूट फ्लाई)',
    nameEn: 'Sorghum shoot fly',
    scientificName: 'Atherigona soccata',
    aliases: ['तना मक्खी', 'डेड हार्ट', 'shoot fly'],
    symptomsHi: [
      'अंकुरण के 1–4 हफ्ते में बीच की पत्ती (गोभ) सूख जाती है — खींचने पर निकल आती है और सड़ी गंध आती है।',
      'पत्तियों के नीचे सफेद लंबे अंडे दिखते हैं।',
      'प्रभावित पौधे से बाद में कई कल्ले निकलते हैं जो देर से पकते हैं।',
    ],
    favourableConditionsHi:
      'मानसून शुरू होने के 2–3 हफ्ते से ज़्यादा देर से बुवाई, अलग-अलग समय पर बुवाई; रबी ज्वार में जल्दी बुवाई।',
    organicHi: [
      'मानसून आने के 7–10 दिन के अंदर बुवाई करें।',
      'बीज दर थोड़ी ज़्यादा रखें और बाद में डेड हार्ट वाले पौधे निकाल दें।',
      'मछली चूरा (फिशमील) ट्रैप — लगभग 5 प्रति एकड़, बुवाई से अंकुरण के 30 दिन तक।',
      'अंकुरण के लगभग 30 दिन बाद नीम आधारित कीटनाशक (1500 ppm) 3.5 मि.ली. प्रति लीटर।',
    ],
    chemicalHi: chem(
      'बीज उपचार: थायमेथोक्साम (Thiamethoxam) 70% WS — 3 ग्राम प्रति किलो बीज।',
    ),
    preventionHi: [
      'पूरे क्षेत्र में एक साथ, समय पर बुवाई।',
      'सहनशील किस्में लगाएं।',
    ],
    severityHint: 'high',
    sources: [S.shootFly, S.iimr],
  },

  // ----- दलहन -----
  {
    id: 'gram-pod-borer',
    cropKeys: ['gram', 'arhar', 'masoor'],
    type: 'pest',
    nameHi: 'फली छेदक (चने की इल्ली)',
    nameEn: 'Gram pod borer',
    scientificName: 'Helicoverpa armigera',
    aliases: ['इल्ली', 'सुंडी', 'हेलिकोवर्पा', 'pod borer'],
    symptomsHi: [
      'छोटी इल्लियां पत्तियां खुरचकर खाती हैं; बड़ी इल्लियां फली में छेद करके दाना खाती हैं।',
      'फली पर गोल छेद, जिसमें से इल्ली का आधा शरीर बाहर दिखता है।',
      'हरी से भूरी धारीदार इल्लियां; फूल और फलियां झड़ती हैं।',
    ],
    favourableConditionsHi:
      'फूल और फली बनते समय गर्म, बादल वाला मौसम — चने में फरवरी–मार्च, अरहर में अक्टूबर–दिसंबर।',
    organicHi: [
      'फेरोमोन ट्रैप — 2 प्रति एकड़ निगरानी के लिए।',
      'पक्षियों के बैठने के लिए “T” आकार की खूंटियां (बर्ड पर्च) — लगभग 8–10 प्रति एकड़।',
      'HaNPV — लगभग 100 LE प्रति एकड़ (250 LE/हेक्टेयर) शाम को छिड़कें।',
      'फूल आने पर नीम बीज अर्क (NSKE) 5% का छिड़काव।',
    ],
    chemicalHi: chem(
      'लगभग 1 इल्ली प्रति मीटर कतार (या प्रति 10 पौधे 1–2 इल्ली) दिखे तब छिड़कें।',
      'इमामेक्टिन बेंज़ोएट 5% SG — 0.4 ग्राम प्रति लीटर (लगभग 80–90 ग्राम प्रति एकड़)।',
      'या क्लोरएंट्रानिलिप्रोल 18.5% SC — 0.3 मि.ली. प्रति लीटर (लगभग 50–60 मि.ली. प्रति एकड़)।',
      'या इंडोक्साकार्ब (Indoxacarb) 14.5% SC — 1 मि.ली. प्रति लीटर।',
      'पहला छिड़काव 50% फूल आने पर, दूसरा 15 दिन बाद ज़रूरत हो तो; हर बार अलग दवा लें।',
    ),
    preventionHi: [
      'गर्मी में गहरी जुताई ताकि प्यूपा नष्ट हों।',
      'समय पर बुवाई; चने के साथ धनिया या अलसी की अंतरफसल।',
      'फूल आने से हर हफ्ते निगरानी।',
    ],
    severityHint: 'high',
    sources: [S.gramPodBorer, S.iipr],
  },
  {
    id: 'gram-wilt',
    cropKeys: ['gram', 'masoor'],
    type: 'fungal',
    nameHi: 'उकठा रोग (विल्ट)',
    nameEn: 'Fusarium wilt',
    scientificName: 'Fusarium oxysporum f. sp. ciceris',
    aliases: ['उकठा', 'उखेड़ा', 'सूखा रोग', 'wilt'],
    symptomsHi: [
      'पौधे की ऊपरी पत्तियां झुककर मुरझाती हैं, फिर पूरा पौधा सूख जाता है — खेत में टुकड़ों में।',
      'जड़ चीरने पर अंदर भूरी-काली धारी (नली) दिखती है; जड़ सड़ी नहीं होती।',
      'शुरुआती 3–5 हफ्ते और फूल-फली के समय ज़्यादा।',
    ],
    favourableConditionsHi:
      'मिट्टी में फफूंद कई साल ज़िंदा रहती है। गर्म मिट्टी (बहुत जल्दी बुवाई), सूखा तनाव और एक ही खेत में बार-बार चना या मसूर।',
    organicHi: [
      'ट्राइकोडर्मा (Trichoderma viride/harzianum) — 4–5 ग्राम प्रति किलो बीज से बीज उपचार।',
      'लगभग 1 किलो ट्राइकोडर्मा को 25 किलो सड़ी गोबर खाद में मिलाकर 7–10 दिन छाया में रखें, फिर बुवाई पर प्रति एकड़ डालें।',
    ],
    chemicalHi: chem(
      'बीज उपचार: कार्बोक्सिन 37.5% + थाइरम 37.5% DS — 2–3 ग्राम प्रति किलो बीज, या कार्बेन्डाज़िम (Carbendazim) 50% WP — 2 ग्राम प्रति किलो बीज (फिर ट्राइकोडर्मा)।',
      'खड़ी फसल में सूखे पौधे दवा से ठीक नहीं होते — बचाव ही उपाय है।',
    ),
    preventionHi: [
      'उकठा-रोधी किस्में बोएं (KVK या कृषि विश्वविद्यालय से पूछें)।',
      '3–4 साल का फसल चक्र अपनाएं; गर्मी में गहरी जुताई करें।',
      'उत्तर भारत में बहुत जल्दी बुवाई से बचें; फूल के समय हल्की सिंचाई करें।',
    ],
    severityHint: 'high',
    sources: [S.iipr, S.arharWilt],
  },
  {
    id: 'gram-ascochyta-blight',
    cropKeys: ['gram'],
    type: 'fungal',
    nameHi: 'एस्कोकाइटा झुलसा',
    nameEn: 'Ascochyta blight',
    scientificName: 'Ascochyta rabiei',
    aliases: ['झुलसा', 'चने का झुलसा', 'ascochyta', 'blight'],
    symptomsHi: [
      'पत्तियों, तनों और फलियों पर भूरे धब्बे, जिनमें गोल छल्लों में छोटे काले बिंदु।',
      'तने पर धब्बे घेरा बनाकर तना तोड़ देते हैं; ऊपर का हिस्सा सूख जाता है।',
      'खेत में टुकड़ों में पौधे झुलसे हुए दिखते हैं।',
    ],
    favourableConditionsHi:
      'ठंडा मौसम (लगभग 15–25°C) के साथ लगातार बारिश, बादल और ओस — उत्तर-पश्चिम भारत (पंजाब, हरियाणा, जम्मू) में ज़्यादा; रोग बीज और फसल अवशेषों से आता है।',
    organicHi: ['रोगमुक्त बीज लें; रोगी फसल अवशेष जलाने के बजाय गहरा दबा दें।', 'रोगी पौधे उखाड़कर नष्ट करें।'],
    chemicalHi: chem(
      'बीज उपचार: कार्बेन्डाज़िम या थाइरम — लगभग 2.5 ग्राम प्रति किलो बीज।',
      'पहले लक्षण दिखते ही मैंकोज़ेब 75% WP — 2 ग्राम प्रति लीटर (0.2%), या क्लोरोथैलोनिल 75% WP — 2 ग्राम प्रति लीटर; 10 दिन के अंतर पर 2 बार और।',
    ),
    preventionHi: ['सहनशील किस्में लगाएं।', 'फसल चक्र; घनी बुवाई से बचें।'],
    severityHint: 'high',
    sources: [S.ascochyta, S.iipr],
  },
  {
    id: 'arhar-sterility-mosaic',
    cropKeys: ['arhar'],
    type: 'viral',
    nameHi: 'बांझपन मोज़ेक रोग',
    nameEn: 'Sterility mosaic',
    scientificName: 'Pigeonpea sterility mosaic virus (spread by mite Aceria cajani)',
    aliases: ['बांझपन रोग', 'हरा प्लेग', 'sterility mosaic', 'SMD'],
    symptomsHi: [
      'पत्तियां छोटी, हल्की हरी-पीली चितकबरी (मोज़ेक); पौधा घना और झाड़ी जैसा।',
      'पौधे में फूल-फलियां बहुत कम या बिल्कुल नहीं लगतीं — इसीलिए “बांझपन” रोग।',
    ],
    favourableConditionsHi:
      'बहुत छोटे माइट (एरियोफिड) से फैलता है। गर्मी में पेड़ी, बहुवर्षीय और अपने-आप उगे अरहर के पौधों में वायरस और माइट बचे रहते हैं।',
    organicHi: [
      'शुरुआत में रोगी पौधे उखाड़कर नष्ट करें।',
      'खेत के आसपास अपने-आप उगे और पुराने (पेड़ी/बहुवर्षीय) अरहर के पौधे हटाएं।',
    ],
    chemicalHi: chem(
      'रोग की कोई दवा नहीं; माइट नियंत्रण कठिन है — ज़रूरत हो तो कृषि अधिकारी से पंजीकृत माइटनाशक की सलाह लें।',
    ),
    preventionHi: ['बांझपन मोज़ेक रोधी किस्में सबसे अच्छा उपाय हैं।', 'रोगी खेत से बीज न लें।'],
    severityHint: 'high',
    sources: [S.sterilityMosaic, S.sterilityMosaicResistance],
  },
  {
    id: 'arhar-wilt',
    cropKeys: ['arhar'],
    type: 'fungal',
    nameHi: 'अरहर का उकठा रोग',
    nameEn: 'Pigeon pea wilt',
    scientificName: 'Fusarium udum',
    aliases: ['उकठा', 'सूखा रोग', 'wilt'],
    symptomsHi: [
      'पौधे धीरे-धीरे पीले पड़कर मुरझाते हैं, अक्सर फूल-फली के समय।',
      'तने के निचले हिस्से पर बैंगनी-काली पट्टी ऊपर की ओर; छाल हटाने पर लकड़ी पर भूरी-काली धारियां।',
      'कभी-कभी पौधे का केवल एक तरफ़ का हिस्सा सूखता है।',
    ],
    favourableConditionsHi:
      'मिट्टी जनित फफूंद; लगातार अरहर, पानी भराव और सूत्रकृमि (निमेटोड) वाले खेत।',
    organicHi: [
      'ट्राइकोडर्मा — 4 ग्राम प्रति किलो बीज से बीज उपचार।',
      'लगभग 1 किलो ट्राइकोडर्मा 20–25 किलो सड़ी गोबर खाद में मिलाकर प्रति एकड़ बुवाई पर डालें।',
      'रोगी पौधे उखाड़कर नष्ट करें।',
    ],
    chemicalHi: chem(
      'बीज उपचार: कार्बेन्डाज़िम 50% WP — 2 ग्राम प्रति किलो बीज (फिर ट्राइकोडर्मा)।',
      'खड़ी फसल में सूखे पौधे दवा से ठीक नहीं होते।',
    ),
    preventionHi: [
      'उकठा-रोधी किस्में लगाएं।',
      'ज्वार के साथ अंतरफसल या 3 साल का फसल चक्र (जैसे ज्वार) अपनाएं।',
      'गर्मी में गहरी जुताई; खेत में पानी न रुकने दें।',
    ],
    severityHint: 'high',
    sources: [S.arharWilt, S.iipr],
  },
  {
    id: 'arhar-spotted-pod-borer',
    cropKeys: ['arhar'],
    type: 'pest',
    nameHi: 'चित्तीदार फली छेदक (मारुका)',
    nameEn: 'Spotted pod borer',
    scientificName: 'Maruca vitrata',
    aliases: ['मारुका', 'जाला बनाने वाली इल्ली', 'Maruca', 'spotted pod borer'],
    symptomsHi: [
      'फूल, कलियां और फलियां जाले से आपस में जुड़ी; अंदर हल्की हरी-सफेद इल्ली, जिसकी पीठ पर काले धब्बे।',
      'फूल झड़ते हैं; फली में छेद, अंदर दाने खाए हुए और बाहर मल।',
    ],
    favourableConditionsHi: 'फूल आते समय बादल और नमी वाला मौसम; अगेती और मध्यम अवधि की अरहर में ज़्यादा।',
    organicHi: [
      'फूल आने पर हर हफ्ते जाले वाले गुच्छे देखें और तोड़कर नष्ट करें।',
      'फूल आने पर नीम बीज अर्क (NSKE) 5% का छिड़काव।',
      'पक्षियों के लिए “T” आकार की खूंटियां लगाएं।',
    ],
    chemicalHi: chem(
      '50% फूल आने पर: फ्लूबेंडियामाइड 39.35% SC — लगभग 0.2 मि.ली. प्रति लीटर; 15–20 दिन बाद क्लोरएंट्रानिलिप्रोल 18.5% SC — लगभग 0.3 मि.ली. प्रति लीटर।',
      'या स्पाइनोसैड 45% SC — लगभग 0.3 मि.ली. प्रति लीटर।',
    ),
    preventionHi: ['सहनशील किस्में और समय पर बुवाई।', 'फूल आने से नियमित निगरानी।'],
    severityHint: 'high',
    sources: [S.arharPodBorerIpm, S.arharPodBorerModules],
  },
  {
    id: 'moong-yellow-mosaic',
    cropKeys: ['moong', 'urad'],
    type: 'viral',
    nameHi: 'पीला मोज़ेक रोग',
    nameEn: 'Yellow mosaic',
    scientificName: 'Mungbean yellow mosaic virus (MYMV / MYMIV)',
    aliases: ['पीलिया', 'पीला रोग', 'YMV', 'yellow mosaic'],
    symptomsHi: [
      'नई पत्तियों पर पीले और हरे धब्बों का चितकबरा पैटर्न।',
      'धीरे-धीरे पूरी पत्ती पीली; पौधे बौने, फूल-फली कम।',
      'फलियां छोटी, टेढ़ी और दाने कम।',
    ],
    favourableConditionsHi:
      'सफेद मक्खी ज़्यादा होने पर तेज़ी से फैलता है — गर्म, सूखा मौसम (जायद और खरीफ)।',
    organicHi: [
      'रोगी पौधे दिखते ही उखाड़कर मिट्टी में दबा दें।',
      'पीले चिपचिपे ट्रैप — लगभग 8–10 प्रति एकड़।',
      'शुरुआत में सफेद मक्खी के लिए नीम तेल 1500 ppm — 5 मि.ली. प्रति लीटर।',
    ],
    chemicalHi: chem(
      'वायरस पर कोई दवा असर नहीं करती — केवल सफेद मक्खी को रोकें।',
      'सफेद मक्खी दिखे तो थायमेथोक्साम 25% WG — लगभग 0.2 ग्राम प्रति लीटर, या इमिडाक्लोप्रिड 17.8% SL — 0.2–0.3 मि.ली. प्रति लीटर (लेबल पर मूंग/उड़द दर्ज हो तभी)।',
    ),
    preventionHi: [
      'पीला मोज़ेक रोधी किस्में बोएं (IIPR या राज्य विश्वविद्यालय की सिफारिश)।',
      'समय पर बुवाई और खेत व मेड़ों से खरपतवार हटाएं।',
    ],
    severityHint: 'high',
    sources: [S.iipr, S.cibrcUses],
  },
  {
    id: 'urad-powdery-mildew',
    cropKeys: ['urad', 'moong'],
    type: 'fungal',
    nameHi: 'चूर्णिल आसिता (पाउडरी मिल्ड्यू)',
    nameEn: 'Powdery mildew',
    scientificName: 'Erysiphe polygoni',
    aliases: ['सफेद चूर्ण', 'भभूतिया', 'powdery mildew'],
    symptomsHi: [
      'पत्तियों, तनों और फलियों पर सफेद आटे जैसी परत।',
      'पत्तियां पीली होकर झड़ जाती हैं; फलियां कम और छोटी।',
    ],
    favourableConditionsHi: 'सूखे, ठंडे दिन और ठंडी नम रातें (रबी और देर खरीफ); घनी फसल और छाया।',
    organicHi: ['हल्के प्रकोप में नीम बीज अर्क (NSKE) 5% का छिड़काव।', 'रोगी पत्तियां हटाएं।'],
    chemicalHi: chem(
      'घुलनशील गंधक (Wettable sulphur) 80% WP — 2.5–3 ग्राम प्रति लीटर; बहुत गर्मी (32°C से ऊपर) में न छिड़कें।',
      'या कार्बेन्डाज़िम 50% WP — 1 ग्राम प्रति लीटर, या हेक्साकोनाज़ोल 5% EC — 1–2 मि.ली. प्रति लीटर।',
      '10–15 दिन बाद ज़रूरत हो तो दोहराएं।',
    ),
    preventionHi: ['सहनशील किस्में और समय पर बुवाई।', 'ज़्यादा घनी बुवाई न करें।'],
    severityHint: 'medium',
    sources: [S.iipr, S.cibrcUses],
  },
  {
    id: 'moong-cercospora-leaf-spot',
    cropKeys: ['moong', 'urad'],
    type: 'fungal',
    nameHi: 'सर्कोस्पोरा पत्ती धब्बा',
    nameEn: 'Cercospora leaf spot',
    scientificName: 'Cercospora canescens',
    aliases: ['पत्ती धब्बा', 'leaf spot', 'cercospora'],
    symptomsHi: [
      'पत्तियों पर छोटे गोल से कोणीय भूरे धब्बे, बीच में हल्के स्लेटी और किनारे लाल-भूरे।',
      'ज़्यादा प्रकोप में पत्तियां झड़ जाती हैं और फलियां कम भरती हैं।',
    ],
    favourableConditionsHi: 'गर्म-नम खरीफ मौसम, ज़्यादा बारिश और घनी फसल।',
    organicHi: ['स्वस्थ बीज लें; फसल अवशेष नष्ट करें।', 'ट्राइकोडर्मा से बीज उपचार।'],
    chemicalHi: chem(
      'लक्षण दिखते ही कार्बेन्डाज़िम 50% WP — 1 ग्राम प्रति लीटर, या मैंकोज़ेब 75% WP — 2.5 ग्राम प्रति लीटर; 10–15 दिन बाद दोहराएं।',
    ),
    preventionHi: ['फसल चक्र और सही दूरी।', 'सहनशील किस्में लगाएं।'],
    severityHint: 'medium',
    sources: [S.iipr, S.cibrcUses],
  },
  {
    id: 'masoor-rust',
    cropKeys: ['masoor'],
    type: 'fungal',
    nameHi: 'रतुआ (गेरुई)',
    nameEn: 'Lentil rust',
    scientificName: 'Uromyces viciae-fabae',
    aliases: ['गेरुई', 'रतुआ', 'rust'],
    symptomsHi: [
      'पत्तियों और तनों पर पहले हल्के पीले, फिर भूरे-नारंगी उभरे दाने (फफोले); बाद में तने पर काले धब्बे।',
      'ज़्यादा प्रकोप में पौधे सूखे और झुलसे से दिखते हैं; दाने छोटे रह जाते हैं।',
    ],
    favourableConditionsHi: 'ठंडा-नम मौसम, बादल और ओस — आमतौर पर फरवरी में।',
    organicHi: ['रोगरोधी किस्में लगाएं।', 'फसल अवशेष नष्ट करें।'],
    chemicalHi: chem(
      'लक्षण दिखते ही मैंकोज़ेब 75% WP — 2.5 ग्राम प्रति लीटर, या प्रोपिकोनाज़ोल 25% EC — 1 मि.ली. प्रति लीटर; 10 दिन के अंतर पर 2–3 छिड़काव।',
    ),
    preventionHi: ['समय पर बुवाई।', 'संतुलित खाद; घनी बुवाई न करें।'],
    severityHint: 'medium',
    sources: [S.iipr, S.cibrcUses],
  },

  // ----- सरसों -----
  {
    id: 'mustard-aphid',
    cropKeys: ['mustard'],
    type: 'pest',
    nameHi: 'माहू (चेपा)',
    nameEn: 'Mustard aphid',
    scientificName: 'Lipaphis erysimi',
    aliases: ['चेपा', 'मोयला', 'माहू', 'aphid'],
    symptomsHi: [
      'फूलों, कलियों, फलियों और तने के ऊपरी हिस्से पर हरे-भूरे छोटे कीड़ों के घने झुंड।',
      'पौधे की बढ़वार रुकती है; फलियां कम और दाने छोटे-सिकुड़े।',
      'पत्तियों पर चिपचिपा पदार्थ और काली फफूंद।',
    ],
    favourableConditionsHi:
      'दिसंबर के आख़िर से फरवरी तक बादल, हल्की ठंड (लगभग 10–20°C) और नमी; देर से बोई फसल और ज़्यादा नाइट्रोजन।',
    organicHi: [
      'प्रकोप शुरू होते ही प्रभावित टहनियां तोड़कर नष्ट करें।',
      'लेडीबर्ड बीटल और सिरफिड मक्खी जैसे मित्र कीटों को बचाएं।',
      'नीम तेल 1500 ppm — 5 मि.ली. प्रति लीटर या NSKE 5%।',
    ],
    chemicalHi: chem(
      'लगभग 10% पौधों पर माहू हो या मुख्य तने के ऊपरी 10 सेमी में 26–28 माहू हों, तब छिड़कें।',
      'इमिडाक्लोप्रिड 17.8% SL — लगभग 50 मि.ली. प्रति एकड़ (125 मि.ली. प्रति हेक्टेयर)।',
      'या थायमेथोक्साम 25% WG — लगभग 40 ग्राम प्रति एकड़।',
      'मधुमक्खियों को बचाने के लिए फूल के समय छिड़काव दोपहर बाद या शाम को करें।',
    ),
    preventionHi: [
      'समय पर बुवाई (उत्तर भारत में अक्टूबर के पहले पखवाड़े तक)।',
      'संतुलित नाइट्रोजन; दिसंबर से हर हफ्ते निगरानी।',
    ],
    severityHint: 'high',
    sources: [S.mustardAphid, S.drmr],
  },
  {
    id: 'mustard-white-rust',
    cropKeys: ['mustard'],
    type: 'fungal',
    nameHi: 'सफेद रतुआ',
    nameEn: 'White rust',
    scientificName: 'Albugo candida',
    aliases: ['सफ़ेद गेरुई', 'स्टैग हेड', 'white rust'],
    symptomsHi: [
      'पत्तियों की निचली सतह पर सफेद उभरे फफोले और ऊपर की सतह पर पीले धब्बे।',
      'फूल वाली टहनियां मोटी, टेढ़ी और हिरण के सींग जैसी हो जाती हैं — उनमें फलियां नहीं बनतीं।',
    ],
    favourableConditionsHi: 'ठंडा (लगभग 10–20°C) और नम मौसम, ओस-कोहरा और घनी फसल।',
    organicHi: ['रोगी पत्तियां और विकृत टहनियां तोड़कर नष्ट करें।'],
    chemicalHi: chem(
      'बीज उपचार: मेटालैक्सिल 35% SD — 6 ग्राम प्रति किलो बीज।',
      'खड़ी फसल में लक्षण दिखने पर: मेटालैक्सिल 8% + मैंकोज़ेब 64% WP — 2.5 ग्राम प्रति लीटर (लगभग 500 ग्राम प्रति एकड़); 15 दिन बाद ज़रूरत हो तो दोहराएं।',
    ),
    preventionHi: ['सहनशील किस्में और समय पर बुवाई।', 'फसल चक्र अपनाएं; फसल अवशेष नष्ट करें।'],
    severityHint: 'medium',
    sources: [S.drmr, S.cibrcUses],
  },
  {
    id: 'mustard-alternaria-blight',
    cropKeys: ['mustard'],
    type: 'fungal',
    nameHi: 'झुलसा रोग (अल्टरनेरिया ब्लाइट)',
    nameEn: 'Alternaria blight',
    scientificName: 'Alternaria brassicae',
    aliases: ['काला धब्बा', 'पत्ती झुलसा', 'alternaria'],
    symptomsHi: [
      'पत्तियों पर गोल भूरे-काले धब्बे, जिनमें गोल छल्ले बने होते हैं।',
      'धब्बे तने और फलियों पर भी; फलियां समय से पहले सूखती हैं और दाने छोटे रह जाते हैं।',
    ],
    favourableConditionsHi: 'बारिश या ओस के बाद हल्का गर्म-नम मौसम (लगभग 18–25°C), फरवरी–मार्च।',
    organicHi: ['ट्राइकोडर्मा से बीज उपचार (लगभग 5 ग्राम प्रति किलो)।', 'नीचे की रोगी पत्तियां हटाएं।'],
    chemicalHi: chem(
      'बीज उपचार: कार्बेन्डाज़िम या थाइरम — 2–3 ग्राम प्रति किलो बीज।',
      'मैंकोज़ेब (Mancozeb) 75% WP — 2.5 ग्राम प्रति लीटर; बुवाई के लगभग 45–50 दिन से 10–15 दिन के अंतर पर 2–3 छिड़काव।',
    ),
    preventionHi: ['समय पर बुवाई।', 'पोटाश और सल्फर सहित संतुलित खाद।'],
    severityHint: 'medium',
    sources: [S.drmr, S.cibrcUses],
  },
  {
    id: 'mustard-sclerotinia-rot',
    cropKeys: ['mustard'],
    type: 'fungal',
    nameHi: 'तना सड़न (स्क्लेरोटीनिया)',
    nameEn: 'Sclerotinia stem rot',
    scientificName: 'Sclerotinia sclerotiorum',
    aliases: ['तना गलन', 'सफेद सड़न', 'stem rot', 'sclerotinia'],
    symptomsHi: [
      'तने पर ज़मीन से कुछ ऊपर पानी से भीगे लंबे धब्बे, जिन पर सफेद रुई जैसी फफूंद।',
      'तना अंदर से खोखला; चीरने पर काले, चूहे की मेंगनी जैसे दाने (स्क्लेरोशिया)।',
      'पौधे समय से पहले सूखकर गिर जाते हैं और फलियां ठीक नहीं भरतीं।',
    ],
    favourableConditionsHi:
      'फूल आते समय (दिसंबर के आख़िर से जनवरी) ठंडा-नम मौसम, घनी फसल और उस समय की सिंचाई; झड़ी पंखुड़ियों से तने में संक्रमण होता है।',
    organicHi: [
      'गर्मी में गहरी जुताई; सरसों के बाद गेहूं या जौ जैसी फसल लें।',
      'ट्राइकोडर्मा मिली सड़ी गोबर खाद खेत में डालें।',
    ],
    chemicalHi: chem(
      'बीज उपचार: कार्बेन्डाज़िम 50% WP — 2 ग्राम प्रति किलो बीज।',
      'फूल आने पर कार्बेन्डाज़िम 50% WP — 1 ग्राम प्रति लीटर (0.1%) के दो छिड़काव, लगभग 45–50 और 65–70 दिन पर।',
    ),
    preventionHi: [
      'जहां संभव हो, लगभग 25 दिसंबर से 15 जनवरी के बीच सिंचाई से बचें (DRMR सलाह)।',
      'घनी बुवाई न करें; संतुलित खाद दें।',
    ],
    severityHint: 'high',
    sources: [S.sclerotinia, S.drmr],
  },

  // ----- सोयाबीन / मूंगफली -----
  {
    id: 'soybean-yellow-mosaic',
    cropKeys: ['soybean'],
    type: 'viral',
    nameHi: 'पीला मोज़ेक रोग',
    nameEn: 'Soybean yellow mosaic',
    scientificName: 'Mungbean yellow mosaic India virus (MYMIV)',
    aliases: ['पीलिया', 'YMV', 'yellow mosaic'],
    symptomsHi: [
      'पत्तियों पर गहरे पीले और हरे धब्बे; पत्तियां सिकुड़ जाती हैं।',
      'पौधे बौने; फलियां कम और छोटी।',
    ],
    favourableConditionsHi:
      'सफेद मक्खी से फैलता है — जुलाई–अगस्त में बारिश का लंबा अंतराल और आसपास खरपतवार।',
    organicHi: [
      'रोगी पौधे शुरुआत में ही उखाड़कर नष्ट करें।',
      'पीले चिपचिपे ट्रैप — लगभग 8–10 प्रति एकड़।',
    ],
    chemicalHi: chem(
      'बीज उपचार: थायमेथोक्साम 30% FS — 10 मि.ली. प्रति किलो बीज।',
      'सफेद मक्खी के लिए: थायमेथोक्साम 12.6% + लैम्ब्डा-साइहैलोथ्रिन 9.5% ZC — लगभग 50 मि.ली. प्रति एकड़ (125 मि.ली./हेक्टेयर)।',
      'या बीटासायफ्लूथ्रिन 8.49% + इमिडाक्लोप्रिड 19.81% OD — लगभग 140 मि.ली. प्रति एकड़ (350 मि.ली./हेक्टेयर)।',
    ),
    preventionHi: ['रोग-सहनशील किस्में और समय पर बुवाई।', 'खेत को खरपतवार मुक्त रखें।'],
    severityHint: 'high',
    sources: [S.soybeanDiseases, S.iisrSoybean],
  },
  {
    id: 'soybean-girdle-beetle',
    cropKeys: ['soybean'],
    type: 'pest',
    nameHi: 'चक्र भृंग (गर्डल बीटल)',
    nameEn: 'Girdle beetle',
    scientificName: 'Obereopsis brevis',
    aliases: ['चक्र भृंग', 'गर्डल बीटल', 'girdle beetle'],
    symptomsHi: [
      'तने या पत्ती के डंठल पर दो गोल छल्ले (रिंग) कटे दिखते हैं।',
      'छल्लों के ऊपर का हिस्सा मुरझाकर सूख जाता है।',
      'तने के अंदर सुंडी सुरंग बनाती है; बाद में पौधा उस जगह से टूट सकता है।',
    ],
    favourableConditionsHi: 'जुलाई–अगस्त का गर्म-नम मौसम, घनी फसल और ज़्यादा नाइट्रोजन।',
    organicHi: [
      'शुरुआत में छल्ले वाली शाखाएं और पौधे तोड़कर नष्ट करें।',
      'घनी बुवाई न करें; मेड़ साफ़ रखें।',
    ],
    chemicalHi: chem(
      'क्लोरएंट्रानिलिप्रोल 18.5% SC — लगभग 60 मि.ली. प्रति एकड़ (150 मि.ली./हेक्टेयर)।',
      'या थायक्लोप्रिड (Thiacloprid) 21.7% SC — लगभग 300 मि.ली. प्रति एकड़ (750 मि.ली./हेक्टेयर)।',
      'या प्रोफेनोफॉस (Profenofos) 50% EC — लगभग 500 मि.ली. प्रति एकड़ (1.25 लीटर/हेक्टेयर)।',
    ),
    preventionHi: ['फसल चक्र और गर्मी में गहरी जुताई।', 'सही बीज दर और दूरी।'],
    severityHint: 'medium',
    sources: [S.soybeanGirdle, S.iisrSoybean],
  },
  {
    id: 'soybean-charcoal-rot',
    cropKeys: ['soybean', 'jowar', 'gram'],
    type: 'fungal',
    nameHi: 'चारकोल सड़न / सूखी जड़ सड़न',
    nameEn: 'Charcoal rot / dry root rot',
    scientificName: 'Macrophomina phaseolina',
    aliases: ['चारकोल रॉट', 'सूखी जड़ सड़न', 'जड़ सड़न', 'charcoal rot', 'dry root rot'],
    symptomsHi: [
      'फूल-फली के समय पौधे अचानक पीले होकर सूखते हैं; पत्तियां लटकी रहती हैं।',
      'जड़ और तने का निचला हिस्सा भूरा-काला, छाल उतरती है; अंदर कोयले के चूर्ण जैसे छोटे काले दाने।',
      'ज्वार में तना अंदर से खोखला होकर पौधे गिर जाते हैं; चने में जड़ सूखी और भुरभुरी।',
    ],
    favourableConditionsHi:
      'फूल-फली के समय सूखा तनाव और ज़्यादा तापमान (लगभग 30°C से ऊपर); हल्की मिट्टी और बारानी खेती; फफूंद मिट्टी में कई साल रहती है।',
    organicHi: [
      'ट्राइकोडर्मा — 4–5 ग्राम प्रति किलो बीज से बीज उपचार।',
      'ट्राइकोडर्मा मिली सड़ी गोबर खाद या वर्मीकम्पोस्ट बुवाई पर डालें।',
      'फूल-फली के समय नमी बनाए रखें (जहां सिंचाई हो)।',
    ],
    chemicalHi: chem(
      'बीज उपचार: कार्बेन्डाज़िम 50% WP — 2 ग्राम प्रति किलो बीज, या कार्बोक्सिन 37.5% + थाइरम 37.5% DS — 2–3 ग्राम प्रति किलो बीज (फिर ट्राइकोडर्मा)।',
      'खड़ी फसल में सूखे पौधे दवा से ठीक नहीं होते।',
    ),
    preventionHi: ['फसल चक्र और संतुलित पोटाश।', 'ज्वार में बहुत घनी फसल न रखें।'],
    severityHint: 'medium',
    sources: [S.iisrSoybean, S.iipr],
  },
  {
    id: 'groundnut-tikka',
    cropKeys: ['groundnut'],
    type: 'fungal',
    nameHi: 'टिक्का रोग (पत्ती धब्बा) और रतुआ',
    nameEn: 'Tikka leaf spot and rust',
    scientificName: 'Cercospora arachidicola, Nothopassalora personata; Puccinia arachidis',
    aliases: ['टिक्का', 'पत्ती धब्बा', 'रतुआ', 'leaf spot', 'tikka', 'rust'],
    symptomsHi: [
      'अगेती टिक्का: पत्तियों पर भूरे गोल धब्बे, चारों ओर पीला घेरा।',
      'पछेती टिक्का: पत्ती की निचली सतह पर गहरे काले-भूरे धब्बे, घेरा कम।',
      'रतुआ: पत्ती की निचली सतह पर नारंगी-भूरे उभरे दाने; अक्सर टिक्का के साथ आता है।',
      'ज़्यादा प्रकोप में पत्तियां झड़ जाती हैं और फलियां कम भरती हैं।',
    ],
    favourableConditionsHi: 'लगातार नमी, ओस और लगभग 25–30°C तापमान; एक ही खेत में बार-बार मूंगफली।',
    organicHi: [
      'मूंगफली के साथ बाजरा (3:1) की अंतरफसल।',
      'फसल अवशेष और रोगी पत्तियां नष्ट करें।',
    ],
    chemicalHi: chem(
      'कार्बेन्डाज़िम 12% + मैंकोज़ेब 63% WP — 2 ग्राम प्रति लीटर।',
      'या हेक्साकोनाज़ोल 5% EC — 2 मि.ली. प्रति लीटर, या टेबुकोनाज़ोल 25.9% EC — 1 मि.ली. प्रति लीटर (रतुआ साथ हो तो ये दोनों बेहतर)।',
      'पहला छिड़काव लगभग 30–35 दिन पर, फिर 15 दिन के अंतर पर 2 बार।',
    ),
    preventionHi: ['फसल चक्र और सहनशील किस्में।', 'समय पर बुवाई।'],
    severityHint: 'medium',
    sources: [S.dgr, S.cibrcUses],
  },
  {
    id: 'groundnut-collar-rot',
    cropKeys: ['groundnut'],
    type: 'fungal',
    nameHi: 'कॉलर रॉट और तना सड़न',
    nameEn: 'Collar rot and stem rot',
    scientificName: 'Aspergillus niger; Sclerotium rolfsii',
    aliases: ['कॉलर सड़न', 'तना सड़न', 'सफेद सड़न', 'collar rot', 'stem rot'],
    symptomsHi: [
      'कॉलर रॉट: अंकुरण के बाद ज़मीन के पास तना काला पड़कर सड़ता है; पौधे मुरझाकर मर जाते हैं, खेत में खाली जगह।',
      'तना सड़न: ज़मीन के पास तने पर सफेद रुई जैसी फफूंद और सरसों के दाने जैसी भूरी गांठें; शाखा या पूरा पौधा सूखता है।',
      'फलियां भी सड़ सकती हैं।',
    ],
    favourableConditionsHi:
      'कॉलर रॉट: बुवाई के बाद गर्म मिट्टी और नमी में उतार-चढ़ाव। तना सड़न: गर्म-नम मौसम, मिट्टी में बिना सड़ा जैविक कचरा।',
    organicHi: [
      'ट्राइकोडर्मा विरिडी — 4 ग्राम प्रति किलो बीज से बीज उपचार।',
      'लगभग 1 किलो ट्राइकोडर्मा 20 किलो सड़ी गोबर खाद में मिलाकर प्रति एकड़; नीम या अरंडी की खली भी मदद करती है।',
      'गर्मी में गहरी जुताई करें।',
    ],
    chemicalHi: chem(
      'बीज उपचार: टेबुकोनाज़ोल 2% DS — 1–1.5 ग्राम प्रति किलो बीज, या कार्बेन्डाज़िम 12% + मैंकोज़ेब 63% WP — 3 ग्राम प्रति किलो बीज।',
    ),
    preventionHi: ['फसल चक्र (अनाज के साथ)।', 'पुराने अवशेष और कचरा खेत से हटाएं।'],
    severityHint: 'medium',
    sources: [S.tnauGroundnutStemRot, S.groundnutCollarRot],
  },
  {
    id: 'groundnut-white-grub',
    cropKeys: ['groundnut', 'bajra', 'sugarcane', 'potato'],
    type: 'pest',
    nameHi: 'सफेद लट (व्हाइट ग्रब)',
    nameEn: 'White grub',
    scientificName: 'Holotrichia consanguinea, H. serrata',
    aliases: ['लट', 'गिंडार', 'जड़ लट', 'white grub'],
    symptomsHi: [
      'पौधे अचानक पीले होकर मुरझाते और सूखते हैं; खींचने पर आसानी से उखड़ जाते हैं।',
      'जड़ें और फलियां कुतरी हुई; मिट्टी में “C” आकार की मोटी सफेद सुंडी।',
      'खेत में जगह-जगह पौधे मरने से खाली घेरे बन जाते हैं।',
    ],
    favourableConditionsHi:
      'हल्की रेतीली मिट्टी। मानसून की पहली अच्छी बारिश के बाद शाम को भृंग (बीटल) निकलकर पास के पेड़ों (नीम, बेर, खेजड़ी) पर पत्ते खाते और खेत में अंडे देते हैं।',
    organicHi: [
      'पहली अच्छी बारिश के बाद 3–4 दिन तक शाम को पेड़ों से भृंग झाड़कर इकट्ठा करें और नष्ट करें — पूरा गांव मिलकर करे तो असर ज़्यादा।',
      'प्रकाश प्रपंच (लाइट ट्रैप) लगाएं।',
      'मेटाराइज़ियम एनिसोप्ली (जैविक फफूंद) सड़ी गोबर खाद में मिलाकर बुवाई पर डालें।',
      'गर्मी में गहरी जुताई करें ताकि लट और प्यूपा पक्षियों का भोजन बनें।',
    ],
    chemicalHi: chem(
      'बीज उपचार: इमिडाक्लोप्रिड 600 FS (48%) — 2 मि.ली. प्रति किलो बीज, थोड़े पानी में घोलकर।',
    ),
    preventionHi: [
      'केवल अच्छी तरह सड़ी गोबर खाद डालें।',
      'भृंग नियंत्रण पूरे क्षेत्र में एक साथ करें।',
    ],
    severityHint: 'high',
    sources: [S.whiteGrub, S.dgr],
  },

  // ----- कपास -----
  {
    id: 'cotton-pink-bollworm',
    cropKeys: ['cotton'],
    type: 'pest',
    nameHi: 'गुलाबी सुंडी (पिंक बॉलवर्म)',
    nameEn: 'Pink bollworm',
    scientificName: 'Pectinophora gossypiella',
    aliases: ['गुलाबी इल्ली', 'रोसेट फूल', 'pink bollworm'],
    symptomsHi: [
      'फूल की पंखुड़ियां आपस में धागे से बंधी — गुलाब की कली जैसे “रोसेट” फूल।',
      'हरे टिंडे में छोटा छेद; अंदर गुलाबी या सफेद सुंडी बीज और रुई खाती है।',
      'टिंडे ठीक से नहीं खुलते; रुई पीली-दागी और बीज खोखले।',
    ],
    favourableConditionsHi:
      'अगेती (समय से पहले) बुवाई, लंबी अवधि की फसल, पिछले साल के संक्रमित टिंडे और डंठल, और जिनिंग मिल के पास के खेत।',
    organicHi: [
      'बुवाई के 45 दिन बाद फेरोमोन ट्रैप — 2 प्रति एकड़ (5 प्रति हेक्टेयर)।',
      'रोसेट फूल दिखते ही तोड़कर नष्ट करें।',
      'हर एकड़ से 20 हरे टिंडे तोड़कर चीरें — 2 या ज़्यादा में सुंडी मिले तो ETL पार है।',
      'शुरुआती 60 दिन में NSKE 5% + नीम तेल 5 मि.ली. प्रति लीटर।',
      'ट्राइकोग्रामा बैक्ट्री (Trichogramma bactrae) — 60,000 प्रति एकड़, 90–120 दिन पर।',
    ],
    chemicalHi: chem(
      'ETL: 10% रोसेट फूल, या 10% संक्रमित हरे टिंडे, या लगातार 3 दिन प्रति ट्रैप 8 पतंगे।',
      '60–120 दिन की फसल में: प्रोफेनोफॉस 50% EC — 3 मि.ली. प्रति लीटर, या इमामेक्टिन बेंज़ोएट 5% SG — 0.5 ग्राम प्रति लीटर, या इंडोक्साकार्ब 14.5% SC — 1 मि.ली. प्रति लीटर।',
      '120 दिन के बाद ही सिंथेटिक पाइरेथ्रॉइड, जैसे साइपरमेथ्रिन 10% EC — 1–1.5 मि.ली. प्रति लीटर।',
      'कोई भी टैंक मिश्रण न बनाएं; एक दवा दो बार से ज़्यादा न दोहराएं।',
    ),
    preventionHi: [
      'प्रमाणित Bt बीज रसीद के साथ खरीदें; समय पर, क्षेत्र के अनुसार छोटी-मध्यम अवधि की किस्म बोएं।',
      'ज़्यादा यूरिया न दें; फसल 180 दिन से आगे न खींचें।',
      'डंठल और अधखुले टिंडे खेत से हटाएं; डंठल खेत में ढेर न करें।',
      'संक्रमित कपास को गोदाम में न रखें; साफ़ और संक्रमित कपास अलग-अलग चुनें।',
      'फसल चक्र अपनाएं।',
    ],
    severityHint: 'high',
    sources: [S.cicr, S.pbw],
  },
  {
    id: 'cotton-whitefly',
    cropKeys: ['cotton'],
    type: 'pest',
    nameHi: 'सफेद मक्खी',
    nameEn: 'Whitefly',
    scientificName: 'Bemisia tabaci',
    aliases: ['चिट्टी मक्खी', 'whitefly', 'पत्ती मरोड़'],
    symptomsHi: [
      'पत्तियों की निचली सतह पर छोटे सफेद पंख वाले कीड़े — पौधा हिलाने पर उड़ते हैं।',
      'पत्तियां पीली, चिपचिपी और उन पर काली फफूंद।',
      'उत्तर भारत में पत्ती मरोड़ (लीफ कर्ल) वायरस फैलाती है — पत्तियां मुड़तीं और नसें मोटी हो जाती हैं।',
    ],
    favourableConditionsHi:
      'गर्म-उमस (जुलाई–सितंबर), बारिश का लंबा अंतराल, ज़्यादा यूरिया, 120 दिन से पहले पाइरेथ्रॉइड या कीटनाशक मिश्रण का छिड़काव, और आसपास सब्ज़ियां व खरपतवार।',
    organicHi: [
      'पीले चिपचिपे ट्रैप — लगभग 8 प्रति एकड़ निगरानी के लिए, 40 प्रति एकड़ नियंत्रण के लिए।',
      'शुरुआती 60 दिन में नीम तेल के दो छिड़काव।',
      'खेत के चारों ओर ज्वार, बाजरा या मक्का की 2 घनी कतारें।',
    ],
    chemicalHi: chem(
      'ETL: प्रति पत्ती लगभग 6 वयस्क सफेद मक्खी (20 पौधों का औसत)।',
      'वयस्क के लिए: डायफेंथ्यूरॉन (Diafenthiuron) 50% WP — 1.2 ग्राम प्रति लीटर, या फ्लोनिकामिड (Flonicamid) 50% WG — 0.4 ग्राम प्रति लीटर, या एफिडोपाइरोपेन 50 ग्राम/लीटर — 2 मि.ली. प्रति लीटर।',
      'शिशु (निम्फ) के लिए: पाइरीप्रोक्सीफेन (Pyriproxyfen) 10% EC — 2 मि.ली. प्रति लीटर, या स्पाइरोमेसिफेन (Spiromesifen) 22.9% SC — 1.2 मि.ली. प्रति लीटर।',
      '120 दिन से पहले सिंथेटिक पाइरेथ्रॉइड या ऑर्गेनोफॉस्फेट न छिड़कें।',
    ),
    preventionHi: [
      'समय पर बुवाई (उत्तर भारत में अमेरिकी कपास 15 मई तक) और सहनशील किस्में।',
      'खेत, मेड़ और नालियों के पास खरपतवार साफ़ रखें।',
      'शुरुआती बढ़वार में ज़्यादा यूरिया न दें।',
    ],
    severityHint: 'high',
    sources: [S.cicr],
  },
  {
    id: 'cotton-jassid',
    cropKeys: ['cotton', 'okra', 'brinjal'],
    type: 'pest',
    nameHi: 'हरा तेला (जैसिड)',
    nameEn: 'Jassid (leafhopper)',
    scientificName: 'Amrasca biguttula',
    aliases: ['तेला', 'फुदका', 'jassid', 'leafhopper'],
    symptomsHi: [
      'पत्तियों के नीचे हरे, तिरछे चलने वाले छोटे कीड़े।',
      'पत्तियों के किनारे पीले, फिर लाल-भूरे होकर नीचे की ओर मुड़ते हैं।',
      'पौधे की बढ़वार रुक जाती है।',
    ],
    favourableConditionsHi: 'गर्म-नम और बादल वाला मौसम, ज़्यादा नाइट्रोजन, बरसात के बीच सूखा अंतराल।',
    organicHi: [
      'शुरुआत में नीम तेल या NSKE 5% का छिड़काव।',
      'रोएंदार पत्ती वाली सहनशील किस्में लगाएं; क्राइसोपर्ला जैसे मित्र कीट बचाएं।',
    ],
    chemicalHi: chem(
      'कपास में ETL: 25% पौधों पर पत्ती किनारे पीले-मुड़े, या प्रति पत्ती 2 शिशु।',
      'फ्लोनिकामिड 50% WG — 0.4 ग्राम प्रति लीटर, या डाइनोटेफ्यूरान 20% SG — 0.3 ग्राम प्रति लीटर, या इमिडाक्लोप्रिड 17.8% SL — 0.3 मि.ली. प्रति लीटर।',
      'भिंडी और बैंगन में केवल वही दवा लें जिसके लेबल पर वह फसल दर्ज हो, और छिड़काव तुड़ाई के बाद करें।',
    ),
    preventionHi: ['संतुलित नाइट्रोजन।', 'खरपतवार साफ़ रखें और हर हफ्ते निगरानी करें।'],
    severityHint: 'medium',
    sources: [S.cicr, S.cibrcUses],
  },
  {
    id: 'cotton-thrips',
    cropKeys: ['cotton'],
    type: 'pest',
    nameHi: 'थ्रिप्स',
    nameEn: 'Cotton thrips',
    scientificName: 'Thrips tabaci',
    aliases: ['थ्रिप्स', 'चुरड़ा', 'thrips'],
    symptomsHi: [
      'पत्तियों की निचली सतह पर चांदी जैसे चमकीले धब्बे; पत्तियां ऊपर की ओर मुड़ती हैं।',
      'शुरुआती पौधों की बढ़वार रुकती है।',
    ],
    favourableConditionsHi:
      'सूखा, गर्म मौसम और शुरुआती अवस्था (बुवाई के लगभग 30–60 दिन)। मध्य और दक्षिण भारत में थ्रिप्स नेक्रोसिस (तंबाकू स्ट्रीक) वायरस भी फैलाते हैं।',
    organicHi: [
      'नीले चिपचिपे ट्रैप — लगभग 8 प्रति एकड़।',
      'शुरुआती 60 दिन में NSKE 5% + नीम तेल का छिड़काव।',
      'खेत और मेड़ों से गाजर घास जैसे खरपतवार हटाएं।',
    ],
    chemicalHi: chem(
      'ETL: प्रति पत्ती लगभग 10 थ्रिप्स।',
      'थायमेथोक्साम 25% WG — 0.2 ग्राम प्रति लीटर, या स्पिनेटोरम 11.7% SC — लगभग 0.85 मि.ली. प्रति लीटर।',
      'कीटनाशक मिश्रण न बनाएं।',
    ),
    preventionHi: ['समय पर बुवाई और खरपतवार नियंत्रण।', 'संतुलित नाइट्रोजन।'],
    severityHint: 'medium',
    sources: [S.cicr],
  },
  {
    id: 'cotton-leaf-curl-virus',
    cropKeys: ['cotton'],
    type: 'viral',
    nameHi: 'पत्ती मरोड़ रोग (कॉटन लीफ कर्ल)',
    nameEn: 'Cotton leaf curl disease',
    scientificName: 'Cotton leaf curl virus (begomovirus complex)',
    aliases: ['पत्ती मरोड़', 'लीफ कर्ल', 'CLCuD', 'leaf curl'],
    symptomsHi: [
      'पत्तियां ऊपर या नीचे की ओर कप जैसी मुड़ती हैं; नसें मोटी और गहरी हरी।',
      'पत्ती के नीचे नस पर छोटी पत्ती जैसी बढ़वार (एनेशन) दिखती है।',
      'पौधे बौने रह जाते हैं; टिंडे कम और छोटे।',
    ],
    favourableConditionsHi:
      'सफेद मक्खी से फैलता है — उत्तर भारत (पंजाब, हरियाणा, राजस्थान) में देर से बुवाई, गर्म-उमस और आसपास के खरपतवार।',
    organicHi: [
      'बुवाई के 30 दिन से 15 दिन के अंतर पर 3–5 छिड़काव: सैलिसिलिक एसिड 200 ppm, या 5% छाछ, या 3% सरसों का तेल (CICR सलाह)।',
      'खेत के चारों ओर ज्वार, बाजरा या मक्का की कतारें; बीच-बीच में देसी कपास।',
      'खरपतवार और खुद उगे कपास के पौधे नष्ट करें।',
    ],
    chemicalHi: chem(
      'वायरस की कोई दवा नहीं — सफेद मक्खी को नियंत्रित करें।',
      'डायफेंथ्यूरॉन 50% WP — 1.2 ग्राम प्रति लीटर, या फ्लोनिकामिड 50% WG — 0.4 ग्राम प्रति लीटर।',
    ),
    preventionHi: [
      'लीफ कर्ल रोधी या सहनशील Bt हाइब्रिड लगाएं।',
      'समय पर बुवाई (अमेरिकी कपास 15 मई तक)।',
      'मिट्टी जांच के अनुसार संतुलित नाइट्रोजन।',
    ],
    severityHint: 'high',
    sources: [S.cicr],
  },
  {
    id: 'cotton-boll-rot',
    cropKeys: ['cotton'],
    type: 'fungal',
    nameHi: 'टिंडा सड़न (बॉल रॉट)',
    nameEn: 'Boll rot',
    aliases: ['टिंडा गलन', 'boll rot'],
    symptomsHi: [
      'टिंडों पर भूरे-काले धब्बे जो पूरे टिंडे पर फैल जाते हैं।',
      'टिंडा ठीक से नहीं खुलता; अंदर की रुई भूरी-काली और सड़ी।',
      'अंदरूनी सड़न में बाहर से टिंडा ठीक दिखता है पर रुई खराब होती है।',
    ],
    favourableConditionsHi:
      'फूल और टिंडा बनते समय बादल, ज़्यादा नमी और लगातार बूंदाबांदी; बहुत घनी बढ़वार, पानी भराव और रसचूसक कीटों के घाव।',
    organicHi: [
      'बढ़ते टिंडों से चिपकी सूखी पंखुड़ियां हटाएं।',
      'ज़्यादा नाइट्रोजन से बचें और पानी निकासी ठीक रखें।',
    ],
    chemicalHi: chem(
      'टिंडा बनते समय बादल और नमी हो तो बचाव के लिए: कॉपर ऑक्सीक्लोराइड 50% WP — 2.5 ग्राम प्रति लीटर, या कार्बेन्डाज़िम 12% + मैंकोज़ेब 63% WP — 2.5 ग्राम प्रति लीटर; 15 दिन के अंतर पर।',
      'या मेटिराम 55% + पायराक्लोस्ट्रोबिन 5% WG — 2 ग्राम प्रति लीटर, या प्रोपिनेब 70% WP — 2.5 ग्राम प्रति लीटर।',
    ),
    preventionHi: ['रसचूसक कीटों पर समय से नियंत्रण।', 'फसल की बढ़वार ज़रूरत से ज़्यादा न होने दें।'],
    severityHint: 'medium',
    sources: [S.cicr],
  },

  // ----- गन्ना -----
  {
    id: 'sugarcane-red-rot',
    cropKeys: ['sugarcane'],
    type: 'fungal',
    nameHi: 'लाल सड़न (रेड रॉट)',
    nameEn: 'Red rot',
    scientificName: 'Colletotrichum falcatum',
    aliases: ['लाल सड़न', 'गन्ने का कैंसर', 'red rot'],
    symptomsHi: [
      'ऊपर से तीसरी-चौथी पत्ती पीली होकर किनारों से सूखती है; फिर पूरा अगोला सूख जाता है।',
      'गन्ना चीरने पर अंदर का गूदा लाल, बीच-बीच में सफेद आड़ी पट्टियां; सिरके या शराब जैसी खट्टी गंध।',
      'पत्ती की मध्य शिरा पर लाल धब्बे।',
      'गन्ना अंदर से खोखला होकर सिकुड़ जाता है।',
    ],
    favourableConditionsHi:
      'संक्रमित बीज गन्ना, पानी भराव या बाढ़, बरसात का गर्म-नम मौसम (जुलाई–सितंबर), रोगी खेत की पेड़ी फसल और संवेदनशील किस्में (जैसे कई क्षेत्रों में Co 0238)।',
    organicHi: [
      'ट्राइकोडर्मा मिली सड़ी गोबर खाद या वर्मीकम्पोस्ट खेत में डालें।',
      'रोगी झुंड जड़ समेत निकालकर खेत से बाहर नष्ट करें।',
    ],
    chemicalHi: chem(
      'बीज टुकड़ों (सेट्स) का उपचार: थायोफेनेट मिथाइल (Thiophanate methyl) 70% WP या कार्बेन्डाज़िम 50% WP — 1 ग्राम प्रति लीटर (0.1%) घोल में बुवाई से पहले डुबोएं (सेट उपचार यंत्र हो तो उससे)।',
      'खड़ी फसल में फैल चुका रोग दवा से ठीक नहीं होता — रोगी गन्ना हटाना ही उपाय है।',
    ),
    preventionHi: [
      'रोगरोधी/सहनशील किस्में बोएं; जहां लाल सड़न आई हो वहां Co 0238 जैसी संवेदनशील किस्म न लगाएं।',
      'स्वस्थ नर्सरी से ही बीज गन्ना लें।',
      'रोगी खेत में पेड़ी न लें; 1–2 साल दूसरी फसल लें।',
      'पानी निकासी ठीक रखें; रोगी खेत का पानी दूसरे खेत में न जाने दें।',
    ],
    severityHint: 'high',
    sources: [S.redRot],
  },
  {
    id: 'sugarcane-early-shoot-borer',
    cropKeys: ['sugarcane'],
    type: 'pest',
    nameHi: 'अगोला बेधक (अर्ली शूट बोरर)',
    nameEn: 'Early shoot borer',
    scientificName: 'Chilo infuscatellus',
    aliases: ['प्रारंभिक तना बेधक', 'डेड हार्ट', 'early shoot borer'],
    symptomsHi: [
      'बुवाई के 1–3 महीने में बीच की गोभ सूख जाती है (डेड हार्ट); खींचने पर निकल आती है और सड़ी गंध आती है।',
      'तने के निचले हिस्से में ज़मीन के पास छोटे छेद।',
    ],
    favourableConditionsHi: 'गर्म, सूखा मौसम (मार्च–जून), कम नमी और देर से बसंतकालीन बुवाई।',
    organicHi: [
      'ट्राइकोग्रामा काइलोनिस ट्राइकोकार्ड — लगभग 20,000 प्रति एकड़ (50,000/हेक्टेयर), 10–15 दिन के अंतर पर।',
      'सूखी पत्तियों की परत (ट्रैश मल्चिंग) बिछाएं और हल्की सिंचाई से नमी बनाए रखें।',
      'डेड हार्ट वाले पौधे ज़मीन से काटकर नष्ट करें।',
      'बुवाई के लगभग 3 महीने पर हल्की मिट्टी चढ़ाएं।',
    ],
    chemicalHi: chem(
      'क्लोरएंट्रानिलिप्रोल 18.5% SC — लगभग 150 मि.ली. प्रति एकड़ (375 मि.ली./हेक्टेयर), बुवाई के 30 और 60 दिन पर।',
      'या फिप्रोनिल 0.3% GR — लगभग 10 किलो प्रति एकड़ (25 किलो/हेक्टेयर), बुवाई पर और 60 दिन पर।',
    ),
    preventionHi: ['शरदकालीन (अक्टूबर) बुवाई में प्रकोप कम रहता है।', 'गर्मी में नमी बनाए रखें।'],
    severityHint: 'medium',
    sources: [S.sugarcaneBorer],
  },
  {
    id: 'sugarcane-top-borer',
    cropKeys: ['sugarcane'],
    type: 'pest',
    nameHi: 'चोटी बेधक (टॉप बोरर)',
    nameEn: 'Top borer',
    scientificName: 'Scirpophaga excerptalis',
    aliases: ['चोटी बेधक', 'बंची टॉप', 'top borer'],
    symptomsHi: [
      'बीच की गोभ सूख जाती है (डेड हार्ट), पर खींचने पर आसानी से नहीं निकलती।',
      'खुली पत्तियों पर गोलियों जैसे छेदों की कतार; मध्य शिरा पर लाल सुरंग।',
      'बड़े गन्ने में ऊपर झाड़ीनुमा अगोला (बंची टॉप)।',
    ],
    favourableConditionsHi:
      'मार्च से सितंबर तक कई पीढ़ियां; उत्तर भारत में जून–जुलाई की पीढ़ी सबसे ज़्यादा नुकसान करती है।',
    organicHi: [
      'पत्तियों पर भूरे बालों से ढके अंडों के गुच्छे इकट्ठा कर नष्ट करें।',
      'ट्राइकोग्रामा जैपोनिकम — लगभग 20,000 प्रति एकड़ (50,000/हेक्टेयर), 10 दिन के अंतर पर।',
      'डेड हार्ट वाले पौधे काटकर नष्ट करें।',
    ],
    chemicalHi: chem(
      'जून के आख़िर में (तीसरी पीढ़ी के समय): क्लोरएंट्रानिलिप्रोल 0.4% GR — लगभग 10 किलो प्रति एकड़, हल्की सिंचाई के साथ।',
    ),
    preventionHi: ['पूरे क्षेत्र में एक साथ निगरानी और नियंत्रण।', 'पेड़ी फसल में भी निगरानी जारी रखें।'],
    severityHint: 'medium',
    sources: [S.sugarcaneTopBorer, S.sugarcaneBorer],
  },
  {
    id: 'sugarcane-pyrilla',
    cropKeys: ['sugarcane'],
    type: 'pest',
    nameHi: 'पायरिला (गन्ने का फुदका)',
    nameEn: 'Sugarcane pyrilla',
    scientificName: 'Pyrilla perpusilla',
    aliases: ['पायरिला', 'फुदका', 'pyrilla', 'leafhopper'],
    symptomsHi: [
      'पत्तियों के नीचे हल्के भूरे, चोंचदार फुदके और उनके शिशु रस चूसते हैं।',
      'पत्तियां पीली-सफेद पड़ती हैं; चिपचिपे पदार्थ पर काली फफूंद।',
      'गन्ने में रस और चीनी घट जाती है।',
    ],
    favourableConditionsHi: 'गर्म-नम मौसम (जुलाई–अक्टूबर), ज़्यादा नाइट्रोजन और घनी या गिरी हुई फसल।',
    organicHi: [
      'परजीवी कीट एपिरिकेनिया मेलानोल्यूका (Epiricania melanoleuca) पायरिला का प्राकृतिक दुश्मन है — इसके कोकून (लगभग 1600–2000 प्रति एकड़) जहां मिलें, उन्हें बचाएं और प्रभावित खेतों में फैलाएं।',
      'परजीवी मौजूद हों तो रासायनिक छिड़काव से बचें।',
      'अंडों के गुच्छे वाली निचली पत्तियां हटाएं।',
    ],
    chemicalHi: chem(
      'आमतौर पर परजीवी से नियंत्रण हो जाता है। बहुत ज़्यादा प्रकोप हो और परजीवी न हों, तभी कृषि अधिकारी या चीनी मिल के गन्ना विभाग से पंजीकृत दवा की सलाह लें।',
    ),
    preventionHi: ['संतुलित नाइट्रोजन।', 'गन्ने को गिरने से बचाने के लिए बंधाई करें।'],
    severityHint: 'medium',
    sources: [S.pyrilla],
  },
  {
    id: 'sugarcane-smut',
    cropKeys: ['sugarcane'],
    type: 'fungal',
    nameHi: 'कंडुआ (स्मट)',
    nameEn: 'Sugarcane smut',
    scientificName: 'Sporisorium scitamineum',
    aliases: ['कंडुआ', 'काला चाबुक', 'smut', 'whip'],
    symptomsHi: [
      'अगोले से काली, चाबुक जैसी लंबी संरचना निकलती है, जिस पर पतली चांदी जैसी झिल्ली होती है — फटने पर काला पाउडर उड़ता है।',
      'पौधे पतले, घास जैसे और ज़्यादा कल्ले वाले; गन्ना छोटा।',
    ],
    favourableConditionsHi: 'संक्रमित बीज गन्ना, पेड़ी फसल और गर्म-सूखा मौसम।',
    organicHi: [
      'काले चाबुक दिखते ही उन्हें मोटे कपड़े या थैली से ढककर काटें और नष्ट करें — पाउडर न उड़ने दें।',
      'रोगी झुंड उखाड़ें; रोगी खेत में पेड़ी न लें।',
      'बीज गन्ने का ताप उपचार (जैसे नम गर्म हवा या गर्म पानी) — सुविधा चीनी मिल या कृषि विभाग से पता करें।',
    ],
    chemicalHi: chem(
      'बीज टुकड़ों का बुवाई से पहले फफूंदनाशक घोल (जैसे कार्बेन्डाज़िम 50% WP — 1 ग्राम प्रति लीटर) में उपचार; सेट उपचार यंत्र से असर बेहतर होता है।',
    ),
    preventionHi: ['रोगरोधी किस्में और स्वस्थ नर्सरी का बीज गन्ना।', 'रोगी खेत में 1–2 साल दूसरी फसल।'],
    severityHint: 'medium',
    sources: [S.tnauSugarcaneSmut, S.sbiThermotherapy],
  },

  // ----- आलू / प्याज़ / लहसुन -----
  {
    id: 'potato-late-blight',
    cropKeys: ['potato'],
    type: 'fungal',
    nameHi: 'पछेती झुलसा',
    nameEn: 'Late blight',
    scientificName: 'Phytophthora infestans',
    aliases: ['झुलसा', 'late blight', 'आलू झुलसा'],
    symptomsHi: [
      'पत्तियों के किनारों या सिरों पर पानी से भीगे जैसे हल्के धब्बे, जो तेज़ी से काले-भूरे हो जाते हैं।',
      'नम सुबह में धब्बों के किनारे पत्ती के नीचे सफेद रुई जैसी फफूंद।',
      'कुछ ही दिनों में पूरा खेत झुलसा हुआ सा; सड़ी गंध।',
      'कंदों पर भूरे-बैंगनी धंसे धब्बे और अंदर भूरी सड़न।',
    ],
    favourableConditionsHi:
      'ठंडा-नम मौसम: लगभग 10–20°C तापमान, 90% से ज़्यादा नमी, कई दिन बादल, बूंदाबांदी या कोहरा (दिसंबर–जनवरी)।',
    organicHi: [
      'स्वस्थ, प्रमाणित बीज आलू लगाएं।',
      'पहले रोगी पौधे दिखते ही उखाड़कर खेत से बाहर नष्ट करें।',
      'मेड़ पर मिट्टी चढ़ाकर कंदों को ढक दें ताकि बीजाणु कंद तक न पहुंचें।',
    ],
    chemicalHi: chem(
      'रोग आने से पहले, मौसम अनुकूल होने पर बचाव छिड़काव: मैंकोज़ेब 75% WP या क्लोरोथैलोनिल (Chlorothalonil) 75% WP — 2 ग्राम प्रति लीटर (0.2%)।',
      'लक्षण दिखने पर: साइमोक्सानिल 8% + मैंकोज़ेब 64% WP — 3 ग्राम प्रति लीटर, या फेनामिडोन 10% + मैंकोज़ेब 50% WG — 3 ग्राम प्रति लीटर, या डाइमेथोमॉर्फ (Dimethomorph) 50% WP 1 ग्राम + मैंकोज़ेब 2 ग्राम प्रति लीटर।',
      '7–10 दिन के अंतर पर दोहराएं; हर बार दवा बदलें और 0.1% स्टिकर मिलाएं।',
    ),
    preventionHi: [
      'सहनशील किस्में लगाएं (CPRI की सिफारिश देखें)।',
      'कोहरे वाले मौसम में ज़्यादा सिंचाई न करें।',
      'रोग वाले खेत में खुदाई से 10–15 दिन पहले डंठल काट दें।',
      'सड़े कंद और कचरा खेत के पास ढेर न करें।',
    ],
    severityHint: 'high',
    sources: [S.cpriAdvisory, S.cpri],
  },
  {
    id: 'potato-black-scurf',
    cropKeys: ['potato'],
    type: 'fungal',
    nameHi: 'काली रूसी और स्कैब (कंद के धब्बे)',
    nameEn: 'Black scurf and common scab',
    scientificName: 'Rhizoctonia solani; Streptomyces scabies',
    aliases: ['काली रूसी', 'स्कैब', 'कंद धब्बे', 'black scurf', 'common scab'],
    symptomsHi: [
      'काली रूसी: कंदों की सतह पर काले, मिट्टी जैसे चिपके धब्बे जो धोने से नहीं छूटते; अंकुर गल सकते हैं।',
      'सामान्य स्कैब: कंदों पर भूरे, खुरदरे, कॉर्क जैसे उभरे या धंसे धब्बे।',
      'कंद का बाज़ार भाव घटता है; रोग बीज कंद से अगली फसल में जाता है।',
    ],
    favourableConditionsHi:
      'संक्रमित बीज कंद; ठंडी-गीली मिट्टी में गहरी बुवाई (काली रूसी); सूखी या क्षारीय मिट्टी और कंद बनते समय नमी की कमी (स्कैब)।',
    organicHi: [
      'स्वस्थ, प्रमाणित बीज कंद लें।',
      'ट्राइकोडर्मा मिली सड़ी गोबर खाद डालें।',
      'कंद बनते समय मिट्टी में नमी बनाए रखें — स्कैब कम होता है।',
      'पकने के बाद खुदाई में देर न करें।',
    ],
    chemicalHi: chem(
      'बीज कंदों का उपचार: 3% बोरिक एसिड घोल (30 ग्राम प्रति लीटर) में लगभग 20–30 मिनट डुबोएं या छिड़कें, फिर छाया में सुखाकर भंडारण या बुवाई करें।',
    ),
    preventionHi: [
      'फसल चक्र अपनाएं।',
      'ताज़ी (कच्ची) गोबर खाद और ज़रूरत से ज़्यादा चूना न डालें — स्कैब बढ़ता है।',
    ],
    severityHint: 'medium',
    sources: [S.blackScurf, S.cpri],
  },
  {
    id: 'onion-purple-blotch',
    cropKeys: ['onion', 'garlic'],
    type: 'fungal',
    nameHi: 'बैंगनी धब्बा (पर्पल ब्लॉच)',
    nameEn: 'Purple blotch',
    scientificName: 'Alternaria porri',
    aliases: ['बैंगनी धब्बा', 'purple blotch', 'झुलसा', 'स्टेमफीलियम झुलसा', 'stemphylium blight'],
    symptomsHi: [
      'पत्तियों पर छोटे सफेद धंसे धब्बे, जो बड़े होकर बैंगनी-भूरे, बीच में गहरे और चारों ओर पीले घेरे वाले बनते हैं।',
      'धब्बे से ऊपर पत्ती पीली होकर गिर जाती है।',
      'बीज वाली फसल में डंठल टूट जाते हैं।',
      'मिलता-जुलता स्टेमफीलियम झुलसा: पत्तियों पर पीले-नारंगी लंबे धब्बे जो भूरे हो जाते हैं — इसका प्रबंधन भी लगभग यही है।',
    ],
    favourableConditionsHi:
      'गर्म-नम मौसम (लगभग 25–30°C, ज़्यादा नमी), बारिश या ओस; खरीफ प्याज़ में ज़्यादा। थ्रिप्स के घाव से संक्रमण बढ़ता है।',
    organicHi: [
      'ट्राइकोडर्मा से पौध/बीज उपचार।',
      'रोगी पत्तियां हटाएं; थ्रिप्स पर काबू रखें।',
    ],
    chemicalHi: chem(
      'मैंकोज़ेब 75% WP — 2.5 ग्राम प्रति लीटर + स्टिकर (प्याज़ की चिकनी पत्ती पर दवा टिकने के लिए)।',
      'या टेबुकोनाज़ोल (Tebuconazole) 25.9% EC — 1–1.5 मि.ली. प्रति लीटर, या हेक्साकोनाज़ोल 5% EC — 1 मि.ली. प्रति लीटर।',
      '10–15 दिन के अंतर पर, हर बार दवा बदलकर।',
    ),
    preventionHi: [
      'फसल चक्र अपनाएं; स्वस्थ पौध/कलियां लगाएं।',
      'सही दूरी और पानी निकासी।',
    ],
    severityHint: 'high',
    sources: [S.dogrPurpleBlotch, S.dogr],
  },
  {
    id: 'onion-thrips',
    cropKeys: ['onion', 'garlic'],
    type: 'pest',
    nameHi: 'थ्रिप्स (चुरड़ा)',
    nameEn: 'Onion thrips',
    scientificName: 'Thrips tabaci',
    aliases: ['चुरड़ा', 'तेला', 'thrips'],
    symptomsHi: [
      'पत्तियों पर चांदी जैसी सफेद धारियां और धब्बे।',
      'पत्तियों के सिरे भूरे होकर मुड़ते और सूखते हैं।',
      'पत्तियों के बीच (गोभ में) छोटे पीले-भूरे कीड़े।',
      'कंद छोटे रह जाते हैं।',
    ],
    favourableConditionsHi: 'गर्म और सूखा मौसम (फरवरी–अप्रैल, रबी प्याज़) और कम नमी।',
    organicHi: [
      'नीले चिपचिपे ट्रैप लगाएं।',
      'प्याज़ के चारों ओर मक्का या गेहूं की 2 कतारें (अवरोधक फसल)।',
      'शुरुआत में नीम तेल 1500 ppm — 5 मि.ली. प्रति लीटर।',
    ],
    chemicalHi: chem(
      'फिप्रोनिल 5% SC — 1–1.5 मि.ली. प्रति लीटर, या प्रोफेनोफॉस 50% EC — 1 मि.ली. प्रति लीटर।',
      'स्टिकर ज़रूर मिलाएं; हर छिड़काव में दवा बदलें।',
    ),
    preventionHi: ['खेत और मेड़ों को खरपतवार मुक्त रखें।', 'हर हफ्ते गोभ में कीड़े गिनें।'],
    severityHint: 'high',
    sources: [S.dogrPurpleBlotch, S.dogr],
  },
  {
    id: 'onion-damping-off',
    cropKeys: ['onion', 'tomato', 'brinjal', 'chilli', 'cauliflower'],
    type: 'fungal',
    nameHi: 'आर्द्र गलन (नर्सरी में पौध गलना)',
    nameEn: 'Damping off',
    scientificName: 'Pythium spp., Rhizoctonia solani, Fusarium spp.',
    aliases: ['पौध गलन', 'डैम्पिंग ऑफ', 'damping off', 'नर्सरी रोग'],
    symptomsHi: [
      'नर्सरी में बीज जमने से पहले ही सड़ जाता है, या अंकुर निकलकर ज़मीन के पास से गलकर गिर जाते हैं।',
      'तने का निचला हिस्सा पानी से भीगा, पतला और भूरा।',
      'नर्सरी में टुकड़ों में पौधे मरते हैं।',
    ],
    favourableConditionsHi: 'नर्सरी में ज़्यादा पानी, खराब निकासी, घनी बुवाई, छाया, बादल-नमी और ठंडी-गीली मिट्टी।',
    organicHi: [
      'ज़मीन से कम से कम 15 सेमी ऊंची क्यारी बनाएं या प्रो-ट्रे में पौध उगाएं; पानी न रुकने दें।',
      'बुवाई से पहले नर्सरी की गीली मिट्टी को पारदर्शी पॉलीथीन से लगभग 30 दिन ढककर सौर उपचार करें।',
      'ट्राइकोडर्मा — 4–5 ग्राम प्रति किलो बीज से बीज उपचार; नर्सरी की मिट्टी में ट्राइकोडर्मा मिली सड़ी खाद।',
      'पतली बुवाई और ज़रूरत भर हल्की सिंचाई।',
    ],
    chemicalHi: chem(
      'लक्षण दिखें तो नर्सरी में कॉपर ऑक्सीक्लोराइड 50% WP — 2.5 ग्राम प्रति लीटर घोल से क्यारी को भिगोएं (लगभग 4 लीटर प्रति वर्ग मीटर)।',
    ),
    preventionHi: ['छायादार जगह पर नर्सरी न बनाएं।', 'बहाकर (फ्लड) सिंचाई न करें।'],
    severityHint: 'medium',
    sources: [S.tnauDampingOff, S.kauDampingOff],
  },
  {
    id: 'onion-basal-rot',
    cropKeys: ['onion', 'garlic'],
    type: 'fungal',
    nameHi: 'आधार सड़न (बेसल रॉट)',
    nameEn: 'Fusarium basal rot',
    scientificName: 'Fusarium oxysporum f. sp. cepae',
    aliases: ['बेसल रॉट', 'कंद सड़न', 'basal rot'],
    symptomsHi: [
      'पत्तियां सिरे से पीली होकर नीचे की ओर सूखती हैं।',
      'कंद के निचले हिस्से (जड़ वाले सिरे) पर सड़न; जड़ें गल जाती हैं और पौधा आसानी से उखड़ता है।',
      'भंडारण में कंद नीचे से सड़ते हैं।',
    ],
    favourableConditionsHi: 'गर्म मिट्टी, पानी भराव, मिट्टी के कीटों से हुए घाव और लगातार प्याज़-लहसुन की खेती।',
    organicHi: [
      'रोपाई से पहले पौध की जड़ें ट्राइकोडर्मा या स्यूडोमोनास के घोल में डुबोएं।',
      'ट्राइकोडर्मा मिली कम्पोस्ट (लगभग 200 किलो प्रति एकड़) खेत में डालें।',
    ],
    chemicalHi: chem(
      'रोपाई से पहले पौध की जड़ें कार्बेन्डाज़िम 50% WP — 1 ग्राम प्रति लीटर घोल में कुछ मिनट डुबोएं।',
    ),
    preventionHi: ['फसल चक्र; पानी निकासी ठीक रखें।', 'भंडारण से पहले कंद अच्छी तरह सुखाएं; सड़े कंद अलग करें।'],
    severityHint: 'medium',
    sources: [S.kauBasalRot, S.dogr],
  },

  // ----- टमाटर -----
  {
    id: 'tomato-early-blight',
    cropKeys: ['tomato', 'potato'],
    type: 'fungal',
    nameHi: 'अगेती झुलसा',
    nameEn: 'Early blight',
    scientificName: 'Alternaria solani',
    aliases: ['झुलसा', 'early blight', 'अगेता झुलसा'],
    symptomsHi: [
      'नीचे की पुरानी पत्तियों पर गोल भूरे-काले धब्बे, जिनमें निशाने जैसे गोल छल्ले।',
      'धब्बों के चारों ओर पीलापन; पत्तियां झड़ती हैं।',
      'तने और फल के डंठल के पास काले धंसे धब्बे।',
    ],
    favourableConditionsHi: 'गर्म-नम मौसम (लगभग 24–29°C) और ओस; कमज़ोर या पोषण की कमी वाले पौधे।',
    organicHi: [
      'ट्राइकोडर्मा — 4–5 ग्राम प्रति किलो बीज से बीज उपचार।',
      'नीचे की रोगी पत्तियां तोड़कर नष्ट करें।',
    ],
    chemicalHi: chem(
      'मैंकोज़ेब 75% WP — 2.5 ग्राम प्रति लीटर, या क्लोरोथैलोनिल 75% WP — 2 ग्राम प्रति लीटर।',
      'या एज़ोक्सीस्ट्रोबिन (Azoxystrobin) 23% SC — 1 मि.ली. प्रति लीटर, या डाइफेनोकोनाज़ोल (Difenoconazole) 25% EC — 0.5 मि.ली. प्रति लीटर।',
      '10–15 दिन के अंतर पर; तुड़ाई से पहले प्रतीक्षा अवधि रखें।',
    ),
    preventionHi: [
      '2–3 साल का फसल चक्र — टमाटर, आलू, बैंगन, मिर्च एक के बाद एक न लगाएं।',
      'पौधों को सहारा (स्टेकिंग) दें; संतुलित खाद और ड्रिप सिंचाई।',
    ],
    severityHint: 'medium',
    sources: [S.iihr, S.cibrcUses],
  },
  {
    id: 'tomato-late-blight',
    cropKeys: ['tomato'],
    type: 'fungal',
    nameHi: 'पछेती झुलसा',
    nameEn: 'Late blight',
    scientificName: 'Phytophthora infestans',
    aliases: ['झुलसा', 'late blight'],
    symptomsHi: [
      'पत्तियों पर पानी से भीगे जैसे बड़े धब्बे जो तेज़ी से काले-भूरे होते हैं; नमी में नीचे सफेद फफूंद।',
      'तनों पर काले धब्बे।',
      'फलों पर भूरे-हरे, चिकने और सख्त धब्बे जो बाद में सड़ जाते हैं।',
    ],
    favourableConditionsHi: 'ठंडा-नम मौसम, लगभग 10–20°C, लगातार बादल, कोहरा या बूंदाबांदी।',
    organicHi: [
      'रोगी पौधे और फल तुरंत हटाकर नष्ट करें।',
      'पास में आलू के खेत हों तो उनकी निगरानी भी करें — यही रोग वहां से आता है।',
    ],
    chemicalHi: chem(
      'बचाव के लिए: मैंकोज़ेब 75% WP — 2–2.5 ग्राम प्रति लीटर।',
      'लक्षण दिखने पर: साइमोक्सानिल 8% + मैंकोज़ेब 64% WP — 3 ग्राम प्रति लीटर।',
      '7–10 दिन के अंतर पर, दवा बदलकर; तुड़ाई से पहले प्रतीक्षा अवधि रखें।',
    ),
    preventionHi: ['पौधों को सहारा दें और हवा आने-जाने की जगह रखें।', 'ऊपर से (फव्वारे से) सिंचाई से बचें।'],
    severityHint: 'high',
    sources: [S.cpriAdvisory, S.iihr],
  },
  {
    id: 'tomato-leaf-curl-virus',
    cropKeys: ['tomato'],
    type: 'viral',
    nameHi: 'पत्ती मरोड़ रोग (लीफ कर्ल वायरस)',
    nameEn: 'Tomato leaf curl virus',
    scientificName: 'Tomato leaf curl New Delhi virus (ToLCNDV) and related begomoviruses',
    aliases: ['कुकड़ा', 'चुर्रा-मुर्रा', 'पत्ती मरोड़', 'पत्ती मुड़ना', 'leaf curl', 'ToLCV'],
    symptomsHi: [
      'नई पत्तियां छोटी, ऊपर की ओर मुड़ी, सिकुड़ी और किनारों से पीली।',
      'पौधे बौने और झाड़ी जैसे; फूल झड़ते हैं और फल बहुत कम लगते हैं।',
      'संक्रमण जितना जल्दी हो, नुकसान उतना ज़्यादा।',
    ],
    favourableConditionsHi:
      'सफेद मक्खी से फैलता है — गर्म, सूखा मौसम, बिना जाल वाली नर्सरी, और आसपास संक्रमित फसल व खरपतवार।',
    organicHi: [
      'पौध 40–50 मेश के नायलॉन जाल से ढकी नर्सरी में तैयार करें।',
      'पीले चिपचिपे ट्रैप — लगभग 8–10 प्रति एकड़।',
      'खेत के चारों ओर मक्का या ज्वार की 2–3 घनी कतारें।',
      'रोगी पौधे शुरुआत में ही उखाड़कर नष्ट करें।',
      'शुरुआत में नीम तेल 1500 ppm — 5 मि.ली. प्रति लीटर।',
    ],
    chemicalHi: chem(
      'वायरस की कोई दवा नहीं — सफेद मक्खी को नियंत्रित करें।',
      'साइंट्रानिलिप्रोल (Cyantraniliprole) 10.26% OD — लगभग 1.8 मि.ली. प्रति लीटर, या स्पाइरोमेसिफेन 22.9% SC — लगभग 1 मि.ली. प्रति लीटर।',
      'हर छिड़काव में दवा बदलें; तुड़ाई से पहले प्रतीक्षा अवधि रखें।',
    ),
    preventionHi: [
      'रोग-रोधी या सहनशील किस्में/हाइब्रिड लगाएं (जैसे IIHR की अर्का रक्षक)।',
      'सफेद मक्खी के ज़्यादा प्रकोप वाले समय में रोपाई से बचें — स्थानीय सलाह लें।',
      'खेत और मेड़ों से खरपतवार हटाएं।',
    ],
    severityHint: 'high',
    sources: [S.iihr, S.cibrcUses],
  },
  {
    id: 'tomato-fruit-borer',
    cropKeys: ['tomato'],
    type: 'pest',
    nameHi: 'फल छेदक',
    nameEn: 'Tomato fruit borer',
    scientificName: 'Helicoverpa armigera',
    aliases: ['इल्ली', 'सुंडी', 'fruit borer'],
    symptomsHi: [
      'फलों में गोल छेद; इल्ली का आधा शरीर अंदर, आधा बाहर।',
      'छेद वाले फल सड़ जाते हैं और बाज़ार में नहीं बिकते।',
      'छोटी इल्लियां पत्तियां और कलियां खाती हैं।',
    ],
    favourableConditionsHi: 'फूल और फल बनने का समय, गर्म मौसम; आसपास चना, कपास या मक्का।',
    organicHi: [
      'हर 16 कतार टमाटर पर 1 कतार अफ्रीकन गेंदा (ट्रैप फसल); गेंदा टमाटर से लगभग 15 दिन पहले लगाएं।',
      'फेरोमोन ट्रैप — 4–5 प्रति एकड़।',
      'HaNPV — लगभग 100 LE प्रति एकड़, शाम को।',
      'छेद वाले फल तोड़कर नष्ट करें।',
    ],
    chemicalHi: chem(
      'क्लोरएंट्रानिलिप्रोल 18.5% SC — 0.3 मि.ली. प्रति लीटर।',
      'या फ्लूबेंडियामाइड 39.35% SC — लगभग 0.2 मि.ली. प्रति लीटर, या इंडोक्साकार्ब 14.5% SC — लगभग 1 मि.ली. प्रति लीटर।',
      'पके फल तोड़ने के बाद छिड़कें; प्रतीक्षा अवधि रखें।',
    ),
    preventionHi: ['गर्मी में गहरी जुताई।', 'फूल आने से हर हफ्ते निगरानी।'],
    severityHint: 'high',
    sources: [S.iihr, S.cibrcUses],
  },
  {
    id: 'tomato-blossom-end-rot',
    cropKeys: ['tomato'],
    type: 'physiological',
    nameHi: 'फल का निचला सिरा सड़ना (ब्लॉसम एंड रॉट)',
    nameEn: 'Blossom-end rot',
    aliases: ['फल सड़न', 'कैल्शियम की कमी', 'blossom end rot'],
    symptomsHi: [
      'फल के निचले (फूल वाले) सिरे पर पानी से भीगा धब्बा, जो बड़ा होकर काला, चमड़े जैसा और धंसा हो जाता है।',
      'अक्सर तब दिखता है जब फल एक-तिहाई से आधे बड़े हों; बाद में उस पर फफूंद लग सकती है।',
    ],
    favourableConditionsHi:
      'असमान सिंचाई (कभी सूखा, कभी ज़्यादा पानी), तेज़ गर्मी, फल में कैल्शियम की कमी और ज़्यादा नाइट्रोजन (खासकर अमोनियम रूप में)।',
    organicHi: [
      'नियमित, हल्की सिंचाई करें — ड्रिप सबसे अच्छी।',
      'मल्चिंग से मिट्टी की नमी एक जैसी रखें।',
      'प्रभावित फल तोड़ दें।',
    ],
    chemicalHi: chem(
      'फल बनते समय कैल्शियम क्लोराइड — 3 ग्राम प्रति लीटर का पत्तियों पर छिड़काव।',
      'बुवाई के समय चूना या कैल्शियम वाली खाद (जैसे CAN), मिट्टी जांच के अनुसार।',
    ),
    preventionHi: [
      'अमोनियम वाली नाइट्रोजन ज़्यादा न दें।',
      'जड़ों को निराई-गुड़ाई में नुकसान न पहुंचाएं।',
    ],
    severityHint: 'low',
    sources: [S.nhbTomato],
  },
  {
    id: 'tomato-bacterial-wilt',
    cropKeys: ['tomato', 'brinjal', 'chilli', 'potato'],
    type: 'bacterial',
    nameHi: 'जीवाणु म्लानि (बैक्टीरियल विल्ट)',
    nameEn: 'Bacterial wilt',
    scientificName: 'Ralstonia solanacearum',
    aliases: ['उकठा', 'मुरझान', 'bacterial wilt', 'wilt'],
    symptomsHi: [
      'हरा-भरा पौधा अचानक मुरझा जाता है, अक्सर पत्तियां पीली हुए बिना।',
      'तने का कटा टुकड़ा साफ़ पानी के गिलास में लटकाएं तो कुछ मिनट में सफेद दूधिया धार निकलती है — यह पहचान का आसान तरीका है।',
      'तने के अंदर भूरी धारियां।',
    ],
    favourableConditionsHi:
      'गर्म मौसम और मिट्टी में ज़्यादा नमी; मिट्टी, सिंचाई के पानी, रोगी पौध और औज़ारों से फैलता है।',
    organicHi: [
      'रोगी पौधे जड़ समेत तुरंत निकालकर खेत से बाहर नष्ट करें।',
      'टमाटर, बैंगन, मिर्च, आलू के बाद 2–3 साल इसी परिवार की फसल न लें।',
      'नीम खली लगभग 100 किलो प्रति एकड़ मिट्टी में।',
      'सिंचाई सीमित रखें; पानी न रुकने दें।',
    ],
    chemicalHi: chem(
      'इस रोग की कोई पूरी तरह असरदार दवा नहीं — बचाव ही उपाय है।',
      'रोगी खेत में ब्लीचिंग पाउडर लगभग 4 किलो प्रति एकड़ से मिट्टी उपचार (TNAU सलाह)।',
    ),
    preventionHi: [
      'रोगरोधी किस्में या हाइब्रिड लगाएं (जैसे टमाटर में IIHR की अर्का रक्षक)।',
      'स्वस्थ पौध लें; औज़ार साफ़ रखें।',
    ],
    severityHint: 'high',
    sources: [S.tnauBacterialWilt, S.iihr],
  },
  {
    id: 'tomato-pinworm',
    cropKeys: ['tomato'],
    type: 'pest',
    nameHi: 'टमाटर पिनवर्म (टूटा)',
    nameEn: 'Tomato pinworm (Tuta absoluta)',
    scientificName: 'Tuta absoluta (Phthorimaea absoluta)',
    aliases: ['टूटा', 'पत्ती सुरंगक', 'pinworm', 'tuta', 'leaf miner'],
    symptomsHi: [
      'पत्तियों में सफेद-पारदर्शी, फैली हुई सुरंगें (माइन) जिनमें काला मल।',
      'तनों, कलियों और फलों में छोटे छेद; फल के डंठल के पास छेद और सड़न।',
      'ज़्यादा प्रकोप में पत्तियां झुलसी सी दिखती हैं।',
    ],
    favourableConditionsHi: 'गर्म-सूखा मौसम, लगातार टमाटर और पास में बैंगन या आलू; संक्रमित पौध से फैलता है।',
    organicHi: [
      'फेरोमोन ट्रैप (टूटा ल्योर) से निगरानी और पकड़; ल्योर लगभग 20 दिन में बदलें।',
      'प्रभावित पत्तियां, फल और हिस्से तोड़कर नष्ट करें।',
      'नीम खली डालें; नीम आधारित (एज़ाडिरेक्टिन) दवा का छिड़काव; ट्राइकोग्रामा छोड़ें।',
    ],
    chemicalHi: chem(
      'साइंट्रानिलिप्रोल 10.26% OD — लगभग 1.2 मि.ली. प्रति लीटर, या क्लोरएंट्रानिलिप्रोल 18.5% SC — लगभग 0.2–0.3 मि.ली. प्रति लीटर।',
      'हर बार दवा बदलें; तुड़ाई से पहले प्रतीक्षा अवधि रखें।',
    ),
    preventionHi: ['कीटमुक्त पौध लें।', 'फसल अवशेष नष्ट करें; टमाटर परिवार की फसल लगातार न लें।'],
    severityHint: 'high',
    sources: [S.tuta, S.tutaDte],
  },

  // ----- बैंगन / गोभी / मिर्च / भिंडी -----
  {
    id: 'brinjal-fruit-shoot-borer',
    cropKeys: ['brinjal'],
    type: 'pest',
    nameHi: 'तना एवं फल छेदक',
    nameEn: 'Brinjal shoot and fruit borer',
    scientificName: 'Leucinodes orbonalis',
    aliases: ['फल छेदक', 'कीड़ा लगा बैंगन', 'shoot and fruit borer'],
    symptomsHi: [
      'नई टहनियों के सिरे मुरझाकर लटक जाते हैं — अंदर इल्ली होती है।',
      'फलों पर छोटे छेद; अंदर गूदा खाया हुआ और मल भरा।',
      'फूल और कलियां झड़ती हैं।',
    ],
    favourableConditionsHi: 'गर्म-नम मौसम (खरीफ और गर्मी), लगातार बैंगन और पुराने ठूंठ खेत में छोड़ना।',
    organicHi: [
      'हर हफ्ते मुरझाई टहनियां और छेद वाले फल तोड़कर गड्ढे में दबाएं — यह सबसे ज़रूरी कदम है।',
      'फेरोमोन ट्रैप (ल्यूसिनोडीन ल्योर) — लगभग 10 प्रति एकड़, ज़्यादा प्रकोप में अधिक।',
      'ट्राइकोग्रामा काइलोनिस छोड़ें; Bt — 1 ग्राम प्रति लीटर का छिड़काव।',
    ],
    chemicalHi: chem(
      'क्लोरएंट्रानिलिप्रोल 18.5% SC — 0.4 मि.ली. प्रति लीटर, या इमामेक्टिन बेंज़ोएट 5% SG — 0.4 ग्राम प्रति लीटर।',
      'या स्पाइनोसैड (Spinosad) 45% SC — लगभग 0.3 मि.ली. प्रति लीटर।',
      '15 दिन के अंतर पर दवा बदल-बदल कर; छिड़काव से पहले पके फल तोड़ लें।',
    ),
    preventionHi: [
      'पिछली फसल के ठूंठ खेत से हटाएं; लगातार बैंगन न लगाएं।',
      'सहनशील किस्में लगाएं।',
    ],
    severityHint: 'high',
    sources: [S.kauBrinjal, S.ncipm],
  },
  {
    id: 'brinjal-little-leaf',
    cropKeys: ['brinjal'],
    type: 'bacterial',
    nameHi: 'छोटी पत्ती रोग',
    nameEn: 'Little leaf',
    scientificName: 'Phytoplasma (spread by leafhopper Hishimonus phycitis)',
    aliases: ['छोटी पत्ती', 'little leaf', 'फाइटोप्लाज्मा'],
    symptomsHi: [
      'पत्तियां बहुत छोटी, पतली और हल्की पीली-हरी; पौधा झाड़ी जैसा।',
      'फूल हरे और पत्ती जैसे हो जाते हैं; फल नहीं लगते।',
    ],
    favourableConditionsHi: 'पत्ती फुदके (लीफहॉपर) से फैलता है; गर्मी और बरसात में ज़्यादा; आसपास के रोगी पौधे।',
    organicHi: [
      'रोगी पौधे दिखते ही उखाड़कर नष्ट करें — इनसे दूसरे पौधों में फैलता है।',
      'नर्सरी जाल से ढककर तैयार करें; खरपतवार हटाएं।',
    ],
    chemicalHi: chem(
      'रोग की कोई दवा नहीं — वाहक फुदके को नियंत्रित करें (हरा तेला वाली जानकारी देखें) और दवा कृषि अधिकारी की सलाह से लें।',
    ),
    preventionHi: ['सहनशील किस्में लगाएं।', 'रोगी खेत से पौध न लें।'],
    severityHint: 'high',
    sources: [S.tnauLittleLeaf],
  },
  {
    id: 'cauliflower-diamondback-moth',
    cropKeys: ['cauliflower'],
    type: 'pest',
    nameHi: 'हीरक पृष्ठ पतंगा (डायमंड बैक मॉथ)',
    nameEn: 'Diamondback moth',
    scientificName: 'Plutella xylostella',
    aliases: ['DBM', 'गोभी की इल्ली', 'diamondback moth'],
    symptomsHi: [
      'पत्तियों की निचली सतह पर छोटी हरी इल्लियां; छूने पर तेज़ी से हिलकर धागे से लटक जाती हैं।',
      'पत्तियों में छोटे छेद और खिड़की जैसे पारदर्शी धब्बे।',
      'ज़्यादा प्रकोप में पत्तियां जाली जैसी और फूल (कर्ड) खराब।',
    ],
    favourableConditionsHi:
      'ठंडा-सूखा मौसम (अक्टूबर–मार्च), लगातार गोभी वर्गीय फसलें; एक ही दवा बार-बार छिड़कने से कीट पर दवा का असर घटता है।',
    organicHi: [
      'हर 25 कतार गोभी के बाद 2 कतार सरसों (ट्रैप फसल); सरसों गोभी से लगभग 15 दिन पहले बोएं।',
      'फेरोमोन ट्रैप — लगभग 5 प्रति एकड़।',
      'Bt कुर्सटाकी — 2 ग्राम प्रति लीटर, या NSKE 5%।',
    ],
    chemicalHi: chem(
      'स्पाइनोसैड 2.5% SC — 1–1.2 मि.ली. प्रति लीटर।',
      'या इमामेक्टिन बेंज़ोएट 5% SG — 0.4 ग्राम प्रति लीटर, या क्लोरफेनापायर (Chlorfenapyr) 10% SC — 1–1.5 मि.ली. प्रति लीटर।',
      'हर छिड़काव में अलग समूह की दवा लें; लेबल पर गोभी/फूलगोभी दर्ज हो।',
    ),
    preventionHi: ['फसल चक्र अपनाएं।', 'कटाई के बाद अवशेष नष्ट करें।'],
    severityHint: 'high',
    sources: [S.tnauCole, S.cibrcUses],
  },
  {
    id: 'cauliflower-boron-deficiency',
    cropKeys: ['cauliflower'],
    type: 'nutrient',
    nameHi: 'बोरॉन की कमी (भूरापन / खोखला तना)',
    nameEn: 'Boron deficiency (browning)',
    aliases: ['भूरापन', 'खोखला तना', 'browning', 'hollow stem'],
    symptomsHi: [
      'फूल (कर्ड) और तने पर पहले पानी से भीगे धब्बे, फिर भूरे या गुलाबी रंग के धब्बे; स्वाद कड़वा।',
      'तना अंदर से खोखला, भीतर की दीवारें गीली।',
      'पुरानी पत्तियों के किनारे पीले-हरे; ज़्यादा कमी में पत्तियां छोटी रह जाती हैं।',
    ],
    favourableConditionsHi: 'हल्की रेतीली या क्षारीय मिट्टी, सूखा, और ज़्यादा पोटाश या नाइट्रोजन।',
    organicHi: ['सड़ी गोबर खाद या कम्पोस्ट डालें।', 'मिट्टी में नमी एक जैसी बनाए रखें।'],
    chemicalHi: chem(
      'रोपाई से पहले बोरेक्स — लगभग 4–6 किलो प्रति एकड़ (10–15 किलो/हेक्टेयर), मिट्टी जांच के अनुसार; क्षारीय मिट्टी में ज़्यादा लग सकता है।',
      'खड़ी फसल में बोरेक्स 0.2% (2 ग्राम प्रति लीटर, गुनगुने पानी में घोलकर) का छिड़काव, रोपाई के लगभग 30 दिन बाद और कर्ड बनते समय।',
      'बोरॉन ज़्यादा होने पर पौधों के लिए ज़हरीला है — सुझाई मात्रा से ज़्यादा न डालें।',
    ),
    preventionHi: ['हर 2–3 साल में मिट्टी जांच।', 'हर साल बिना जांच के बोरॉन न डालें।'],
    severityHint: 'medium',
    sources: [S.nhbCauliflower],
  },
  {
    id: 'cauliflower-black-rot',
    cropKeys: ['cauliflower'],
    type: 'bacterial',
    nameHi: 'काला सड़न (ब्लैक रॉट)',
    nameEn: 'Black rot',
    scientificName: 'Xanthomonas campestris pv. campestris',
    aliases: ['काला सड़न', 'black rot'],
    symptomsHi: [
      'पत्ती के किनारों से “V” आकार के पीले धब्बे जो अंदर की ओर बढ़ते हैं।',
      'पत्ती की नसें काली पड़ जाती हैं; तना काटने पर अंदर काला घेरा।',
      'फूल (कर्ड) पर भूरे-काले धब्बे और बाद में सड़न।',
    ],
    favourableConditionsHi: 'गर्म-नम मौसम और बारिश के छींटे; रोग संक्रमित बीज से आता है।',
    organicHi: [
      'बीज को गर्म पानी (50°C) में 30 मिनट रखकर उपचार — इससे रोग काफी घटता है, पर अंकुरण थोड़ा कम हो सकता है।',
      'रोगी पत्तियां और पौधे हटाएं।',
      '2–3 साल गोभी वर्गीय फसल उसी खेत में न लें।',
    ],
    chemicalHi: chem(
      'कॉपर ऑक्सीक्लोराइड 50% WP — 3 ग्राम प्रति लीटर; 10–15 दिन के अंतर पर।',
    ),
    preventionHi: ['रोगमुक्त बीज और स्वस्थ पौध।', 'खेत में पानी न रुकने दें।'],
    severityHint: 'medium',
    sources: [S.kauBlackRot, S.iivrBlackRot],
  },
  {
    id: 'chilli-thrips',
    cropKeys: ['chilli'],
    type: 'pest',
    nameHi: 'थ्रिप्स (चुरड़ा-मुरड़ा)',
    nameEn: 'Chilli thrips',
    scientificName: 'Scirtothrips dorsalis, Thrips parvispinus',
    aliases: ['चुरड़ा मुरड़ा', 'कुकड़ा', 'मुर्दा', 'पत्ती मुड़ना', 'thrips'],
    symptomsHi: [
      'पत्तियां ऊपर की ओर नाव जैसी मुड़ती और सिकुड़ती हैं।',
      'पत्तियों और फलों पर खरोंच जैसे भूरे-चांदी जैसे निशान।',
      'नया थ्रिप्स (थ्रिप्स पार्विस्पिनस) फूलों में रहकर फूल झड़ाता है — फल बहुत कम लगते हैं।',
    ],
    favourableConditionsHi:
      'सूखा, गर्म मौसम और बारिश का लंबा अंतराल; नया थ्रिप्स भारी बारिश में भी बढ़ता है। आसपास गाजर घास जैसे खरपतवार।',
    organicHi: [
      'नीले चिपचिपे ट्रैप — 25–30 प्रति एकड़।',
      'NSKE 5%, नीम तेल, या ब्यूवेरिया बेसियाना — 4 ग्राम प्रति लीटर।',
      'चारों ओर मक्का, ज्वार या बाजरा की 2–3 घनी कतारें।',
      'लगभग 200 किलो नीम खली प्रति एकड़ मिट्टी में।',
      'संक्रमित सिरे तोड़ें और खरपतवार हटाएं।',
    ],
    chemicalHi: chem(
      'केवल एक लेबल वाली दवा छिड़कें, मिश्रण नहीं।',
      'फिप्रोनिल 5% SC — 1.6–2 मि.ली. प्रति लीटर (प्रतीक्षा अवधि 7 दिन)।',
      'या स्पाइनोसैड 45% SC — लगभग 0.3 मि.ली. प्रति लीटर (3 दिन)।',
      'या साइंट्रानिलिप्रोल 10.26% OD — 1.2 मि.ली. प्रति लीटर (3 दिन), या टॉलफेनपायराड (Tolfenpyrad) 15% EC — 2 मि.ली. प्रति लीटर (7 दिन)।',
    ),
    preventionHi: [
      'गर्मी में गहरी जुताई; एक साथ रोपाई।',
      'संतुलित खाद, पोटाश पर्याप्त।',
      'सिल्वर-काली प्लास्टिक मल्च (25–30 माइक्रोन) से थ्रिप्स कम होते हैं।',
    ],
    severityHint: 'high',
    sources: [S.chilliThrips, S.tnauChilli],
  },
  {
    id: 'chilli-leaf-curl',
    cropKeys: ['chilli'],
    type: 'viral',
    nameHi: 'पत्ती मरोड़ रोग (लीफ कर्ल)',
    nameEn: 'Chilli leaf curl',
    scientificName: 'Chilli leaf curl virus (begomovirus)',
    aliases: ['कुकड़ा', 'मुर्दा रोग', 'पत्ती मुड़ना', 'leaf curl'],
    symptomsHi: [
      'पत्तियां छोटी, मोटी, सिकुड़ी, फफोलेदार और मुड़ी हुई; नसें मोटी।',
      'पौधे बौने, गांठें पास-पास; फूल-फल बहुत कम।',
      'पहचान: पत्ती नीचे मुड़े और नीचे सफेद मक्खी दिखे — वायरस की आशंका; पत्ती ऊपर मुड़े — थ्रिप्स; पत्ती नीचे मुड़कर चमकदार-तांबई हो — पीली माइट।',
    ],
    favourableConditionsHi: 'सफेद मक्खी से फैलता है — गर्म, सूखा मौसम और बिना जाल वाली नर्सरी।',
    organicHi: [
      'पौध 40–50 मेश के जाल से ढकी नर्सरी में तैयार करें।',
      'पीले चिपचिपे ट्रैप लगाएं; चारों ओर मक्का/ज्वार की कतारें।',
      'रोगी पौधे उखाड़कर नष्ट करें।',
    ],
    chemicalHi: chem(
      'वायरस की कोई दवा नहीं — सफेद मक्खी और माइट को नियंत्रित करें।',
      'स्पाइरोमेसिफेन 22.9% SC — लगभग 1 मि.ली. प्रति लीटर (माइट पर भी असर), या साइंट्रानिलिप्रोल 10.26% OD — लगभग 1.2 मि.ली. प्रति लीटर।',
    ),
    preventionHi: ['सहनशील किस्में लगाएं।', 'खरपतवार और पुराने रोगी पौधे हटाएं।'],
    severityHint: 'high',
    sources: [S.tnauChilli, S.chilliThrips],
  },
  {
    id: 'chilli-anthracnose',
    cropKeys: ['chilli'],
    type: 'fungal',
    nameHi: 'शीर्ष मरण व फल सड़न (एन्थ्रेक्नोज़)',
    nameEn: 'Anthracnose (die-back and fruit rot)',
    scientificName: 'Colletotrichum capsici',
    aliases: ['डाई बैक', 'फल सड़न', 'anthracnose', 'die back'],
    symptomsHi: [
      'टहनियां सिरे से नीचे की ओर सूखती हैं (शीर्ष मरण)।',
      'पके फलों पर धंसे हुए गोल काले धब्बे, जिनमें छोटे काले बिंदु छल्लों में।',
      'फल सिकुड़कर बदरंग; बीज भी संक्रमित हो जाता है।',
    ],
    favourableConditionsHi: 'गर्म-नम मौसम (लगभग 25–30°C), लगातार बारिश और संक्रमित बीज।',
    organicHi: [
      'स्वस्थ फलों से ही बीज लें; ट्राइकोडर्मा 4 ग्राम प्रति किलो बीज से उपचार।',
      'सूखी टहनियां काटकर नष्ट करें।',
    ],
    chemicalHi: chem(
      'बीज उपचार: थाइरम या कार्बेन्डाज़िम — लगभग 2 ग्राम प्रति किलो बीज।',
      'फूल आने के बाद: एज़ोक्सीस्ट्रोबिन 23% SC — 1 मि.ली. प्रति लीटर, या प्रोपिकोनाज़ोल 25% EC — 1 मि.ली. प्रति लीटर, या मैंकोज़ेब 75% WP — 2.5 ग्राम प्रति लीटर।',
      '15 दिन के अंतर पर, दवा बदलकर।',
    ),
    preventionHi: ['पानी निकासी ठीक रखें।', 'फसल चक्र अपनाएं।'],
    severityHint: 'medium',
    sources: [S.tnauChilli, S.cibrcUses],
  },
  {
    id: 'chilli-mites',
    cropKeys: ['chilli'],
    type: 'pest',
    nameHi: 'पीली माइट (मकड़ी)',
    nameEn: 'Yellow mite',
    scientificName: 'Polyphagotarsonemus latus',
    aliases: ['माइट', 'मकड़ी', 'बरुथी', 'mite', 'मुर्दा'],
    symptomsHi: [
      'पत्तियां नीचे की ओर मुड़ती हैं; पत्ती की निचली सतह चमकदार-तांबई।',
      'डंठल लंबे, पत्तियां छोटी और गुच्छे में; नई बढ़वार रुक जाती है।',
      'फूल झड़ते हैं और फलों पर खुरदरे निशान।',
    ],
    favourableConditionsHi: 'गर्म और नम मौसम; बार-बार सिंथेटिक पाइरेथ्रॉइड छिड़कने से माइट बढ़ती है।',
    organicHi: [
      'शुरुआत में प्रभावित सिरे तोड़कर नष्ट करें।',
      'शिकारी माइट (एम्ब्लीसियस) जैसे मित्र जीवों को बचाएं।',
      'नीम तेल 3% का छिड़काव शुरुआती अवस्था में।',
    ],
    chemicalHi: chem(
      'फेनपाइरोक्सिमेट (Fenpyroximate) 5% EC — 1 मि.ली. प्रति लीटर।',
      'या स्पाइरोमेसिफेन 22.9% SC — लगभग 0.5 मि.ली. प्रति लीटर।',
      'या घुलनशील गंधक 80% WP — 3 ग्राम प्रति लीटर (बहुत गर्मी में नहीं)।',
    ),
    preventionHi: ['पाइरेथ्रॉइड दवाओं का बेवजह छिड़काव न करें।', 'खरपतवार साफ़ रखें।'],
    severityHint: 'high',
    sources: [S.tnauChilli, S.kauChilliMite],
  },
  {
    id: 'okra-yellow-vein-mosaic',
    cropKeys: ['okra'],
    type: 'viral',
    nameHi: 'पीली नस मोज़ेक (पीलिया)',
    nameEn: 'Yellow vein mosaic',
    scientificName: 'Bhendi yellow vein mosaic virus (BYVMV)',
    aliases: ['पीलिया', 'पीला रोग', 'YVMV', 'yellow vein mosaic'],
    symptomsHi: [
      'पत्तियों की नसें पीली, बीच का हिस्सा हरा — जाल जैसा पीला पैटर्न।',
      'बाद में पूरी पत्ती पीली; पौधे बौने।',
      'फल छोटे, पीले-हरे, सख्त और बिकने लायक नहीं।',
    ],
    favourableConditionsHi: 'सफेद मक्खी से फैलता है — गर्मी और बरसात की भिंडी में ज़्यादा।',
    organicHi: [
      'सहनशील किस्में लगाएं (जैसे IIVR की काशी चमन)।',
      'रोगी पौधे शुरुआत में ही उखाड़कर नष्ट करें।',
      'पीले चिपचिपे ट्रैप और चारों ओर मक्का की 2 कतारें।',
      'नीम तेल 1500 ppm — 5 मि.ली. प्रति लीटर।',
    ],
    chemicalHi: chem(
      'वायरस की कोई दवा नहीं — सफेद मक्खी को रोकें।',
      'थायमेथोक्साम 25% WG — लगभग 0.2–0.3 ग्राम प्रति लीटर, या इमिडाक्लोप्रिड 17.8% SL — 0.3 मि.ली. प्रति लीटर; छिड़काव तुड़ाई के बाद करें।',
    ),
    preventionHi: ['खरपतवार हटाएं।', 'रोगग्रस्त खेत के पास नई भिंडी न लगाएं।'],
    severityHint: 'high',
    sources: [S.iivrKashiChaman, S.tnauOkraOrganic],
  },
  {
    id: 'okra-fruit-borer',
    cropKeys: ['okra'],
    type: 'pest',
    nameHi: 'तना एवं फल छेदक (चित्तीदार सुंडी)',
    nameEn: 'Okra shoot and fruit borer',
    scientificName: 'Earias vittella',
    aliases: ['फल छेदक', 'चित्तीदार सुंडी', 'fruit borer'],
    symptomsHi: [
      'नई टहनी का सिरा मुरझाकर झुक जाता है।',
      'फलों में छेद, अंदर सुंडी; फल टेढ़े हो जाते हैं।',
    ],
    favourableConditionsHi: 'गर्म-नम खरीफ मौसम; पास में लगातार भिंडी या कपास।',
    organicHi: [
      'प्रभावित टहनियां और फल हर हफ्ते तोड़कर नष्ट करें।',
      'फेरोमोन ट्रैप — लगभग 5 प्रति एकड़।',
      'ट्राइकोग्रामा छोड़ें; NSKE 5% का छिड़काव।',
    ],
    chemicalHi: chem(
      'इमामेक्टिन बेंज़ोएट 5% SG — लगभग 0.4 ग्राम प्रति लीटर।',
      'या इंडोक्साकार्ब 14.5% SC — लगभग 0.5–1 मि.ली. प्रति लीटर।',
      'छिड़काव तुड़ाई के बाद करें; प्रतीक्षा अवधि रखें।',
    ),
    preventionHi: ['फसल चक्र अपनाएं।', 'पुरानी फसल के अवशेष हटाएं।'],
    severityHint: 'medium',
    sources: [S.kauOkra, S.cibrcUses],
  },
];

// ---------- Lookups ----------

/**
 * Alternate ids used elsewhere (e.g. data/crops.ts `majorPestsDiseases`) that point at an
 * existing entry — the same organism on another crop, a renamed slug, or a pest covered by
 * the disease it spreads (whitefly → its virus entry).
 */
export const DISEASE_ID_ALIASES: Record<string, string> = {
  'groundnut-tikka-leaf-spot': 'groundnut-tikka',
  'groundnut-rust': 'groundnut-tikka',
  'groundnut-stem-rot': 'groundnut-collar-rot',
  'jowar-charcoal-rot': 'soybean-charcoal-rot',
  'gram-dry-root-rot': 'soybean-charcoal-rot',
  'garlic-basal-rot': 'onion-basal-rot',
  'brinjal-shoot-fruit-borer': 'brinjal-fruit-shoot-borer',
  'okra-shoot-fruit-borer': 'okra-fruit-borer',
  'barley-yellow-rust': 'wheat-yellow-rust',
  'barley-loose-smut': 'wheat-loose-smut',
  'barley-aphid': 'wheat-aphid',
  'jowar-stem-borer': 'maize-stem-borer',
  'maize-turcicum-leaf-blight': 'maize-leaf-blight',
  'maize-maydis-leaf-blight': 'maize-leaf-blight',
  'bajra-white-grub': 'groundnut-white-grub',
  'arhar-pod-borer': 'gram-pod-borer',
  'masoor-pod-borer': 'gram-pod-borer',
  'masoor-wilt': 'gram-wilt',
  'urad-yellow-mosaic': 'moong-yellow-mosaic',
  'moong-whitefly': 'moong-yellow-mosaic',
  'urad-whitefly': 'moong-yellow-mosaic',
  'moong-powdery-mildew': 'urad-powdery-mildew',
  'urad-cercospora-leaf-spot': 'moong-cercospora-leaf-spot',
  'okra-jassid': 'cotton-jassid',
  'brinjal-jassid': 'cotton-jassid',
  'potato-early-blight': 'tomato-early-blight',
  'potato-common-scab': 'potato-black-scurf',
  'garlic-thrips': 'onion-thrips',
  'garlic-purple-blotch': 'onion-purple-blotch',
  'onion-stemphylium-blight': 'onion-purple-blotch',
  'garlic-stemphylium-blight': 'onion-purple-blotch',
  'cauliflower-damping-off': 'onion-damping-off',
  'chilli-damping-off': 'onion-damping-off',
  'brinjal-bacterial-wilt': 'tomato-bacterial-wilt',
  'tomato-whitefly': 'tomato-leaf-curl-virus',
  'okra-whitefly': 'okra-yellow-vein-mosaic',
};

const byId = new Map(DISEASES.map(d => [d.id, d]));

/** Canonical id for an id or alias, or undefined when the knowledge base has no entry. */
export function resolveDiseaseId(id: string): string | undefined {
  if (byId.has(id)) return id;
  const target = DISEASE_ID_ALIASES[id];
  return target && byId.has(target) ? target : undefined;
}

/** Looks up by canonical id or alias. */
export function getDisease(id: string): DiseaseInfo | undefined {
  const canonical = resolveDiseaseId(id);
  return canonical ? byId.get(canonical) : undefined;
}

/** Resolves a list of ids/aliases in order, skipping unknown ones and duplicates. */
export function getDiseases(ids: readonly string[]): DiseaseInfo[] {
  const seen = new Set<string>();
  const out: DiseaseInfo[] = [];
  for (const id of ids) {
    const d = getDisease(id);
    if (d && !seen.has(d.id)) {
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

const severityRank: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/**
 * Diseases for one crop, most serious first; within a severity the crop's own entries
 * (id starts with the key) come before shared ones. Unknown keys (e.g. 'other') return [].
 */
export function diseasesForCrop(cropKey: string): DiseaseInfo[] {
  if (!isCropKey(cropKey)) return [];
  const own = (d: DiseaseInfo) => (d.cropKeys[0] === cropKey ? 0 : 1);
  return DISEASES.filter(d => d.cropKeys.includes(cropKey)).sort(
    (a, b) => severityRank[a.severityHint] - severityRank[b.severityHint] || own(a) - own(b),
  );
}

// Folding nukta, chandrabindu and joiners lets "गेहूँ"/"गेहूं" and "पड़ना"/"पडना" match.
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/़/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/[‌‍]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SearchRow {
  d: DiseaseInfo;
  names: string;
  crops: string;
  body: string;
}

let rows: SearchRow[] | null = null;

// Built lazily so screens that never search don't pay for it.
function searchRows(): SearchRow[] {
  rows ??= DISEASES.map(d => ({
    d,
    names: normalizeSearch([d.nameHi, d.nameEn, d.scientificName ?? '', ...(d.aliases ?? [])].join(' | ')),
    crops: normalizeSearch(d.cropKeys.map(k => `${CROP_NAMES[k].hi} ${CROP_NAMES[k].en} ${k}`).join(' | ')),
    // Conditions are included so a vector query like "सफेद मक्खी" also finds the viruses it spreads.
    body: normalizeSearch([...d.symptomsHi, d.favourableConditionsHi].join(' | ')),
  }));
  return rows;
}

/**
 * Substring search over names, aliases, crop names, symptoms and conditions. Every word of
 * the query must match somewhere; name hits rank above crop hits, which rank above
 * symptom hits, and the whole phrase appearing together earns a bonus.
 */
export function searchDiseases(query: string, limit = 20): DiseaseInfo[] {
  const phrase = normalizeSearch(query);
  const tokens = phrase.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const scored: { d: DiseaseInfo; score: number }[] = [];
  for (const row of searchRows()) {
    let score = 0;
    for (const t of tokens) {
      if (row.names.includes(t)) score += 3;
      else if (row.crops.includes(t)) score += 2;
      else if (row.body.includes(t)) score += 1;
      else {
        score = -1;
        break;
      }
    }
    if (score <= 0) continue;
    if (tokens.length > 1) {
      if (row.names.includes(phrase)) score += 4;
      else if (row.body.includes(phrase)) score += 3;
    }
    scored.push({ d: row.d, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || severityRank[a.d.severityHint] - severityRank[b.d.severityHint])
    .slice(0, limit)
    .map(s => s.d);
}
