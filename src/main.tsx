import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import PremiumAuditV2 from './PremiumAuditV2.tsx';
import './index.css';
import './premium-v2.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PremiumAuditV2 />
  </StrictMode>,
);
