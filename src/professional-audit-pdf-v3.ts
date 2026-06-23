import { jsPDF } from 'jspdf';

const FLAG = '__auditProfessionalPdfV3Installed';
const BLACK = [26, 26, 26] as const;
const SLATE = [15, 23, 42] as const;
const MUTED = [71, 85, 105] as const;
const BORDER = [226, 232, 240] as const;
const LIGHT = [248, 250, 252] as const;
const GOLD = [197, 165, 102] as const;
const RED = [220, 38, 38] as const;
const GREEN = [22, 163, 74] as const;
const ORANGE = [249, 115, 22] as const;
const BLUE = [96, 165, 250] as const;
const M = 14;
const W = 182;

type Field = { label: string; value: string; note?: string };
type Benefit = { label: string; rate: string; value: number; gap: number };
type ProjectRow = { name: string; target: number; years: number; monthly: number; status: string };
type QuestionRow = { label: string; title: string; answer: string; explanation: string };
type PageState = { page: number; y: number; title: string };
type Metrics = ReturnType<typeof collectMetrics>;

function clean(value: string) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function normalize(value: string) { return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function slug(value: string) { return normalize(value || 'cliente').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'; }
function numberFromText(value: string) { return Number(String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0; }
function money(value: number) { return `${Math.round(value || 0).toLocaleString('es-ES')} €`; }
function moneyMonth(value: number) { return `${money(value)} / mes`; }
function percent(value: number) { return `${Number(value || 0).toLocaleString('es-ES')}%`; }
function shortMoney(value: number) {
  const rounded = Math.round(value || 0);
  if (Math.abs(rounded) >= 1000000) return `${(rounded / 1000000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M €`;
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 1000).toLocaleString('es-ES')} k €`;
  return `${rounded.toLocaleString('es-ES')} €`;
}
function fieldElement(labelText: string) {
  const needle = normalize(labelText);
  return Array.from(document.querySelectorAll('label')).find((item) => normalize(item.textContent || '').includes(needle));
}
function fieldValue(labelText: string) {
  const input = fieldElement(labelText)?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return clean(input?.value || '');
}
function fieldNumber(labelText: string) { return numberFromText(fieldValue(labelText)); }
function sectionByText(text: string) {
  const needle = normalize(text);
  return Array.from(document.querySelectorAll('main section')).find((section) => normalize(section.textContent || '').includes(needle)) as HTMLElement | undefined;
}
function realEstateData() {
  const win = window as typeof window & { auditRealEstateData?: () => Record<string, number> };
  return typeof win.auditRealEstateData === 'function' ? win.auditRealEstateData() : {} as Record<string, number>;
}
function selectedAnswer(titlePart: string) {
  const label = fieldElement(titlePart);
  const select = label?.querySelector('select') as HTMLSelectElement | null;
  return clean(select?.value || 'No indicado');
}
function retirementRatePercent(age: number, years: number) {
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = years + yearsToRetirement;
  const rate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  return rate * 100;
}
function projectedValueAt(m: Metrics, years: number) {
  const invRate = m.investmentReturn / 100;
  const savRate = m.savingReturn / 100;
  const annualSaving = m.monthlySaving * 12;
  const invested = m.invested * Math.pow(1 + invRate, years);
  const saving = savRate > 0 ? annualSaving * ((Math.pow(1 + savRate, years) - 1) / savRate) : annualSaving * years;
  const rents = Number(m.estate.realEstateRents || 0) * 12 * years;
  const realEstateAtEnd = m.yearsToRetirement > 0 ? m.realEstateInvestments * (years / m.yearsToRetirement) : m.realEstateInvestments;
  return m.bank + invested + saving + rents + realEstateAtEnd;
}
function collectMetrics() {
  const estate = realEstateData();
  const salary = fieldNumber('salario neto mensual');
  const base = fieldNumber('base cotización') || fieldNumber('base cotizacion');
  const age = fieldNumber('edad');
  const years = fieldNumber('años cotizados') || fieldNumber('anos cotizados');
  const expenses = fieldNumber('gastos mensuales') + fieldNumber('alquiler, hipoteca y préstamos');
  const bank = fieldNumber('dinero en banco');
  const invested = fieldNumber('dinero invertido');
  const investmentReturn = fieldNumber('rentabilidad dinero invertido') || fieldNumber('rentabilidad inversión') || 0;
  const monthlySaving = fieldNumber('ahorro sistemático mensual') || fieldNumber('ahorro sistematico mensual');
  const savingReturn = fieldNumber('rentabilidad ahorro sistemático') || fieldNumber('rentabilidad ahorro sistematico') || 0;
  const realEstateRents = Number(estate.realEstateRents || 0);
  const adjustedExpenses = Number(estate.adjustedExpenses ?? Math.max(0, expenses - realEstateRents));
  const yearsToRetirement = Math.max(0, 67 - age);
  const retirementRate = retirementRatePercent(age, years) / 100;
  const retirementPension = Number(estate.retirementPension ?? base * retirementRate);
  const state = fieldValue('estado civil');
  const married = state === 'Casado/a' || state === 'Pareja de Hecho';
  const children = fieldNumber('hijos menores');
  const benefitValue = (value: number) => ({ value, gap: Math.max(0, expenses - value) });
  const benefits: Benefit[] = [
    { label: 'Baja laboral', rate: '75% base reguladora', ...benefitValue(base * 0.75) },
    { label: 'Invalidez absoluta', rate: '100% base reguladora', ...benefitValue(base) },
    { label: 'Invalidez profesional', rate: `${age >= 55 ? '75' : '55'}% base reguladora`, ...benefitValue(age >= 55 ? base * 0.75 : base * 0.55) },
    { label: 'Viudedad', rate: married ? '52% base reguladora' : '0% sin cónyuge/pareja computable', ...benefitValue(married ? base * 0.52 : 0) },
    { label: 'Orfandad', rate: `${children > 0 ? `${20 * children}% total (${children} x 20%)` : '0% sin hijos computables'}`, ...benefitValue(base * 0.2 * children) },
    { label: 'Jubilación', rate: `${percent(retirementRate * 100)} base reguladora estimada`, ...benefitValue(retirementPension) },
  ];
  const publicGap = Math.max(0, expenses - retirementPension);
  const adjustedGap = Math.max(0, adjustedExpenses - retirementPension);
  const retirementGap = Number(estate.retirementGap ?? adjustedGap) || adjustedGap || publicGap;
  const targetCapital = retirementGap * 12 * 23;
  const retirementMonths = 23 * 12;
  const accumulationMonths = Math.max(1, yearsToRetirement * 12);
  const recommendedSaving = Math.ceil(targetCapital / accumulationMonths);
  const projectedInvested = Number(estate.projectedInvested ?? invested * Math.pow(1 + investmentReturn / 100, yearsToRetirement));
  const projectedSaving = Number(estate.projectedSaving ?? (savingReturn > 0 ? monthlySaving * 12 * ((Math.pow(1 + savingReturn / 100, yearsToRetirement) - 1) / (savingReturn / 100)) : monthlySaving * 12 * yearsToRetirement));
  const projectedRents = Number(estate.projectedRents ?? realEstateRents * 12 * yearsToRetirement);
  const realEstateInvestments = Number(estate.realEstateInvestments || 0);
  const projectedTotal = Number(estate.projectedTotal ?? bank + projectedInvested + projectedSaving + projectedRents + realEstateInvestments);
  const emergencyMonths = expenses > 0 ? bank / expenses : 0;
  const capacity = Math.max(0, salary - expenses);
  const totalProjectNeed = collectProjectRows(capacity).reduce((sum, project) => sum + project.monthly, 0);
  const projectStatus = capacity <= 0 || totalProjectNeed > capacity * 1.15 ? 'No viable' : totalProjectNeed > capacity ? 'Ajustado' : 'Viable';
  return { estate, salary, base, age, years, expenses, adjustedExpenses, bank, invested, investmentReturn, monthlySaving, savingReturn, yearsToRetirement, retirementMonths, accumulationMonths, retirementPension, retirementGap, targetCapital, recommendedSaving, benefits, projectedInvested, projectedSaving, projectedRents, realEstateInvestments, projectedTotal, emergencyMonths, capacity, totalProjectNeed, projectStatus };
}
function collectProjectRows(capacity: number): ProjectRow[] {
  const section = sectionByText('Objetivos a medio y largo plazo');
  if (!section) return [];
  const rows = Array.from(section.querySelectorAll('div')).filter((item) => {
    const el = item as HTMLElement;
    return String(el.className || '').includes('grid-cols-12') && normalize(el.textContent || '').includes('eliminar');
  });
  return rows.map((row) => {
    const inputs = Array.from(row.querySelectorAll('input')) as HTMLInputElement[];
    const name = clean(inputs[0]?.value || 'Proyecto');
    const target = numberFromText(inputs[1]?.value || '0');
    const years = Math.max(1, numberFromText((inputs.find((input) => input.type === 'range') || inputs[2])?.value || '1'));
    const monthly = target / Math.max(1, years * 12);
    const status = capacity > 0 && monthly <= capacity ? 'Viable' : capacity > 0 && monthly <= capacity * 1.15 ? 'Ajustado' : 'No viable';
    return { name, target, years, monthly, status };
  }).filter((row) => row.name && row.name !== 'Nuevo objetivo');
}
function collectQuestionRows(): QuestionRow[] {
  const section = sectionByText('Cuestionario completo de auditoría');
  if (!section) return [];
  return Array.from(section.querySelectorAll('label')).map((card) => {
    const select = card.querySelector('select') as HTMLSelectElement | null;
    if (!select) return null;
    const spans = Array.from(card.querySelectorAll('span')).map((span) => clean(span.textContent || '')).filter(Boolean);
    return { label: spans[0] || 'Pregunta', title: spans[1] || clean(card.textContent || ''), explanation: spans[2] || 'Permite identificar una posible vulnerabilidad y priorizar medidas de protección financiera.', answer: clean(select.value || 'No indicado') };
  }).filter(Boolean) as QuestionRow[];
}
function appScores(m: Metrics) {
  const p01 = selectedAnswer('protección privada que complemente la baja laboral');
  const p02 = selectedAnswer('familia tendría capital suficiente');
  const p03 = selectedAnswer('acceso sanitario privado');
  const p06 = selectedAnswer('batir inflación');
  const p07 = selectedAnswer('testamento');
  const p08 = selectedAnswer('documentación, claves y pólizas');
  const clamp = (value: number) => Math.min(10, Math.max(1, Math.round(value)));
  return [
    { label: 'Fondo', score: clamp(m.emergencyMonths * 1.8) },
    { label: 'Baja', score: p01 === 'Si' ? 10 : p01 === 'Parcialmente' ? 6 : 2 },
    { label: 'Familia', score: p02 === 'Si' ? 10 : 3 },
    { label: 'Sanidad', score: p03 === 'Si' ? 10 : 3 },
    { label: 'Inflación', score: p06 === 'Si' ? 10 : m.bank > 6000 ? 2 : 5 },
    { label: 'Legal', score: (p07 === 'Si' ? 5 : 1) + (p08 === 'Si' ? 5 : 1) },
  ];
}
function clientFields(m: Metrics): Field[] {
  return [
    { label: 'Nombre del cliente', value: fieldValue('nombre') || 'No indicado' },
    { label: 'Teléfono del cliente', value: fieldValue('teléfono') || 'No indicado' },
    { label: 'Email del cliente', value: fieldValue('email') || 'No indicado' },
    { label: 'Edad', value: `${fieldValue('edad') || '-'} años` },
    { label: 'Años cotizados', value: `${fieldValue('años cotizados') || '-'} años` },
    { label: 'Base de cotización', value: moneyMonth(m.base) },
    { label: 'Estado civil', value: fieldValue('estado civil') || 'No indicado' },
    { label: 'Hijos menores de 25 años', value: fieldValue('hijos menores') || '0' },
    { label: 'Salario neto mensual', value: moneyMonth(m.salary) },
    { label: 'Gastos mensuales personales', value: moneyMonth(fieldNumber('gastos mensuales')) },
    { label: 'Alquiler, hipoteca y préstamos', value: moneyMonth(fieldNumber('alquiler, hipoteca y préstamos')) },
    { label: 'Gasto mensual total utilizado', value: moneyMonth(m.expenses) },
    { label: 'Dinero en banco', value: money(m.bank) },
    { label: 'Dinero invertido actual', value: money(m.invested) },
    { label: 'Rentabilidad dinero invertido', value: percent(m.investmentReturn) },
    { label: 'Ahorro sistemático mensual', value: moneyMonth(m.monthlySaving) },
    { label: 'Rentabilidad ahorro sistemático', value: percent(m.savingReturn) },
    { label: 'Inversiones inmobiliarias', value: money(m.realEstateInvestments) },
    { label: 'Rentas inmobiliarias mensuales', value: moneyMonth(Number(m.estate.realEstateRents || 0)) },
  ];
}
function pageHeader(doc: jsPDF, subtitle: string) { doc.setFillColor(...BLACK); doc.rect(0, 0, 210, 30, 'F'); doc.setFillColor(255, 255, 255); doc.rect(14, 7, 3, 17, 'F'); doc.rect(32, 7, 3, 17, 'F'); doc.rect(23, 7, 3, 7, 'F'); doc.rect(23, 17, 3, 7, 'F'); doc.setFillColor(...GOLD); doc.circle(24.5, 15.5, 4.4, 'F'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255); doc.text('JOSÉ CARLOS HIDALGO', 42, 11); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GOLD); doc.text(subtitle, 42, 19); doc.setTextColor(255, 255, 255); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 42, 26); }
function footer(doc: jsPDF, page: number) { doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(130, 130, 130); doc.text('Informe profesional de auditoría de riesgos financieros y patrimoniales.', 14, 285); doc.text(`Página ${page}`, 196, 285, { align: 'right' }); }
function newPage(doc: jsPDF, state: PageState, title: string) { if (state.page > 1) doc.addPage(); state.title = title; state.y = 42; pageHeader(doc, title.toUpperCase()); }
function ensure(doc: jsPDF, state: PageState, needed = 22) { if (state.y + needed <= 274) return; footer(doc, state.page++); doc.addPage(); pageHeader(doc, state.title.toUpperCase()); state.y = 42; }
function heading(doc: jsPDF, state: PageState, text: string, size = 13) { ensure(doc, state, 14); doc.setFont('Helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(...SLATE); doc.text(text, M, state.y); state.y += size * 0.6 + 4; }
function paragraph(doc: jsPDF, state: PageState, text: string, size = 8.3) { const lines = doc.splitTextToSize(clean(text), W) as string[]; ensure(doc, state, lines.length * 4.2 + 5); doc.setFont('Helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...MUTED); doc.text(lines, M, state.y); state.y += lines.length * 4.2 + 4; }
function rule(doc: jsPDF, state: PageState) { doc.setDrawColor(...GOLD); doc.line(M, state.y, M + 42, state.y); state.y += 7; }
function rows(doc: jsPDF, state: PageState, fields: Field[], columns = 1) { const gap = 5; const colW = columns === 1 ? W : (W - gap) / 2; const rowH = 13; fields.forEach((field, index) => { const col = columns === 1 ? 0 : index % 2; if (columns === 1 || col === 0) ensure(doc, state, rowH + 4); const x = M + col * (colW + gap); const y = state.y; doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.roundedRect(x, y, colW, rowH, 2, 2, 'FD'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(...MUTED); doc.text(field.label, x + 3, y + 4.5); doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SLATE); doc.text(doc.splitTextToSize(field.value, colW - 6).slice(0, 1), x + 3, y + 10.3); if (field.note) { doc.setFont('Helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(...MUTED); doc.text(field.note, x + colW - 3, y + 10.3, { align: 'right' }); } if (columns === 1 || col === 1 || index === fields.length - 1) state.y += rowH + 4; }); state.y += 2; }
function metricStrip(doc: jsPDF, state: PageState, metrics: Field[]) { ensure(doc, state, 30); const cardW = (W - 10) / 3; metrics.forEach((metric, i) => { const x = M + i * (cardW + 5); const y = state.y; doc.setFillColor(255, 255, 255); doc.setDrawColor(...GOLD); doc.roundedRect(x, y, cardW, 24, 3, 3, 'FD'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(metric.label, x + 4, y + 7); doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...SLATE); doc.text(doc.splitTextToSize(metric.value, cardW - 8).slice(0, 1), x + 4, y + 17); }); state.y += 31; }
function drawObjectivesTable(doc: jsPDF, state: PageState, projects: ProjectRow[]) { heading(doc, state, 'Objetivos a medio y largo plazo'); paragraph(doc, state, 'Los objetivos se ordenan por proyecto para comprobar si el esfuerzo mensual requerido encaja con la capacidad de ahorro real.'); rule(doc, state); ensure(doc, state, 20); const widths = [58, 32, 22, 34, 30]; const headers = ['Proyecto', 'Importe', 'Años', 'Ahorro/mes', 'Estado']; let x = M; doc.setFillColor(...BLACK); doc.roundedRect(M, state.y, W, 10, 2, 2, 'F'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255); headers.forEach((h, i) => { doc.text(h, x + 3, state.y + 6.5); x += widths[i]; }); state.y += 10; if (!projects.length) projects = [{ name: 'Sin proyectos añadidos', target: 0, years: 0, monthly: 0, status: 'No indicado' }]; projects.forEach((project, rowIndex) => { ensure(doc, state, 10); x = M; doc.setFillColor(rowIndex % 2 ? 255 : 248, rowIndex % 2 ? 255 : 250, rowIndex % 2 ? 255 : 252); doc.setDrawColor(...BORDER); doc.rect(M, state.y, W, 10, 'FD'); const values = [project.name, money(project.target), `${project.years}`, moneyMonth(project.monthly), project.status]; values.forEach((value, i) => { doc.setFont('Helvetica', i === 4 ? 'bold' : 'normal'); doc.setFontSize(6.8); doc.setTextColor(i === 4 && project.status === 'No viable' ? RED[0] : i === 4 && project.status === 'Ajustado' ? ORANGE[0] : i === 4 ? GREEN[0] : SLATE[0], i === 4 && project.status === 'No viable' ? RED[1] : i === 4 && project.status === 'Ajustado' ? ORANGE[1] : i === 4 ? GREEN[1] : SLATE[1], i === 4 && project.status === 'No viable' ? RED[2] : i === 4 && project.status === 'Ajustado' ? ORANGE[2] : i === 4 ? GREEN[2] : SLATE[2]); doc.text(doc.splitTextToSize(value, widths[i] - 5).slice(0, 1), x + 3, state.y + 6.5); x += widths[i]; }); state.y += 10; }); state.y += 8; }
function drawQuestionCards(doc: jsPDF, state: PageState, questions: QuestionRow[]) { heading(doc, state, 'Cuestionario completo de auditoría'); rule(doc, state); questions.forEach((q) => { const questionLines = doc.splitTextToSize(q.title, 132) as string[]; const explanationLines = doc.splitTextToSize(`Por qué esta pregunta es importante: ${q.explanation}`, 132) as string[]; const cardH = Math.max(25, questionLines.length * 4 + explanationLines.length * 3.5 + 15); ensure(doc, state, cardH + 4); doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.roundedRect(M, state.y, W, cardH, 3, 3, 'FD'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...GOLD); doc.text(q.label.toUpperCase(), M + 4, state.y + 6); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...SLATE); doc.text(questionLines, M + 4, state.y + 12); doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...MUTED); doc.text(explanationLines, M + 4, state.y + 12 + questionLines.length * 4 + 3); doc.setFillColor(255, 255, 255); doc.setDrawColor(...GOLD); doc.roundedRect(158, state.y + 5, 34, 9, 2, 2, 'FD'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(...SLATE); doc.text(q.answer, 175, state.y + 11, { align: 'center' }); state.y += cardH + 4; }); }
function axis(doc: jsPDF, x: number, y: number, w: number, h: number, max: number, xLabels: string[], percentAxis = false) { doc.setDrawColor(...BORDER); doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(...MUTED); [0, .25, .5, .75, 1].forEach((r) => { const yy = y + h - r * h; doc.line(x, yy, x + w, yy); doc.text(percentAxis ? `${Math.round(r * 100)}%` : shortMoney(max * r), x - 4, yy + 2, { align: 'right' }); }); xLabels.forEach((label, i) => { const xx = x + (w / Math.max(1, xLabels.length - 1)) * i; doc.text(label, xx, y + h + 7, { align: 'center', maxWidth: 24 }); }); }
function drawBenefitChart(doc: jsPDF, state: PageState, m: Metrics) { heading(doc, state, 'Comparativa gráfica de prestaciones frente a gastos', 11); paragraph(doc, state, `Cada barra representa la prestación pública estimada y la línea roja representa los gastos mensuales requeridos (${moneyMonth(m.expenses)}).`); ensure(doc, state, 116); const x = 43, top = state.y + 4, w = 140, h = 82; const max = Math.max(m.expenses, ...m.benefits.map((b) => b.value), 1); axis(doc, x, top, w, h, max, m.benefits.map((b) => b.label)); const slot = w / m.benefits.length; const barW = slot * 0.48; m.benefits.forEach((b, i) => { const bh = (b.value / max) * h; const bx = x + i * slot + slot * 0.25; doc.setFillColor(...GOLD); doc.roundedRect(bx, top + h - bh, barW, bh, 1, 1, 'F'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(...SLATE); doc.text(shortMoney(b.value), bx + barW / 2, top + h - bh - 2, { align: 'center' }); }); const gy = top + h - (m.expenses / max) * h; doc.setDrawColor(...RED); doc.setLineWidth(0.9); doc.line(x, gy, x + w, gy); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...RED); doc.text(`Gastos: ${shortMoney(m.expenses)}`, x + w, gy - 2, { align: 'right' }); state.y = top + h + 18; }
function drawRetirementChart(doc: jsPDF, state: PageState, m: Metrics) { heading(doc, state, 'Gráfico de proyección de jubilación', 11); paragraph(doc, state, 'El gráfico refleja la proyección patrimonial: patrimonio actual, rentabilidad, ahorro sistemático, rentas inmobiliarias e inversiones inmobiliarias.'); ensure(doc, state, 120); const x = 43, top = state.y + 4, w = 140, h = 84; const points = Array.from({ length: 8 }, (_, i) => { const years = m.yearsToRetirement * (i / 7); const val = projectedValueAt(m, years); return { px: x + w * (i / 7), val }; }); const max = Math.max(m.projectedTotal, m.targetCapital, ...points.map(p => p.val), 1); axis(doc, x, top, w, h, max, [`${m.age || 0} años`, `${Math.round((m.age + 67) / 2)} años`, '67 años']); const plotted = points.map(p => ({ ...p, py: top + h - (p.val / max) * h })); doc.setDrawColor(...GOLD); doc.setLineWidth(1.3); plotted.forEach((p, i) => { if (i) doc.line(plotted[i - 1].px, plotted[i - 1].py, p.px, p.py); doc.setFillColor(...GOLD); doc.circle(p.px, p.py, 1.5, 'F'); }); const targetY = top + h - (m.targetCapital / max) * h; doc.setDrawColor(...RED); doc.setLineDashPattern([3, 2], 0); doc.line(x, targetY, x + w, targetY); doc.setLineDashPattern([], 0); doc.setTextColor(...RED); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.text(`Capital objetivo: ${shortMoney(m.targetCapital)}`, x + w, Math.max(top + 4, targetY - 2), { align: 'right' }); doc.setTextColor(...GOLD); doc.text(`Proyección: ${shortMoney(m.projectedTotal)}`, x + w, plotted[plotted.length - 1].py - 3, { align: 'right' }); state.y = top + h + 18; }
function drawRadarChart(doc: jsPDF, state: PageState, m: Metrics) { heading(doc, state, 'Gráfico de seguridad y vulnerabilidad', 11); ensure(doc, state, 112); const scores = appScores(m); const cx = 105, cy = state.y + 54, radius = 40; const sides = scores.length; doc.setDrawColor(...BORDER); doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...MUTED); [0.25, .5, .75, 1].forEach((r) => { const pts = scores.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; return [cx + Math.cos(a) * radius * r, cy + Math.sin(a) * radius * r]; }); pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; doc.line(p[0], p[1], n[0], n[1]); }); doc.text(`${Math.round(r * 100)}%`, cx + radius * r + 3, cy); }); const poly = scores.map((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; const r = radius * (s.score / 10); doc.line(cx, cy, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); doc.text(`${s.label} ${s.score}/10`, cx + Math.cos(a) * (radius + 17), cy + Math.sin(a) * (radius + 17), { align: 'center' }); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }); doc.setDrawColor(...GOLD); doc.setLineWidth(1.1); poly.forEach((p, i) => { const n = poly[(i + 1) % poly.length]; doc.line(p[0], p[1], n[0], n[1]); doc.setFillColor(...GOLD); doc.circle(p[0], p[1], 1.5, 'F'); }); state.y += 112; }
function diagnosisRows(m: Metrics): Field[] { const sev = (gap: number, score = 10) => gap > 600 || score <= 3 ? 'Grave' : gap > 0 || score <= 6 ? 'Moderada' : 'Leve'; const scores = appScores(m).reduce<Record<string, number>>((acc, item) => { acc[item.label] = item.score; return acc; }, {}); return [ { label: `Baja laboral - ${sev(m.benefits[0].gap, scores.Baja)}`, value: m.benefits[0].gap > 0 ? `Brecha de ${moneyMonth(m.benefits[0].gap)}. Recomendación: complementar la prestación pública con cobertura privada temporal.` : 'La prestación estimada cubre el gasto mensual requerido.' }, { label: `Invalidez profesional - ${sev(m.benefits[2].gap)}`, value: m.benefits[2].gap > 0 ? `Brecha de ${moneyMonth(m.benefits[2].gap)}. Recomendación: revisar capitales de invalidez y amortización de deuda.` : 'No se detecta brecha mensual relevante frente al gasto declarado.' }, { label: `Protección familiar - ${sev(Math.max(m.benefits[3].gap, m.benefits[4].gap), scores.Familia)}`, value: `Viudedad estimada: ${moneyMonth(m.benefits[3].value)}. Orfandad estimada: ${moneyMonth(m.benefits[4].value)}. Recomendación: definir capital familiar objetivo.` }, { label: `Liquidez - ${sev(0, scores.Fondo)}`, value: `La reserva cubre aproximadamente ${m.emergencyMonths.toFixed(1)} meses de gastos. Recomendación: construir una reserva de 6 a 9 meses.` }, { label: `Jubilación - ${sev(m.retirementGap)}`, value: `Brecha mensual ajustada: ${moneyMonth(m.retirementGap)}. Capital objetivo: ${money(m.targetCapital)}. Ahorro recomendado: ${moneyMonth(m.recommendedSaving)}.` }, { label: `Protección legal - ${sev(0, scores.Legal)}`, value: 'Recomendación: mantener testamento, inventario patrimonial, pólizas, claves y documentación crítica localizables para la familia.' } ]; }
function cover(doc: jsPDF, clientName: string) { doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 297, 'F'); doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(18, 44, 192, 44); doc.setFont('Helvetica', 'bold'); doc.setFontSize(25); doc.setTextColor(...BLACK); doc.text('INFORME DE AUDITORÍA', 18, 76); doc.setFontSize(20); doc.text('DE RIESGOS FINANCIEROS', 18, 91); doc.text('Y PATRIMONIALES', 18, 105); doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...GOLD); doc.text('Previsión social, protección familiar y brecha de jubilación', 18, 123); doc.setTextColor(...SLATE); doc.setFontSize(10.5); doc.text(`Cliente: ${clientName}`, 18, 154); doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 18, 164); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.text('Realizado por José Carlos Hidalgo', 18, 232); doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.text('consultor financiero, hipotecario y patrimonial', 18, 241); doc.setTextColor(...MUTED); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 18, 251); }
function executiveParagraphs(m: Metrics) { const global = Math.round(appScores(m).reduce((sum, item) => sum + item.score, 0) / 6); return [ `Situación de partida. La auditoría muestra una seguridad global aproximada de ${global}/10. El cliente presenta ingresos netos de ${moneyMonth(m.salary)}, gastos mensuales requeridos de ${moneyMonth(m.expenses)} y una capacidad de ahorro real de ${moneyMonth(m.capacity)}. Esta capacidad debe protegerse antes de asumir nuevas obligaciones financieras.`, `Previsión social. Las prestaciones públicas estimadas no deben analizarse de forma aislada, sino frente al gasto real del hogar. La baja laboral, la invalidez, la viudedad, la orfandad y la jubilación muestran el grado de dependencia de las coberturas públicas y permiten cuantificar las brechas mensuales por contingencia.`, `Jubilación. La pensión estimada asciende a ${moneyMonth(m.retirementPension)}. Una vez consideradas las rentas inmobiliarias declaradas, la brecha mensual ajustada es de ${moneyMonth(m.retirementGap)} y el capital objetivo para financiar el retiro hasta los 90 años es de ${money(m.targetCapital)}.`, `Patrimonio proyectado. La proyección a los 67 años asciende a ${money(m.projectedTotal)}, desglosada entre dinero acumulado, dinero invertido, ahorro sistemático, rentas inmobiliarias e inversiones inmobiliarias. Si esta cifra queda por debajo del capital objetivo, conviene elevar aportaciones, revisar rentabilidades y separar liquidez, inversión y jubilación.`, `Recomendaciones. El plan de acción debe priorizar protección de ingresos, capital familiar, reserva líquida de 6 a 9 meses, estrategia antiinflación y orden legal. Las áreas graves deben resolverse antes de optimizar inversión o fiscalidad, porque una contingencia personal sin cobertura puede forzar deuda o ventas patrimoniales en mal momento.` ]; }
async function generatePdf() { window.dispatchEvent(new CustomEvent('audit-real-estate-updated')); await new Promise<void>((resolve) => window.setTimeout(resolve, 160)); const clientName = fieldValue('nombre') || 'Cliente'; const m = collectMetrics(); const projects = collectProjectRows(m.capacity); const questions = collectQuestionRows(); const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); const state: PageState = { page: 1, y: 42, title: '' }; cover(doc, clientName); footer(doc, state.page++);
  newPage(doc, state, 'Resumen de datos del cliente'); heading(doc, state, '1. Resumen de datos del Cliente'); paragraph(doc, state, 'El resumen inicial ordena los datos personales, familiares, económicos y patrimoniales que condicionan toda la auditoría. Cada dato se presenta de forma independiente para facilitar la lectura profesional del informe.'); rule(doc, state); rows(doc, state, clientFields(m), 1); footer(doc, state.page++);
  newPage(doc, state, 'Objetivos a medio y largo plazo'); drawObjectivesTable(doc, state, projects); metricStrip(doc, state, [{ label: 'Capacidad de ahorro real', value: moneyMonth(m.capacity) }, { label: 'Necesidad mensual objetivos', value: moneyMonth(m.totalProjectNeed) }, { label: 'Viabilidad global', value: m.projectStatus }]); footer(doc, state.page++);
  newPage(doc, state, 'Cuestionario completo de auditoría'); drawQuestionCards(doc, state, questions); footer(doc, state.page++);
  newPage(doc, state, 'Auditoría de previsión social'); heading(doc, state, '2. Auditoría de Previsión Social'); paragraph(doc, state, 'Esta sección cuantifica el impacto de cada contingencia sobre la estabilidad económica del hogar. El objetivo es identificar qué prestaciones públicas cubren el gasto mensual y cuáles dejan una brecha que debe asegurarse o planificarse.'); rows(doc, state, m.benefits.map((b) => ({ label: `${b.label} (${b.rate})`, value: `Prestación estimada: ${moneyMonth(b.value)}`, note: b.gap > 0 ? `Brecha: ${moneyMonth(b.gap)}` : 'Cubierto' })), 1); drawBenefitChart(doc, state, m); footer(doc, state.page++);
  newPage(doc, state, 'Estudio brecha de jubilación'); heading(doc, state, '3. Estudio brecha de jubilación'); paragraph(doc, state, 'El estudio de jubilación estima la diferencia entre la pensión pública y el nivel de gasto actual, proyectando el capital necesario para sostener un retiro hasta los 90 años.'); rows(doc, state, [ { label: 'Pensión de jubilación estimada', value: moneyMonth(m.retirementPension) }, { label: 'Gasto mensual declarado', value: moneyMonth(m.expenses) }, { label: 'Gasto ajustado por rentas inmobiliarias', value: moneyMonth(m.adjustedExpenses) }, { label: 'Déficit mensual de jubilación', value: moneyMonth(m.retirementGap) }, { label: 'Capital total previsor requerido', value: money(m.targetCapital) }, { label: 'Años para acumular', value: `${m.yearsToRetirement} años (${m.accumulationMonths} meses)` }, { label: 'Esfuerzo mensual recomendado', value: moneyMonth(m.recommendedSaving) } ], 1); drawRetirementChart(doc, state, m); heading(doc, state, 'Desglose de proyección a los 67 años', 10); rows(doc, state, [{ label: 'Dinero acumulado', value: money(m.bank) }, { label: 'Dinero invertido proyectado', value: money(m.projectedInvested) }, { label: 'Ahorro sistemático acumulado', value: money(m.projectedSaving) }, { label: 'Rentas inmobiliarias acumuladas', value: money(m.projectedRents) }, { label: 'Inversiones inmobiliarias', value: money(m.realEstateInvestments) }, { label: 'Proyección total a los 67', value: money(m.projectedTotal) }], 1); footer(doc, state.page++);
  newPage(doc, state, 'Niveles de seguridad y vulnerabilidad'); heading(doc, state, '4. Niveles de Seguridad y Vulnerabilidad'); paragraph(doc, state, 'La lectura de seguridad sintetiza la robustez del cliente frente a escenarios adversos.'); rows(doc, state, appScores(m).map((s) => ({ label: s.label, value: `${s.score}/10 (${s.score * 10}%)` })), 2); drawRadarChart(doc, state, m); footer(doc, state.page++);
  newPage(doc, state, 'Diagnóstico estratégico y plan de acción'); heading(doc, state, '5. Diagnóstico estratégico y plan de acción'); paragraph(doc, state, 'El diagnóstico prioriza las medidas según gravedad. Las deficiencias graves deben atenderse primero; las moderadas requieren seguimiento y ajuste; las leves deben mantenerse controladas para evitar deterioro futuro.'); rows(doc, state, diagnosisRows(m), 1); footer(doc, state.page++);
  newPage(doc, state, 'Resumen ejecutivo'); heading(doc, state, '6. Resumen ejecutivo'); executiveParagraphs(m).forEach((text) => paragraph(doc, state, text, 8.4)); rule(doc, state); paragraph(doc, state, 'Si desea transformar este diagnóstico en mejoras concretas, puede ponerse en contacto con José Carlos Hidalgo en el teléfono 647 50 60 40 o en el email josecarlos@hilolegal.es. El objetivo es ayudarle a corregir las debilidades detectadas, reforzar su protección familiar y construir un plan financiero más sólido, claro y adaptado a su realidad.', 8.4); footer(doc, state.page++);
  doc.save(`informe-auditoria-profesional-${slug(clientName)}.pdf`); }
function buttonBusy(button: HTMLButtonElement, busy: boolean) { if (busy) { button.dataset.originalHtml = button.innerHTML; button.disabled = true; button.style.opacity = '0.72'; button.innerHTML = '<span>Generando informe profesional PDF...</span>'; } else { button.disabled = false; button.style.opacity = ''; if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml; } }
function isPdfButton(target: EventTarget | null) { const element = target instanceof Element ? target : null; const button = element?.closest('button') as HTMLButtonElement | null; return button && /descargar.*pdf|descargar informe pdf|descargar auditoría/i.test(button.innerText || '') ? button : null; }
function install() { const win = window as typeof window & { [FLAG]?: boolean }; if (win[FLAG]) return; win[FLAG] = true; document.addEventListener('click', async (event) => { const button = isPdfButton(event.target); if (!button) return; event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); try { buttonBusy(button, true); await generatePdf(); } catch (error) { console.error(error); window.alert('No se pudo generar el informe profesional. Revisa los datos y vuelve a intentarlo.'); } finally { buttonBusy(button, false); } }, true); }
install();
