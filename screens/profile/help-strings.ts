// Strings for the Help centre (prefix "profile.help."). Loaded only with HelpScreen.
import { registerStrings } from '../../lib/i18n';
import '../../lib/common-strings';

/** FAQ ids in display order; each has profile.help.faq.<id>.q and .a */
export const FAQ_IDS = ['addCrop', 'doctor', 'doctorLimits', 'prices', 'offline', 'language', 'location', 'reminders', 'voice', 'data'] as const;

registerStrings({
  hi: {
    'profile.help.title': 'सहायता केंद्र',
    'profile.help.subtitle': 'सवाल-जवाब और मदद',
    'profile.help.callTitle': 'किसी से बात करनी है?',
    'profile.help.guides': 'ऐप कैसे इस्तेमाल करें',
    'profile.help.guide.addCrop': 'फसल जोड़ें',
    'profile.help.guide.addCropDesc': 'रोज़ की सलाह पाएं',
    'profile.help.guide.doctor': 'फसल डॉक्टर',
    'profile.help.guide.doctorDesc': 'फोटो से रोग पहचानें',
    'profile.help.guide.ai': 'AI से पूछें',
    'profile.help.guide.aiDesc': 'लिखकर या बोलकर',
    'profile.help.guide.mandi': 'मंडी भाव',
    'profile.help.guide.mandiDesc': 'आज के अनुमानित भाव',
    'profile.help.guide.weather': 'मौसम',
    'profile.help.guide.weatherDesc': 'स्प्रे का सही समय',
    'profile.help.guide.hisab': 'खेती हिसाब',
    'profile.help.guide.hisabDesc': 'खर्च और आय लिखें',
    'profile.help.faq': 'अक्सर पूछे जाने वाले सवाल',

    'profile.help.faq.addCrop.q': 'नई फसल कैसे जोड़ें?',
    'profile.help.faq.addCrop.a':
      'प्रोफाइल में "मेरी फसलें" खोलें और "नई फसल जोड़ें" दबाएं। फसल चुनें, बुवाई की तारीख और ज़मीन लिखें, फिर सेव करें। इसके बाद ऐप उस फसल के लिए रोज़ की सलाह और काम की सूची दिखाएगा।',
    'profile.help.faq.doctor.q': 'फसल डॉक्टर कैसे काम करता है?',
    'profile.help.faq.doctor.a':
      'बीमार पत्ती या पौधे की साफ़ फोटो लें — दिन की रोशनी में, एक पत्ती पूरे फ्रेम में। AI फोटो देखकर संभावित रोग या कीट, उसके लक्षण और उपाय बताता है। फोटो छोटी करके AI सेवा को भेजी जाती है, इसलिए इंटरनेट चाहिए।',
    'profile.help.faq.doctorLimits.q': 'क्या फसल डॉक्टर का जवाब पक्का होता है?',
    'profile.help.faq.doctorLimits.a':
      'नहीं। यह AI का अनुमान है, लैब जांच नहीं। धुंधली फोटो, एक साथ कई रोग या पोषक तत्व की कमी में गलती हो सकती है। दवा छिड़कने से पहले, खासकर रासायनिक दवा, कृषि विज्ञान केंद्र (KVK) या कृषि अधिकारी से पुष्टि करें और डिब्बे पर लिखी मात्रा ही डालें।',
    'profile.help.faq.prices.q': 'मंडी भाव अनुमानित क्यों हैं?',
    'profile.help.faq.prices.a':
      'ऐप के भाव इंटरनेट पर मौजूद स्रोतों (जैसे AGMARKNET, eNAM) से AI खोज द्वारा जुटाए जाते हैं, इसलिए ये देर से अपडेट हो सकते हैं। असली भाव फसल की गुणवत्ता, नमी और उस दिन की आवक पर बदलता है। बेचने से पहले अपनी मंडी में भाव ज़रूर पता करें।',
    'profile.help.faq.offline.q': 'क्या ऐप बिना इंटरनेट चलता है?',
    'profile.help.faq.offline.a':
      'हाँ, काफ़ी हद तक। आपकी फसलें, खेत, हिसाब और पहले देखा मौसम व भाव बिना इंटरनेट भी खुलते हैं। पुरानी जानकारी पर "पुरानी जानकारी" लिखा आता है और आखिरी अपडेट का समय दिखता है। AI से सवाल, फसल डॉक्टर और नए भाव-मौसम के लिए इंटरनेट चाहिए।',
    'profile.help.faq.language.q': 'भाषा कैसे बदलें?',
    'profile.help.faq.language.a':
      'प्रोफाइल में "भाषा" दबाएं और अपनी भाषा चुनें। हिंदी और अंग्रेज़ी में पूरा ऐप है; दूसरी भाषाओं में कुछ हिस्से हिंदी में दिखेंगे, पर AI के जवाब आपकी चुनी भाषा में आएंगे।',
    'profile.help.faq.location.q': 'अपनी जगह (ज़िला) कैसे बदलें?',
    'profile.help.faq.location.a':
      'होम स्क्रीन पर सबसे ऊपर जगह वाला बटन दबाएं। GPS से अपनी अभी की जगह पता करें, या ज़िले का नाम लिखकर या बोलकर खोजें। मौसम, मंडी भाव और सलाह इसी जगह के हिसाब से आते हैं।',
    'profile.help.faq.reminders.q': 'काम की याद (रिमाइंडर) कैसे मिलेगी?',
    'profile.help.faq.reminders.a':
      'कैलेंडर में किसी काम पर याद का समय लगाएं — तय समय पर फ़ोन पर सूचना आएगी। सूचना न आए तो सेटिंग्स → सूचनाएं में "काम की याद" चालू रखें और फ़ोन की सेटिंग में किसान मित्र को सूचना दिखाने की अनुमति दें।',
    'profile.help.faq.voice.q': 'बोलकर कैसे पूछें और जवाब कैसे सुनें?',
    'profile.help.faq.voice.a':
      'जहां भी माइक का बटन दिखे, उसे दबाएं और अपनी भाषा में बोलें। जवाब सुनने के लिए "सुनें" दबाएं। पढ़कर सुनाने वाली आवाज़ सेटिंग्स → आवाज़ में बदल सकते हैं।',
    'profile.help.faq.data.q': 'मेरी जानकारी कहां रहती है?',
    'profile.help.faq.data.a':
      'आपकी जानकारी इसी फ़ोन में रहती है। जवाब देने के लिए AI सवाल, फोटो और अनुमानित जगह AI सेवा को भेजे जाते हैं। हम आपका डेटा नहीं बेचते। पूरी जानकारी "निजता नीति" में है।',

    'profile.help.feedback.title': 'सुझाव या शिकायत',
    'profile.help.feedback.body':
      'ऐप में कुछ गलत लगे या कोई नई सुविधा चाहिए, तो नीचे बटन से एक तैयार संदेश बनाएं, अपनी बात लिखें और शेयर करें। ध्यान दें: अभी ऐप से संदेश सीधे किसान मित्र टीम तक नहीं पहुंचता।',
    'profile.help.feedback.button': 'सुझाव का संदेश बनाएं',
    'profile.help.feedback.bodyDirect': 'ऐप में कुछ गलत लगे या कोई नई सुविधा चाहिए, तो लिखकर भेजें। आपका संदेश ईमेल से किसान मित्र टीम को जाएगा।',
    'profile.help.feedback.buttonDirect': 'सुझाव लिखकर भेजें',
    'profile.help.feedback.shareTitle': 'किसान मित्र — सुझाव',
    'profile.help.feedback.template':
      'किसान मित्र के लिए सुझाव / शिकायत\n\nमेरी बात:\n\n\nकिस स्क्रीन पर:\n\n—\nऐप संस्करण: {version}\nभाषा: {lang}\nडिवाइस: {platform}',
    'profile.help.feedback.copied': 'संदेश कॉपी हो गया — जहां भेजना हो वहां पेस्ट करें',
    'profile.help.more': 'और जानकारी',
  },
  en: {
    'profile.help.title': 'Help centre',
    'profile.help.subtitle': 'FAQs and support',
    'profile.help.callTitle': 'Want to talk to someone?',
    'profile.help.guides': 'How to use the app',
    'profile.help.guide.addCrop': 'Add a crop',
    'profile.help.guide.addCropDesc': 'Get daily advice',
    'profile.help.guide.doctor': 'Crop doctor',
    'profile.help.guide.doctorDesc': 'Identify disease from a photo',
    'profile.help.guide.ai': 'Ask the AI',
    'profile.help.guide.aiDesc': 'Type or speak',
    'profile.help.guide.mandi': 'Mandi prices',
    'profile.help.guide.mandiDesc': "Today's indicative prices",
    'profile.help.guide.weather': 'Weather',
    'profile.help.guide.weatherDesc': 'The right time to spray',
    'profile.help.guide.hisab': 'Farm accounts',
    'profile.help.guide.hisabDesc': 'Record expenses and income',
    'profile.help.faq': 'Frequently asked questions',

    'profile.help.faq.addCrop.q': 'How do I add a new crop?',
    'profile.help.faq.addCrop.a':
      'Open "My crops" in Profile and tap "Add crop". Choose the crop, enter the sowing date and land, then save. The app will then show daily advice and a task list for that crop.',
    'profile.help.faq.doctor.q': 'How does the Crop Doctor work?',
    'profile.help.faq.doctor.a':
      'Take a clear photo of the sick leaf or plant — in daylight, with one leaf filling the frame. The AI looks at the photo and suggests the likely disease or pest, its symptoms and remedies. The photo is shrunk and sent to the AI service, so you need internet.',
    'profile.help.faq.doctorLimits.q': 'Is the Crop Doctor answer certain?',
    'profile.help.faq.doctorLimits.a':
      'No. It is an AI estimate, not a lab test. It can be wrong with blurry photos, several diseases at once or nutrient deficiencies. Before spraying, especially chemicals, confirm with your Krishi Vigyan Kendra (KVK) or agriculture officer and use only the dose written on the label.',
    'profile.help.faq.prices.q': 'Why are mandi prices only indicative?',
    'profile.help.faq.prices.a':
      'Prices are gathered by AI search from internet sources (such as AGMARKNET and eNAM), so they can be delayed. The real price depends on quality, moisture and arrivals that day. Always check the price at your mandi before selling.',
    'profile.help.faq.offline.q': 'Does the app work without internet?',
    'profile.help.faq.offline.a':
      'Mostly, yes. Your crops, farms, accounts and previously seen weather and prices open without internet. Old information is marked "Old data" with the last update time. Asking the AI, the Crop Doctor and fresh prices or weather need internet.',
    'profile.help.faq.language.q': 'How do I change the language?',
    'profile.help.faq.language.a':
      'Tap "Language" in Profile and choose yours. The full app is in Hindi and English; in other languages some parts show in Hindi, but AI answers come in your chosen language.',
    'profile.help.faq.location.q': 'How do I change my place (district)?',
    'profile.help.faq.location.a':
      'Tap the place button at the top of the Home screen. Detect your current place with GPS, or search by typing or speaking the district name. Weather, mandi prices and advice follow this place.',
    'profile.help.faq.reminders.q': 'How do I get task reminders?',
    'profile.help.faq.reminders.a':
      'Set a reminder time on a task in the Calendar — a notification will arrive on time. If it does not, keep "Task reminders" on in Settings → Notifications and allow Kisan Mitra to show notifications in your phone settings.',
    'profile.help.faq.voice.q': 'How do I ask by voice and listen to answers?',
    'profile.help.faq.voice.a':
      'Wherever you see the mic button, tap it and speak in your language. Tap "Listen" to hear an answer. You can change the read-aloud voice in Settings → Voice.',
    'profile.help.faq.data.q': 'Where is my information kept?',
    'profile.help.faq.data.a':
      'Your information stays on this phone. To answer you, questions, photos and your approximate place are sent to the AI service. We do not sell your data. The "Privacy policy" has the full details.',

    'profile.help.feedback.title': 'Suggestions or complaints',
    'profile.help.feedback.body':
      'If something looks wrong or you want a new feature, use the button below to make a ready message, add your words and share it. Note: the app cannot yet send messages straight to the Kisan Mitra team.',
    'profile.help.feedback.button': 'Make a feedback message',
    'profile.help.feedback.bodyDirect': 'If something looks wrong or you want a new feature, write to us. Your message goes to the Kisan Mitra team by email.',
    'profile.help.feedback.buttonDirect': 'Write a suggestion',
    'profile.help.feedback.shareTitle': 'Kisan Mitra — feedback',
    'profile.help.feedback.template':
      'Feedback / complaint for Kisan Mitra\n\nMy message:\n\n\nOn which screen:\n\n—\nApp version: {version}\nLanguage: {lang}\nDevice: {platform}',
    'profile.help.feedback.copied': 'Message copied — paste it where you want to send it',
    'profile.help.more': 'More information',
  },
});
