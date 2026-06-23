const BENEFIT_RATE_FLAG = '__auditBenefitRateLabelsInstalled';

function cleanText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value: string) {
  return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function numberFromText(value: string) {
  return Number(String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function fieldValue(labelText: string) {
  const needle = normalize(labelText);
  const label = Array.from(document.querySelectorAll('label')).find((item) => normalize(item.textContent || '').includes(needle));
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return cleanText(input?.value || '');
}

function fieldNumber(labelText: string) {
  return numberFromText(fieldValue(labelText));
}

function retirementRatePercent() {
  const age = fieldNumber('edad');
  const years = fieldNumber('años cotizados') || fieldNumber('anos cotizados');
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = years + yearsToRetirement;
  if (estimatedYears < 15) return 0;
  if (estimatedYears >= 36.5) return 100;
  return Math.round((0.5 + (estimatedYears - 15) * (0.5 / 21.5)) * 100);
}

function benefitRates() {
  const age = fieldNumber('edad');
  const state = fieldValue('estado civil');
  const children = fieldNumber('hijos menores');
  const married = state === 'Casado/a' || state === 'Pareja de Hecho';
  return new Map<string, string>([
    ['baja laboral', '75% base reguladora'],
    ['invalidez absoluta', '100% base reguladora'],
    ['invalidez profesional', `${age >= 55 ? '75' : '55'}% base reguladora`],
    ['viudedad', married ? '52% base reguladora' : '0% sin cónyuge/pareja computable'],
    ['orfandad', children > 0 ? `${20 * children}% total (${children} x 20%)` : '0% sin hijos computables'],
    ['jubilación', `${retirementRatePercent()}% base reguladora estimada`],
  ]);
}

function renderBenefitRates() {
  const section = Array.from(document.querySelectorAll('main section')).find((item) => normalize(item.textContent || '').includes('auditoria de prevision social')) as HTMLElement | undefined;
  if (!section) return;
  const rates = benefitRates();
  Array.from(section.querySelectorAll('article')).forEach((card) => {
    const label = card.querySelector('p');
    if (!label) return;
    const key = normalize(label.textContent || '').replace(/\(.+\)/g, '').trim();
    const rate = rates.get(key);
    if (!rate) return;
    label.textContent = `${cleanText(label.textContent || '').replace(/\s*\(.+\)$/, '')} (${rate})`;
  });
}

function installBenefitRateLabels() {
  const win = window as typeof window & { [BENEFIT_RATE_FLAG]?: boolean };
  if (win[BENEFIT_RATE_FLAG]) return;
  win[BENEFIT_RATE_FLAG] = true;
  document.addEventListener('input', () => window.setTimeout(renderBenefitRates, 80));
  document.addEventListener('change', () => window.setTimeout(renderBenefitRates, 80));
  window.addEventListener('load', renderBenefitRates);
  window.setTimeout(renderBenefitRates, 300);
  window.setTimeout(renderBenefitRates, 1200);
}

installBenefitRateLabels();
