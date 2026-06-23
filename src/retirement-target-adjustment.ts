const RETIREMENT_TARGET_FLAG = '__auditRetirementTargetAdjustmentInstalled';
const PDF_TARGET_FLAG = '__auditPdfRetirementTargetActive';

function cleanText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string) {
  return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function numberFromText(value: string) {
  const cleaned = String(value || '').replace(/[^0-9.,-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  const normalized = hasComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : hasDot && /\.\d{3}(\D|$)/.test(cleaned)
      ? cleaned.replace(/\./g, '')
      : cleaned;
  return Number(normalized) || 0;
}

function formatEuro(value: number) {
  return `${Math.round(value || 0).toLocaleString('es-ES')} €`;
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

function replaceCurrencyText(text: string) {
  return text
    .replace(/\bEUR\b/g, '€')
    .replace(/(\d)\s+€/g, '$1 €')
    .replace(/(\d)\s*€\s*\/\s*mes/g, '$1 € / mes');
}

function normalizeVisibleEuroText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const next = replaceCurrencyText(node.nodeValue || '');
    if (next !== node.nodeValue) node.nodeValue = next;
  });

  document.querySelectorAll('svg text').forEach((node) => {
    const text = cleanText(node.textContent || '');
    const match = text.match(/^(-?\d+(?:[,.]\d+)?)\s*k$/i);
    if (!match) return;
    const value = numberFromText(match[1]) * 1000;
    node.textContent = formatEuro(value);
  });
}

function updateRetirementTargetDisplay() {
  const target = retirementTargetCapital();
  updateMetricCard('Capital objetivo', formatEuro(target));

  const section = Array.from(document.querySelectorAll('main section')).find((item) => normalizeText(item.textContent || '').includes('estudio brecha de jubilacion')) as HTMLElement | undefined;
  if (!section) {
    normalizeVisibleEuroText();
    return;
  }
  Array.from(section.querySelectorAll('p')).forEach((item) => {
    const text = item.textContent || '';
    if (/Capital total previsor requerido:/i.test(text)) item.textContent = `• Capital total previsor requerido: ${formatEuro(target)}`;
  });
  alignRetirementTargetLine(section, target);
  normalizeVisibleEuroText();
}

function parseAxisMoney(value: string) {
  const text = cleanText(value);
  const short = text.match(/^(-?\d+(?:[,.]\d+)?)\s*k\s*€?$/i);
  if (short) return numberFromText(short[1]) * 1000;
  if (/^-?\d/.test(text) && /€/.test(text)) return numberFromText(text);
  return null;
}

function axisTicks(svg: SVGSVGElement) {
  const svgRect = svg.getBoundingClientRect();
  return Array.from(svg.querySelectorAll('text'))
    .map((node) => {
      const value = parseAxisMoney(node.textContent || '');
      if (value === null) return null;
      const rect = node.getBoundingClientRect();
      return { value, y: rect.top + rect.height / 2 - svgRect.top };
    })
    .filter(Boolean) as Array<{ value: number; y: number }>;
}

function chartBounds(svg: SVGSVGElement) {
  const gridLines = Array.from(svg.querySelectorAll('.recharts-cartesian-grid-horizontal line')) as SVGLineElement[];
  const verticalLines = Array.from(svg.querySelectorAll('.recharts-cartesian-grid-vertical line')) as SVGLineElement[];
  const ys = gridLines.map((line) => Number(line.getAttribute('y1'))).filter(Number.isFinite);
  const xs = verticalLines.map((line) => Number(line.getAttribute('x1'))).filter(Number.isFinite);
  if (!ys.length) return null;
  const left = xs.length ? Math.min(...xs) : Number(gridLines[0].getAttribute('x1')) || 0;
  const right = xs.length ? Math.max(...xs) : Number(gridLines[0].getAttribute('x2')) || Number(svg.getAttribute('width')) || 0;
  return { top: Math.min(...ys), bottom: Math.max(...ys), left, right };
}

function targetYFromTicks(svg: SVGSVGElement, target: number, bounds: { top: number; bottom: number }) {
  const ticks = axisTicks(svg).filter((tick) => tick.y >= bounds.top - 8 && tick.y <= bounds.bottom + 8);
  if (ticks.length >= 2) {
    const sorted = ticks.sort((a, b) => a.value - b.value);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (high.value !== low.value) {
      const ratio = (target - low.value) / (high.value - low.value);
      return high.y + (1 - ratio) * (low.y - high.y);
    }
  }
  return bounds.bottom - target / Math.max(target, 1) * (bounds.bottom - bounds.top);
}

function alignRetirementTargetLine(section: HTMLElement, target: number) {
  const svg = section.querySelector('svg.recharts-surface') as SVGSVGElement | null;
  if (!svg) return;
  const bounds = chartBounds(svg);
  if (!bounds) return;
  const y = Math.min(bounds.bottom, Math.max(bounds.top, targetYFromTicks(svg, target, bounds)));
  const redLine = Array.from(svg.querySelectorAll('path[stroke]')).find((path) => {
    const stroke = String(path.getAttribute('stroke') || '').toLowerCase();
    const parent = path.closest('.recharts-line');
    return Boolean(parent) && (stroke === '#dc2626' || stroke === 'rgb(220, 38, 38)');
  }) as SVGPathElement | undefined;
  if (redLine) {
    redLine.setAttribute('d', `M${bounds.left},${y}L${bounds.right},${y}`);
    redLine.setAttribute('data-audit-target-capital', String(Math.round(target)));
  }
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
  window.setInterval(updateRetirementTargetDisplay, 1800);
}

installRetirementTargetAdjustment();
