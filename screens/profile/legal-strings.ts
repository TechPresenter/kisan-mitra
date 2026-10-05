// Privacy policy and terms for Kisan Mitra 2.0 (prefixes "profile.privacy." / "profile.terms.").
// Hindi is the primary text; English mirrors it. Loaded only with PrivacyScreen / TermsScreen.
//
// Facts these texts rely on (keep them true when the app changes):
// - All app data lives on the device (lib/store, localStorage "km:v2:*"); there is no server account.
// - AI: questions, compressed photos, crop details and approximate place (district/state) go to
//   the AI service (services/ai): Google Gemini directly (VITE_GEMINI_API_KEY), or through the app's
//   own server (server.ts, server/ai-generate.ts), which forwards without storing to Gemini, or to
//   Anthropic Claude when GEMINI_API_KEY is not set. Mandi prices use AI web search and also send
//   coordinates rounded to 2 decimals (~1 km; services/mandi buildPrompt).
// - Contact: no official support email/number yet (screens/profile/helpers SUPPORT_EMAIL is null),
//   so these texts must not name one.
// - Weather: Open-Meteo (services/weather). Place search: Open-Meteo geocoding; reverse
//   geocoding: BigDataCloud with coordinates rounded to ~100 m (services/location).
// - Analytics: anonymous event counters only (lib/analytics). No ads, no selling of data.
import { registerStrings } from '../../lib/i18n';
import '../../lib/common-strings';

export interface LegalSection {
  id: string;
  /** Number of paragraphs before the list: <prefix>.<id>.p1 … pN */
  paragraphs?: number;
  /** Number of bullets: <prefix>.<id>.b1 … bN */
  bullets?: number;
  /** Paragraph after the list: <prefix>.<id>.after */
  after?: boolean;
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  { id: 'stored', paragraphs: 1, bullets: 5 },
  { id: 'sent', paragraphs: 1, bullets: 6 },
  { id: 'never', bullets: 4 },
  { id: 'analytics', paragraphs: 1 },
  { id: 'permissions', bullets: 4, after: true },
  { id: 'google', paragraphs: 1 },
  { id: 'control', bullets: 3 },
  { id: 'safety', paragraphs: 1 },
  { id: 'changes', paragraphs: 1 },
];

export const TERMS_SECTIONS: LegalSection[] = [
  { id: 'about', paragraphs: 1 },
  { id: 'ai', bullets: 3 },
  { id: 'chemicals', bullets: 3 },
  { id: 'prices', paragraphs: 1 },
  { id: 'weather', paragraphs: 1 },
  { id: 'schemes', paragraphs: 1 },
  { id: 'yours', bullets: 3 },
  { id: 'service', paragraphs: 1 },
  { id: 'liability', paragraphs: 1 },
  { id: 'changes', paragraphs: 1 },
];

registerStrings({
  hi: {
    'profile.legal.effective': 'लागू तिथि: 5 अक्टूबर 2026',
    'profile.legal.summary': 'संक्षेप में',
    'profile.legal.listenAll': 'पूरा सुनें',

    // ---------- Privacy ----------
    'profile.privacy.title': 'निजता नीति',
    'profile.privacy.subtitle': 'आपकी जानकारी कैसे संभाली जाती है',
    'profile.privacy.intro':
      'किसान मित्र आपकी निजता का पूरा ध्यान रखता है। यहां आसान भाषा में बताया गया है कि ऐप कौन-सी जानकारी रखता है, इंटरनेट पर क्या भेजता है और क्यों।',
    'profile.privacy.summary1': 'आपकी जानकारी इसी फ़ोन में रहती है।',
    'profile.privacy.summary2': 'हम आपका डेटा किसी को नहीं बेचते।',
    'profile.privacy.summary3': 'ऐप में कोई विज्ञापन नहीं है।',
    'profile.privacy.summary4': 'आप कभी भी अपना सारा डेटा डाउनलोड कर सकते हैं या हटा सकते हैं।',

    'profile.privacy.stored.title': '1. आपके फ़ोन में क्या सेव होता है',
    'profile.privacy.stored.p1':
      'ऐप चलाने के लिए यह जानकारी सिर्फ़ इसी फ़ोन में ऐप की अपनी स्टोरेज में रखी जाती है। ऐप में कोई ऑनलाइन खाता नहीं है और हम यह जानकारी अपने किसी सर्वर पर जमा नहीं करते।',
    'profile.privacy.stored.b1': 'नाम, मोबाइल नंबर या ईमेल, गांव, ज़िला और राज्य',
    'profile.privacy.stored.b2': 'खेत, फसलें, बुवाई की तारीख और काम की सूची',
    'profile.privacy.stored.b3': 'खर्च-आय का हिसाब और मिट्टी जांच की रिपोर्ट',
    'profile.privacy.stored.b4': 'AI से पूछे गए सवाल-जवाब और फसल डॉक्टर की जांच (फोटो छोटे आकार में)',
    'profile.privacy.stored.b5': 'सेव की गई जानकारी, सूचनाएं और आपकी सेटिंग्स',

    'profile.privacy.sent.title': '2. इंटरनेट पर क्या भेजा जाता है और क्यों',
    'profile.privacy.sent.p1':
      'कुछ सुविधाओं के लिए ज़रूरी जानकारी बाहरी सेवाओं को भेजी जाती है, ताकि वे आपको जवाब दे सकें। इन सेवाओं की अपनी निजता नीतियां हैं।',
    'profile.privacy.sent.b1':
      'AI सलाह और फसल डॉक्टर: आपका सवाल, फसल की फोटो (छोटी करके), फसल की जानकारी और आपकी अनुमानित जगह (ज़िला/राज्य) AI सेवा (Google Gemini) को भेजी जाती है।',
    'profile.privacy.sent.b2':
      'मंडी भाव: फसल का नाम, आपका ज़िला और आपकी अनुमानित जगह (लगभग 1 किमी तक) AI सेवा को भेजे जाते हैं, जो इंटरनेट पर खोजकर ताज़ा भाव लाती है।',
    'profile.privacy.sent.b3': 'मौसम: आपकी चुनी हुई जगह के अनुमानित निर्देशांक (latitude/longitude) Open-Meteo को भेजे जाते हैं।',
    'profile.privacy.sent.b4':
      'जगह खोजना और पहचानना: आपका लिखा या बोला जगह का नाम Open-Meteo को, और GPS से मिली जगह (लगभग 100 मीटर तक गोल करके) BigDataCloud को भेजी जाती है, ताकि गांव/ज़िले का नाम पता चले।',
    'profile.privacy.sent.b5': 'बोलकर लिखना: आपकी आवाज़ को फ़ोन की आवाज़-पहचान सेवा (जैसे Google) शब्दों में बदलती है।',
    'profile.privacy.sent.b6':
      'वेब पर (और जहां ऐप किसान मित्र के सर्वर से जुड़ता है) AI वाले सवाल हमारे सर्वर से होकर AI सेवा तक जाते हैं। सर्वर इन्हें सिर्फ़ आगे भेजता है, सेव नहीं करता। वहां AI सेवा Google Gemini या Anthropic Claude हो सकती है।',

    'profile.privacy.never.title': '3. जो हम कभी नहीं करते',
    'profile.privacy.never.b1': 'आपकी जानकारी किसी को नहीं बेचते।',
    'profile.privacy.never.b2': 'ऐप में विज्ञापन नहीं दिखाते और विज्ञापन कंपनियों को आपकी जानकारी नहीं देते।',
    'profile.privacy.never.b3': 'आपकी फोटो, सवाल या हिसाब दूसरे किसानों को नहीं दिखाते।',
    'profile.privacy.never.b4': 'आपकी जगह लगातार ट्रैक नहीं करते — GPS सिर्फ़ तब लेते हैं जब आप खुद जगह पता करने को कहते हैं।',

    'profile.privacy.analytics.title': '4. ऐप के इस्तेमाल की गिनती',
    'profile.privacy.analytics.p1':
      'ऐप को बेहतर बनाने के लिए सिर्फ़ गुमनाम गिनती रखी जाती है — जैसे कौन-सी सुविधा कितनी बार खोली गई। इसमें आपका नाम, नंबर, फोटो, सही जगह या आपके लिखे शब्द कभी शामिल नहीं होते।',

    'profile.privacy.permissions.title': '5. फ़ोन की अनुमतियां',
    'profile.privacy.permissions.b1': 'जगह (Location): आपके इलाके का मौसम और मंडी भाव दिखाने के लिए।',
    'profile.privacy.permissions.b2': 'कैमरा और गैलरी: फसल डॉक्टर में फसल की फोटो लेने के लिए।',
    'profile.privacy.permissions.b3': 'माइक्रोफ़ोन: बोलकर सवाल पूछने के लिए।',
    'profile.privacy.permissions.b4': 'सूचनाएं: मौसम की चेतावनी और काम की याद दिलाने के लिए।',
    'profile.privacy.permissions.after':
      'हर अनुमति आप कभी भी फ़ोन की सेटिंग से बंद कर सकते हैं। अनुमति न देने पर भी बाकी ऐप चलता रहेगा।',

    'profile.privacy.google.title': '6. Google से लॉगिन',
    'profile.privacy.google.p1':
      'अगर आप वेब पर Google से लॉगिन करते हैं, तो Google आपका नाम, ईमेल और प्रोफाइल फोटो ऐप को देता है। यह जानकारी भी सिर्फ़ इसी डिवाइस में रहती है।',

    'profile.privacy.control.title': '7. आपका नियंत्रण',
    'profile.privacy.control.b1': 'प्रोफाइल में अपनी जानकारी कभी भी बदलें।',
    'profile.privacy.control.b2': 'सेटिंग्स → "मेरा डेटा डाउनलोड करें" से अपनी सारी जानकारी की कॉपी लें।',
    'profile.privacy.control.b3':
      'सेटिंग्स → "सारा डेटा हटाएं" या लॉगआउट करने पर इस फ़ोन से सब कुछ हट जाता है। ऐप अनइंस्टॉल करने पर भी डेटा हट जाता है।',

    'profile.privacy.safety.title': '8. सुरक्षा के लिए सलाह',
    'profile.privacy.safety.p1':
      'फ़ोन पर स्क्रीन लॉक ज़रूर लगाएं। AI से सवाल पूछते समय आधार नंबर, बैंक खाता, OTP या पासवर्ड कभी न लिखें।',

    'profile.privacy.changes.title': '9. बदलाव और संपर्क',
    'profile.privacy.changes.p1':
      'इस नीति में बदलाव होने पर ऐप में नई लागू तिथि दिखाई जाएगी। अभी ऐप में संपर्क का सीधा माध्यम (ईमेल या फ़ोन नंबर) नहीं है; यह जुड़ते ही इसी पेज और सहायता केंद्र में दिखाया जाएगा।',

    // ---------- Terms ----------
    'profile.terms.title': 'नियम व शर्तें',
    'profile.terms.subtitle': 'ऐप इस्तेमाल करने के नियम',
    'profile.terms.intro':
      'किसान मित्र इस्तेमाल करने से पहले ये नियम ध्यान से पढ़ें। ऐप इस्तेमाल करके आप इन नियमों से सहमत होते हैं।',
    'profile.terms.summary1': 'AI की सलाह मार्गदर्शन है, गारंटी नहीं।',
    'profile.terms.summary2': 'दवा या रसायन से पहले विशेषज्ञ से पूछें।',
    'profile.terms.summary3': 'मंडी भाव अनुमानित हैं — बेचने से पहले मंडी में पुष्टि करें।',
    'profile.terms.summary4': 'खेत में आखिरी फ़ैसला आपका होता है।',

    'profile.terms.about.title': '1. यह ऐप क्या है',
    'profile.terms.about.p1':
      'किसान मित्र किसानों को खेती की जानकारी और सलाह देने वाला ऐप है। यह कोई सरकारी ऐप नहीं है और किसी सरकारी विभाग की ओर से काम नहीं करता।',

    'profile.terms.ai.title': '2. AI सलाह सिर्फ़ मार्गदर्शन है',
    'profile.terms.ai.b1': 'AI से मिली सलाह, रोग की पहचान और खाद की मात्रा एक शुरुआती सुझाव है, पक्की गारंटी नहीं। AI से गलती हो सकती है।',
    'profile.terms.ai.b2': 'खेत में क्या करना है, इसका आखिरी फ़ैसला आपका है। गंभीर समस्या में कृषि विशेषज्ञ से सलाह लें।',
    'profile.terms.ai.b3': 'खाद की सही मात्रा के लिए अपना मृदा स्वास्थ्य कार्ड (Soil Health Card) और स्थानीय कृषि अधिकारी की सलाह मानें।',

    'profile.terms.chemicals.title': '3. दवा और रसायन',
    'profile.terms.chemicals.b1': 'कोई भी कीटनाशक या रासायनिक दवा छिड़कने से पहले कृषि विज्ञान केंद्र (KVK) या कृषि अधिकारी से पुष्टि करें।',
    'profile.terms.chemicals.b2': 'दवा के डिब्बे पर लिखी मात्रा और सावधानी का ही पालन करें। छिड़काव के समय दस्ताने, मास्क और पूरे कपड़े पहनें।',
    'profile.terms.chemicals.b3': 'सिर्फ़ भारत में मंज़ूर दवाएं ही इस्तेमाल करें।',

    'profile.terms.prices.title': '4. मंडी भाव',
    'profile.terms.prices.p1':
      'भाव इंटरनेट स्रोतों पर आधारित अनुमान हैं और देर से अपडेट हो सकते हैं। बेचने से पहले अपनी मंडी में भाव पक्का करें। भविष्य के भाव या मुनाफ़े की कोई गारंटी नहीं है।',

    'profile.terms.weather.title': '5. मौसम',
    'profile.terms.weather.p1':
      'मौसम का अनुमान Open-Meteo से आता है और बदल सकता है। ज़रूरी फ़ैसलों से पहले भारत मौसम विज्ञान विभाग (IMD) की चेतावनी भी देखें।',

    'profile.terms.schemes.title': '6. सरकारी योजनाएं',
    'profile.terms.schemes.p1':
      'योजनाओं की जानकारी आधिकारिक वेबसाइटों से लेकर आसान भाषा में दी गई है, पर नियम बदल सकते हैं। आवेदन से पहले आधिकारिक पोर्टल या सरकारी दफ़्तर से पुष्टि करें। किसान मित्र आपकी ओर से कोई आवेदन जमा नहीं करता।',

    'profile.terms.yours.title': '7. आपकी ज़िम्मेदारी',
    'profile.terms.yours.b1': 'ऐप का इस्तेमाल सिर्फ़ कानूनी और खेती से जुड़े कामों के लिए करें।',
    'profile.terms.yours.b2': 'दूसरों की निजी जानकारी या जानबूझकर गलत जानकारी न डालें।',
    'profile.terms.yours.b3': 'अपने फ़ोन और उसमें रखे डेटा की सुरक्षा आपकी ज़िम्मेदारी है।',

    'profile.terms.service.title': '8. सेवा और बदलाव',
    'profile.terms.service.p1':
      'ऐप की कुछ सुविधाएं इंटरनेट और बाहरी सेवाओं पर चलती हैं, जो कभी-कभी बंद या धीमी हो सकती हैं। हम ऐप की सुविधाएं बदल, जोड़ या हटा सकते हैं।',

    'profile.terms.liability.title': '9. ज़िम्मेदारी की सीमा',
    'profile.terms.liability.p1':
      'ऐप की जानकारी पर भरोसा करके लिए गए फ़ैसलों से हुए फसल, पैसे या दूसरे नुकसान के लिए किसान मित्र ज़िम्मेदार नहीं होगा। हमेशा अपनी समझ और स्थानीय विशेषज्ञ की सलाह से काम करें।',

    'profile.terms.changes.title': '10. नियमों में बदलाव',
    'profile.terms.changes.p1':
      'नियम बदलने पर ऐप में नई लागू तिथि दिखेगी। बदलाव के बाद भी ऐप इस्तेमाल करते रहने का मतलब है कि आप नए नियमों से सहमत हैं।',
  },
  en: {
    'profile.legal.effective': 'Effective date: 5 October 2026',
    'profile.legal.summary': 'In short',
    'profile.legal.listenAll': 'Listen to all',

    // ---------- Privacy ----------
    'profile.privacy.title': 'Privacy policy',
    'profile.privacy.subtitle': 'How your information is handled',
    'profile.privacy.intro':
      'Kisan Mitra takes your privacy seriously. This page explains in simple words what the app keeps, what it sends over the internet and why.',
    'profile.privacy.summary1': 'Your information stays on this phone.',
    'profile.privacy.summary2': 'We never sell your data.',
    'profile.privacy.summary3': 'There are no ads in the app.',
    'profile.privacy.summary4': 'You can download or delete all your data at any time.',

    'profile.privacy.stored.title': '1. What is saved on your phone',
    'profile.privacy.stored.p1':
      'To run the app, this information is kept only in the app’s own storage on this phone. There is no online account, and we do not keep this information on any server of ours.',
    'profile.privacy.stored.b1': 'Name, mobile number or email, village, district and state',
    'profile.privacy.stored.b2': 'Farms, crops, sowing dates and task lists',
    'profile.privacy.stored.b3': 'Expense and income records and soil test reports',
    'profile.privacy.stored.b4': 'Questions and answers from the AI and Crop Doctor checks (photos in small size)',
    'profile.privacy.stored.b5': 'Saved items, notifications and your settings',

    'profile.privacy.sent.title': '2. What is sent over the internet, and why',
    'profile.privacy.sent.p1':
      'Some features send the information they need to outside services so that they can answer you. These services have their own privacy policies.',
    'profile.privacy.sent.b1':
      'AI advice and Crop Doctor: your question, the crop photo (made smaller), crop details and your approximate place (district/state) are sent to the AI service (Google Gemini).',
    'profile.privacy.sent.b2':
      'Mandi prices: the crop name, your district and your approximate location (to about 1 km) are sent to the AI service, which searches the internet for recent prices.',
    'profile.privacy.sent.b3': 'Weather: approximate coordinates (latitude/longitude) of your chosen place are sent to Open-Meteo.',
    'profile.privacy.sent.b4':
      'Finding your place: a place name you type or speak is sent to Open-Meteo, and a GPS location (rounded to about 100 metres) is sent to BigDataCloud to find the village/district name.',
    'profile.privacy.sent.b5': "Voice typing: your phone's speech recognition service (such as Google) turns your voice into text.",
    'profile.privacy.sent.b6':
      "On the web (and wherever the app connects to Kisan Mitra's server), AI questions pass through our server on their way to the AI service. The server only forwards them and does not save them. There, the AI service may be Google Gemini or Anthropic Claude.",

    'profile.privacy.never.title': '3. What we never do',
    'profile.privacy.never.b1': 'We never sell your information.',
    'profile.privacy.never.b2': 'We do not show ads or give your information to advertising companies.',
    'profile.privacy.never.b3': 'We do not show your photos, questions or accounts to other farmers.',
    'profile.privacy.never.b4': 'We do not track your location continuously — GPS is used only when you ask the app to find your place.',

    'profile.privacy.analytics.title': '4. Usage counts',
    'profile.privacy.analytics.p1':
      'To improve the app, only anonymous counts are kept — such as how often a feature was opened. They never include your name, number, photos, exact location or anything you typed.',

    'profile.privacy.permissions.title': '5. Phone permissions',
    'profile.privacy.permissions.b1': 'Location: to show weather and mandi prices for your area.',
    'profile.privacy.permissions.b2': 'Camera and gallery: to take crop photos for the Crop Doctor.',
    'profile.privacy.permissions.b3': 'Microphone: to ask questions by voice.',
    'profile.privacy.permissions.b4': 'Notifications: for weather warnings and task reminders.',
    'profile.privacy.permissions.after':
      'You can turn off any permission at any time in your phone settings. The rest of the app keeps working without it.',

    'profile.privacy.google.title': '6. Signing in with Google',
    'profile.privacy.google.p1':
      'If you sign in with Google on the web, Google shares your name, email and profile photo with the app. This too stays only on this device.',

    'profile.privacy.control.title': '7. Your control',
    'profile.privacy.control.b1': 'Change your details in Profile at any time.',
    'profile.privacy.control.b2': 'Settings → "Download my data" gives you a copy of all your information.',
    'profile.privacy.control.b3':
      'Settings → "Delete all data", or logging out, removes everything from this phone. Uninstalling the app also removes the data.',

    'profile.privacy.safety.title': '8. Safety tips',
    'profile.privacy.safety.p1':
      'Keep a screen lock on your phone. Never type your Aadhaar number, bank account, OTP or passwords when asking the AI.',

    'profile.privacy.changes.title': '9. Changes and contact',
    'profile.privacy.changes.p1':
      'If this policy changes, the app will show a new effective date. The app does not yet have a direct contact channel (email or phone number); it will be shown on this page and in the Help centre as soon as it is added.',

    // ---------- Terms ----------
    'profile.terms.title': 'Terms & conditions',
    'profile.terms.subtitle': 'Rules for using the app',
    'profile.terms.intro': 'Please read these terms before using Kisan Mitra. By using the app you agree to them.',
    'profile.terms.summary1': 'AI advice is guidance, not a guarantee.',
    'profile.terms.summary2': 'Ask an expert before using pesticides or chemicals.',
    'profile.terms.summary3': 'Mandi prices are indicative — confirm at the mandi before selling.',
    'profile.terms.summary4': 'The final decision on your farm is yours.',

    'profile.terms.about.title': '1. What this app is',
    'profile.terms.about.p1':
      'Kisan Mitra is an app that gives farmers farming information and advice. It is not a government app and does not act on behalf of any government department.',

    'profile.terms.ai.title': '2. AI advice is only guidance',
    'profile.terms.ai.b1': 'AI advice, disease identification and fertiliser doses are preliminary suggestions, not guarantees. The AI can make mistakes.',
    'profile.terms.ai.b2': 'The final decision about your farm is yours. For serious problems, consult an agriculture expert.',
    'profile.terms.ai.b3': 'For exact fertiliser doses, follow your Soil Health Card and your local agriculture officer.',

    'profile.terms.chemicals.title': '3. Pesticides and chemicals',
    'profile.terms.chemicals.b1': 'Before spraying any pesticide or chemical, confirm with your Krishi Vigyan Kendra (KVK) or agriculture officer.',
    'profile.terms.chemicals.b2': 'Follow only the dose and precautions on the label. Wear gloves, a mask and full clothing while spraying.',
    'profile.terms.chemicals.b3': 'Use only products approved in India.',

    'profile.terms.prices.title': '4. Mandi prices',
    'profile.terms.prices.p1':
      'Prices are estimates based on internet sources and may be delayed. Confirm the price at your mandi before selling. Future prices or profits are not guaranteed.',

    'profile.terms.weather.title': '5. Weather',
    'profile.terms.weather.p1':
      'Weather forecasts come from Open-Meteo and can change. Before important decisions, also check warnings from the India Meteorological Department (IMD).',

    'profile.terms.schemes.title': '6. Government schemes',
    'profile.terms.schemes.p1':
      'Scheme information is taken from official websites and written in simple language, but rules can change. Confirm on the official portal or at a government office before applying. Kisan Mitra does not submit any application on your behalf.',

    'profile.terms.yours.title': '7. Your responsibilities',
    'profile.terms.yours.b1': 'Use the app only for lawful, farming-related purposes.',
    'profile.terms.yours.b2': "Do not enter other people's personal information or knowingly false information.",
    'profile.terms.yours.b3': 'Keeping your phone and the data on it safe is your responsibility.',

    'profile.terms.service.title': '8. Service and changes',
    'profile.terms.service.p1':
      'Some features depend on the internet and outside services, which can sometimes be down or slow. We may change, add or remove features.',

    'profile.terms.liability.title': '9. Limitation of liability',
    'profile.terms.liability.p1':
      'Kisan Mitra is not responsible for crop, financial or other losses from decisions taken by relying on information in the app. Always use your own judgement and the advice of local experts.',

    'profile.terms.changes.title': '10. Changes to these terms',
    'profile.terms.changes.p1':
      'If these terms change, the app will show a new effective date. Continuing to use the app after a change means you accept the new terms.',
  },
});
