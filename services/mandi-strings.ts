// Strings for services/mandi.ts: market signal fallbacks, history notes, price dates, price-move
// notifications and errors.
import { registerStrings } from '../lib/i18n';

registerStrings({
  hi: {
    'mandi.signal.title': 'AI बाज़ार संकेत',
    'mandi.signal.notEnough':
      'अभी {crop} के भाव की पर्याप्त जानकारी नहीं है। बेचने से पहले स्थानीय मंडी से ताज़ा भाव पूछ लें।',
    'mandi.signal.up':
      'पिछले {days} दिनों में {crop} का भाव लगभग {pct}% बढ़ा है। यदि आपके पास भंडारण की सुविधा है तो बेचने से पहले स्थानीय मंडी का रुझान देखें।',
    'mandi.signal.down':
      'पिछले {days} दिनों में {crop} का भाव लगभग {pct}% घटा है। जल्दबाज़ी न करें, आसपास की मंडियों के भाव मिलाकर देखें।',
    'mandi.signal.stable':
      'पिछले {days} दिनों में {crop} का भाव लगभग स्थिर रहा है। बेचने से पहले आसपास की मंडियों के भाव मिलाकर देखें।',
    'mandi.signal.prevUp':
      'पिछली रिपोर्ट के मुकाबले {crop} का भाव {pct}% ऊपर है। बेचने से पहले स्थानीय मंडी में भाव पक्का कर लें।',
    'mandi.signal.prevDown':
      'पिछली रिपोर्ट के मुकाबले {crop} का भाव {pct}% नीचे है। जल्दबाज़ी न करें, आसपास की मंडियों के भाव भी देखें।',
    'mandi.signal.prevStable':
      'पिछली रिपोर्ट के मुकाबले {crop} का भाव लगभग वही है। बेचने से पहले आसपास की मंडियों के भाव मिलाकर देखें।',
    'mandi.history.notEnough': 'रुझान दिखाने के लिए अभी कम से कम 2 दिन के भाव चाहिए',
    'mandi.history.high': 'सबसे ऊंचा',
    'mandi.history.low': 'सबसे कम',
    // Shown next to every price whose date is not today ("भाव की तारीख: 3 अक्टूबर").
    'mandi.priceDate': 'भाव की तारीख: {date}',
    'mandi.notif.up': '{crop} का अनुमानित भाव {pct}% बढ़ा',
    'mandi.notif.down': '{crop} का अनुमानित भाव {pct}% घटा',
    'mandi.notif.body':
      '{market}: {price}/क्विंटल ({date}), पिछला भाव {prev} ({prevDate})। बेचने से पहले स्थानीय मंडी में भाव पक्का कर लें।',
    'mandi.nearbyMarket': 'नज़दीकी मंडी',
    'mandi.error.no-data': 'आपके क्षेत्र के मंडी भाव अभी नहीं मिल पाए। थोड़ी देर बाद फिर कोशिश करें या नज़दीकी बड़ा शहर चुनें।',
    'mandi.error.unverified':
      'मंडी भाव किसी भरोसेमंद स्रोत से पक्के नहीं हो पाए, इसलिए अभी नहीं दिखा रहे। थोड़ी देर बाद फिर कोशिश करें या नज़दीकी मंडी से भाव पूछें।',
  },
  en: {
    'mandi.signal.title': 'AI market signal',
    'mandi.signal.notEnough': 'Not enough price information for {crop} yet. Ask your local mandi for the latest rate before selling.',
    'mandi.signal.up':
      'In the last {days} days the {crop} price has risen by about {pct}%. If you have storage, watch the local mandi trend before selling.',
    'mandi.signal.down':
      'In the last {days} days the {crop} price has fallen by about {pct}%. Do not rush; compare prices at nearby mandis.',
    'mandi.signal.stable':
      'In the last {days} days the {crop} price has stayed about the same. Compare prices at nearby mandis before selling.',
    'mandi.signal.prevUp': 'The {crop} price is {pct}% higher than the previous report. Confirm the rate at your local mandi before selling.',
    'mandi.signal.prevDown': 'The {crop} price is {pct}% lower than the previous report. Do not rush; check nearby mandis too.',
    'mandi.signal.prevStable': 'The {crop} price is about the same as the previous report. Compare nearby mandis before selling.',
    'mandi.history.notEnough': 'At least 2 days of prices are needed to show a trend',
    'mandi.history.high': 'Highest',
    'mandi.history.low': 'Lowest',
    'mandi.priceDate': 'Price date: {date}',
    'mandi.notif.up': 'Estimated {crop} price up {pct}%',
    'mandi.notif.down': 'Estimated {crop} price down {pct}%',
    'mandi.notif.body':
      '{market}: {price}/quintal ({date}), previous {prev} ({prevDate}). Confirm the rate at your local mandi before selling.',
    'mandi.nearbyMarket': 'Nearby mandi',
    'mandi.error.no-data': 'Could not find mandi prices for your area right now. Try again later or pick a nearby big town.',
    'mandi.error.unverified':
      'Mandi prices could not be confirmed from a reliable source, so they are not shown. Try again later or ask your nearby mandi.',
  },
});
