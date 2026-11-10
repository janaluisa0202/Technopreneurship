import React from 'react';
import { createRoot } from 'react-dom/client';
import { CommuterApp } from './apps/commuter/CommuterApp';
import { CommuterDataGate } from './apps/commuter/components/CommuterDataGate';
import { runtimeConfig } from './apps/commuter/services/env';
import './styles.css';
import { SettingsProvider } from './shared/settings/SettingsProvider';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider><CommuterDataGate config={runtimeConfig}><CommuterApp /></CommuterDataGate></SettingsProvider>
  </React.StrictMode>,
);
