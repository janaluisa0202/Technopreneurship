
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot } from './shared/AppRoot';
import './styles.css';
import { SettingsProvider } from './shared/settings/SettingsProvider';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <AppRoot />
    </SettingsProvider>
  </React.StrictMode>,
);
