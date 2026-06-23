const RETIREMENT_TARGET_FLAG = '__auditRetirementTargetAdjustmentInstalled';
const PDF_TARGET_FLAG = '__auditPdfRetirementTargetActive';

function cleanText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string) {
  return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function numberFromText(value: string) {
  return Number(String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function formatEuro(value: number) {
  return `${Math.round(value || 0).toLocaleString('es-ES')} EUR`;
}

function fieldValue(labelText: string) {
  const needle = normalizeText(labelText);
  const label = Array.from(document.querySelectorAll('label')).find((item) => normalizeText(item.textContent || '').includes(needle));
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return cleanText(input?.value || '');
}

function fieldNumber(labelText: string) {
  return numberFromText(fieldValue(labelText));
}

function estimatedRetirementPension() {
  const base = fieldNumber('base cotización') || fieldNumber('base cotizacion');
  const age = fieldNumber('edad');
  const contributedYears = fieldNumber('años cotizados') || fieldNumber('anos cotizados');
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = contributedYears + yearsToRetirement;
  const rate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  return base * rate;
}

function retirementTimeline() {
  const age = fieldNumber('edad');
  const retirementStartAge = Math.max(67, age);
  const yearsTo90 = Math.max(0, 90 - retirementStartAge);
  const mortgageYearsTo75 = Math.max(0, Math.min(75, 90) - retirementStartAge);
  return { retirementStartAge, yearsTo90, mortgageYearsTo75 };
}

function retirementTargetCapital() {
  const ordinaryExpenses = fieldNumber('gastos mensuales');
  const mortgagePayment = fieldNumber('alquiler, hipoteca y préstamos');
  const pension = estimatedRetirementPension();
  const { yearsTo90, mortgageYearsTo75 } = retirementTimeline();
  const ordinaryGap = Math.max(0, ordinaryExpenses - pension);
  return ordinaryGap * 12 * yearsTo90 + mortgagePayment * 12 * mortgageYearsTo75;
}

function impliedPdfMonthlyGap() {
  const target = retirementTargetCapital();
  return target / (23 * 12);
}

function updateMetricCard(labelText: string, value: string) {
  const needle = normalizeText(labelText);
  const label = Array.from(document.querySelectorAll('p')).find((item) => normalizeText(item.textContent || '') === needle);
  const card = label?.parentElement;
  if (!card) return;
  const valueNode = Array.from(card.querySelectorAll('p')).find((item) => item !== label && /EUR|€/.test(item.textContent || ''));
  if (valueNode) valueNode.textContent = value;
}

function updateRetirementTargetDisplay() {
  const target = retirementTargetCapital();
  updateMetricCard('Capital objetivo', formatEuro(target));

  const section = Array.from(document.querySelectorAll('main section')).find((item) => normalizeText(item.textContent || '').includes('estudio brecha de jubilacion')) as HTMLElement | undefined;
  if (!section) return;
  Array.from(section.querySelectorAll('p')).forEach((item) => {
    const text = item.textContent || '';
    if (/Capital total previsor requerido:/i.test(text)) item.textContent = `• Capital total previsor requerido: ${formatEuro(target)}`;
  });
}

function wrapRealEstateDataForPdf(win: typeof window & { auditRealEstateData?: () => Record<string, number>; [PDF_TARGET_FLAG]?: boolean }) {
  if (typeof win.auditRealEstateData !== 'function') return;
  const original = win.auditRealEstateData;
  win.auditRealEstateData = () => {
    const data = original();
    if (!win[PDF_TARGET_FLAG]) return data;
    return { ...data, retirementGap: impliedPdfMonthlyGap() };
  };
}

function markPdfGeneration(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest('button');
  if (!button || !/descargar.*pdf|descargar informe pdf|descargar auditoría/i.test(button.textContent || '')) return;
  const win = window as typeof window & { [PDF_TARGET_FLAG]?: boolean };
  win[PDF_TARGET_FLAG] = true;
  window.setTimeout(() => { win[PDF_TARGET_FLAG] = false; }, 8000);
}

function installRetirementTargetAdjustment() {
  const win = window as typeof window & { [RETIREMENT_TARGET_FLAG]?: boolean; auditRetirementTargetCapital?: () => number; auditRealEstateData?: () => Record<string, number>; [PDF_TARGET_FLAG]?: boolean };
  if (win[RETIREMENT_TARGET_FLAG]) return;
  win[RETIREMENT_TARGET_FLAG] = true;
  win.auditRetirementTargetCapital = retirementTargetCapital;
  wrapRealEstateDataForPdf(win);
  document.addEventListener('click', (event) => markPdfGeneration(event.target), true);
  document.addEventListener('input', () => window.setTimeout(updateRetirementTargetDisplay, 120));
  document.addEventListener('change', () => window.setTimeout(updateRetirementTargetDisplay, 120));
  window.addEventListener('load', updateRetirementTargetDisplay);
  window.setTimeout(updateRetirementTargetDisplay, 400);
  window.setTimeout(updateRetirementTargetDisplay, 1400);
}

installRetirementTargetAdjustment();
