const METRIC_SYNC_FLAG = '__auditRealEstateMetricSyncInstalled';

function formatEuro(value: number) {
  return `${Math.round(value).toLocaleString('es-ES')} EUR`;
}

function syncRetirementProjectionMetric() {
  const win = window as typeof window & { auditRealEstateData?: () => { projectedTotal: number } };
  if (typeof win.auditRealEstateData !== 'function') return;
  const data = win.auditRealEstateData();
  const labels = Array.from(document.querySelectorAll('p'));
  const label = labels.find((item) => (item.textContent || '').trim().toLowerCase() === 'proyección a los 67');
  const card = label?.parentElement;
  if (!card) return;
  const value = Array.from(card.querySelectorAll('p')).find((item) => item !== label && (item.textContent || '').includes('EUR'));
  if (value) value.textContent = formatEuro(data.projectedTotal);
}

function installMetricSync() {
  const win = window as typeof window & { [METRIC_SYNC_FLAG]?: boolean };
  if (win[METRIC_SYNC_FLAG]) return;
  win[METRIC_SYNC_FLAG] = true;
  document.addEventListener('input', () => window.setTimeout(syncRetirementProjectionMetric, 100));
  document.addEventListener('change', () => window.setTimeout(syncRetirementProjectionMetric, 100));
  window.addEventListener('audit-real-estate-updated', () => window.setTimeout(syncRetirementProjectionMetric, 40));
  window.addEventListener('load', syncRetirementProjectionMetric);
  window.setTimeout(syncRetirementProjectionMetric, 500);
  window.setTimeout(syncRetirementProjectionMetric, 1500);
}

installMetricSync();
