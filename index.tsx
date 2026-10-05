import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { migrateFromV1 } from './lib/migrate';
import { FEATURES } from './lib/features';
import './lib/common-strings';
import AppShell from './app/AppShell';

// Keep v1 users signed in (and their theme) before anything reads the store.
migrateFromV1();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const GOOGLE_CLIENT_ID = '479886343078-qp955ghf2ucbks61bvo26lem1affjk4h.apps.googleusercontent.com';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {FEATURES.googleLogin ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AppShell />
      </GoogleOAuthProvider>
    ) : (
      <AppShell />
    )}
  </React.StrictMode>,
);
