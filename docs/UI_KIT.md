# Kisan Mitra UI Kit

Design-system primitives for every screen. Import everything from the barrel:

```tsx
import { Screen, Card, ListRow, Button, toast } from '../../components/ui';
```

The visual rules live in `docs/DESIGN.md`; this file is the component API. A live gallery of every component (light, dark, high contrast and large text) is at `components/ui/__gallery__/` (dev only: run `npx vite`, then open `/components/ui/__gallery__/index.html#home`; add `?theme=dark&hc=1&scale=1.3` to preview appearances).

---

## 1. Setup (app shell, once)

```tsx
import { useApplyAppearance, Toaster, DialogHost, BottomNav } from '../components/ui';

function AppShell() {
  useApplyAppearance();            // Settings → theme / high contrast / text size → <html>
  return (
    <div className="h-dvh">        {/* Screen fills its parent: give it a height */}
      {/* …active screen… */}
      <BottomNav items={…} active={tab} onSelect={nav.switchTab} ariaLabel={t('app.nav')} />
      <Toaster />                  {/* toast() */}
      <DialogHost />               {/* confirm() / showAlert() */}
    </div>
  );
}
```

- `applyAppearance({ theme, highContrast, textScale })` is the non-hook version. It toggles `.dark` / `.hc` on `<html>`, sets `--text-scale` and updates `<meta name="theme-color">`.
- Hind is bundled offline (`@fontsource/hind` 400/500/600/700, imported in `index.css`).

## 2. Tokens and Tailwind classes

All tokens are CSS variables on `:root`, swapped under `.dark` and `.hc`, and exposed to Tailwind through `@theme inline`. Opacity modifiers work (`bg-tech/10`, `border-brand-600/30`).

| Group | Classes |
|---|---|
| Brand | `bg-brand-{950,900,800,700,600,500,200,100,50}`. `bg-brand-700` is the primary fill. **`text-brand`** is readable green text in both themes (prices, links). |
| App bar | `bg-appbar` (deep green, stays green in dark), `bg-statusbar` |
| Surfaces | `bg-canvas` (page), `bg-surface` (cards, sheets, nav), `bg-surface-2` (inputs, tracks), `bg-surface-3` (pressed, skeleton) |
| Lines | `border-line`, `border-line-strong` (hover borders, dividers; decorative only, 1.5:1) |
| Controls | `border-control` / `bg-control`: unchecked switch tracks, checkbox and radio rings, inactive page dots (≥ 3:1 on surface in every theme, WCAG 1.4.11) |
| Ink | `text-ink`, `text-ink-2` (secondary), `text-ink-3` (captions, placeholders; ≥ 4.5:1) |
| Accents | `sky`, `sun`, `orange`, `danger`, `tech` (text/icon), `danger-fill` / `tech-fill` (fills behind white text), `tech-tint` (lavender AI wash) |
| Tones | `bg-tint-{tone}` (soft wash), `text-tone-{tone}` (AA text/icon on that wash and on surface), `bg-tone-{tone}` (bar fills). Tones: `green orange sky red amber teal rose indigo tech gray` |
| Charts | `var(--viz-1…4)`: green, blue, orange, violet, CVD-validated in this order |
| Type | `text-caption` 13px (the floor) · `text-small` 14 · `text-body` 16 · `text-card-title` 17 · `text-section` 18 · `text-title` 20 (app bar) · `text-hero` 40 |
| Radius | `rounded-card` 20 · `rounded-list` 16 · `rounded-tile` 16 · `rounded-btn` 14 · `rounded-input` 14 |
| Elevation | `shadow-float` (only for floating things: nav, sheets, FAB) |
| Variants | `dark:` follows the `.dark` class; `hc:` follows `.hc` |

Utilities in `index.css`:

| Utility | What it does |
|---|---|
| `press` | 150ms press feedback (scale .98); no scale under reduced motion |
| `safe-pt` / `safe-pb` / `safe-mb` | safe-area inset padding / margin |
| `nav-pb` | bottom padding for content behind the fixed bottom nav (≈ 5rem + inset) |
| `nav-mb` | margin that clears the nav (Screen's sticky footer) |
| `nav-bottom` | `bottom` offset for floating things (toasts, FABs): clears the nav **and** the visible Screen's sticky footer (`--footer-h`) |
| `appbar-pt` | top padding equal to the app bar height (hero content under a transparent bar) |
| `bg-weather` | sky-blue gradient for the weather card and hero (`#1565c0 → #1976d2`, deeper in dark). White text on it is ≥ 4.6:1. Put only white text and `WeatherChip`s on it; never `text-white/80` or `bg-white/20` |
| `skeleton` | shimmering placeholder fill |
| `scrollbar-none` | hides scrollbars on horizontal rows |

Rules of thumb:

- Text scales with Settings → large text because everything is in `rem`; avoid `px` font sizes.
- **Devanagari matras sit above the cap height.** Never combine `truncate` / `line-clamp-*` with `leading-none` or `leading-tight`, or "मंडी" renders as "मडी". Use `leading-snug` or looser.
- In dark mode `text-brand-600…900` are remapped to the readable green automatically. Still prefer `text-brand` for green text.

## 3. Conventions

- **Icons:** pass the lucide component (`icon={Sprout}`), not an element, so the kit sizes and colours it. A ready element also works.
- **Events:** native-like controls (`Button`, `IconButton`, `Chip`) take `onClick`. Composite pressables (`ListRow`, `Card`, `IconTile`, `StatCard`, app bar actions, `SectionHeader` action) take `onPress`. Value controls take `onChange(value)` with the value, not the event (except `TextField`, which keeps the native `onChange` and adds `onValueChange(string)`).
- **Strings:** the kit only uses `common.*` and `ui.*` keys. Pass already-translated text (`t('mandi.title')`) as props.
- **Accessibility:** icon-only controls require a Hindi `label` / `aria-label`. Overlays trap focus, make the app root `inert` and register `useBackHandler`. Every control is a real button or input.
- **`key` on kit components:** the repo has no `@types/react`, so `components/ui/jsx-key.d.ts` restores `key` for function components. Delete it once `@types/react` is installed.

---

## 4. Layout

### Screen

App bar, its own scroll area (safe-area aware, padded for the bottom nav) and an optional sticky footer.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title`, `subtitle` | ReactNode | | white 20px title, 13px white/80 subtitle |
| `back` | `boolean \| () => void` | auto | auto = shown when `nav.canGoBack`, calls `nav.pop()` |
| `leading` | ReactNode | | replaces the back arrow (Home logo tile) |
| `actions` | `AppBarAction[] \| ReactNode` | | icon actions on the right |
| `headerContent` | ReactNode | | inside the green header under the title (location pill) |
| `onRefresh`, `refreshing` | | | adds a spinning refresh action |
| `padded` | boolean | `true` | 16px gutter, 16px top, 20px gap between direct children |
| `tone` | `'default' \| 'hero'` | `'default'` | hero: app bar floats transparent over `hero`, turns green after 24px of scroll |
| `hero` | ReactNode | | full-bleed illustrated header (start its content with `appbar-pt`) |
| `footer` | ReactNode | | sticky above the bottom nav. Its height is published as `--footer-h` on `<html>` while mounted, so toasts float above its button |
| `bottomNav` | boolean | `true` | `false` for screens without the nav (login, onboarding, full-screen flows) |
| `header` | boolean | `true` | `false` hides the app bar (splash) |
| `scrollRef`, `className`, `contentClassName` | | | |

```tsx
<Screen
  title={t('doctor.title')}
  subtitle={t('doctor.subtitle')}
  actions={[{ icon: Bell, label: t('ui.notifications'), badge: unread, onPress: () => nav.push('notifications') }]}
  onRefresh={res.refresh}
  refreshing={res.refreshing}
  footer={<Button fullWidth size="lg" onClick={analyse}>{t('doctor.analyse')}</Button>}
>
  {/* sections */}
</Screen>

// Home
<Screen leading={<Logo />} title="किसान मित्र" back={false}
  actions={[{ icon: Search, label: t('common.search'), onPress: openSearch }]}
  headerContent={<HeaderPill icon={MapPin} label={placeLabel(place)} onPress={pickPlace} />}>

// Weather with an illustrated header (white text on bg-weather only; an illustration behind
// text needs its own scrim)
<Screen tone="hero" title={t('weather.title')}
  hero={
    <div className="appbar-pt bg-weather px-5 pb-8 text-white">
      <p className="text-[3rem] leading-none font-bold">32°C</p>
      <p className="mt-2 text-body">{t(weatherConditionKey(code, isDay))}</p>
      <div className="mt-4 flex flex-wrap gap-2"><WeatherChip icon={Droplets}>{t('weather.humidity', { n })}</WeatherChip></div>
    </div>
  }>
```

### AppBar, AppBarActions, HeaderPill

`Screen` renders `AppBar` for you; use it directly only for custom layouts.

```ts
interface AppBarAction { icon: IconLike; label: string; onPress(): void; badge?: number | boolean; disabled?: boolean; busy?: boolean; key?: string }
```

`AppBar` props: `title`, `subtitle`, `onBack`, `leading`, `actions`, `children` (extra header content), `transparent`, `overlay` (absolute over content), `className`.
`AppBarActions` renders an `AppBarAction[]` as white icon buttons, for mixing with custom nodes.

```tsx
<HeaderPill icon={MapPin} label="वाराणसी, उत्तर प्रदेश" onPress={openPicker} ariaLabel={t('home.changePlace')} />
```

`HeaderPill`: white rounded pill for the green header. `chevron` defaults to true when pressable.

### BottomNav

```tsx
<BottomNav
  ariaLabel={t('app.nav')}
  active={nav.tab}
  onSelect={key => nav.switchTab(key)}
  items={[
    { key: 'home', label: t('app.tab.home'), icon: House },
    { key: 'mandi', label: t('app.tab.mandi'), icon: Store },
    { key: 'kheti', label: t('app.tab.kheti'), icon: Tractor },
    { key: 'ai', label: 'AI', icon: Bot, highlight: true },
    { key: 'profile', label: t('app.tab.profile'), icon: UserRound, badge: true },
  ]}
/>
```

White bar with safe-area padding; height is `--nav-h` (4.25rem), which `Screen` reserves. Active = green with a filled icon and `aria-current="page"`. `highlight` raises a green circle (AI). `badge` takes a count or `true` for a dot, and is added to the accessible name. `fixed` defaults to true.

### SectionHeader

```tsx
<SectionHeader title={t('home.myCrops')} action={{ onPress: () => nav.push('crops') }} />   // "सभी देखें ›"
<SectionHeader title="लक्षण" icon={Stethoscope} as="h3" subtitle="…" action={<ListenButton id="sym" text={text} size="sm" />} />
```

---

## 5. Actions

### Button

`variant`: `primary` (solid green, default) · `secondary` (white, green border) · `ghost` · `soft` (green tint) · `danger` · `tech` (violet, AI).
`size`: `sm` 44px (the touch-target floor) · `md` 48px (default) · `lg` 56px (main CTA).
Other props: `icon`, `iconRight`, `loading` (spinner, `aria-busy`, disabled), `fullWidth`, plus native button props (`type`, `disabled`, `onClick`, `aria-*`…).

```tsx
<Button fullWidth size="lg" onClick={next}>{t('common.next')}</Button>
<Button variant="secondary" icon={Image} fullWidth>{t('doctor.gallery')}</Button>
<Button variant="tech" icon={Sparkles} loading={busy}>{t('mandi.aiTips')}</Button>
```

### IconButton

`label` is **required** (aria-label + title). `variant`: `ghost` (default), `soft`, `solid`, `outline`, `onDark`. `size`: `sm` 44 · `md` 48 · `lg` 56. `badge`: count or dot. `iconClassName` (e.g. `animate-spin`).

```tsx
<IconButton icon={Trash2} label={t('common.delete')} variant="soft" onClick={remove} />
```

### Spinner

Small inline spinner for buttons and inline refreshes only; screens use skeletons. Props: `size` (`sm` | `md`), optional `label` (adds `role="status"`).

---

## 6. Surfaces and lists

### Card

`tone`: `default` (white + border) · `muted` · `brand` (green tint) · `tech` (lavender) · `warning` · `danger` · `sky`.
`padding`: `none | sm | md (16px, default) | lg`. `radius`: `card` (20) | `list` (16). `elevated` adds the float shadow. `onPress` makes the whole card a button. `as`: `div | section | article | li`.

```tsx
<Card><SectionHeader title="खर्च और आय" as="h3" className="mb-3" /><BarChart … /></Card>
<Card tone="tech" onPress={openSignal}>…</Card>
```

### ListRow and ListGroup

| Prop | Notes |
|---|---|
| `leading` | `Thumbnail`, `ToneIcon`, `Avatar`, `DateTile`… |
| `title`, `subtitle`, `meta` | bold title, muted subtitle (`subtitleLines` 1–3, default 2), small third line |
| `trailing` | price, trend, time, or a control (`Checkbox`, `ListenButton`), which stays separately clickable |
| `chevron` | default: shown when pressable without `trailing` |
| `onPress` | the title becomes a real `<button>` whose hit area covers the row (no nested buttons) |
| `variant` | `card` (own bordered card, default) or `plain` (inside `ListGroup`) |
| `disabled`, `ariaLabel`, `className` | |

```tsx
// Mandi row
<ListRow
  leading={<Thumbnail src={crop.image} alt="" fallback={<CropArt cropKey="wheat" />} />}
  title="गेहूं"
  subtitle={<span className="font-bold text-brand">₹2,480/क्विंटल</span>}
  trailing={<TrendBadge value={1.8} />}
  onPress={() => nav.push('mandi-detail', { commodityKey: 'wheat' })}
/>

// Calendar task
<ListRow leading={<DateTile date="2026-10-15" />} title="गेहूं की बुवाई" subtitle="खेत की तैयारी पूरी करें"
  trailing={<Checkbox checked={done} onChange={setDone} aria-label={t('calendar.markDone')} />} />

// Profile menu
<ListGroup ariaLabel={t('profile.menu')}>
  <ListRow variant="plain" leading={<ToneIcon icon={Tractor} size="sm" />} title={t('profile.farms')} onPress={…} />
  <ListRow variant="plain" leading={<ToneIcon icon={Languages} tone="sky" size="sm" />} title={t('profile.language')}
    trailing={<span className="text-small text-ink-2">हिंदी</span>} chevron onPress={…} />
</ListGroup>
```

### ToneIcon, Thumbnail, DateTile, Avatar, PaginationDots

```tsx
<ToneIcon icon={Droplets} tone="sky" />                         // size sm 36 | md 44 | lg 56 | xl 72; shape circle | rounded; duotone (default true)
<Thumbnail src={photo} alt="गेहूं" size="md" fallback={<CropArt cropKey="wheat" />} />   // 12px radius; sm 44 | md 56 | lg 72 | xl 96
<DateTile date="2026-10-15" tone="orange" />                    // big day number + short month, full date as aria-label
<Avatar name="राम कुमार" src={profile.picture} size="xl" />       // initials "रक" on a stable pastel; sm 32 | md 40 | lg 56 | xl 80
<PaginationDots count={3} index={step} onSelect={setStep} />    // onboarding dots (44px buttons when onSelect is given)
```

`initials(name)` is exported too.

### IconTile and TileGrid

```tsx
<TileGrid columns={4}>
  <IconTile icon={Sprout} label="फसल सलाह" tone="green" onPress={…} />
  <IconTile icon={Bug} label="फसल रोग" tone="red" badge={3} onPress={…} />
</TileGrid>

<TileGrid columns={2}>
  <IconTile variant="card" icon={FlaskConical} tone="amber" label="खाद कैलकुलेटर" description="प्रति एकड़ मात्रा" onPress={…} />
</TileGrid>
```

`variant`: `grid` (56px tinted icon tile + 13px label, Home quick actions) or `card` (whole tile tinted, calculators). `TileGrid` columns: 4 (Home), 2 or 3 (calculators).

### StatCard

```tsx
<div className="grid grid-cols-2 gap-3">
  <StatCard label="कुल खर्च" value={formatINR(28500)} tone="red" />
  <StatCard label="कुल आय" value={formatINR(72000)} tone="green" />
</div>
<StatCard size="lg" label="अनुमानित लाभ" value={formatINR(43500)} tone="teal" hint="यह सीजन • गेहूं" aside={<Sparkline values={trend} />} />
```

Props: `label`, `value` (pre-formatted), `tone`, `icon`, `hint`, `size` (`md` | `lg`), `colorValue` (tone-coloured value; default ink), `aside`, `onPress`.
The value is sized to the room it has (a container query): up to 24px (`md`) / 32px (`lg`), shrinking on narrow cards so "₹1,25,000" still fits a half-width card at 130% text. As a last resort it wraps inside the card instead of spilling out.

### Callout and Disclaimer

```tsx
<Callout tone="brand" title="क्या आज स्प्रे करना सही है?">आज शाम 4–6 बजे स्प्रे के लिए अच्छा समय है।</Callout>
<Callout tone="tech" title="AI बाजार संकेत" action={<Button size="sm" variant="tech">AI सुझाव देखें</Button>}>…</Callout>

<Disclaimer kind="ai" />           // common.disclaimer.ai, lavender
<Disclaimer kind="fertilizer" />   // info style
<Disclaimer kind="price" />
<Disclaimer variant="warning">…custom text…</Disclaimer>
```

`Callout` tones: `brand`, `tech`, `warning`, `danger`, `info`, `neutral`. `icon` defaults per tone (`null` hides it); also `aside` and `role` (`note` | `status` | `alert`).
`Disclaimer` must sit next to AI diagnosis, fertilizer and price guidance.

---

## 7. Selection

### Chip and ChipGroup

```tsx
<ChipGroup
  ariaLabel={t('notifications.filter')}
  value={filter}
  onChange={setFilter}
  options={[{ value: 'all', label: 'सभी' }, { value: 'weather', label: 'मौसम', count: 3 }, …]}
/>
<Chip label="यह सीजन" dropdown onClick={() => setSeasonOpen(true)} />   // pairs with SelectSheet
```

`ChipGroup` is a single-select radiogroup with arrow-key navigation. It scrolls horizontally edge-to-edge (`bleed`, default true) or wraps (`wrap`), and keeps the selected chip in view. A standalone `Chip` is a toggle (`selected`, `aria-pressed`). Chip props: `label`, `selected`, `icon`, `count`, `dropdown`.

### SegmentedTabs

```tsx
<SegmentedTabs ariaLabel={t('advisory.period')} value={tab} onChange={setTab} idPrefix="adv"
  options={[{ value: 'today', label: 'आज' }, { value: 'week', label: 'इस सप्ताह' }, { value: 'month', label: 'इस महीने' }]} />
<div role="tabpanel" id={`adv-panel-${tab}`} aria-labelledby={`adv-tab-${tab}`}>…</div>
```

Gray track with a green active pill. Props: `size` (`md` 14px text | `sm` 13px text; both are ≥ 44px tall) and a per-option `badge`.
Labels never truncate: with large text on a narrow phone they wrap at spaces ("सबसे / बड़ा") and the segment grows taller, so keep labels to one or two short words.

### Badge, CountBadge, TrendBadge

```tsx
<Badge tone="amber">{t('common.staleData')}</Badge>           // variant soft | solid | outline; size sm | md; icon
<CountBadge count={5} />  <CountBadge dot />                   // decorative; put the count in the parent's label
<TrendBadge value={1.8} />                                     // green ↑ 1.8%
<TrendBadge value={-0.5} />                                    // red ↓ 0.5%
<TrendBadge value={0} />                                       // orange → 0%
<TrendBadge value={4.2} goodWhen="down" variant="pill" />      // expenses: up is bad (red)
```

`trendOf(value, decimals)` returns `'up' | 'down' | 'stable'`.

---

## 8. Forms

Every field has a visible label, a hint or error wired with `aria-describedby`, a 52px box and 14px radius.

```tsx
<TextField label="नाम" value={name} onValueChange={setName} placeholder="जैसे: राम कुमार" hint="जैसा आधार कार्ड पर है" />
<TextField label="मोबाइल" inputMode="tel" prefix="+91" value={phone} onValueChange={setPhone} error={phoneError} />
<TextField label="सवाल" value={q} onValueChange={setQ} trailing={<MicButton size="sm" variant="ghost" onResult={setQ} />} />

<NumberField label="ज़मीन" value={area} onChange={setArea} unit="एकड़" min={0} max={500} step={0.5} stepper />
<SelectField label="इकाई" value={unit} onChange={setUnit} options={[{ value: 'acre', label: 'एकड़' }, …]} />
<DateField label="बुवाई की तारीख" value={sowing} onChange={setSowing} max={todayISO()} />
<TextArea label="समस्या बताएं" optional value={note} onChange={setNote} maxLength={300}
  trailing={<MicButton size="sm" onResult={text => setNote(n => (n ? `${n} ${text}` : text))} />} />
```

| Component | Key props |
|---|---|
| `TextField` | `label`, `hint`, `error`, `optional`, `prefix`, `suffix`, `trailing`, `leadingIcon`, `onValueChange`, plus native input props (`value`, `onChange`, `inputMode`, `maxLength`, `ref`…) |
| `NumberField` | `value: number \| null`, `onChange(n \| null)`, `min`, `max` (clamped on blur), `step`, `integer`, `unit`, `stepper`. Accepts Devanagari digits and commas (`parseNumber` exported). |
| `SelectField` | `options: { value, label, disabled? }[]`, `value`, `onChange(value)`, `placeholder` (default "चुनें"), `leadingIcon` |
| `DateField` | `value` / `onChange` as `YYYY-MM-DD`, `min`, `max` (native picker) |
| `TextArea` | `value`, `onChange(string)`, `autoGrow` (default) up to `maxRows`, `maxLength` + counter (`showCount`), `trailing` |
| `FieldShell` | label/hint/error wrapper for custom controls: `id`, `label`, `hint`, `error`, `optional`, `labelAside` |

### SearchBar

```tsx
<SearchBar value={q} onChange={setQ} onSubmit={runSearch} voice placeholder={t('search.placeholder')} />
```

`role="search"` form (48px tall) with a 44px clear button. `voice` adds a 44px mic that fills and submits the query (nothing is submitted if the screen was left while listening). `mic` is a custom slot. `variant="onDark"` for use inside the green header.

### Toggle, Checkbox, RadioCards

```tsx
<Toggle checked={s.notifications.weather} onChange={v => …} label="मौसम चेतावनी" description="तेज़ बारिश और पाले की सूचना" icon={Bell} />
<Toggle checked={on} onChange={setOn} aria-label="…" />              // bare switch: 52×32 track inside a ≥ 48px hit area

<Checkbox checked={done} onChange={setDone} aria-label={t('calendar.markDone')} />       // round, 32px, ≥ 48px hit area
<Checkbox shape="square" checked={agree} onChange={setAgree} label={t('auth.agree')} />

<RadioCards label="खेती का तरीका" value={type} onChange={setType} options={[
  { value: 'organic', label: 'जैविक खेती', description: 'गोबर खाद, जीवामृत', icon: Sprout, tone: 'green' }, …]} />
<RadioCards multiple columns={3} label="आपकी फसलें" value={crops} onChange={setCrops}
  options={CROPS.map(c => ({ value: c.key, label: c.name, media: <CropArt cropKey={c.key} /> }))} />
```

Unchecked switch tracks, checkbox rings and radio-card indicators use `control` (≥ 3:1), so they stay visible in sunlight.
`RadioCards` uses native radio/checkbox inputs inside a `fieldset`, so keyboard and screen readers work. `columns`: 1 (rows) or 2/3 (tiles). Option fields: `label`, `description`, `icon` + `tone`, or `media`, and `disabled`. It also takes `hint` and `error`.

---

## 9. Overlays

### Sheet and SelectSheet

```tsx
<Sheet open={open} onClose={() => setOpen(false)} title="मेरे खेत" description="खेत चुनें या नया जोड़ें"
  footer={<Button fullWidth size="lg" onClick={save}>{t('common.save')}</Button>}>
  …
</Sheet>

<SelectSheet open={seasonOpen} onClose={() => setSeasonOpen(false)} title="सीजन चुनें"
  value={season} onChange={setSeason}
  options={[{ value: 'rabi', label: 'रबी', description: 'अक्टूबर – मार्च' }, …]} />
```

`Sheet` props: `size` (`auto` ≤ 90% | `tall` 90% | `full`), `dismissible` (default true: scrim, back and Escape close it), `initialFocusRef`, `ariaLabel` (when there is no title), `flush` (no body padding). The sheet calls `useBackHandler(onClose, open)`, moves focus in and back out, keeps Tab inside, and makes the app root `inert`. A non-dismissible sheet still swallows the back button.

### Dialog, confirm(), showAlert()

```tsx
if (await confirm({ title: t('common.confirmDelete'), message: t('hisab.deleteBody'), tone: 'danger', icon: Trash2 })) remove();
await showAlert({ title: t('doctor.photoTooDark') });
```

Both need `<DialogHost/>` mounted once; without it they fall back to the native dialog. Defaults: confirm label "ठीक है" ("हटाएं" for `tone: 'danger'`), cancel "रद्द करें". `Dialog` is also available as a component (`open`, `onClose`, `title`, `children`, `actions`, `icon`, `tone`, `dismissible`, `role`).

### toast()

```tsx
toast(t('common.saved'));
toast.success(t('common.saved'), { action: { label: t('hisab.undo'), onPress: undo } });
toast.error(t('common.error.generic'));
toast.info(…); toast.warning(…); toast.dismiss(id);
toast({ message, tone: 'info', duration: 6000, id: 'sync' });   // same id replaces instead of stacking
```

Works outside React. At most 3 are shown at once, above the bottom nav and above the visible Screen's sticky footer (so a toast never covers "सेव करें"), inside a polite live region. Default duration is 4s, or 6.5s with an action. `<Toaster offset="bottom"/>` is for screens without a nav.

---

## 10. Feedback and state

```tsx
if (res.loading) return <SkeletonList rows={5} trailing />;          // whole-screen loading: skeletons, never spinners
if (res.error && !res.data) return <ErrorState error={res.error} onRetry={res.refresh} retrying={res.refreshing} />;
if (!items.length) return <EmptyState art={<EmptyCropsArt />} title="अभी कोई फसल नहीं जोड़ी"
  body="अपनी फसल जोड़ें और रोज़ की सलाह पाएं।" action={{ label: 'नई फसल जोड़ें', icon: Plus, onPress: add }} />;

<OfflineBanner />                                                    // shows itself while offline (useOnline)
<LastUpdated at={res.fetchedAt} stale={res.stale} refreshing={res.refreshing} onRefresh={res.refresh} />
```

| Component | Props |
|---|---|
| `Skeleton` | `className` (size it), `rounded` (`sm md lg card full`), `style` |
| `SkeletonText` | `lines` |
| `SkeletonCard` | `media`, `lines`, `banner` |
| `SkeletonList` | `rows`, `variant` (`card` \| `plain`), `media` (`square` \| `circle` \| `none`), `trailing` |
| `EmptyState` | `art` or `icon` + `tone`, `title`, `body`, `action`, `secondaryAction`, `compact` |
| `ErrorState` | `error` (never shown raw: an AI error's `messageKey` is translated; offline shows `common.error.offline`), `title`, `message`, `onRetry`, `retrying`, `compact` (inline card for one failed section) |
| `OfflineBanner` | `show` (force), `className` |
| `LastUpdated` | `at`, `stale` ("पुरानी जानकारी" badge), `refreshing`, `onRefresh` |

Skeleton presets announce one "लोड हो रहा है…" to screen readers. The shimmer stops under reduced motion.

---

## 11. Data viz

Charts are hand-rolled SVG drawn at real pixel width. They carry a full-data `aria-label` (`role="img"`), show a tooltip on hover, tap and ←/→ keys, and use rem-based labels so large text works. Series colours follow the validated order green, blue, orange, violet (`VIZ_COLORS`). Assign them in order and never cycle; fold a 5th series into "अन्य".

### Gauge

```tsx
<Gauge value={72} label="मध्यम" tone="orange" caption="मिट्टी स्वास्थ्य स्कोर" />
```

Semicircle, red → amber → green along the scale. `max` (100), `tone` (default from the score: < 45 red, < 75 orange, else green, via `gaugeTone`), `footer`.

### ProgressBar and LevelBar

```tsx
<ProgressBar label="फसल अवस्था" valueLabel="60%" value={60} tone="green" />
<LevelBar label="नाइट्रोजन (N)" detail="180 kg/ha" value={30} status="low" />   // red "कम"
<LevelBar label="pH" detail="6.8" value={68} status="good" />                  // green "उचित"
```

`LevelBar` `status`: `good` (उचित, green), `medium` (मध्यम, orange), `low` (कम, red), `high` (ज़्यादा, amber). `statusLabel` overrides the word. It uses `role="meter"`.

### BarChart

```tsx
<BarChart
  title="खर्च और आय"
  series={[{ key: 'income', label: 'आय' }, { key: 'expense', label: 'खर्च' }]}
  data={[{ label: 'सित', values: [18000, 9500] }, { label: 'अक्टू', values: [42000, 11000] }]}
  formatValue={formatINR}
/>
```

Grouped or single columns (≤ 24px bars, 2px gaps, 4px rounded tops). A legend appears for 2+ series. `formatTick` defaults to compact (72K, 1.2L) unless that would repeat a label. `height` is the plot height in px (default 160).

### LineChart and Sparkline

```tsx
<LineChart title="गेहूं का भाव" data={last7.map(p => ({ label: formatWeekday(p.date), value: p.price }))}
  formatValue={n => formatINR(n)} tone="brand" />
<Sparkline values={prices} tone={trendOf(change)} className="w-16" height={24} />
```

`LineChart`: 2px line, a 10% wash (`area`), an end dot with a surface ring, the value labelled at the end only, and a crosshair tooltip. `tone`: `brand`, `up`, `down`, `stable`, `neutral`.
`Sparkline`: width from the class (default `w-20`). Pass `label` for an accessible summary; without one it is decorative, so pair it with a `TrendBadge`.

### WeatherGlyph

```tsx
<WeatherGlyph code={w.weatherCode} isDay={w.isDay} className="size-8" />
<WeatherGlyph code={0} colored={false} className="size-24 text-[#ffd54f]" />   // on the blue card
t(weatherConditionKey(code, isDay))   // "धूप खिली है", "बारिश", "आंधी-तूफ़ान"…
```

It maps WMO codes to lucide icons with sensible colours (amber sun, indigo moon, gray cloud and fog, blue rain, violet storm). `weatherKind(code)` groups codes into `clear partly cloudy fog drizzle rain heavyRain showers snow thunder`. Condition strings are `ui.weather.*`.

### WeatherCard and WeatherChip

```tsx
// Home
<WeatherCard
  title={t('home.todayWeather')}                       // "आज का मौसम"
  temperature={`${Math.round(w.temp)}°C`}
  condition={t(weatherConditionKey(w.weatherCode, w.isDay))}
  code={w.weatherCode}
  isDay={w.isDay}
  onPress={() => nav.push('weather')}
  chips={<>
    <WeatherChip icon={Droplets}>{t('home.humidity', { n: w.humidity })}</WeatherChip>   // "48% नमी"
    <WeatherChip icon={Wind}>{t('home.wind', { n: w.wind })}</WeatherChip>                // "12 km/h"
    <WeatherChip icon={CloudSun}>{t('home.aqi', { n: aqi })}</WeatherChip>
  </>}
/>

// Any other content on bg-weather (the Weather screen hero)
<WeatherChip icon={Droplets}>48% नमी</WeatherChip>
```

`WeatherCard`: rounded 20px `bg-weather` card with a heading, a 40px temperature, the condition, the glyph at the top-right (yellow for sun, white otherwise; `art` replaces it) and a chip row. Props: `title`, `temperature`, `condition`, `code`, `isDay`, `art`, `chips`, `footer`, `onPress` (whole card becomes a button), `ariaLabel`, `className`. Text keeps clear of the glyph.
`WeatherChip`: small `bg-black/20` pill with white 13px text and an optional `icon` (≥ 6:1 on every gradient stop). Use it instead of hand-rolled `bg-white/20` chips, which fail contrast.

---

## 12. Voice

```tsx
<MicButton onResult={text => setQuestion(text)} size="lg" variant="solid" />
<ListenButton id={`advice-${crop.id}`} text={adviceText} />            // "सुनें" ↔ "रोकें"
<ListenButton id={msg.id} text={msg.text} variant="icon" size="sm" />
```

`MicButton` calls `listen()` from `services/voice.ts`. It is a toggle: tap to listen, tap again to stop. While listening it shows a red pulse (a static ring under reduced motion), `aria-pressed="true"` and a status announcement; its accessible name stays "बोलकर लिखें". A cancelled session, or one still running when the button unmounts (the screen was left), never calls `onResult`, so a late result cannot search or navigate from a screen the farmer has left. It passes an `AbortSignal` to `listen()` so the recogniser itself stops once the voice service supports one. Unsupported or denied microphones and empty results show a toast (`common.voice.*`, `ui.voice.*`). Props: `size` (`sm` 44 | `md` 48 | `lg` 64), `variant` (`soft` | `solid` | `ghost` | `onDark`), `label`, `lang`, `disabled`, `onListeningChange`.
`ListenButton` uses `useSpeaker()`: only the item whose `id` is speaking shows "रोकें". It is disabled when `text` is empty. Sizes: pill `sm` 44px / `md` 48px tall; icon `sm` 44 / `md` 48.

---

## 13. Hooks and helpers

| Export | Use |
|---|---|
| `cx(...classes)` | join class names, skipping falsy values |
| `renderIcon(icon, props)`, `DUOTONE`, `IconLike` | render an icon prop the kit way |
| `TINT_BG`, `TONE_TEXT`, `TONE_FILL`, `SOLID_BG`, `toneVar(tone)`, `toneFor(key)`, `LEVEL_TONE` | tone class maps; `toneFor` gives a stable pastel per string |
| `useOptionalNav()` | `useNav()` that returns `null` outside `NavProvider` |
| `useElementWidth()` | `[ref, width]` via ResizeObserver |
| `useRoving(count, active, onMove)` | arrow-key single-select groups |
| `useModalFocus(active, panelRef, initialFocusRef?)`, `usePresence(open)` | build custom overlays that behave like `Sheet` |
| `VIZ_COLORS`, `LINE_COLOR`, `niceScale`, `formatCompact`, `tickFormatter` | chart plumbing |

## 14. Kit strings (`ui.*`)

`ui.notifications`, `ui.badge.count` ({n}), `ui.badge.new`, `ui.clear`, `ui.more`, `ui.selected`, `ui.page` ({n}, {total}), `ui.refreshing`, `ui.select.placeholder`, `ui.number.decrease|increase|range`, `ui.dialog.ok`, `ui.error.title`, `ui.error.offlineTitle`, `ui.voice.start|noSpeech|error`, `ui.trend.up|down|stable`, `ui.status.good|medium|low|high`, `ui.chart.lineSummary`, `ui.chart.trend`, `ui.weather.clear|clearNight|partly|cloudy|fog|drizzle|rain|heavyRain|showers|snow|thunder`. Reuse them freely, for example `t('ui.notifications')` for the bell's label.
