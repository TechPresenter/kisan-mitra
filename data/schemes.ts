// "सरकारी योजनाएं" content: Government of India farmer schemes, Hindi-first.
// Every figure, eligibility rule, document and step below was copied from an official
// source opened during the 2026-10-05 review (scheme portals, DA&FW guidelines, PIB
// releases/backgrounders, the Union Budget speech). Per-scheme sources are in `sourceUrls`;
// the audit trail and the excluded schemes are in docs/SCHEMES.md.
//
// `lastVerified` must never claim more freshness than the sources support: it is the
// review date only when a 2026 official source confirms the entry is current; otherwise
// it is the date of the newest official document that states the entry's figures.
// Do not add or edit a figure without re-checking the official source.
import type { GovernmentScheme, SchemeCategory } from '../types/models';

/** lucide-react icon names used by the category chips / scheme rows. */
export type SchemeIconName = 'HandCoins' | 'ShieldCheck' | 'Landmark' | 'BadgePercent' | 'Tractor' | 'Sprout' | 'Droplets';
/** Soft tint families from the design brief's quick-action palette. */
export type SchemeTone = 'green' | 'indigo' | 'amber' | 'orange' | 'rose' | 'teal' | 'sky';

export interface SchemeCategoryDef {
  id: SchemeCategory;
  labelHi: string;
  labelEn: string;
  icon: SchemeIconName;
  tone: SchemeTone;
}

/** Filter-chip order from the reference screen (सभी is a UI string, not a category). */
export const SCHEME_CATEGORIES: readonly SchemeCategoryDef[] = [
  { id: 'support', labelHi: 'किसान सहायता', labelEn: 'Farmer support', icon: 'HandCoins', tone: 'green' },
  { id: 'insurance', labelHi: 'बीमा', labelEn: 'Insurance', icon: 'ShieldCheck', tone: 'indigo' },
  { id: 'credit', labelHi: 'ऋण', labelEn: 'Credit', icon: 'Landmark', tone: 'amber' },
  { id: 'subsidy', labelHi: 'सब्सिडी', labelEn: 'Subsidy', icon: 'BadgePercent', tone: 'orange' },
  { id: 'machinery', labelHi: 'कृषि यंत्र', labelEn: 'Farm machinery', icon: 'Tractor', tone: 'rose' },
  { id: 'seed', labelHi: 'बीज', labelEn: 'Seeds', icon: 'Sprout', tone: 'teal' },
  { id: 'irrigation', labelHi: 'सिंचाई', labelEn: 'Irrigation', icon: 'Droplets', tone: 'sky' },
];

/**
 * Date this catalog was last reviewed against official sources. Per-scheme
 * `lastVerified` can be older (see the file header); show that one on detail screens.
 */
export const SCHEMES_LAST_VERIFIED = '2026-10-05';

// Entries re-confirmed during the review against a 2026 official source.
const REVIEWED = SCHEMES_LAST_VERIFIED;
const MINISTRY_AGRI = 'कृषि एवं किसान कल्याण मंत्रालय';

// Official documents opened during verification (shared by several schemes).
const PIB = 'https://static.pib.gov.in/WriteReadData/specificdocs/documents';
const PIB_RELEASE = 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=';
const PMKISAN_DOCS = 'https://pmkisan.gov.in/Documents';
const SRC = {
  pibAnnadata2026: `${PIB}/2026/jun/doc202665884101.pdf`,
  pibResilient2026: `${PIB}/2026/mar/doc2026326833901.pdf`,
  pmkisanPortal: 'https://pmkisan.gov.in',
  pibPmKisanCabinet2026: `${PIB_RELEASE}2292460`,
  pibPmKisan23: `${PIB_RELEASE}2275744`,
  pibPmKisan22: `${PIB}/2026/mar/doc2026319829701.pdf`,
  pibKcc2026: `${PIB}/2026/mar/doc2026311819801.pdf`,
  pibMissCabinet2025: `${PIB_RELEASE}2131989`,
  budgetSpeech2025: 'https://www.indiabudget.gov.in/budget2025-26/doc/Budget_Speech.pdf',
  pibPmfbyFaq: `${PIB}/2021/dec/doc202112701.pdf`,
  // DA&FW "Operational Guidelines Kharif-23" with its 6 Nov 2024 covering letter, as
  // published by Maharashtra's agriculture department; pmfby.gov.in has no direct link to it.
  pmfbyGuidelines2023:
    'https://krishi.maharashtra.gov.in/Site/Upload/GR/OG%20titled%20as%20Operational%20Guidelines%20Kharif%2023%20for%20the%20implementation%20of%20PMFBY%20and%20RWBCIS%20From%20Kharif%202023%20onwards-reg%20(2).pdf',
  // DA&FW advisory (May 2026) applying OG 2023 from Kharif 2026, as published by HP.
  pmfbyAdvisory2026: 'https://agriculture.hp.gov.in/wp-content/uploads/2026/06/PMFBY26-27_merged.pdf',
  pibPmfbyWildAnimal2025: `${PIB_RELEASE}2191224`,
  airPmfbyWildAnimal2025: 'https://newsonair.gov.in/wild-animal-attacks-paddy-inundation-to-be-covered-under-pmfby-from-kharif-2026/',
  pibPmfbyLokSabha2026: `${PIB_RELEASE}2222799`,
  pibShc2025: `${PIB}/2025/aug/doc2025816613501.pdf`,
  pdmcGuidelines2025: 'https://pdmc.da.gov.in/files/General-Information/Guideline/4-1760756927.pdf',
  pdmcPortal: 'https://pdmc.da.gov.in/',
  smamGuidelines2026: 'https://www.agriwelfare.gov.in/Documents/SMAM_2026F_Operational_Guidelines_Revision.pdf',
  smamDivision: 'https://agriwelfare.gov.in/en/MechanizationDiv',
  pibPkvy2025: `${PIB}/2025/oct/doc2025106657801.pdf`,
  pmkmyGuidelines: `${PMKISAN_DOCS}/PM-KMY%20-%20Operational%20Guidelines.pdf`,
  pmkmyFaq: `${PMKISAN_DOCS}/PM-KMY%20-%20FAQs.pdf`,
  pmkmySalient: `${PMKISAN_DOCS}/PM-KMY%20-%20Salient%20Features.pdf`,
  pibPmkmy2024: `${PIB}/2024/sep/doc202499390501.pdf`,
  pibPmkmyFaq: `${PIB}/2022/jan/doc20221185101.pdf`,
  enamRegistration: 'https://enam.gov.in/resources/registration-guideline',
  enamFaq: 'https://enam.gov.in/resources/FAQs-of-eNam',
  nmnfGuidelines: 'https://naturalfarming.dac.gov.in/uploads/NMNF/Guideline_of_NMNF_V2_Revised.pdf',
  seedsDivision: 'https://agriwelfare.gov.in/en/SeedsDiv',
  smspGuidelines2014: 'https://agriwelfare.gov.in/Documents/SMSP13.05.2014_2.pdf',
  pibPulses2025: `${PIB}/2025/oct/doc20251011663801.pdf`,
};

/**
 * Ordered by how often farmers need them. benefitsHi[0] is always a short one-line
 * highlight suitable for list rows (e.g. "प्रति वर्ष ₹6,000 की सहायता").
 */
export const SCHEMES: readonly GovernmentScheme[] = [
  {
    id: 'pm-kisan',
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    nameHi: 'प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)',
    category: 'support',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'खेती योग्य ज़मीन वाले किसान परिवारों को हर साल ₹6,000 की सीधी आर्थिक मदद, जो ₹2,000 की तीन बराबर किस्तों में आधार से जुड़े बैंक खाते में आती है।',
    eligibilityHi: [
      'खेती योग्य ज़मीन वाले किसान परिवार। पहचान राज्य सरकार ज़मीन के रिकॉर्ड (भू-अभिलेख) के आधार पर करती है।',
      'किस्त तभी मिलती है जब PM-KISAN पोर्टल पर ज़मीन का रिकॉर्ड जुड़ा हो, बैंक खाता आधार से जुड़ा हो और e-KYC पूरा हो।',
      'इन श्रेणियों के किसान परिवार पात्र नहीं: सभी संस्थागत भूमिधारक; पूर्व या वर्तमान संवैधानिक पद धारक, केंद्र/राज्य मंत्री, सांसद, विधायक, विधान परिषद सदस्य, नगर निगम के महापौर और ज़िला पंचायत अध्यक्ष।',
      'केंद्र/राज्य सरकार, सरकारी उपक्रम (PSU), सरकारी स्वायत्त संस्थानों और स्थानीय निकायों के सेवारत या सेवानिवृत्त अधिकारी/कर्मचारी, और ₹10,000 या अधिक मासिक पेंशन पाने वाले सेवानिवृत्त भी पात्र नहीं — लेकिन मल्टी टास्किंग स्टाफ (MTS), चतुर्थ श्रेणी और ग्रुप D कर्मचारियों पर यह रोक लागू नहीं है।',
      'पिछले कर-निर्धारण वर्ष में आयकर देने वाले, और पेशेवर संस्था में पंजीकृत होकर प्रैक्टिस करने वाले डॉक्टर, इंजीनियर, वकील, चार्टर्ड अकाउंटेंट (CA) और आर्किटेक्ट पात्र नहीं। अपात्र व्यक्ति को मिली राशि वसूल की जाती है।',
    ],
    benefitsHi: [
      'प्रति वर्ष ₹6,000 की सहायता',
      '₹2,000 की तीन बराबर किस्तें, DBT से सीधे आधार से जुड़े बैंक खाते में।',
      'पात्र किसानों की सूची गांव स्तर पर सार्वजनिक की जाती है; जो किसान गलती से छूट गए हैं, वे शिकायत दर्ज कर नाम जुड़वाने की मांग कर सकते हैं।',
      'केंद्रीय कैबिनेट ने 31 जुलाई 2026 को योजना 2026-27 से 2030-31 तक जारी रखने की मंज़ूरी दी।',
    ],
    documentsHi: ['आधार कार्ड', 'आधार से जुड़ा बैंक खाता', 'ज़मीन के कागज़ (भू-अभिलेख)', 'मोबाइल नंबर'],
    howToApplyHi: [
      'PM-KISAN मोबाइल ऐप से खुद पंजीकरण करें, या pmkisan.gov.in पोर्टल का उपयोग करें।',
      'e-KYC पूरा करें — OTP से, बायोमेट्रिक (अंगूठे) से, या ऐप में चेहरा स्कैन (Face Authentication) करके।',
      'भुगतान की स्थिति ऐप या पोर्टल पर देखें। सवालों के लिए Kisan-eMitra चैटबॉट 11 भाषाओं में 24 घंटे उपलब्ध है।',
      'शिकायत PM-KISAN पोर्टल या CPGRAMS पर दर्ज करें।',
    ],
    officialUrl: 'https://pmkisan.gov.in',
    sourceUrls: [
      SRC.pmkisanPortal,
      SRC.pibPmKisanCabinet2026,
      SRC.pibPmKisan23,
      SRC.pibPmKisan22,
      SRC.pibAnnadata2026,
      SRC.pibResilient2026,
    ],
    lastVerified: REVIEWED,
  },
  {
    id: 'pmfby',
    name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    nameHi: 'प्रधानमंत्री फसल बीमा योजना (PMFBY)',
    category: 'insurance',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'प्राकृतिक आपदा, कीट और रोग से फसल के नुकसान पर बीमा — बुवाई से पहले से कटाई के बाद तक। किसान को बहुत कम प्रीमियम देना होता है ("एक राष्ट्र, एक फसल, एक प्रीमियम")। योजना खरीफ 2026 और रबी 2026-27 के लिए ऑपरेशनल गाइडलाइंस 2023 के अनुसार जारी है।',
    eligibilityHi: [
      'अधिसूचित क्षेत्र में अधिसूचित फसल उगाने वाले सभी किसान, जिनमें बटाईदार और काश्तकार (किरायेदार) किसान भी शामिल हैं।',
      'फसल और ज़मीन में किसान का बीमा योग्य हित होना ज़रूरी है।',
      'वन अधिकार अधिनियम (FRA) के तहत वन भूमि पर खेती करने वाले आदिवासी किसान, और पूर्वोत्तर में सामुदायिक ज़मीन पर खेती करने वाले किसान (गांव प्रधान या राजस्व अधिकारी के प्रमाणपत्र से) भी बीमा करा सकते हैं।',
      'योजना सभी किसानों के लिए स्वैच्छिक है। KCC/फसल ऋण वाले किसान अपने-आप शामिल होते हैं, जब तक वे नामांकन की अंतिम तिथि से कम से कम 7 दिन पहले बैंक शाखा में बाहर रहने का घोषणा-पत्र न दें।',
    ],
    benefitsHi: [
      'प्रीमियम अधिकतम: खरीफ 2%, रबी 1.5%, बागवानी 5%',
      'किसान का अधिकतम प्रीमियम (बीमा राशि का): खरीफ अनाज व तिलहन 2%, रबी अनाज व तिलहन 1.5%, वार्षिक वाणिज्यिक/बागवानी फसलें 5% — या एक्चुरियल दर, जो भी कम हो।',
      'बाकी प्रीमियम केंद्र और राज्य सरकार मिलकर देती हैं (50:50; पूर्वोत्तर और हिमालयी राज्यों में 90:10)।',
      'मूल कवर: सूखा, लंबा सूखा अंतराल, बाढ़, जलभराव, बड़े पैमाने पर कीट और रोग, भूस्खलन, बिजली गिरने से लगी आग, आंधी, ओलावृष्टि और चक्रवात से खड़ी फसल की उपज के नुकसान पर बीमा।',
      'राज्य ने यह ऐड-ऑन कवर चुना हो तो: खराब मौसम के कारण बुवाई न हो पाए तो बीमा राशि का अधिकतम 25% तक दावा।',
      'राज्य ने ऐड-ऑन कवर चुने हों तो: कटाई के बाद खेत में सूखने के लिए रखी फसल को 14 दिन तक ओलावृष्टि, चक्रवात और बेमौसम बारिश से सुरक्षा; ओलावृष्टि, भूस्खलन, जलभराव, बादल फटने और बिजली से लगी आग जैसी स्थानीय आपदा में खेत-स्तर पर आकलन।',
      'खरीफ 2026 से: धान की फसल में जलभराव फिर से स्थानीय आपदा में शामिल।',
      'खरीफ 2026 से: जंगली जानवरों के हमले से फसल नुकसान ऐड-ऑन कवर में — जहां राज्य ने उन जानवरों और ज़िलों/बीमा इकाइयों को अधिसूचित किया हो। 72 घंटे के भीतर Crop Insurance App पर जियो-टैग फोटो के साथ सूचना दें।',
      'तय समय में दावे का भुगतान न हो तो बीमा कंपनी किसान को 12% सालाना ब्याज (जुर्माना) देती है — यह राष्ट्रीय फसल बीमा पोर्टल पर अपने-आप जुड़ता है।',
      'दावे की राशि सीधे बैंक खाते में आती है। युद्ध, परमाणु जोखिम, जानबूझकर किया गया नुकसान, चोरी और पालतू पशुओं द्वारा चराई से हुआ नुकसान शामिल नहीं है।',
    ],
    documentsHi: [
      'आधार कार्ड/नंबर (या आधार से e-KYC) और मोबाइल नंबर',
      'बैंक पासबुक की कॉपी — दावे की राशि इसी बचत खाते में आती है',
      'ज़मीन के कागज़ — अधिकार अभिलेख (RoR), भूमि कब्ज़ा प्रमाणपत्र (LPC) आदि',
      'बटाईदार/काश्तकार किसान: अनुबंध दस्तावेज़ या राज्य द्वारा तय कोई अन्य दस्तावेज़',
      'बुवाई प्रमाणपत्र, या फसल बोने के इरादे का स्व-घोषणा पत्र',
    ],
    howToApplyHi: [
      'हर मौसम की अंतिम तिथि से पहले बैंक शाखा, PACS, कॉमन सर्विस सेंटर (CSC), बीमा कंपनी या pmfby.gov.in पोर्टल से नामांकन कराएं।',
      'CSC पर नामांकन के लिए किसान से कोई शुल्क नहीं लिया जाता।',
      'फसल नुकसान होने पर 72 घंटे के भीतर "Crop Insurance App" या कृषि रक्षक पोर्टल व हेल्पलाइन 14447 पर सूचना दें; बैंक शाखा या कृषि विभाग/ज़िला अधिकारियों के ज़रिए भी सूचना दी जा सकती है।',
      'शिकायत के लिए कृषि रक्षक पोर्टल और हेल्पलाइन 14447।',
    ],
    officialUrl: 'https://pmfby.gov.in',
    sourceUrls: [
      SRC.pmfbyGuidelines2023,
      SRC.pmfbyAdvisory2026,
      SRC.pibPmfbyWildAnimal2025,
      SRC.airPmfbyWildAnimal2025,
      SRC.pibPmfbyLokSabha2026,
      SRC.pibPmfbyFaq,
    ],
    lastVerified: REVIEWED,
  },
  {
    id: 'kcc',
    name: 'Kisan Credit Card (KCC) with Modified Interest Subvention Scheme',
    nameHi: 'किसान क्रेडिट कार्ड (KCC) — ब्याज सहायता योजना',
    category: 'credit',
    ministry: `${MINISTRY_AGRI} (बैंकों के माध्यम से)`,
    summaryHi:
      'खेती, कटाई के बाद के खर्च, पशुपालन और मछली पालन जैसे कामों के लिए बैंक से समय पर और सस्ता ऋण, एक ही खिड़की से। RuPay कार्ड से ज़रूरत के अनुसार पैसा निकालें।',
    eligibilityHi: [
      'खुद खेती करने वाले व्यक्तिगत किसान और संयुक्त कर्ज़दार।',
      'काश्तकार (किरायेदार) किसान, मौखिक पट्टेदार और बटाईदार।',
      'स्वयं सहायता समूह (SHG) और संयुक्त देयता समूह (JLG), जिनमें काश्तकारों और बटाईदारों के समूह भी शामिल हैं।',
      'पशुपालन, डेयरी और मछली पालन करने वाले किसान भी।',
    ],
    benefitsHi: [
      'समय पर चुकाने पर 4% प्रभावी ब्याज (₹3 लाख तक)',
      '₹3 लाख तक के अल्पकालिक कृषि ऋण पर 7% ब्याज; समय पर चुकाने पर 3% तक की अतिरिक्त छूट, यानी प्रभावी ब्याज 4%। केवल पशुपालन या मछली पालन के ऋण पर यह लाभ ₹2 लाख तक (कैबिनेट मंज़ूरी, वित्त वर्ष 2025-26)।',
      'बजट 2025-26 में ब्याज सहायता योजना (MISS) की सीमा ₹3 लाख से ₹5 लाख करने की घोषणा हुई — अपने बैंक से पक्का करें कि आपके ऋण पर कितनी राशि तक 4% ब्याज लागू है।',
      '₹2 लाख तक का ऋण बिना गिरवी (1 जनवरी 2025 से)।',
      'RuPay कार्ड और 5 साल तक वैध घूमने वाली (revolving) ऋण सीमा।',
      'सीमांत किसानों के लिए ज़मीन और फसल के आधार पर ₹10,000 से ₹50,000 तक की लचीली सीमा, 5 साल के लिए।',
    ],
    documentsHi: [
      'एक पेज का सरल KCC आवेदन फॉर्म (कुछ जानकारी बैंक के PM-KISAN रिकॉर्ड से पहले से भरी होती है)',
      'ज़मीन के कागज़ों की प्रतियां',
      'बोई जाने वाली फसलों की जानकारी',
    ],
    howToApplyHi: [
      'अपने बैंक (वाणिज्यिक बैंक, क्षेत्रीय ग्रामीण बैंक या सहकारी बैंक) की शाखा में आवेदन करें।',
      'फॉर्म सभी अनुसूचित वाणिज्यिक बैंकों की वेबसाइट, agricoop.gov.in और pmkisan.gov.in पर मिलता है।',
      'कॉमन सर्विस सेंटर (CSC) फॉर्म भरने और उसे बैंक शाखा तक ऑनलाइन भेजने में मदद करते हैं।',
      'KCC अभियान के तहत ज़िला स्तर पर लगने वाले साप्ताहिक शिविरों में भी आवेदन किया जा सकता है।',
      'ब्याज सहायता (MISS) हर वित्त वर्ष के लिए मंज़ूर होती है — 2026-27 की ब्याज दर और सीमा अपने बैंक से पक्की करें।',
    ],
    officialUrl: 'https://fasalrin.gov.in',
    sourceUrls: [SRC.pibKcc2026, SRC.pibMissCabinet2025, SRC.budgetSpeech2025, SRC.pibResilient2026, SRC.pibAnnadata2026],
    // Newest official figures: PIB backgrounder of 11 Mar 2026; MISS was last approved for FY 2025-26.
    lastVerified: '2026-03-11',
  },
  {
    id: 'pm-kmy',
    name: 'Pradhan Mantri Kisan Maandhan Yojana (PM-KMY)',
    nameHi: 'प्रधानमंत्री किसान मानधन योजना (PM-KMY)',
    category: 'support',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'छोटे और सीमांत किसानों के लिए स्वैच्छिक व अंशदायी पेंशन योजना: 60 साल की उम्र के बाद हर महीने कम से कम ₹3,000 पेंशन।',
    eligibilityHi: [
      '18 से 40 वर्ष की उम्र के छोटे और सीमांत किसान।',
      '2 हेक्टेयर तक खेती योग्य ज़मीन, और नाम 01.08.2019 तक राज्य/केंद्र शासित प्रदेश के भू-अभिलेख में दर्ज हो।',
      'पात्र नहीं: NPS, कर्मचारी राज्य बीमा (ESIC) या कर्मचारी भविष्य निधि (EPFO) जैसी वैधानिक सामाजिक सुरक्षा योजनाओं के सदस्य, और PM-SYM या PM-LVM पेंशन योजना चुनने वाले किसान।',
      'उच्च आर्थिक स्थिति वाले भी पात्र नहीं: संस्थागत भूमिधारक; पूर्व या वर्तमान संवैधानिक पद धारक, मंत्री, सांसद, विधायक, महापौर और ज़िला पंचायत अध्यक्ष; सरकारी व PSU के सेवारत या सेवानिवृत्त कर्मचारी (MTS/चतुर्थ श्रेणी/ग्रुप D को छोड़कर); पिछले वर्ष आयकर देने वाले; पंजीकृत प्रैक्टिस करने वाले डॉक्टर, इंजीनियर, वकील, CA और आर्किटेक्ट।',
      'गलत घोषणा करने पर केवल अपना अंशदान बिना ब्याज लौटाया जाता है और सरकार का हिस्सा बंद हो जाता है।',
    ],
    benefitsHi: [
      '60 साल के बाद ₹3,000 प्रति माह पेंशन',
      'किसान जितना अंशदान देता है, उतनी ही राशि केंद्र सरकार भी पेंशन फंड में जमा करती है।',
      'मासिक अंशदान ₹55 से ₹200 — योजना से जुड़ते समय की उम्र के अनुसार, 60 साल की उम्र तक।',
      'पति-पत्नी दोनों अलग-अलग जुड़ें तो दोनों को 60 साल के बाद अलग-अलग ₹3,000 पेंशन मिलती है।',
      'पेंशन मिलते समय लाभार्थी की मृत्यु होने पर जीवनसाथी को 50%, यानी ₹1,500 प्रति माह पारिवारिक पेंशन।',
      'चाहें तो अंशदान PM-KISAN की किस्त से अपने-आप कट सकता है (ऑटो-डेबिट फॉर्म पर सहमति देकर)।',
      '10 साल से पहले योजना छोड़ने पर अपना अंशदान बचत खाते की ब्याज दर के साथ वापस मिलता है।',
    ],
    documentsHi: [
      'आधार कार्ड',
      'बैंक पासबुक या खाते का विवरण (खाता संख्या, IFSC/MICR कोड)',
      'जन्म तिथि, जीवनसाथी और नॉमिनी (नामांकित व्यक्ति) का विवरण',
      'मोबाइल नंबर (वैकल्पिक)',
    ],
    howToApplyHi: [
      'नज़दीकी कॉमन सर्विस सेंटर (CSC) पर आधार कार्ड और बैंक पासबुक लेकर जाएं — पंजीकरण किसान के लिए मुफ़्त है (CSC का शुल्क सरकार देती है)।',
      'या अपने ज़िले में राज्य नोडल अधिकारी (PM-KISAN) या उनकी तय एजेंसी के पास पंजीकरण कराएं।',
      'नामांकन-सह-ऑटो-डेबिट फॉर्म पर हस्ताक्षर के बाद पेंशन कार्ड मिलता है। पेंशन फंड का प्रबंधन LIC करती है।',
    ],
    // pmkmy.gov.in fails TLS and its "apply" link is dead; the FAQ on pmkisan.gov.in loads.
    officialUrl: SRC.pmkmyFaq,
    sourceUrls: [
      SRC.pmkmyGuidelines,
      SRC.pmkmyFaq,
      SRC.pmkmySalient,
      SRC.pibPmkmy2024,
      SRC.pibPmkmyFaq,
      SRC.pibAnnadata2026,
      SRC.pibResilient2026,
    ],
    // PIB, 5 Jun 2026, restates the ₹3,000 pension; no 2026-31 approval was found.
    lastVerified: '2026-06-05',
  },
  {
    id: 'soil-health-card',
    name: 'Soil Health Card Scheme (Soil Health & Fertility)',
    nameHi: 'मृदा स्वास्थ्य कार्ड योजना',
    category: 'support',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'खेत की मिट्टी के 12 मापदंडों की जांच करके हर जोत के लिए कार्ड, जिसमें खाद और मिट्टी सुधार की सही मात्रा की सलाह होती है। 2022-23 से यह RKVY का हिस्सा ("Soil Health & Fertility") है। नमूना लेने, जांच, कार्ड बनाने और बांटने का खर्च केंद्र सरकार उठाती है (₹190 प्रति नमूना)।',
    eligibilityHi: ['देश के सभी किसान।'],
    benefitsHi: [
      'मिट्टी की जांच और खाद की सही सलाह',
      '12 मापदंडों की जांच: नाइट्रोजन, फास्फोरस, पोटाश, सल्फर, जिंक, आयरन, कॉपर, मैंगनीज़, बोरॉन, pH, EC (विद्युत चालकता) और जैविक कार्बन।',
      'खाद, जैव-उर्वरक, जैविक इनपुट और मिट्टी सुधार की सही मात्रा की सलाह; हर 2 साल में कार्ड देने का लक्ष्य।',
      'कार्ड 22 भाषाओं और 5 बोलियों में, स्थानीय इकाइयों में मिलता है।',
      'ग्रामीण युवा (18–27 वर्ष), SHG और FPO गांव-स्तर की मिट्टी जांच लैब लगाने के लिए आवेदन कर सकते हैं; मंज़ूरी ज़िला स्तरीय कार्यकारी समिति देती है।',
    ],
    documentsHi: ['खेत (जोत) की जानकारी — कार्ड हर जोत के लिए अलग बनता है'],
    howToApplyHi: [
      'कृषि विभाग के कर्मचारी या प्रशिक्षित लोग रबी/खरीफ की कटाई के बाद, या जब खेत में फसल न हो, नमूना लेते हैं — अपने कृषि कार्यालय से संपर्क करें।',
      'नमूना 15–20 सेमी गहराई से V आकार का कट लगाकर, खेत के चारों कोनों और बीच से लिया जाता है।',
      'जांच के बाद कार्ड soilhealth.dac.gov.in पोर्टल पर बनता है; SHC मोबाइल ऐप भी उपलब्ध है।',
    ],
    officialUrl: 'https://soilhealth.dac.gov.in',
    sourceUrls: [SRC.pibShc2025, SRC.pibResilient2026, SRC.pibAnnadata2026],
    // PIB, 26 Mar 2026, restates the 12 parameters and the 2-year cycle.
    lastVerified: '2026-03-26',
  },
  {
    id: 'e-nam',
    name: 'e-NAM (National Agriculture Market)',
    nameHi: 'ई-नाम (राष्ट्रीय कृषि बाज़ार)',
    category: 'support',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'देशभर की APMC मंडियों को जोड़ने वाला ऑनलाइन व्यापार पोर्टल — "एक राष्ट्र, एक बाज़ार"। किसान को अपनी मंडी के साथ दूसरे राज्यों/मंडियों के खरीदारों से भी बोली मिल सकती है।',
    eligibilityHi: [
      'ई-नाम से जुड़ी मंडी में उपज बेचने वाले किसान। मार्च 2026 तक 23 राज्यों और 4 केंद्र शासित प्रदेशों की 1,656 मंडियां जुड़ी थीं।',
      'किसान उत्पादक संगठन (FPO) भी पंजीकरण कर सकते हैं।',
    ],
    benefitsHi: [
      'ऑनलाइन बोली से ज़्यादा खरीदार और पारदर्शी भाव',
      'स्थानीय या दूसरे राज्यों/मंडियों के ऑनलाइन व्यापारियों की बोली में से अपनी पसंद चुनें — सौदा अपनी स्थानीय मंडी में ही दर्ज होता है।',
      'मंडी में आवक की जानकारी, AI आधारित गुणवत्ता जांच (assaying), ई-बोली और सीधे किसान को ई-भुगतान।',
    ],
    documentsHi: [
      'ईमेल आईडी (ऑनलाइन पंजीकरण के लिए) — ईमेल न हो तो मंडी में पंजीकरण',
      'मंडी (APMC) पंजीकरण के लिए KYC विवरण',
    ],
    howToApplyHi: [
      'enam.gov.in पर पंजीकरण चुनें, Registration Type में "Farmer" और अपनी APMC मंडी चुनें, फिर सही ईमेल आईडी दें।',
      'ईमेल पर मिले अस्थायी लॉगिन से डैशबोर्ड खोलें और "Click here to register with APMC" पर क्लिक करके KYC पूरा करें।',
      'APMC से मंज़ूरी मिलने पर स्थायी लॉगिन आईडी (जैसे HR866F00001) और पासवर्ड मिलता है।',
      'ईमेल न हो तो अपनी ई-नाम मंडी (APMC) के कार्यालय में जाकर पंजीकरण कराएं।',
      'मदद के लिए ई-नाम हेल्पलाइन: 1800 270 0224',
    ],
    officialUrl: 'https://enam.gov.in',
    sourceUrls: [SRC.enamRegistration, SRC.enamFaq, SRC.pibResilient2026, SRC.pibAnnadata2026],
    lastVerified: REVIEWED,
  },
  {
    id: 'pdmc',
    name: 'Per Drop More Crop (PDMC) — Micro Irrigation',
    nameHi: 'पर ड्रॉप मोर क्रॉप (प्रति बूंद अधिक फसल) — ड्रिप/स्प्रिंकलर सिंचाई',
    category: 'irrigation',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'ड्रिप और स्प्रिंकलर जैसी सूक्ष्म सिंचाई लगाने पर सब्सिडी, ताकि कम पानी में ज़्यादा फसल हो। 2015-16 से चल रही यह योजना 2022-23 से PM-RKVY के तहत है।',
    eligibilityHi: [
      'सभी किसान; छोटे और सीमांत किसानों को ज़्यादा सहायता।',
      'पट्टे (lease) की ज़मीन या अनुबंध खेती करने वाले भी पात्र — कम से कम 7 साल का पट्टा अनुबंध दिखाना होगा।',
      'जिस खेत पर पहले सब्सिडी ली है, उस पर 7 साल (प्रणाली की अनुमानित उम्र) बाद ही दोबारा सब्सिडी; स्प्रिंकलर से ड्रिप में बदलने पर कम से कम 3 साल बाद अंतर की सब्सिडी मिल सकती है।',
    ],
    benefitsHi: [
      'छोटे-सीमांत किसानों को 55%, अन्य को 45% सहायता',
      'प्रति लाभार्थी अधिकतम 5 हेक्टेयर तक सहायता।',
      'सब्सिडी दिशानिर्देश की इकाई लागत तक सीमित; पूर्वोत्तर व हिमालयी राज्यों तथा जम्मू-कश्मीर व लद्दाख में 25% और कम सूक्ष्म सिंचाई वाले राज्यों में 15% अधिक इकाई लागत मानी जाती है।',
      'राशि DBT से आधार से जुड़े बैंक खाते में आती है। केवल BIS मार्क वाली प्रणाली और पुर्ज़े ही लगाए जाते हैं।',
    ],
    documentsHi: [
      'आधार (बायोमेट्रिक या चेहरे से आधार आधारित पंजीकरण)',
      'आधार से जुड़ा, DBT सक्षम सक्रिय बैंक खाता',
      'पट्टे की ज़मीन हो तो कम से कम 7 साल का पट्टा अनुबंध',
    ],
    howToApplyHi: [
      'अपने राज्य के कृषि/उद्यान विभाग के पोर्टल पर ऑनलाइन आवेदन करें — राज्यों के लिंक pdmc.da.gov.in पर "State PDMC Link" में हैं।',
      'राज्य में पंजीकृत कंपनी से BIS मार्क वाली ड्रिप/स्प्रिंकलर प्रणाली लगवाएं।',
      'लगने और सत्यापन के बाद सब्सिडी DBT से खाते में आती है।',
    ],
    officialUrl: 'https://pdmc.da.gov.in',
    sourceUrls: [SRC.pdmcGuidelines2025, SRC.pdmcPortal, SRC.pibResilient2026],
    // PDMC Operational Guidelines 2025 (PDF dated 15 Oct 2025), still listed as current on the portal.
    lastVerified: '2025-10-15',
  },
  {
    id: 'smam',
    name: 'Sub-Mission on Agricultural Mechanization (SMAM)',
    nameHi: 'कृषि यंत्रीकरण उप-मिशन (SMAM)',
    category: 'machinery',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'ट्रैक्टर, कृषि यंत्र और उपकरण खरीदने पर सब्सिडी, तथा किराये पर यंत्र देने वाले कस्टम हायरिंग सेंटर खोलने में मदद। यह RKVY का हिस्सा है; दिशानिर्देश अगस्त 2026 में संशोधित हुए।',
    eligibilityHi: [
      'किसान अपने नाम पर यंत्र खरीदने के लिए आवेदन कर सकते हैं; लाभार्थी राज्य/ज़िला नोडल एजेंसी पारदर्शी तरीके से चुनती है।',
      'आवेदन लक्ष्य से ज़्यादा हों तो राज्य ऑनलाइन लॉटरी से चयन करते हैं।',
      'कस्टम हायरिंग सेंटर: ग्रामीण युवा/किसान उद्यमी, SHG, FPO, पंचायत, PACS और किसान सहकारी समितियां।',
      'किसान ड्रोन कस्टम हायरिंग सेंटर के लिए 10वीं पास होना और प्रशिक्षित ड्रोन पायलट होना ज़रूरी है।',
    ],
    benefitsHi: [
      'यंत्र खरीद पर 40–50% सब्सिडी',
      'यंत्र की कीमत का 50% — छोटे व सीमांत, SC/ST, महिला किसान और पूर्वोत्तर व हिमालयी क्षेत्र के किसानों को; अन्य किसानों को 40%। हर यंत्र की अधिकतम सब्सिडी सीमा तय है।',
      'वन अधिकार अधिनियम (FRA) पट्टाधारकों को यंत्र लागत का 90% सहायता (लाभार्थी सूची जनजातीय कार्य मंत्रालय देता है)।',
      'कस्टम हायरिंग सेंटर: ₹250 लाख तक की परियोजना लागत का 40%। कृषि स्नातक द्वारा किसान ड्रोन केंद्र: ड्रोन की मूल कीमत का 50% या ₹5 लाख, जो कम हो।',
      'कम मशीनीकरण वाले क्षेत्रों के छोटे व सीमांत किसानों को कस्टम हायरिंग सेंटर/महिला SHG से ड्रोन किराये पर लेने के लिए ₹2,000 प्रति हेक्टेयर, साल में 2 हेक्टेयर तक, DBT से।',
    ],
    documentsHi: ['बैंक खाता (सब्सिडी DBT से सीधे खाते में आती है)', 'राज्य पोर्टल पर आवेदन के समय मांगी गई जानकारी'],
    howToApplyHi: [
      'अपने राज्य के कृषि विभाग के ऑनलाइन पोर्टल पर आवेदन करें; जिन राज्यों का अपना पोर्टल नहीं है वे केंद्रीय पोर्टल agrimachinery.nic.in से जुड़े हैं।',
      'चयन के बाद राज्य द्वारा सूचीबद्ध (empanelled) निर्माताओं में से अपनी पसंद का यंत्र चुनें और कीमत पर मोलभाव करें।',
      'सत्यापन के बाद सब्सिडी DBT से खाते में आती है।',
    ],
    officialUrl: 'https://agrimachinery.nic.in',
    sourceUrls: [SRC.smamGuidelines2026, SRC.smamDivision, SRC.pibResilient2026],
    lastVerified: REVIEWED,
  },
  {
    id: 'pkvy',
    name: 'Paramparagat Krishi Vikas Yojana (PKVY)',
    nameHi: 'परंपरागत कृषि विकास योजना (PKVY)',
    category: 'subsidy',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'समूह (क्लस्टर) में जैविक खेती अपनाने वाले किसानों को 3 साल में ₹31,500 प्रति हेक्टेयर की मदद — जैविक इनपुट, प्रमाणन, प्रशिक्षण और बिक्री के लिए।',
    eligibilityHi: [
      'सभी किसान और संस्थाएं आवेदन कर सकती हैं; सहायता अधिकतम 2 हेक्टेयर ज़मीन तक।',
      'किसान 20 हेक्टेयर के समूह (क्लस्टर) में मिलकर जैविक खेती अपनाते हैं।',
    ],
    benefitsHi: [
      '3 साल में ₹31,500 प्रति हेक्टेयर',
      'खेत पर/बाहर बने जैविक इनपुट: ₹15,000 (DBT से सीधे किसान को)।',
      'विपणन, पैकेजिंग व ब्रांडिंग: ₹4,500; प्रमाणन व अवशेष जांच: ₹3,000; प्रशिक्षण व क्षमता निर्माण: ₹9,000।',
      'PGS-India या NPOP (थर्ड पार्टी) से जैविक प्रमाणन; जैविक खेती पोर्टल (Jaivik Kheti) पर उपज सीधे ग्राहकों को बेचने की सुविधा।',
    ],
    documentsHi: ['ज़मीन का विवरण (सहायता अधिकतम 2 हेक्टेयर तक)', 'DBT के लिए बैंक खाता', 'क्षेत्रीय परिषद द्वारा मांगे गए अन्य दस्तावेज़'],
    howToApplyHi: [
      'अपनी क्षेत्रीय परिषद (Regional Council) से संपर्क करें — वही नामांकन और प्रमाणन में मार्गदर्शन करती है।',
      'परिषद आवेदनों को वार्षिक कार्य योजना में जोड़कर मंत्रालय को भेजती है; मंज़ूरी के बाद राशि केंद्र से राज्य और परिषद होते हुए DBT से किसान तक आती है।',
      'PGS-India प्रमाणन की जानकारी pgsindia-ncof.gov.in पर देखें।',
    ],
    officialUrl: 'https://pgsindia-ncof.gov.in',
    sourceUrls: [SRC.pibPkvy2025, SRC.pibAnnadata2026],
    // PIB backgrounder of 6 Oct 2025 is the newest document with the per-hectare figures.
    lastVerified: '2025-10-06',
  },
  {
    id: 'nmnf',
    name: 'National Mission on Natural Farming (NMNF)',
    nameHi: 'राष्ट्रीय प्राकृतिक खेती मिशन (NMNF)',
    category: 'subsidy',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'बिना रसायन की, पशुधन (देसी गाय) आधारित प्राकृतिक खेती को बढ़ावा। चुने गए क्लस्टरों में किसानों को प्रशिक्षण, कृषि सखी की मदद और प्रति एकड़ प्रोत्साहन राशि। मिशन की लागत व्यवस्था 2025-26 तक तय थी — नए नामांकन की स्थिति ज़िला कृषि कार्यालय से पक्की करें।',
    eligibilityHi: [
      'चुनी गई ग्राम पंचायतों के प्राकृतिक खेती क्लस्टर (लगभग 50 हेक्टेयर, करीब 125 किसान) के इच्छुक किसान।',
      'किसान उसी ग्राम पंचायत का निवासी हो और अपनी ज़मीन के एक हिस्से पर प्राकृतिक खेती शुरू करने को तैयार हो।',
      'जागरूकता बैठकों और KVK/कृषि विश्वविद्यालय के प्रशिक्षण में भाग ले, और 6 और किसानों को प्राकृतिक खेती सिखाने को तैयार हो।',
    ],
    benefitsHi: [
      'प्रशिक्षण और प्रति एकड़ प्रोत्साहन (2025-26 तक के नियम)',
      'दिशानिर्देश (फरवरी 2025) के अनुसार प्रशिक्षित किसानों को ₹4,000 प्रति एकड़ प्रति वर्ष, 2 साल तक परिणाम-आधारित प्रोत्साहन; सीखने के लिए प्रति किसान अधिकतम 1 एकड़ तक सहायता।',
      'KVK, कृषि विश्वविद्यालय और स्थानीय संस्थानों में प्रशिक्षण; गांव में कृषि सखी (CRP) की मदद।',
      'बायो-इनपुट रिसोर्स सेंटर (BRC) से जीवामृत, बीजामृत जैसे प्राकृतिक इनपुट।',
      'प्राकृतिक उपज के लिए सरल सहभागी प्रमाणन व्यवस्था और एक राष्ट्रीय ब्रांड बनाया जा रहा है।',
    ],
    documentsHi: ['प्रोत्साहन राशि के लिए बैंक खाता', 'जिस ज़मीन पर प्राकृतिक खेती करेंगे उसका विवरण'],
    howToApplyHi: [
      'अपनी ग्राम पंचायत की कृषि सखी या ब्लॉक कृषि/ATMA कार्यालय से संपर्क करें — कृषि सखी हर फसल मौसम की शुरुआत में इच्छुक किसानों का नामांकन करती हैं।',
      'प्रशिक्षण लेकर खेत के एक हिस्से पर प्राकृतिक खेती शुरू करें।',
      'राज्य नोडल अधिकारियों की सूची naturalfarming.dac.gov.in पर है।',
    ],
    officialUrl: 'https://naturalfarming.dac.gov.in',
    sourceUrls: [SRC.nmnfGuidelines, SRC.pibPmKisan23, SRC.pibAnnadata2026, SRC.pibResilient2026],
    // Incentive figures come from the guideline revised on 10 Feb 2025 (15th FC cost norms).
    lastVerified: '2025-02-10',
  },
  {
    id: 'pulses-mission',
    name: 'Mission for Aatmanirbharta in Pulses',
    nameHi: 'दलहन आत्मनिर्भरता मिशन',
    category: 'seed',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'दालों, खासकर अरहर (तुअर), उड़द और मसूर का उत्पादन बढ़ाने का मिशन (2025-26 से 2030-31): मुफ़्त बीज किट, प्रमाणित बीज और MSP पर पक्की खरीद।',
    eligibilityHi: [
      'दलहन उगाने वाले किसान; काम क्लस्टर के आधार पर भाग लेने वाले राज्यों में होता है।',
      'MSP पर 100% खरीद की सुविधा अरहर (तुअर), उड़द और मसूर के लिए, भाग लेने वाले राज्यों में।',
    ],
    benefitsHi: [
      'मुफ़्त बीज किट और प्रमाणित बीज',
      'किसानों में कुल 88 लाख मुफ़्त बीज किट और 126 लाख क्विंटल प्रमाणित बीज बांटे जाएंगे।',
      'अरहर, उड़द और मसूर की MSP पर 100% खरीद, 4 साल तक — NAFED और NCCF के ज़रिए (PM-AASHA के तहत)।',
      'ICAR, KVK और राज्य कृषि विभाग द्वारा बड़े पैमाने पर प्रदर्शन: मिट्टी स्वास्थ्य, यंत्रीकरण, संतुलित खाद और पौध संरक्षण।',
      'दाल प्रसंस्करण और पैकेजिंग की 1,000 इकाइयों के लिए प्रति इकाई ₹25 लाख तक सब्सिडी।',
    ],
    documentsHi: ['बीज किट और सरकारी खरीद के लिए दस्तावेज़ राज्य कृषि विभाग/खरीद एजेंसी तय करती है'],
    howToApplyHi: [
      'बीज किट और प्रदर्शन के लिए अपने ज़िले के कृषि विभाग या कृषि विज्ञान केंद्र (KVK) से संपर्क करें।',
      'MSP पर बिक्री के लिए अपने राज्य में NAFED/NCCF के खरीद केंद्र की जानकारी लें।',
      'प्रमाणित बीज की गुणवत्ता और असलियत SATHI पोर्टल (seedtrace.gov.in) से जांची जाती है।',
    ],
    officialUrl: SRC.pibPulses2025,
    sourceUrls: [SRC.pibPulses2025, SRC.pibResilient2026, SRC.pibAnnadata2026],
    // PIB backgrounder of 11 Oct 2025 (launch day) is the newest document with these figures.
    lastVerified: '2025-10-11',
  },
  {
    id: 'smsp',
    name: 'Sub-Mission on Seeds and Planting Material (SMSP)',
    nameHi: 'बीज एवं रोपण सामग्री उप-मिशन (SMSP)',
    category: 'seed',
    ministry: MINISTRY_AGRI,
    summaryHi:
      'किसानों तक प्रमाणित और अच्छी गुणवत्ता का बीज पहुंचाने वाली केंद्र प्रायोजित योजना। बीज ग्राम कार्यक्रम में किसान अपने खेत पर अच्छा बीज तैयार करना और रखना सीखते हैं। देश में लगभग 6.85 लाख बीज ग्राम बनाए जा चुके हैं।',
    eligibilityHi: [
      'राज्य की कार्यान्वयन एजेंसी द्वारा बीज ग्राम कार्यक्रम के लिए चुने गए किसान; लाभार्थी किसानों की सूची राज्य सरकार की वेबसाइट पर डाली जाती है।',
      'सहायता केवल प्रमाणित/गुणवत्तापूर्ण बीज तैयार करने के लिए है।',
    ],
    benefitsHi: [
      'बीज ग्राम में आधार/प्रमाणित बीज पर 50–60% सहायता',
      'अनाज फसलों के आधार/प्रमाणित बीज पर 50%, और दलहन, तिलहन, चारा व हरी खाद फसलों पर 60% सहायता — प्रति किसान 1 एकड़ के बीज तक।',
      'बीज उत्पादन और कटाई के बाद बीज तकनीक पर किसान समूहों (50–150 किसान) को प्रशिक्षण।',
      'बीज भंडारण बिन पर 25% (SC/ST किसानों को 33%) सहायता: 10 क्विंटल बिन पर अधिकतम ₹1,000 (SC/ST ₹1,500), 20 क्विंटल बिन पर अधिकतम ₹2,000 (SC/ST ₹3,000); हर किसान को एक बिन।',
    ],
    documentsHi: ['दस्तावेज़ों की सूची राज्य कृषि विभाग तय करता है — ब्लॉक/ज़िला कृषि कार्यालय से पूछें'],
    howToApplyHi: [
      'यह केंद्र प्रायोजित योजना राज्यों के ज़रिए चलती है — बीज ग्राम कार्यक्रम के लिए अपने ब्लॉक या ज़िला कृषि कार्यालय से संपर्क करें।',
      'सहायता की दरें 2014 के परिचालन दिशानिर्देश के अनुसार हैं — ताज़ा दरें अपने कृषि कार्यालय से पक्की करें।',
    ],
    officialUrl: SRC.seedsDivision,
    sourceUrls: [SRC.smspGuidelines2014, SRC.seedsDivision, SRC.pibResilient2026, SRC.pibAnnadata2026],
    // Rates come from the SMSP guideline of 13 May 2014, the newest one the Seeds Division publishes.
    lastVerified: '2014-05-13',
  },
];

// Extra search words (Hinglish, English, common Hindi synonyms) so farmers can find a
// scheme by what they call it, e.g. "fasal bima", "पेंशन", "ड्रिप". Generic words like
// "subsidy" go only on schemes that actually pay one, so "tractor subsidy" finds SMAM.
const SUBSIDY_WORDS = ['subsidy', 'सब्सिडी', 'अनुदान'];
const SEARCH_ALIASES: Record<string, string[]> = {
  'pm-kisan': ['pm kisan', 'pmkisan', 'kisan samman nidhi', 'सम्मान निधि', '6000', 'किस्त', 'kist', 'e-kyc', 'ekyc', 'ई-केवाईसी'],
  pmfby: ['fasal bima', 'crop insurance', 'फसल बीमा', 'प्रीमियम', 'नुकसान', 'krishi rakshak', 'कृषि रक्षक', '14447', 'जंगली जानवर', 'wild animal'],
  kcc: [
    'kcc', 'kisan credit card', 'loan', 'karz', 'कर्ज', 'कर्ज़', 'लोन', 'ब्याज', 'miss', 'interest subvention',
    'dairy', 'डेयरी', 'पशुपालन', 'fisheries', 'मछली पालन',
  ],
  'pm-kmy': ['pension', 'पेंशन', 'maandhan', 'mandhan', 'मानधन', 'kisan pension', 'बुढ़ापा'],
  'soil-health-card': ['shc', 'soil test', 'soil health', 'मिट्टी जांच', 'मिट्टी', 'मृदा', 'mitti'],
  'e-nam': ['enam', 'mandi', 'मंडी', 'online mandi', 'ऑनलाइन मंडी', 'बाज़ार', 'bazar', 'बेचना', 'भाव', 'bhav'],
  pdmc: ['pmksy', 'drip', 'sprinkler', 'ड्रिप', 'स्प्रिंकलर', 'फव्वारा', 'micro irrigation', 'सूक्ष्म सिंचाई', 'कृषि सिंचाई योजना', ...SUBSIDY_WORDS],
  smam: ['tractor', 'ट्रैक्टर', 'यंत्र', 'मशीन', 'machine', 'custom hiring', 'कस्टम हायरिंग', 'drone', 'ड्रोन', ...SUBSIDY_WORDS],
  pkvy: ['organic', 'जैविक', 'jaivik', 'pgs', 'जैविक खेती', ...SUBSIDY_WORDS],
  nmnf: ['natural farming', 'प्राकृतिक खेती', 'जीवामृत', 'krishi sakhi', 'कृषि सखी', 'देसी गाय', ...SUBSIDY_WORDS],
  'pulses-mission': [
    'dal', 'दाल', 'दलहन', 'pulses', 'arhar', 'tur', 'अरहर', 'तुअर', 'उड़द', 'urad', 'मसूर', 'masoor', 'seed kit', 'बीज किट', 'msp',
    ...SUBSIDY_WORDS,
  ],
  smsp: ['seed', 'बीज', 'बीज ग्राम', 'seed village', 'प्रमाणित बीज', 'beej', ...SUBSIDY_WORDS],
};

const BY_ID = new Map(SCHEMES.map(s => [s.id, s]));
const CATEGORY_BY_ID = new Map(SCHEME_CATEGORIES.map(c => [c.id, c]));

export function getScheme(id: string): GovernmentScheme | undefined {
  return BY_ID.get(id);
}

export function getSchemeCategory(id: SchemeCategory): SchemeCategoryDef {
  // Every SchemeCategory has an entry, so the fallback only guards future model changes.
  return CATEGORY_BY_ID.get(id) ?? SCHEME_CATEGORIES[0];
}

/** Schemes in one category, in catalog order. 'all' returns every scheme. */
export function schemesByCategory(cat: SchemeCategory | 'all'): GovernmentScheme[] {
  return cat === 'all' ? [...SCHEMES] : SCHEMES.filter(s => s.category === cat);
}

// Folds the spelling variants farmers type: case, nukta (ज़/ज), chandrabindu (ँ/ं),
// zero-width joiners, digit-group commas ("6,000" = "6000") and punctuation, so "जमीन"
// matches "ज़मीन". There is no transliteration: Latin queries such as "zameen" match
// only the English names and the aliases above.
function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‌‍़]/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

interface SearchIndexEntry {
  scheme: GovernmentScheme;
  title: string;
  body: string;
  /** body without spaces, so "pmkisan" matches "pm kisan". */
  squashed: string;
}

const SEARCH_INDEX: SearchIndexEntry[] = SCHEMES.map(scheme => {
  const cat = getSchemeCategory(scheme.category);
  const title = normalize([scheme.name, scheme.nameHi, ...(SEARCH_ALIASES[scheme.id] ?? [])].join(' '));
  const body = normalize(
    [title, cat.labelHi, cat.labelEn, scheme.summaryHi, ...scheme.benefitsHi, ...scheme.eligibilityHi].join(' '),
  );
  return { scheme, title, body, squashed: body.replace(/ /g, '') };
});

/**
 * Free-text search over names, aliases, category labels, summary, benefits and
 * eligibility. Every query word must match; name/alias hits rank first. An empty
 * query returns all schemes.
 */
export function searchSchemes(query: string): GovernmentScheme[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [...SCHEMES];
  const hits: { scheme: GovernmentScheme; score: number; order: number }[] = [];
  SEARCH_INDEX.forEach((entry, order) => {
    let score = 0;
    for (const t of tokens) {
      if (entry.title.includes(t)) score += 3;
      else if (entry.body.includes(t) || entry.squashed.includes(t)) score += 1;
      else return;
    }
    hits.push({ scheme: entry.scheme, score, order });
  });
  return hits.sort((a, b) => b.score - a.score || a.order - b.order).map(h => h.scheme);
}
