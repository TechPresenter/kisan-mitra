# Kisan Mitra 2.0 — Architecture & Conventions

## Stack

- React 19 + TypeScript, Vite 6, Tailwind CSS v4.
- Capacitor 8 for Android. The same code runs on the web.
- Express server (`server.ts`). It is optional for app builds and required for the web build's AI calls.
- No router library. Navigation is a custom per-tab stack (`lib/nav.tsx`).

## Folder layout

| Path | What lives there |
|---|---|
| `app/` | App shell, auth gate, bottom navigation, screen registry (`app/registry.ts`) |
| `screens/<module>/` | One folder per feature module. Each screen file default-exports a React component. |
| `components/ui/` | Design system primitives. Import from `components/ui` (barrel `index.ts`). |
| `components/illustrations/` | SVG crop art, scenes, empty-state art, logo |
| `lib/` | Framework-free infrastructure: store, cache, nav, i18n, format, analytics, image, back handler |
| `services/` | Data and integration services: AI, weather, location, mandi, voice, notifications, reminders, saved items, advisory, tasks |
| `data/` | Static, versioned content: crop catalog, diseases, techniques, schemes, unit presets |
| `types/models.ts` | All persisted data models |
| `docs/` | This file, `DESIGN.md`, `UI_KIT.md` (component API) |

## Rules for every module

1. **No new npm dependencies.** Use what is installed: React, lucide-react, Capacitor plugins, `@google/genai` (only inside `services/ai`).
2. **Own your files.** A module may only edit files inside its own `screens/<module>/` folder, plus any service/data files explicitly assigned to it. Ask for shared changes in your final report; don't make them.
3. **Strings.**
   - Every user-facing string goes through `useT()` with a module prefix (`weather.title`).
   - Register the strings in `screens/<module>/strings.ts` with `registerStrings({ hi: {...}, en: {...} })`, and import that file at the top of each screen.
   - Hindi is the primary language: write natural, simple Hindi, not literal translations. Shared words (save, retry, today…) already exist as `common.*` keys in `lib/common-strings.ts`.
4. **Data.**
   - Persist through `lib/store.ts`: `usePersisted`, `useCollection`, `collection()`, `KEYS`.
   - Fetch through `lib/cache.ts`: `useResource` / `fetchWithCache`, so data works offline and carries `fetchedAt`.
5. **AI.**
   - Only via `services/ai` (`ai.generate` / `ai.generateJSON` with a `task`). Never import `@google/genai` elsewhere.
   - Catch `AIError` and show `t(err.messageKey)`.
6. **Navigation.**
   - `const nav = useNav()`, then `nav.push('crop-detail', { id })`, `nav.pop()`, `nav.switchTab('mandi')`. Screen params come from `useRoute().params`.
   - Overlays (sheets, dialogs) must call `useBackHandler(close, open)` so the Android back button closes them first.
7. **Layout.** Use `<Screen>` from the UI kit: app bar, safe areas, scroll and bottom-nav padding. Don't hand-roll headers.
8. **States.** Every async view renders loading (skeleton), empty, error (with retry) and offline/stale states.
9. **Privacy.** Analytics via `track()` only, with enum/count props. Never log names, phone numbers, photos or free text.
10. **Images.** Compress user photos with `lib/image.ts` before sending or storing. Store thumbnails only.
11. **Performance.** Screens are lazy-loaded. Avoid large inline data in screens (put it in `data/`). Memoize long lists. No heavy animation.

## AI provider

`services/ai/index.ts` selects the provider:

1. `VITE_API_BASE_URL` set: the backend provider calls `server.ts /api/ai/generate`. This is recommended for production, because keys stay on the server.
2. `VITE_GEMINI_API_KEY` set: direct Gemini. The key ships inside the APK, so restrict it in Google Cloud Console.
3. Web build without either: same-origin backend.

The shared persona, safety rules and language instruction are prepended to every request. Adding a provider means implementing `AIProvider` in `services/ai/providers/`.
