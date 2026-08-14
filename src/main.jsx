import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

import { DbProvider } from './context/DbContext.jsx';
import { App } from './App.jsx';
import './index.css';

registerSW({ immediate: true });

const baseUrl = import.meta.env.BASE_URL || '/';
const routerBasename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <DbProvider>
        <App />
      </DbProvider>
    </BrowserRouter>
  </StrictMode>,
);
