import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './footer-fix.css';
import './executive-summary-format.ts';
import './real-estate-adjustments.ts';
import './real-estate-metric-sync.ts';
import './pdf-summary-width-fix.ts';
import './professional-audit-pdf-v3.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
