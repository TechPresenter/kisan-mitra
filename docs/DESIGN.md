# Kisan Mitra 2.0 — Design System Brief

Hindi-first, mobile-first Indian agriculture super-app. It should feel **trustworthy, calm and human-designed**: white surfaces, a deep agriculture green identity, generous spacing, large readable type and clear iconography. Not a generic AI dashboard.

Do **not** use excessive gradients, heavy shadows, tiny text, crowded dashboards or decorative animation. Low-end Android phones are the main target.

## Visual reference (from the product owner's reference screens)

These are the common patterns across the reference screens. Follow them closely.

- **App bar.** Solid deep green (`brand-900`) under a green status bar. Contents:
  - back arrow on the left;
  - white title (20px, semibold) with an optional small white/80% subtitle on a second line (e.g. "फसल डॉक्टर" / "फोटो से पहचानें फसल की समस्या");
  - right-side white icon buttons (bell with red dot badge, search, help).
- **Home app bar.** Logo tile plus "किसान मित्र", with search and bell on the right. Below it sits a white rounded **location pill** with a green map-pin, "वाराणसी, उत्तर प्रदेश" and a chevron-down.
- **Weather card (Home).** Rounded 20px card with a sky-blue gradient (`#1e88e5 → #64b5f6`) and a sun illustration at top-right.
  - Text: "आज का मौसम", a huge "32°C", and the condition "धूप खिली है (Sunny)".
  - A row of small white translucent chips: 💧 48% नमी, 🌬 12 km/h, AQI 58.
- **Quick-action grid.** 4 columns of square tiles. Each tile is a 56px rounded (16px) tinted icon tile with a two-tone colored icon, and a 13–14px label under it.
  - Colors are varied but soft: green, orange, sky blue, red, amber, teal, rose, indigo.
  - Labels: फसल सलाह, मंडी भाव, मौसम, फसल रोग, मिट्टी जांच, सरकारी योजना, कैलेंडर, विशेषज्ञ.
- **Bottom navigation.** White bar with 5 items: होम, मंडी, खेती, AI, प्रोफाइल. Active item is green with a filled icon. **AI is visually highlighted**: a green circular badge behind its icon, slightly raised.
- **Lists.** White rows/cards with a 1px soft border (`line`) and 16–20px radius.
  - Left: a crop image (rounded 12px, 56px) or a colored round icon. Then a bold title and a muted subtitle. Right: a chevron or a trend value.
- **Mandi rows.**
  - Left: crop image. Then "गेहूं" and "₹2,480/क्विंटल" (price in brand green, bold).
  - Right: a trend in color — green "↑ 1.8%", red "↓ 0.5%", orange "→ 0%".
  - Below the list: a lavender **"AI बाजार संकेत"** card with a purple icon.
- **Segmented tabs.** Light-gray track; the active segment is a solid green pill with white text (e.g. आज | इस सप्ताह | इस महीने, नजदीकी मंडी | फसल भाव, सितंबर | अक्टूबर | नवंबर).
- **Filter chips.** Horizontally scrollable pills; the selected one is green-filled (सभी, किसान सहायता, बीमा, सब्सिडी…).
- **Primary buttons.** Full width, 52–56px tall, solid green (`brand-700`), white bold text, 14px radius ("आगे बढ़ें", "लॉगिन करें", "विश्लेषण करें", "AI सुझाव देखें").
  - Secondary buttons are white with a green border and green text ("गैलरी से चुनें").
- **Splash / onboarding / login.**
  - Full-bleed farm landscape illustration (green fields, sun, farmer) with the logo: a white sprout on a green rounded-square tile, the title "किसान मित्र" and the tagline "खेती की हर समस्या का समाधान".
  - Onboarding shows a rounded illustration card, pagination dots and an "आगे बढ़ें" button.
  - Login has a green header with the logo, then "Google से जारी रखें" (web only), "या", inputs and a primary button.
- **Weather screen.** Large header with a sky + field illustration behind "32°C" and the condition, then the chip row.
  - "अगले 7 दिन का अनुमान": a row of day columns (weekday, icon, temperature).
  - A green-tinted card: "क्या आज स्प्रे करना सही है? आज शाम 4–6 बजे स्प्रे के लिए अच्छा समय है।" with a check icon.
- **Crop advisory.** Crop header (image, "गेहूं", "2 एकड़ • बढ़वार अवस्था"), then segmented tabs, then task rows. Each row has a colored round icon (green सिंचाई, orange कीट निगरानी, blue खाद, red मौसम चेतावनी), a title, a one-line description and a chevron.
- **Calendar.** Month segmented tabs, then task rows.
  - Left: a date tile with a big orange number and the month below ("15 अक्टूबर"). Then the title and subtitle. Right: a large checkbox.
- **Soil health.** "मिट्टी स्वास्थ्य स्कोर": a semicircle gauge "72/100 मध्यम" in green→amber, then nutrient rows.
  - Each row: label (pH, नाइट्रोजन (N)…), a short colored bar, and a status label (उचित green, कम red, मध्यम orange).
- **Crop doctor.** Camera viewfinder card with corner brackets over the photo, two buttons (📷 फोटो लें primary, 🖼 गैलरी से चुनें outline), a big "विश्लेषण करें" button and an "उदाहरण देखें" row of example thumbnails.
- **Diagnosis result.** Crop image, crop name, the issue "पत्ती का झुलसा (Leaf Rust)" and "87% निश्चितता" (green, large). Then sections लक्षण / संभावित कारण / तुरंत क्या करें as bullet lists, and a "विस्तृत सुझाव देखें" button.
- **Hisab (expenses).**
  - Tabs: खर्च | आय | कुल. Filters: "यह सीजन ▾" and "गेहूं ▾".
  - Two stat cards: कुल खर्च ₹28,500 (red tint) and कुल आय ₹72,000 (green tint).
  - A wide card: अनुमानित लाभ ₹43,500.
- **Calculators.** 2–3 column grid of tinted tiles: बीज कैलकुलेटर, खाद कैलकुलेटर, कीटनाशक मिश्रण, सिंचाई कैलकुलेटर, खेती लागत, लाभ कैलकुलेटर.
- **Schemes.** Chips, then rows with a colored icon, the name (PM-KISAN), a one-line benefit ("प्रति वर्ष ₹6,000 की सहायता") and a chevron.
- **Profile.** Big initials avatar (pastel circle), name and phone, then list rows (मेरे खेत, सेटिंग्स, भाषा — हिंदी, सहायता केंद्र).
- **Notifications.** Chips (सभी, मौसम, फसल, मंडी), then rows with a colored category icon, a title, a body and a time on the right ("2 घंटे पहले").

## Tokens

Defined as CSS variables in `index.css`, with Tailwind v4 `@theme inline` aliases. Dark mode swaps the variables under `.dark`.

| Token | Light | Use |
|---|---|---|
| `brand-950` | `#0a2e18` | Status bar on dark headers |
| `brand-900` | `#14532d` | App bars, headings on light |
| `brand-800` | `#166534` | Pressed primary |
| `brand-700` | `#15803d` | Primary buttons, links, prices |
| `brand-600` | `#16a34a` | Active nav, fresh accents |
| `brand-100` | `#dcfce7` | Selected tints |
| `brand-50` | `#f0fdf4` | Subtle tints |
| `canvas` | `#f6f8f5` | Page background behind cards |
| `surface` | `#ffffff` | Cards, sheets, nav |
| `surface-2` | `#f1f4f0` | Inputs, segmented tracks |
| `line` | `#e3e9e3` | Borders, dividers |
| `ink` | `#16211b` | Primary text |
| `ink-2` | `#4b5a51` | Secondary text |
| `ink-3` | `#7a877f` | Captions, placeholders (≥ 4.5:1 on white for ≥ 14px) |
| `sky` | `#1e88e5` | Weather |
| `sun` | `#f59e0b` | Sun, dates, warnings (amber) |
| `orange` | `#f97316` | Calendar dates, pests |
| `danger` | `#dc2626` | Only warnings, price down, errors |
| `tech` | `#6d28d9` | AI / technology features (lavender tint `#f3efff`) |

- **Typography.** Hind, bundled offline via `@fontsource/hind` (400/500/600/700).
  - Body 16px, line-height 1.55. Secondary 14px. Caption 13px (the minimum; never smaller).
  - Card titles 17px semibold. Section titles 18px bold. App bar 20px semibold. Hero numbers 36–44px bold.
- **Text scaling.** Use `rem` everywhere. Settings → large text sets the root font-size (100% / 115% / 130%).
- **Radius.** Cards 20px, list cards 16px, tiles 16px, buttons 14px, inputs 14px, chips and pills full.
- **Elevation.** Mostly borders. Shadow only for floating things (bottom nav, sheets, FAB): `0 1px 2px rgb(16 24 20 / .06), 0 6px 16px rgb(16 24 20 / .06)`.
- **Spacing.** 4px grid. Page gutter 16px. Gap between sections 20–24px. Card padding 16px.
- **Touch targets.** At least 48px (spec minimum 44px).
- **Motion.** 150–200ms ease-out for press feedback (scale .98) and sheet slide. Respect `prefers-reduced-motion`. No looping animations except the mic "listening" pulse and skeleton shimmer (which is disabled under reduced motion).
- **High contrast.** `.hc` on `<html>` darkens `ink-2`/`ink-3` and strengthens `line`.
- **Dark mode.** `.dark` on `<html>`: canvas `#0c1410`, surface `#111c16`, surface-2 `#17251d`, line `#223428`, ink `#e8f0ea`. App bars stay deep green (`#0f3d22`).

## States (every data screen)

- **Loading.** Skeleton shapes that mirror the final layout. No spinners for whole screens.
- **Empty.** Illustration, a one-line title, a helpful sentence and a primary action ("नई फसल जोड़ें").
- **Error.** Friendly Hindi message, what the farmer can do, and a "फिर कोशिश करें" button. Never show raw error text.
- **Offline / stale.** Show cached data with `<LastUpdated>` ("अपडेट: आज 10:30 AM") and a "पुरानी जानकारी" badge when older than its freshness window. Never present stale data as current.
- **AI content.** Always show the AI disclaimer where diagnosis, fertilizer or price guidance appears.

## Accessibility

- Every icon-only button has a Hindi `aria-label`.
- Form fields have visible labels, not just placeholders.
- Contrast: AA at minimum. Text never sits on photos without a scrim.
- Large touch targets, and voice input next to every free-text field that matters (chat, search, crop doctor notes, community).
