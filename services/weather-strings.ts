// Strings for services/weather.ts: conditions, AQI, spray advice and farm weather alerts.
// Alert and spray texts are rendered with tNow() whenever a forecast is viewed (weatherView).
import { registerStrings } from '../lib/i18n';

registerStrings({
  hi: {
    // WMO weather codes → short conditions
    'weather.cond.sunny': 'धूप खिली है',
    'weather.cond.clearNight': 'आसमान साफ़ है',
    'weather.cond.mostlySunny': 'ज़्यादातर धूप',
    'weather.cond.mostlyClear': 'ज़्यादातर साफ़ आसमान',
    'weather.cond.partlyCloudy': 'हल्के बादल',
    'weather.cond.overcast': 'बादल छाए हैं',
    'weather.cond.fog': 'कोहरा',
    'weather.cond.drizzle': 'बूंदाबांदी',
    'weather.cond.freezingDrizzle': 'ठंडी बूंदाबांदी',
    'weather.cond.lightRain': 'हल्की बारिश',
    'weather.cond.rain': 'बारिश',
    'weather.cond.heavyRain': 'तेज़ बारिश',
    'weather.cond.freezingRain': 'ठंडी बारिश',
    'weather.cond.snow': 'बर्फ़बारी',
    'weather.cond.lightShowers': 'हल्की बौछारें',
    'weather.cond.showers': 'रुक-रुक कर बारिश',
    'weather.cond.heavyShowers': 'तेज़ बौछारें',
    'weather.cond.thunderstorm': 'गरज के साथ बारिश',
    'weather.cond.hailstorm': 'ओलों के साथ आंधी',
    'weather.cond.unknown': 'मौसम',

    // AQI on India's CPCB National AQI scale (estimated from modelled PM2.5 / PM10)
    'weather.aqi.label': 'AQI {value}',
    'weather.aqi.name': 'वायु गुणवत्ता (AQI)',
    'weather.aqi.note': 'भारत के AQI पैमाने (CPCB) पर अनुमान, पिछले 24 घंटे के PM2.5 और PM10 के मॉडल आंकड़ों से',
    'weather.aqi.good': 'अच्छा',
    'weather.aqi.satisfactory': 'संतोषजनक',
    'weather.aqi.moderate': 'मध्यम',
    'weather.aqi.poor': 'खराब',
    'weather.aqi.veryPoor': 'बहुत खराब',
    'weather.aqi.severe': 'गंभीर',

    // Time-of-day words for spray windows ("शाम 4–6 बजे")
    'weather.period.morning': 'सुबह',
    'weather.period.afternoon': 'दोपहर',
    'weather.period.evening': 'शाम',
    'weather.period.night': 'रात',
    'weather.window.same': '{period} {from}–{to} बजे',
    'weather.window.cross': '{fromPeriod} {from} – {toPeriod} {to} बजे',
    'weather.window.tomorrow': 'कल {window}',

    // Spray advice ("क्या आज स्प्रे करना सही है?")
    'weather.spray.question': 'क्या आज स्प्रे करना सही है?',
    'weather.spray.good':
      'आज {window} स्प्रे के लिए अच्छा समय है। हवा {wind} km/h, तापमान {temp}°C और अगले {hours} घंटे बारिश की संभावना कम है।',
    'weather.spray.calmNote': 'हवा लगभग शांत है — बहुत बारीक फुहार की जगह मोटी बूंदों वाला नोज़ल लगाएं।',
    'weather.spray.notToday': 'आज स्प्रे न करें — {why}। कल {window} बेहतर समय रहेगा।',
    'weather.spray.lateToday': 'आज स्प्रे का अच्छा समय निकल चुका है। कल {window} स्प्रे के लिए अच्छा समय रहेगा।',
    'weather.spray.notSoon': 'आज और कल स्प्रे के लिए मौसम ठीक नहीं है — {why}। मौसम ठीक होने तक स्प्रे टालें।',
    'weather.spray.lateBadTomorrow': 'आज स्प्रे का समय निकल चुका है और कल भी मौसम ठीक नहीं है — {why}। मौसम ठीक होने तक स्प्रे टालें।',
    'weather.spray.why.rain': 'बारिश की संभावना है, दवा धुल सकती है',
    'weather.spray.why.wind': 'हवा तेज़ है, दवा उड़कर बेकार जा सकती है',
    'weather.spray.why.heat': 'तापमान बहुत ज़्यादा है, दवा जल्दी सूखकर उड़ सकती है',
    'weather.spray.noData': 'मौसम की पूरी जानकारी नहीं मिली। स्प्रे से पहले आसमान और हवा देख लें।',

    // Farm weather alerts (IMD criteria). {when} is "6 अक्टूबर को" or "6–8 अक्टूबर के बीच".
    'weather.when.day': '{date} को',
    'weather.when.range': '{range} के बीच',
    'weather.alert.heavyRain.title': 'भारी बारिश की चेतावनी',
    'weather.alert.veryHeavyRain.title': 'बहुत भारी बारिश की चेतावनी',
    'weather.alert.extremeRain.title': 'अत्यधिक भारी बारिश की चेतावनी',
    'weather.alert.heavyRain.msg':
      '{when} एक दिन में {value} मिमी तक बारिश का अनुमान है। स्प्रे, खाद और सिंचाई टालें; खेत से पानी निकलने का रास्ता खुला रखें और कटी फसल ढककर रखें।',
    'weather.alert.hot.title': 'तेज़ गर्मी की चेतावनी',
    'weather.alert.heatwave.title': 'लू की चेतावनी',
    'weather.alert.severeHeatwave.title': 'भीषण लू की चेतावनी',
    'weather.alert.heat.msg':
      '{when} अधिकतम तापमान {value}°C तक जा सकता है। सिंचाई सुबह या शाम करें, दोपहर में स्प्रे और भारी काम न करें; पशुओं को छाया और भरपूर पानी दें।',
    'weather.alert.coldWave.title': 'शीतलहर की चेतावनी',
    'weather.alert.coldWave.msg':
      '{when} न्यूनतम तापमान {value}°C तक गिर सकता है। नर्सरी और छोटे पौधों को ढकें, शाम को हल्की सिंचाई करें और पशुओं को ठंड से बचाएं।',
    'weather.alert.frost.title': 'पाले की चेतावनी',
    'weather.alert.frost.msg':
      '{when} रात का तापमान {value}°C तक गिर सकता है, पाला पड़ने का खतरा है। शाम को हल्की सिंचाई करें, नर्सरी को पुआल या पॉलीथीन से ढकें और रात में मेड़ पर धुआं करें।',
    'weather.alert.wind.title': 'तेज़ हवा की चेतावनी',
    'weather.alert.gale.title': 'बहुत तेज़ हवा की चेतावनी',
    'weather.alert.wind.msg':
      '{when} {value} km/h तक के तेज़ झोंके चल सकते हैं। स्प्रे टालें, ऊंची फसलों और बेलों को सहारा दें और ढीला सामान बांधकर रखें।',
    'weather.alert.storm.title': 'आंधी-तूफ़ान की आशंका',
    'weather.alert.hail.title': 'ओलावृष्टि की आशंका',
    'weather.alert.storm.msg':
      '{when} गरज-चमक के साथ बारिश हो सकती है। बिजली कड़कने पर खुले खेत में न रहें, पेड़ के नीचे न खड़े हों; कटी फसल और भूसा ढककर रखें।',
    'weather.alert.hail.msg':
      '{when} गरज-चमक के साथ ओले गिर सकते हैं। खुले खेत में न रहें, पेड़ के नीचे न खड़े हों; नर्सरी, कटी फसल और पशुओं को ढकी जगह पर रखें।',
    'weather.notif.title': '{title} — {place}',

    'weather.error.load': 'मौसम की जानकारी नहीं मिल पाई। इंटरनेट जांचकर दोबारा कोशिश करें।',
  },
  en: {
    'weather.cond.sunny': 'Sunny',
    'weather.cond.clearNight': 'Clear sky',
    'weather.cond.mostlySunny': 'Mostly sunny',
    'weather.cond.mostlyClear': 'Mostly clear',
    'weather.cond.partlyCloudy': 'Partly cloudy',
    'weather.cond.overcast': 'Cloudy',
    'weather.cond.fog': 'Fog',
    'weather.cond.drizzle': 'Drizzle',
    'weather.cond.freezingDrizzle': 'Freezing drizzle',
    'weather.cond.lightRain': 'Light rain',
    'weather.cond.rain': 'Rain',
    'weather.cond.heavyRain': 'Heavy rain',
    'weather.cond.freezingRain': 'Freezing rain',
    'weather.cond.snow': 'Snowfall',
    'weather.cond.lightShowers': 'Light showers',
    'weather.cond.showers': 'Rain showers',
    'weather.cond.heavyShowers': 'Heavy showers',
    'weather.cond.thunderstorm': 'Thunderstorm',
    'weather.cond.hailstorm': 'Thunderstorm with hail',
    'weather.cond.unknown': 'Weather',

    'weather.aqi.label': 'AQI {value}',
    'weather.aqi.name': 'Air quality (AQI)',
    'weather.aqi.note': "Estimate on India's AQI scale (CPCB), from modelled PM2.5 and PM10 over the last 24 hours",
    'weather.aqi.good': 'Good',
    'weather.aqi.satisfactory': 'Satisfactory',
    'weather.aqi.moderate': 'Moderate',
    'weather.aqi.poor': 'Poor',
    'weather.aqi.veryPoor': 'Very poor',
    'weather.aqi.severe': 'Severe',

    'weather.period.morning': 'morning',
    'weather.period.afternoon': 'afternoon',
    'weather.period.evening': 'evening',
    'weather.period.night': 'night',
    'weather.window.same': '{from}–{to} {toAmPm}',
    'weather.window.cross': '{from} {fromAmPm} – {to} {toAmPm}',
    'weather.window.tomorrow': 'tomorrow {window}',

    'weather.spray.question': 'Is it a good day to spray?',
    'weather.spray.good':
      'Today {window} is a good time to spray. Wind {wind} km/h, temperature {temp}°C and little chance of rain for the next {hours} hours.',
    'weather.spray.calmNote': 'The air is almost still — use a coarse-droplet nozzle instead of a very fine mist.',
    'weather.spray.notToday': 'Do not spray today — {why}. Tomorrow {window} will be better.',
    'weather.spray.lateToday': "Today's good spraying time has passed. Tomorrow {window} will be a good time.",
    'weather.spray.notSoon': 'Weather is not right for spraying today or tomorrow — {why}. Wait until it improves.',
    'weather.spray.lateBadTomorrow':
      "Today's spraying time has passed and tomorrow's weather is not right either — {why}. Wait until it improves.",
    'weather.spray.why.rain': 'rain is likely and may wash the spray off',
    'weather.spray.why.wind': 'wind is strong and the spray may drift away',
    'weather.spray.why.heat': 'it is too hot and the spray may evaporate',
    'weather.spray.noData': 'Full weather data is not available. Check the sky and wind before spraying.',

    'weather.when.day': 'On {date},',
    'weather.when.range': 'Between {range},',
    'weather.alert.heavyRain.title': 'Heavy rain warning',
    'weather.alert.veryHeavyRain.title': 'Very heavy rain warning',
    'weather.alert.extremeRain.title': 'Extremely heavy rain warning',
    'weather.alert.heavyRain.msg':
      '{when} up to {value} mm of rain in a day is expected. Postpone spraying, fertiliser and irrigation; keep field drainage open and cover harvested crop.',
    'weather.alert.hot.title': 'Extreme heat warning',
    'weather.alert.heatwave.title': 'Heatwave warning',
    'weather.alert.severeHeatwave.title': 'Severe heatwave warning',
    'weather.alert.heat.msg':
      '{when} the maximum temperature may reach {value}°C. Irrigate in the morning or evening, avoid spraying and heavy work at midday; give animals shade and plenty of water.',
    'weather.alert.coldWave.title': 'Cold wave warning',
    'weather.alert.coldWave.msg':
      '{when} the minimum temperature may drop to {value}°C. Cover nurseries and young plants, irrigate lightly in the evening and protect animals from cold.',
    'weather.alert.frost.title': 'Frost warning',
    'weather.alert.frost.msg':
      '{when} the night temperature may drop to {value}°C with a risk of frost. Irrigate lightly in the evening, cover nurseries with straw or plastic and make smoke along the field bunds at night.',
    'weather.alert.wind.title': 'Strong wind warning',
    'weather.alert.gale.title': 'Very strong wind warning',
    'weather.alert.wind.msg':
      '{when} wind gusts up to {value} km/h are possible. Postpone spraying, support tall crops and climbers, and tie down loose items.',
    'weather.alert.storm.title': 'Thunderstorm likely',
    'weather.alert.hail.title': 'Hailstorm likely',
    'weather.alert.storm.msg':
      '{when} thunderstorms with rain are possible. Do not stay in open fields or under trees during lightning; cover harvested crop and fodder.',
    'weather.alert.hail.msg':
      '{when} thunderstorms with hail are possible. Stay out of open fields and away from trees; keep nurseries, harvested crop and animals under cover.',
    'weather.notif.title': '{title} — {place}',

    'weather.error.load': 'Could not load the weather. Check the internet and try again.',
  },
});
