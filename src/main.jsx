import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

import { DbProvider } from './context/DbContext.jsx';
import { PrivacyProvider } from './context/PrivacyContext.jsx';
import { App } from './App.jsx';
import './index.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('bookmview-pwa-update-ready'));
  },
});

const baseUrl = import.meta.env.BASE_URL || '/';
const routerBasename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <DbProvider>
        <PrivacyProvider>
          <App />
        </PrivacyProvider>
      </DbProvider>
    </BrowserRouter>
  </StrictMode>,
);
