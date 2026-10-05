// Dev-only entry for the UI kit gallery: `npx vite` then open /components/ui/__gallery__/index.html.
// Not part of the app build (vite build only uses the root index.html).
import { createRoot } from 'react-dom/client';
import { Gallery } from './Gallery';

const el = document.getElementById('root');
if (el) createRoot(el).render(<Gallery />);
