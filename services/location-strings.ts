// Strings for services/location.ts (place search, GPS detection, errors).
import { registerStrings } from '../lib/i18n';

registerStrings({
  hi: {
    'location.myLocation': 'मेरी जगह',
    'location.detecting': 'आपकी जगह पता की जा रही है…',
    'location.useCurrent': 'मेरी अभी की जगह इस्तेमाल करें',
    'location.popular': 'प्रमुख जिले',
    'location.searchPlaceholder': 'शहर, जिला या गांव का नाम लिखें',
    'location.noResults': 'यह जगह नहीं मिली। नाम दूसरे तरीके से लिखकर देखें या पास का बड़ा शहर चुनें।',
    'location.error.denied': 'लोकेशन की अनुमति नहीं मिली। फ़ोन की सेटिंग्स में अनुमति दें या अपनी जगह खोजकर चुनें।',
    'location.error.unavailable': 'आपकी जगह पता नहीं चल पाई। GPS चालू करें या अपनी जगह खोजकर चुनें।',
    'location.error.timeout': 'जगह पता करने में बहुत देर लगी। दोबारा कोशिश करें या अपनी जगह खोजकर चुनें।',
    'location.error.search': 'जगह खोज नहीं पाए। इंटरनेट जांचकर दोबारा कोशिश करें।',
  },
  en: {
    'location.myLocation': 'My location',
    'location.detecting': 'Finding your location…',
    'location.useCurrent': 'Use my current location',
    'location.popular': 'Major districts',
    'location.searchPlaceholder': 'Type a city, district or village',
    'location.noResults': 'Place not found. Try another spelling or pick a nearby big town.',
    'location.error.denied': 'Location permission was not given. Allow it in phone settings or search for your place.',
    'location.error.unavailable': 'Could not find your location. Turn on GPS or search for your place.',
    'location.error.timeout': 'Finding your location took too long. Try again or search for your place.',
    'location.error.search': 'Could not search places. Check the internet and try again.',
  },
});
