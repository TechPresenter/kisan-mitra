# Data services: weather, location and mandi

Real-world data used by the Home, Weather, Mandi, Onboarding and Advisory screens. All three services:

- fetch through `lib/cache.ts`, so the last result stays visible offline and carries `fetchedAt`;
- register their own strings (`weather.*`, `location.*`, `mandi.*`) when imported, so screens can `t()` the keys listed below;
- throw errors that expose a `messageKey` (`WeatherError`, `LocationError`, `MandiError`, `AIError`). Show `t(err.messageKey)`, never `err.message`.

| Service | Source | Key needed | Freshness |
|---|---|---|---|
| `services/weather.ts` | Open-Meteo forecast and air-quality APIs | none | 30 min |
| `services/location.ts` | Open-Meteo geocoding; BigDataCloud reverse geocoding (client endpoint) | none | search 7 days, reverse 30 days |
| `services/mandi.ts` | `services/ai` with web grounding (AGMARKNET / eNAM as target sources) | an AI provider that returns search sources (see Mandi) | 3 h per crop; signal once a day |

---

## Weather — `services/weather.ts`

```ts
import { useWeather, getWeather, weatherCodeInfo, aqiInfo, weatherView } from '../../services/weather';
```

### Fetching

| Export | Signature | Notes |
|---|---|---|
| `useWeather` | `(place: GeoPlace \| null \| undefined) => Resource<WeatherSnapshot>` | Pass `null` to stay idle. The cached copy renders instantly, and a refresh runs when it is older than 30 min. `data` is always `weatherView(snapshot, now)`, rebuilt every 15 minutes. |
| `getWeather` | `(place, { force? }) => Promise<CachedResult<WeatherSnapshot>>` | Non-hook version; `data` is `weatherView(…)` at call time. When a refresh fails, it returns the cached copy with `error` set. With no cache, it throws `WeatherError`. |
| `weatherView` | `(snapshot, now = Date.now()) => WeatherSnapshot` | Pure. Drops days and hours that have passed, then works out `spray` and `alerts` again for the rest, in the current language. Use it on any snapshot you hold onto. |
| `placeToday` | `(snapshot, now?) => ISODate` | Today's date at the forecast's place (not the device's). |
| `weatherCacheName` | `(place) => string` | `weather:<lat2>,<lon2>`: one cache entry per ~1 km. |
| `WEATHER_MAX_AGE_MS` | `30 * MINUTE` | Use this for "पुरानी जानकारी" checks. |

**Never show a stored `spray` or `alerts` directly.** They are only valid at `fetchedAt`. `useWeather` and `getWeather` already return the view; if you keep a snapshot elsewhere, pass it through `weatherView` first.

What one fetch does:

- **Requests.** One forecast call (current, the next 48 h hourly, 7 days daily, `timezone=auto`). An air-quality call runs in parallel (hourly PM2.5 and PM10 for the last 24 h). It is optional and gets a single 8 s attempt, so an AQI failure only leaves `aqi` undefined.
- **Retry.** A forecast request that fails is retried once.
- **Notifications.** Alerts for the next 3 days (storm/hail: the next 2 days) are pushed to the notification center:
  - `category: 'weather'`, with priority taken from the alert severity;
  - title `"<alert title> — <place>"`;
  - `dedupeKey: weather:<kind>:<day>:<variant>:<lat1>,<lon1>`, where `<day>` and `<variant>` are those of the day that triggered it;
  - `target: { screen: 'weather' }`.
  - What was notified is remembered per kind, day and place (store key `weather.notified`). A day notifies again only when it is new to the alert or got worse (e.g. heavy → very heavy rain). The same forecast fetched again, or a downgrade, does not notify.

### Snapshot shape (`WeatherSnapshot`, types/models.ts)

- **Times.** `hourly[].time`, `daily[].sunrise` and `daily[].sunset` are ISO 8601 with the place's UTC offset, e.g. `2026-10-05T16:00:00+05:30`.
  - `new Date(time)` parses them correctly.
  - `time.slice(11, 13)` gives the local hour.
- **Hourly.** Up to 48 entries from the current hour. An hour with any missing model value is left out, so there can be gaps; never fill them with 0.
- **Daily.** `daily[0]` is today at the place (in the view). The list ends early if a day is missing a core value; a missing value never shows as 0 °C, 0 mm or "sunny". Each day also carries `windGustMaxKmh` (type `DailyForecastExt`).
- **Current.** `temperatureC` is always real; a fetch without it fails with `WeatherError('bad-response')`. Missing humidity, wind or weather code fall back to this hour's forecast. `weatherCode` is `UNKNOWN_WEATHER_CODE` (-1) when neither has one; `weatherCodeInfo(-1)` gives "मौसम" with a cloud icon.
- **`aqi`.** India's National AQI (CPCB scale, 0–500) estimated from Open-Meteo's modelled (CAMS) 24-hour average PM2.5 and PM10. Show it as `t('weather.aqi.label', { value })` ("AQI 74") with `aqiInfo(aqi)` for its band. Put `t('weather.aqi.note')` in the detail view: it is a model estimate, not a CPCB station reading, and can differ from SAMEER (dust-heavy days can read high).
- **`alerts`** and **`spray`.** See below. In the view they always describe `now`.

### Conditions, icons, scenes

`weatherCodeInfo(code, isDay = true)` returns `{ key, icon, scene }`:

- **`key`.** An i18n key with a short Hindi condition, e.g. `weather.cond.sunny` gives "धूप खिली है" in Hindi and "Sunny" in English. For the reference "धूप खिली है (Sunny)" style, use `` `${t(key)} (${translate('en', key)})` ``.
- **`icon`.** A lucide-react export name: `Sun`, `Moon`, `CloudSun`, `CloudMoon`, `Cloud`, `CloudFog`, `CloudDrizzle`, `CloudRain`, `CloudRainWind`, `CloudSnow`, `CloudLightning` or `CloudHail`. Render it with `icons[info.icon]` from `lucide-react`, or with your own switch.
- **`scene`.** One of `'clear-day' | 'clear-night' | 'cloudy' | 'rain' | 'storm' | 'fog'`, for the header illustration.

Related helpers:

- `isWetCode(code)` is true for codes ≥ 51 (any precipitation).
- `aqiInfo(aqi)` returns `{ level, key, tone }`. `key` is `weather.aqi.good | satisfactory | moderate | poor | veryPoor | severe` ("अच्छा / संतोषजनक / मध्यम / खराब / बहुत खराब / गंभीर"). `tone` is `'good'` (good, satisfactory), `'warn'` (moderate) or `'bad'` (poor and worse).
- `naqiFromPm(pm25Avg24h?, pm10Avg24h?)` computes the index; CPCB breakpoints: PM2.5 30 / 60 / 90 / 120 / 250, PM10 50 / 100 / 250 / 350 / 430 µg/m³.

### Spray advice — "क्या आज स्प्रे करना सही है?"

`spray: SprayAdvice` has the shape `{ suitable, bestWindow?, reason }`. For example: `{ suitable: true, bestWindow: 'शाम 4–6 बजे', reason: 'आज शाम 4–6 बजे स्प्रे के लिए अच्छा समय है। …' }`.

"Today" is the date at the place for `now`, not the day the forecast was fetched. Each 2-hour window in today's remaining daylight is checked as follows:

- **Daylight.** It starts at or after sunrise and ends no later than 30 minutes after sunset.
- **Rain.** For the window plus the next 6 h, the rain probability is ≤ 40% and hourly rain is ≤ 0.2 mm. No hour in the window has a wet weather code. A gap in the hourly data counts as possible rain.
- **Wind.** It is ≤ 15 km/h. The ideal is 3–10 km/h; outside that range the window scores worse.
- **Temperature.** It is ≤ 32 °C.

The window with the best score wins. If no window works today, the advice suggests tomorrow's best window (`bestWindow: 'कल सुबह 7–9 बजे'`, `suitable: false`). Otherwise the reason names the main blocker (rain, wind or heat). Windows whose 6 h look-ahead runs past the end of the forecast are not judged. If the forecast does not reach 6 h past today's daylight (an old cached forecast), the advice is `weather.spray.noData`.

- `sprayAdvice(daily, hourly, now?)` is pure; `weatherView` calls it for you.
- `formatHourWindow(startHour, hours = 2)` returns "शाम 4–6 बजे" in Hindi and "4–6 PM" in English.

### Alerts

`deriveAlerts(daily, hourly, { elevationM? })` returns `WeatherAlert[]`, urgent first. Consecutive days of the same kind merge into one alert, which carries the first date and the worst value. The text names absolute dates ("6 अक्टूबर को", "6–8 अक्टूबर के बीच") plus a farmer action hint. A rule whose input is missing never fires.

| Kind | Rule | Severity |
|---|---|---|
| `heavy-rain` | IMD. Max of the daily sum and any rolling 24 h hourly sum: heavy ≥ 64.5 mm, very heavy ≥ 115.6 mm, extremely heavy ≥ 204.5 mm. | important / urgent / urgent |
| `heatwave` | IMD. Tmax ≥ 40 °C (IMD threshold for even considering a plains heatwave), ≥ 45 °C (heatwave by actual Tmax), ≥ 47 °C (severe). | important / urgent / urgent |
| `cold-wave` | IMD. Plains only (elevation < 1000 m): Tmin ≤ 4 °C. IMD's severe cold wave (≤ 2 °C) shows as `frost`. | important |
| `frost` | Tmin ≤ 2 °C. Crop canopy runs ~2–4 °C below 2 m air, and IMD ground frost means grass minimum ≤ 0 °C. Replaces cold-wave for that day. | urgent |
| `strong-wind` | IMD terms. Gust or max wind ≥ 40 km/h ("squally wind", 22 kt) or ≥ 62 km/h (gale force, 34 kt). | important / urgent |
| `storm` | **Model-derived, not an IMD criterion.** Thunder code (95/96/99) in at least 2 forecast hours of the day and a daily rain chance ≥ 50%, so only days in the 48 h hourly range qualify. With a hail code (96/99) in those hours it becomes a hail alert: urgent only when the day's gust is ≥ 40 km/h and the rain chance ≥ 60%, otherwise important. | important / important or urgent |

Sources:

- [IMD terminology](https://rsmcnewdelhi.imd.gov.in/images/pdf/terminology.pdf) (rainfall categories, squally wind, gale).
- [IMD heat/cold-wave criteria](https://mausam.imd.gov.in/pdfs/heatcolduser/Definition.pdf).
- [CPCB National Air Quality Index](https://cpcb.gov.in/National-Air-Quality-Index/) (AQI bands and PM breakpoints).
- Spray wind range: [Queensland Govt / GRDC spray-drift guidance](https://www.business.qld.gov.au/industries/farms-fishing-forestry/agriculture/sustainable/chemical/spray-drift/minimise).
- [TNAU Agritech, safe use of pesticides](https://agritech.tnau.ac.in/crop_protection/crop_prot_pesticides_safe%20use%20of%20pesticides.html).

All thresholds are exported constants (`IMD_HEAVY_RAIN_MM`, `STORM_MIN_THUNDER_HOURS`, `SPRAY_WIND_MAX_KMH`, …).

---

## Location — `services/location.ts`

The selected place lives in `lib/app-state.ts` (`usePlace()`, `getPlace()`, `placeLabel()`); this service only finds places.

| Export | Signature | Notes |
|---|---|---|
| `searchPlaces` | `(query: string) => Promise<GeoPlace[]>` | Hindi or English input ("वाराणसी", "varanasi", "इंदौर", "Belgaum"). Up to 10 results, popular districts first. Returns `[]` for queries shorter than 2 characters. |
| `reverseGeocode` | `(lat, lon) => Promise<GeoPlace>` | Never throws. Coordinates are rounded to 3 decimals (~100 m). |
| `detectCurrentPlace` | `() => Promise<GeoPlace>` | GPS (`enableHighAccuracy: false`, 15 s timeout, positions up to 10 min old reused), then `reverseGeocode`. |
| `getCurrentPosition` | `() => Promise<{ lat, lon, accuracyM? }>` | Raw coordinates. |
| `POPULAR_PLACES` | `GeoPlace[]` (24) | Major agricultural districts with Hindi and English names and the Hindi state, e.g. वाराणसी, लखनऊ, पटना, इंदौर … हिसार. |
| `INDIAN_STATES` | `IndianState[]` (28 states + 8 UTs) | `{ code: 'UP', iso: ['IN-UP'], name: 'उत्तर प्रदेश', nameEn: 'Uttar Pradesh', type: 'state' \| 'ut' }`. Use it for profile pickers. |
| `findState` | `(nameOrCode) => IndianState \| undefined` | Accepts Hindi or English names, spelling variants ("झारखण्ड", "State of Odisha", "Orissa"), short codes and ISO codes. |
| `nearestPopularPlace` | `(lat, lon) => { place, km }` | |
| `distanceKm` | `(a, b) => number` | |
| `normalizePlaceName` | `(s) => string` | |
| `transliterateHindi` | `(s) => string` | "गोरखपुर" → "gorakhpur". |
| `LocationError` | `code: 'denied' \| 'unavailable' \| 'timeout' \| 'search'` | `messageKey` = `location.error.<code>`. |

How `searchPlaces` works:

- **Local matches.** Popular districts and their aliases (Banaras, Belgaum, Burdwan, Nasik…) match instantly, with no network.
- **Network queries.** The input is sent to Open-Meteo twice: with `language=hi` for Hindi names and `language=en` for `nameEn`.
- **Hindi input.** It is also tried transliterated, because GeoNames has Hindi names only for bigger places.
- **Missing English names.** Hits that came back only in Hindi get their English name from `/v1/get?id=`.
- **State names.** These are normalized through `INDIAN_STATES`, so they always come out in Hindi.
- **Errors.** It throws `LocationError('search')` only when the network fails and nothing matched locally.

How `reverseGeocode` works:

- It calls BigDataCloud in Hindi and English in parallel.
- The district comes from `adminLevel 5`, and the state from the ISO code.
- If both calls fail, it falls back to the nearest popular district within 40 km (with the real coordinates), or to `{ name: t('location.myLocation'), lat, lon }`.

UI strings:

- `location.myLocation`, `location.detecting`, `location.useCurrent`, `location.popular`, `location.searchPlaceholder`, `location.noResults`;
- `location.error.denied | unavailable | timeout | search`.

---

## Mandi — `services/mandi.ts`

| Export | Signature | Notes |
|---|---|---|
| `useMandi` | `(place \| null, commodityKeys: string[]) => Resource<MandiSnapshotExt>` | Idle when there is no place or no valid key. Rebuilt whenever any screen's search updates one of these crops, and at midnight. |
| `getMandiSnapshot` | `(place, commodityKeys, { force? }) => Promise<CachedResult<MandiSnapshotExt>>` | Cached per crop for 3 h; only missing or stale crops are searched, in one call. When the search fails, cached prices come back with `error` set. With nothing to show it throws `AIError` (offline, not-configured, rate-limit…), `MandiError('unverified')` or `MandiError('no-data')`. |
| `defaultCommodities` | `(profileCropKeys?) => string[]` | Up to 8 keys: the farmer's crops first, then wheat, paddy, tomato, potato, onion, mustard. |
| `getPriceHistory` | `(place, commodityKey, days = 7) => MandiHistoryPointExt[]` | Our own observations at that place, oldest first, from the mandi observed most recently. |
| `usePriceHistory` | `(place \| null, commodityKey, days = 7)` | Reactive version. |
| `historyStats` | `(points) => HistoryStats` | Uses only the points of the latest point's mandi. `{ enough: false, count, messageKey: 'mandi.history.notEnough' }` with fewer than 2. Otherwise `{ enough: true, market?, high, low, first, last, changePct7d, trend, spanDays, count }`. |
| `getMarketSignal` | `(place, commodityKey, snapshot?, history?) => Promise<string>` | The "AI बाजार संकेत" text. `history` defaults to `getPriceHistory(place, commodityKey)`; points or a snapshot from another place are ignored. Never throws. |
| `signalIsSafe` | `(text, input) => boolean` | The guard used on AI signals (exported for tests). |
| `trendOf` | `(changePct?) => PriceTrend` | \|Δ\| < 0.5% counts as stable. |
| `maxPriceAgeDays` | `(key) => number` | 3 for tomato, onion, potato, brinjal, cauliflower, okra, chilli; 7 for everything else. |
| `PRICE_BOUNDS` | | Plausible ₹/quintal range per crop key. |
| `MANDI_COMMODITIES` | | All 24 catalog keys. |
| `mandiPlaceKey` | `(place) => string` | `<lat1>,<lon1>`: the ~11 km cell that prices and history are kept for. |
| `mandiCacheName` | `(place, commodityKey) => string` | `mandi.crop:<placeKey>:<key>`. |
| `MANDI_MAX_AGE_MS` | | 3 h. |
| `MandiError` | `code: 'no-data' \| 'unverified'` | `messageKey` = `mandi.error.no-data` / `mandi.error.unverified`. |

`MandiSnapshotExt` is `MandiSnapshot` with `prices: MandiPriceExt[]`. Each `MandiPriceExt` always has `market`, `priceDate` and:

- `ageDays`: days from `priceDate` to today, worked out whenever the snapshot is built;
- `previousDate?` and `previousFrom?: 'source' | 'history'`;
- `sources`: the search results from the site that shows this price.

### What screens must show

- **The price date.** Whenever `ageDays > 0` (`priceDate !== today`), show `t('mandi.priceDate', { date: formatDate(priceDate) })` ("भाव की तारीख: 3 अक्टूबर") next to the price. `fetchedAt` only says when we searched, not how old the price is.
- **The disclaimer.** `indicative: true` is always set. Always show `t('common.disclaimer.price')`, plus `sources` (per row or for the snapshot).
- **No trend without a previous price.** With no `previousPrice`, `changePct` is `undefined`: show no arrow instead of "0%".
- **Errors.** For `mandi.error.unverified`, say the prices could not be confirmed. Never fall back to showing unsourced numbers.

### How prices are obtained and validated

1. The service calls `ai.generateJSON({ task: 'mandi-prices', grounding: true })` for the crops that are missing or stale at this place.
   - It asks for the latest reported modal, min and max prices in ₹/quintal at the nearest APMC mandis, with each crop's age limit, the price date, the mandi, the commodity name as written on the page, the page URL, and 3–5 nearby mandis.
   - It asks for the previous modal price and its date only when the same page shows them.
   - The prompt forbids estimates and MSP substitution.
2. **Sources are required.** A reply with no search sources is the model's memory, not a reported price: the call fails with `MandiError('unverified')`, and nothing is cached, recorded or notified. Each row must cite a URL on a site the search returned; Gemini's redirect links are matched by the site name in their title. Rows without a matching source are dropped.
3. Each row is validated, and a bad row is dropped rather than repaired:
   - **Crop.** `key` must equal a requested key exactly and must not contradict the commodity name. A name is matched against all 24 crops' names and market aliases, longest first, with Unicode word edges, so "Green gram (Moong)" is moong (dropped when only gram was asked for), "मूंगफली" is groundnut, and milled rice, sweet potato, cottonseed, cabbage and processed products (dal, atta, oil) match no crop.
   - **Numbers.** Prices must be real numbers, or numeric strings like "2,450". Ranges and prose are rejected.
   - **Bounds.** The modal price must fall inside `PRICE_BOUNDS[key]`.
   - **Dates.** The row needs a real `YYYY-MM-DD` date, not in the future and not older than `maxPriceAgeDays(key)`. Undated or badly formatted rows are dropped, never stored as today's price.
   - **Mandi.** The row needs a market name.
   - **Min/max.** These are kept only when they are in bounds and `min ≤ modal ≤ max`.
   - **Previous price from the source.** It is kept only with a valid `previousDate` before the price date, at most 7 days earlier, and within 50% of the price.
   - **Keys.** Duplicate and unknown keys are ignored.
4. `previousPrice` comes from the source when it passed step 3. Otherwise it is our own earlier observation of the **same mandi at the same place** within the last 7 days. `changePct` and `trend` follow from it.
5. Display text is cleaned up:
   - `commodity` is the Hindi crop name, plus a meaningful variety ("मिर्च (Green)"); generic labels like "Other" or "FAQ" are dropped.
   - For a display name in the current language, use `cropName(key, lang)` from `data/crop-keys.ts`.
6. **Cache.** Every requested crop gets its own entry (`mandi.crop:<placeKey>:<key>`); a crop the search did not find is cached as "not found" for 3 h. Home, the Mandi tab and a crop screen therefore show the same price, and concurrent requests for the same crop share one search. A snapshot leaves out cached prices that have aged past their limit, and its `fetchedAt` is the oldest entry used.
7. **History.** Every successful fetch upserts one point per commodity, price date and place (`placeKey`, `market`) into `KEYS.mandiHistory`, capped at 60 days. Points from older builds without a place are dropped.
8. **Notifications.** A watched crop gets a `'mandi'` notification only when it moved ≥ 3% against our own observation of the same mandi, and the price is dated today or yesterday. A previous price that came from the source never notifies. Watched crops are `profile.cropKeys` plus `KEYS.mandiWatchlist`, read as either `string[]` or `{ commodityKey }[]`.
   - Title: "{crop} का अनुमानित भाव {pct}% बढ़ा/घटा"; the body names the mandi and both dates.
   - `dedupeKey: mandi:<key>:<priceDate>`.
   - `target: { screen: 'mandi', params: { commodityKey } }`.

### AI बाजार संकेत

`getMarketSignal` sends only our numbers (latest price, previous price, the last 7 days of observations at one mandi, high/low/change) to `ai.generate({ task: 'market' })`.

- **Output.** It returns 1–2 cautious sentences that describe what happened, e.g. "पिछले 7 दिनों में गेहूं की कीमत बढ़ी है। यदि आपके पास storage की सुविधा है…".
- **Guard (`signalIsSafe`).** A reply is replaced with a rule-based sentence built from the same numbers when:
  - it predicts or guarantees prices. This covers Hindi future and "may" forms (बढ़ेगा, बढ़ने की संभावना, तेजी आ सकती है, ऊपर जाएगा, रहेगा, मिलेगा…) and English ones (will, going to, may/likely/expected … rise/fall, forecast…);
  - or it contains a number that is not in the data we sent (Devanagari digits and "2,450" are read as numbers; rounding is allowed).
- **Fallbacks.** The same rule-based text is used offline, without AI, or when there is too little data. It never throws.
- **Cache.** One signal is cached per commodity, day, language, place and exact input.

UI strings:

- `mandi.signal.title` ("AI बाजार संकेत");
- `mandi.priceDate` ("भाव की तारीख: {date}");
- `mandi.history.notEnough | high | low`;
- `mandi.nearbyMarket`;
- `mandi.error.no-data | unverified`.

---

## Testing notes (2026-10-05)

**Weather** was checked against the live API (Varanasi, Thiruvananthapuram, Delhi) and with synthetic forecasts:

- Mapping, the NAQI call, alerts and notification keys, and the cache hit on a repeat call all worked live.
- Synthetic cases covered:
  - nulls (current, daily, hourly) and the hourly gaps they leave;
  - the same cached forecast viewed the next morning (today's window, alerts for past days dropped) and two days later ("no data");
  - storm/hail thresholds and the cold-wave/frost split;
  - NAQI band edges;
  - notification escalation, repeats, downgrades, new days and the horizon.
- The live Varanasi forecast for 6–9 Oct carries daily thunder/hail codes but only one thunder hour: it no longer raises storm or hail alerts.

**Location** was checked against the live APIs:

- Hindi and English search, aliases and states all worked.
- Reverse geocoding worked for Varanasi (city), Ghatampur (town) and Jamda, Odisha (village).

**Mandi** was checked with mocked AI replies and two live grounded Gemini calls (`gemini-3.8-flash`):

- Mocked replies covered every validation rule above: per-place and per-mandi history, the per-crop cache (one call for two screens, only missing crops fetched, stale prices with `error` on failure), notifications, and the signal guard (the six forecasting sentences from review plus invented numbers).
- **Live: one grounded JSON request came back with no grounding metadata at all, i.e. no search ran.** Its wheat price (₹3,360, "previous" ₹2,524) disagreed with a second, searched call (₹2,450). The second call had grounding metadata. Such replies are now rejected as `unverified`.

**Known limits:**

- **Mandi prices need search sources.** With direct Gemini (APK builds without `VITE_API_BASE_URL`), a reply that skipped the search shows `mandi.error.unverified`. The backend provider (`server.ts`, Claude web search or Gemini with grounding) returns real source URLs and is the recommended setup for mandi prices.
- **Sources are capped at 6** by the AI providers, so a row from a site outside the first 6 results is dropped.
- **The AQI is a model estimate** (CAMS PM2.5 / PM10). It can differ from CPCB station readings, especially on dusty days.
- **Hindi place search is limited.** GeoNames lacks Hindi names for many small places, so Hindi search works best for towns and districts; small villages may need to be typed in English.
- **Spray advice errs on the cautious side.** Open-Meteo's 10 m wind is higher than wind at nozzle height.
