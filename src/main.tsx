import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './footer-fix.css';
import './executive-summary-format.ts';
import './real-estate-adjustments.ts';
import './real-estate-metric-sync.ts';
import './benefit-rate-labels.ts';
import './retirement-target-adjustment.ts';
import './pdf-currency-format-patch.ts';
import './professional-audit-pdf-v3.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
