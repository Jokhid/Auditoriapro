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
import './pdf-logo-size-patch.ts';
import './pdf-full-width-text-patch.ts';
import './pdf-premium-closing-patch.ts';
import './professional-audit-pdf-v3.ts';
import './executive-priority-map-patch.ts';
import './v2-header-footer-patch.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
