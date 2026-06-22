import { jsPDF } from 'jspdf';

type TextArg = string | string[];
type ChartSection = 'benefits' | 'retirement' | null;

type PatchState = {
  section: ChartSection;
  benefitChartPages: Set<number>;
  retirementChartPages: Set<number>;
  suppressedPrevisorBox?: { page: number; y: number; h: number };
  textColor: number[];
  fillColor: number[];
  drawColor: number[];
};

const stateByDoc = new WeakMap<jsPDF, PatchState>();
const PATCH_FLAG = '__auditPdfChartFixInstalled';

function state(doc: jsPDF): PatchState {
  let current = stateByDoc.get(doc);
  if (!current) {
    current = {
      section: null,
      benefitChartPages: new Set<number>(),
      retirementChartPages: new Set<number>(),
      textColor: [0, 0, 0],
      fillColor: [0, 0, 0],
      drawColor: [0, 0, 0],
    };
    stateByDoc.set(doc, current);
  }
  return current;
}

function pageOf(doc: jsPDF) {
  return doc.internal.getNumberOfPages();
}

function normalizeText(value: TextArg) {
  return Array.isArray(value) ? value.join(' ') : String(value || '');
}

function colorMatches(actual: number[], expected: number[], tolerance = 3) {
  return expected.every((value, index) => Math.abs((actual[index] ?? -999) - value) <= tolerance);
}

function currentNumberFromLabel(labelText: string) {
  const needle = labelText.toLowerCase();
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((item) => (item.textContent || '').toLowerCase().includes(needle));
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return Number(String(input?.value ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function calculateBenefitData() {
  const base = currentNumberFromLabel('base cotización') || currentNumberFromLabel('base cotizacion');
  const age = currentNumberFromLabel('edad');
  const contributedYears = currentNumberFromLabel('años cotizados') || currentNumberFromLabel('anos cotizados');
  const expenses = currentNumberFromLabel('gastos mensuales') + currentNumberFromLabel('alquiler, hipoteca y préstamos');
  const spouseText = (Array.from(document.querySelectorAll('label')).find((item) => (item.textContent || '').toLowerCase().includes('estado civil'))?.querySelector('select') as HTMLSelectElement | null)?.value || '';
  const children = currentNumberFromLabel('hijos menores');
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = contributedYears + yearsToRetirement;
  const retirementRate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  const married = spouseText === 'Casado/a' || spouseText === 'Pareja de Hecho';
  const benefits = [base * 0.75, base, age >= 55 ? base * 0.75 : base * 0.55, married ? base * 0.52 : 0, base * 0.2 * children, base * retirementRate];
  return { expenses, benefits, max: Math.max(expenses, ...benefits, 1) };
}

function calculateRetirementData() {
  const age = currentNumberFromLabel('edad');
  const expenses = currentNumberFromLabel('gastos mensuales') + currentNumberFromLabel('alquiler, hipoteca y préstamos');
  const base = currentNumberFromLabel('base cotización') || currentNumberFromLabel('base cotizacion');
  const contributedYears = currentNumberFromLabel('años cotizados') || currentNumberFromLabel('anos cotizados');
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = contributedYears + yearsToRetirement;
  const retirementRate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  const pension = base * retirementRate;
  const targetCapital = Math.max(0, expenses - pension) * 12 * 23;
  const bank = currentNumberFromLabel('dinero en banco');
  const invested = currentNumberFromLabel('dinero invertido');
  const monthlySaving = currentNumberFromLabel('ahorro sistemático mensual') || currentNumberFromLabel('ahorro sistematico mensual');
  const invRate = currentNumberFromLabel('rentabilidad dinero invertido') / 100;
  const savRate = currentNumberFromLabel('rentabilidad ahorro sistemático') / 100 || currentNumberFromLabel('rentabilidad ahorro sistematico') / 100;
  const annualSaving = monthlySaving * 12;
  const years = Math.max(15, yearsToRetirement);
  const totals = Array.from({ length: years + 1 }, (_, year) => {
    const saving = savRate > 0 ? annualSaving * ((Math.pow(1 + savRate, year) - 1) / savRate) : annualSaving * year;
    return bank + invested * Math.pow(1 + invRate, year) + saving;
  });
  return { startAge: age, endAge: age + years, retirementAge: 67, max: Math.max(targetCapital, ...totals, 1) };
}

function euro(value: number) {
  return `${Math.round(value).toLocaleString('es-ES')} EUR`;
}

function drawYLabels(doc: jsPDF, x: number, y: number, h: number, max: number) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const previousSize = doc.getFontSize();
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  ticks.forEach((tick) => {
    const value = max * tick;
    const yy = y + h - 10 - tick * (h - 12);
    doc.text(euro(value), x - 2, yy + 1.6, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.12);
    doc.line(x, yy, x + 1.8, yy);
  });
  doc.setFontSize(previousSize);
}

function drawXLabels(doc: jsPDF, x: number, y: number, w: number, h: number, labels: Array<{ value: string; ratio: number }>) {
  const previousSize = doc.getFontSize();
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  labels.forEach((label) => {
    const xx = x + label.ratio * w;
    doc.text(label.value, xx, y + h + 5, { align: 'center' });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.12);
    doc.line(xx, y + h - 10, xx, y + h - 8.2);
  });
  doc.setFontSize(previousSize);
}

function drawBenefitAxisValues(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const page = pageOf(doc);
  const current = state(doc);
  if (current.benefitChartPages.has(page)) return;
  current.benefitChartPages.add(page);

  const data = calculateBenefitData();
  drawYLabels(doc, x, y, h, data.max);
}

function drawRetirementAxisValues(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const page = pageOf(doc);
  const current = state(doc);
  if (current.retirementChartPages.has(page)) return;
  current.retirementChartPages.add(page);

  const data = calculateRetirementData();
  drawYLabels(doc, x, y, h, data.max);
  const span = Math.max(1, data.endAge - data.startAge);
  drawXLabels(doc, x, y, w, h, [
    { value: `${data.startAge} años`, ratio: 0 },
    { value: `${Math.round((data.startAge + data.endAge) / 2)} años`, ratio: 0.5 },
    { value: `${data.endAge} años`, ratio: 1 },
    { value: `67 años`, ratio: Math.min(1, Math.max(0, (data.retirementAge - data.startAge) / span)) },
  ]);
}

function installPdfReportChartFix() {
  const ctor = jsPDF as unknown as { API: Record<string, unknown>; [PATCH_FLAG]?: boolean };
  if (ctor[PATCH_FLAG]) return;
  ctor[PATCH_FLAG] = true;

  const originalSetFillColor = ctor.API.setFillColor as (...args: unknown[]) => jsPDF;
  const originalSetDrawColor = ctor.API.setDrawColor as (...args: unknown[]) => jsPDF;
  const originalSetTextColor = ctor.API.setTextColor as (...args: unknown[]) => jsPDF;
  const originalRect = ctor.API.rect as (...args: unknown[]) => jsPDF;
  const originalRoundedRect = ctor.API.roundedRect as (...args: unknown[]) => jsPDF;
  const originalText = ctor.API.text as (...args: unknown[]) => jsPDF;

  ctor.API.setFillColor = function patchedSetFillColor(this: jsPDF, ...args: unknown[]) {
    state(this).fillColor = args.map(Number).slice(0, 3);
    return originalSetFillColor.apply(this, args);
  };

  ctor.API.setDrawColor = function patchedSetDrawColor(this: jsPDF, ...args: unknown[]) {
    state(this).drawColor = args.map(Number).slice(0, 3);
    return originalSetDrawColor.apply(this, args);
  };

  ctor.API.setTextColor = function patchedSetTextColor(this: jsPDF, ...args: unknown[]) {
    state(this).textColor = args.map(Number).slice(0, 3);
    return originalSetTextColor.apply(this, args);
  };

  function shouldSuppressPrevisorBox(doc: jsPDF, x: number, y: number, w: number, h: number) {
    const current = state(doc);
    const isPrevisorBox = w > 150 && h >= 24 && colorMatches(current.fillColor, [15, 23, 42]) && colorMatches(current.drawColor, [249, 115, 22]);
    if (isPrevisorBox) current.suppressedPrevisorBox = { page: pageOf(doc), y, h };
    return isPrevisorBox;
  }

  ctor.API.rect = function patchedRect(this: jsPDF, ...args: unknown[]) {
    const [x, y, w, h, style] = args as [number, number, number, number, string | undefined];
    const current = state(this);

    if (shouldSuppressPrevisorBox(this, Number(x), Number(y), Number(w), Number(h))) return this;

    const result = originalRect.apply(this, args);
    if (style === 'D' && Number(w) >= 120 && Number(h) >= 42) {
      if (current.section === 'benefits') drawBenefitAxisValues(this, Number(x), Number(y), Number(w), Number(h));
      if (current.section === 'retirement') drawRetirementAxisValues(this, Number(x), Number(y), Number(w), Number(h));
    }
    return result;
  };

  ctor.API.roundedRect = function patchedRoundedRect(this: jsPDF, ...args: unknown[]) {
    const [x, y, w, h] = args as [number, number, number, number];
    if (shouldSuppressPrevisorBox(this, Number(x), Number(y), Number(w), Number(h))) return this;
    return originalRoundedRect.apply(this, args);
  };

  ctor.API.text = function patchedText(this: jsPDF, ...args: unknown[]) {
    const value = normalizeText(args[0] as TextArg).toLowerCase();
    const current = state(this);

    if (value.includes('2. auditoría de previsión social') || value.includes('2. auditoria de prevision social')) current.section = 'benefits';
    if (value.includes('3. estudio brecha de jubilación') || value.includes('3. estudio brecha de jubilacion')) current.section = 'retirement';
    if (value.includes('4. niveles de seguridad') || value.includes('5. diagnóstico') || value.includes('5. diagnostico') || value.includes('6. resumen ejecutivo')) current.section = null;

    const y = Number(args[2]);
    const box = current.suppressedPrevisorBox;
    const insidePrevisor = box && box.page === pageOf(this) && y >= box.y - 2 && y <= box.y + box.h + 8;

    if (value.includes('estudio previsor: brecha de jubilación hasta los 90 años') || value.includes('estudio previsor: brecha de jubilacion hasta los 90 anos')) {
      originalSetTextColor.call(this, 197, 165, 102);
      const result = originalText.apply(this, args);
      originalSetTextColor.apply(this, current.textColor);
      return result;
    }

    if (insidePrevisor) {
      originalSetTextColor.call(this, 15, 23, 42);
      const result = originalText.apply(this, args);
      originalSetTextColor.apply(this, current.textColor);
      return result;
    }

    return originalText.apply(this, args);
  };
}

installPdfReportChartFix();
