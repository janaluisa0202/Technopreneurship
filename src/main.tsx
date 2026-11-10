import React from 'react';
import { createRoot } from 'react-dom/client';
import { CommuterApp } from './apps/commuter/CommuterApp';
import './styles.css';
import { SettingsProvider } from './shared/settings/SettingsProvider';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider><CommuterApp /></SettingsProvider>
  </React.StrictMode>,
);
