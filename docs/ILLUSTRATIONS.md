# Kisan Mitra — Illustration Set

All artwork lives in `components/illustrations/` as inline SVG React components. It replaces the stock photos in the reference screens.

- **Offline.** Nothing is fetched; the art ships inside the JS bundle.
- **License-clean.** Every piece was drawn in code for this project. The only borrowed geometry is the lucide `Sprout` icon inside `AppMark` (ISC license, already a dependency via `lucide-react`).
- **Light.** The whole set is about 46 KB minified (about 17 KB gzipped). Each crop renders to at most about 2.5 KB of markup.

```ts
import { CropArt, FarmScene, SkyScene, SunGlyph, AppMark, Wordmark, EmptyArt, LeafExample } from '../components/illustrations';
```

## Style

- **Look.** Flat vector, lit from the top-left, with a light, base and shade tone per shape and no outlines. A soft ground shadow (`#000` at 7%) sits under each crop.
- **Indian context.** Mustard and wheat fields with furrows, neem-style trees, taad palms, a thatched hut, and a farmer in kurta, dhoti, orange pagdi and a red-check gamchha.
- **No text inside the art.** Callers add every word through `useT()`.

### Palette

These colours are derived from the `docs/DESIGN.md` tokens.

| Family | Tones (light → dark) | Used for |
|---|---|---|
| Leaf green | `#7cc062` `#4f9d3a` `#3f8a35` `#2f7a32` | foliage, fields |
| Brand green | `#16a34a` `#166534` `#14532d` `#064e3b` | logo, header scene, splash text (`SCENE_INK`) |
| Wheat gold | `#f4cb5e` `#e0a83a` `#c58a22` | grains, wheat tufts |
| Mustard | `#ffdd55` `#f5c21b` `#f4cf3e` | flowers, mustard field band |
| Soil brown | `#d8b07c` `#a8743f` `#6b4a2e` | paths, soil, trunks |
| Sky blue | `#62aeea` `#1a6cbf` `#0f57a6` | clear-day weather sky |
| Sun amber | `#ffe68a` `#ffd34d` `#f59e0b` | sun, EmptyArt accent |
| Tomato red | `#f47e6b` `#e5452f` `#c8301f` | tomato, chilli, gamchha |

EmptyArt draws in the UI kit's tone colours (`--tone-*`), not a fixed hex, so it follows the theme.

## Components

Every component is pure (props only) and wrapped in `memo`. Each one takes `className` and `style`.

- **Accessibility.** Art is decorative by default (`aria-hidden`). Passing `title` makes it `role="img"` with that `aria-label`; pass a translated string.
- **Sizing.** Sized components take `size` in px. Scenes have no intrinsic size: they fill their container's width, so size them with `className`.

### `CropArt`

Crop thumbnail on a soft tinted rounded tile. This is the "crop image" in lists, mandi rows, crop headers and the diagnosis result.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `crop` | `string` | — | Any key from `data/crop-keys.ts`. Unknown keys show a sprout. |
| `size` | `number` | `56` | px |
| `rounded` | `boolean` | `true` | The 12px-at-56px tile. `false` gives square corners for callers that clip. |
| `background` | `boolean` | `true` | `false` removes the tile and keeps only the crop and its shadow. |
| `title` | `string` | — | e.g. `cropName(key, lang)` when the image is meaningful on its own. |

`cropTint(crop, scheme = 'light')` returns the tile colour so headers and chips can echo it. The light tints are pastels made for dark ink. Pass the app theme (`settings.theme`) to get the dark variant: the same hue at 17% lightness, where dark-mode `ink` reads at 10:1 or better and `ink-2` at 5.8:1 or better.

```tsx
<CropArt crop="wheat" />                              // list row, 56px
<CropArt crop={crop.key} size={72} title={cropName(crop.key, lang)} />
<div style={{ background: cropTint(crop.key, settings.theme) }} className="text-ink">…</div>
```

All 24 keys are covered: wheat, paddy, maize, bajra, jowar, barley, gram, arhar, moong, urad, masoor, mustard, soybean, groundnut, cotton, sugarcane, potato, onion, tomato, brinjal, cauliflower, chilli, okra, garlic.

### `FarmScene`

Farm landscape for splash, onboarding and login.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'splash' \| 'welcome' \| 'header'` | `'splash'` | See below. |
| `fit` | `'cover' \| 'contain'` | `'cover'` | `cover` crops to fill and keeps the ground in view. |

- **`splash`** (360×640, bottom-anchored). The top half is a calm dawn sky for the logo, title and tagline. Use `className="absolute inset-0 w-full h-full"`.
- **`welcome`** (320×240). The onboarding card. Use inside a rounded `overflow-hidden` card.
- **`header`** (400×160, bottom-anchored). The sky is the `brand-900` app-bar green, so white logo and text sit on it, with fields along the bottom. Use it for the login header.

The scenes look the same in light and dark mode, so the text on them needs a colour that does not change with the theme either. Use `SCENE_INK[variant]`, not a themed class: dark mode remaps `text-brand-900` to `#4ade80`, which is about 1.4:1 on the splash sky.

```tsx
<h1 style={{ color: SCENE_INK.splash }}>{t('app.name')}</h1>    // #14532d, 7.5:1 on the splash sky
```

### `SkyScene`

The Weather screen's hero background. It has one sky per condition, each with a night mood, over the same strip of fields.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `condition` | `SkyCondition` | — | Use `weatherCodeInfo(code, isDay).scene` from `services/weather`. |
| `night` | `boolean` | `false` | Moon instead of sun, plus a darker sky and fields. Pass `!current.isDay`. `'clear-night'` is always night. |
| `fit` | `'cover' \| 'contain'` | `'cover'` | |

`SkyCondition` is the same type as `WeatherScene` in `services/weather`. That service is the only place that maps WMO codes to scenes. For example, code 2 (partly cloudy) gives `'cloudy'`, and unknown codes give `'cloudy'` too.

**Artboard.** The artboard is 360×320 and bottom-anchored, composed for `Screen tone="hero"`, where the app bar floats transparent over the art:

- **Top.** The top 80 units are empty sky; the app bar sits there.
- **Sun or moon.** It sits at (276, 168). On wide phones the cover crop trims about 75 units off the top: at 412 px the app bar covers art y 74–144. At y 168 the disc stays below the app-bar icons and inside the frame at 320–412 px widths.
- **Clouds, rain and fog banks.** They stay right of x 220 and below y 140, or below the horizon. White app-bar icons measured 5.2:1 or better over the art at every width, without counting the app bar's own scrim.
- **Text side.** The left 220 units above y 230 have only dim stars (opacity ≤ 0.45). A built-in left-to-right scrim (`#000` 28% → 0 at 65% of the width) darkens them further.
- **Fields.** They take the bottom ~46 units (y ≥ 274). Keep text out of them: leave at least 64px (`pb-16`) below the last line.

```tsx
const info = weatherCodeInfo(w.current.weatherCode, w.current.isDay);

<Screen tone="hero" title={t('weather.title')} hero={
  <div className="relative overflow-hidden text-white">
    <SkyScene condition={info.scene} night={!w.current.isDay} className="absolute inset-0 size-full" />
    <div className="relative appbar-pt px-5 pb-16">
      <p className="mt-4 text-[2.75rem] leading-none font-bold">{temp}</p>
      <p className="mt-2 text-body">{t(info.key)}</p>
      {/* chip row */}
    </div>
  </div>
}>
```

The art already has a sun or moon, so don't add a weather glyph on the right of this header.

**Measured contrast.** White text was measured on renders at 320, 360 and 412 px wide, with and without a 24px status-bar inset, laid out as in the snippet above. The bands are the "32°C" line, the condition line, and the chip row (x 20 px to 62% of the width, at most 230 px). Each figure is the 5th percentile of the pixels behind the band, in the worst of those renders:

| Scene (day / night) | Temperature (needs 3:1) | Condition (needs 4.5:1) | Chip row (needs 4.5:1) |
|---|---|---|---|
| clear | 6.9 / 16.8 | 5.9 / 15.8 | 4.9 / 14.1 |
| cloudy | 7.6 / 14.3 | 6.7 / 13.2 | 5.9 / 12.1 |
| rain | 9.9 / 16.2 | 8.8 / 15.3 | 7.5 / 14.0 |
| storm | 15.6 / 18.3 | 14.6 / 17.8 | 12.7 / 16.4 |
| fog | 6.8 / 14.2 | 6.0 / 13.1 | 5.3 / 11.6 |

These figures cover text in the left 62% of the header. Chips further right sit over clouds, rain and fog banks, so give the chips their own fill (for example a translucent dark pill) if the row runs past the middle of the header.

### `SunGlyph`

The sun at the top-right of the Home weather card, made for the `#1e88e5 → #64b5f6` gradient. `size` defaults to 96. Pass `cloud` for a partly-sunny variant.

### `AppMark` and `Wordmark`

- **`AppMark({ size = 40 })`.** The logo tile: lucide Sprout in `#bbf7d0` on a `#166534 → #064e3b` rounded square. It matches `assets/icon-only.png`.
- **`Wordmark({ size, children })`.** `AppMark` followed by caller text: `<Wordmark><span className="text-xl font-semibold">{t('app.name')}</span></Wordmark>`. The text is the accessible name; the tile is decorative.

### `EmptyArt`

Calm two-tone art for empty, offline and error states. The artboard is 4:3 and `size` sets the width (default 160).

Kinds: `crops`, `notifications`, `saved`, `search`, `offline`, `error`, `calendar`, `money`, `community`, `chat`, `soil`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `kind` | `EmptyArtKind` | — | |
| `size` | `number` | `160` | Width in px. |
| `tone` | `Tone` (from `components/ui/tones`) | `'green'` | Same tone names as `ToneIcon` and `Badge`. Draws with `TONE_TEXT[tone]`, so it follows dark mode and high contrast. |
| `color` | `string` | — | Raw CSS colour that overrides `tone`, e.g. `'currentColor'` to inherit the text colour. Prefer `tone`. |

How the art is coloured:

- **Drawing.** `currentColor` at a few opacities, set by `tone` or `color`. Don't add a `text-*` class as well, because it would compete with the tone class.
- **`--ill-paper`.** The "white" surfaces inside the art. If it is unset, they fall back to `--surface`, so they are white on light cards and `#111c16` in dark mode.
- **`--ill-accent`.** The one small warm highlight. Default `#f59e0b`.

```tsx
<EmptyArt kind="crops" />
<EmptyArt kind="error" tone="orange" />
```

### `LeafExample`

The "उदाहरण देखें" thumbnails in Crop Doctor. They show good photo framing (one leaf, filling the frame, sharp, even light), not diagnostic references.

| Prop | Type | Default |
|---|---|---|
| `kind` | `'rust' \| 'blight' \| 'yellowing' \| 'healthy'` | — |
| `size` | `number` | `72` |
| `rounded` | `boolean` | `true` |

### Kind lists and constants

`index.ts` exports typed lists to iterate:

- **Lists.** `CROP_ART_KEYS`, `FARM_SCENE_VARIANTS`, `SKY_CONDITIONS`, `EMPTY_ART_KINDS` and `LEAF_EXAMPLE_KINDS`, plus all of them together as `ILLUSTRATION_KINDS`.
- **Types.** `FarmSceneVariant`, `SkyCondition` (an alias of `WeatherScene`), `EmptyArtKind` and `LeafExampleKind`.
- **`SCENE_INK`.** The fixed text colour for each FarmScene variant.

## Dark mode

- **Crop tiles, scenes, sun and leaf examples.** They are self-contained pictures and stay as they are, like photos would.
- **Text on a FarmScene.** Because the scene doesn't change, its text must not change either. Use `SCENE_INK`, never `text-brand-*`, which dark mode remaps to light green.
- **SkyScene.** The scene follows the time of day (`night`), not the app theme. Its text is plain white (`text-white`), which no theme remaps.
- **`cropTint`.** The light tints are pastels. In dark mode, call `cropTint(crop, 'dark')` (or pass `settings.theme`), or use `bg-surface-2` instead.
- **EmptyArt.** Its drawing uses the themed `--tone-*` colours, and its paper falls back to `--surface`, so it adapts with no extra CSS.

## Adding or changing art

1. **Grid.** Crops use a 64×64 grid. Keep the art inside the rounded tile, lit from the top-left, with 2–3 tones per shape and no strokes as outlines.
2. **Markup budget.** Keep each crop under about 2.5 KB of markup. Repeated small shapes share one `<path>` per colour through `byTone()`, `ell()` and `circ()`. Arc chords are padded on purpose, because a chord shorter than the diameter self-intersects into a ring. Dots can be zero-length round-capped strokes (`M x y h0`).
3. **Unique ids.** Gradients and clip paths must use `useSvgId()`, so two instances on one screen never share ids. `CropArt` uses no ids at all, which keeps long lists cheap.
4. **SkyScene layout.** Keep the SkyScene rules above: the top 80 units empty, the sun or moon at (276, 168), anything on the right below y 140, and the left 220 units above y 230 free of clouds, fog and stars brighter than 0.6. Re-measure white-text and icon contrast at 320, 360 and 412 px after any change to sky colours or positions.
5. **Check by eye.** Render a contact sheet and look at it at 40, 56 and 128px before shipping:
   - `renderToStaticMarkup` from `react-dom/server`, then rasterise with `sharp`;
   - run it through `npx tsx` from the project root, with the script kept outside the repo;
   - render each scene in its own root, or rewrite the `ka…` ids per tile, so the tiles don't share gradients;
   - librsvg doesn't resolve `var()` in attributes, so substitute the EmptyArt paper colour before rasterising. Chromium resolves it.

## Shared change (optional)

EmptyArt already falls back to `--surface`, so nothing is required. To make the hook explicit, or to retarget the paper colour later, add this to `index.css`:

```css
:root { --ill-paper: var(--surface); }
```
