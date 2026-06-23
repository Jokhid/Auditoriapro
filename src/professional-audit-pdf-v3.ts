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
type Benefit = { label: string; value: number; gap: number };
type AppSection = { heading: string; lines: string[]; explanation: string };
type PageState = { page: number; y: number; title: string };
type Metrics = ReturnType<typeof collectMetrics>;

function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function normalize(value: string) { return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function slug(value: string) { return normalize(value || 'cliente').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'; }
function numberFromText(value: string) { return Number(String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0; }
function euro(value: number) { return `${Math.round(value || 0).toLocaleString('es-ES')} EUR`; }
function euroMonth(value: number) { return `${euro(value)} / mes`; }
function percent(value: number) { return `${Number(value || 0).toLocaleString('es-ES')}%`; }
function shortEuro(value: number) {
  const rounded = Math.round(value || 0);
  if (Math.abs(rounded) >= 1000000) return `${(rounded / 1000000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M EUR`;
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 1000).toLocaleString('es-ES')} k EUR`;
  return `${rounded.toLocaleString('es-ES')} EUR`;
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
function sectionExplanation(heading: string) {
  const lower = normalize(heading);
  if (lower.includes('resumen de datos')) return 'Esta primera parte recoge la fotografía económica, familiar y patrimonial de partida. Es la base sobre la que se interpretan las prestaciones, la capacidad real de ahorro y la vulnerabilidad financiera.';
  if (lower.includes('objetivos')) return 'Los objetivos permiten comprobar si los proyectos personales son compatibles con la capacidad real de ahorro mensual, sin comprometer la liquidez ni la protección familiar.';
  if (lower.includes('cuestionario')) return 'El cuestionario cualitativo identifica hábitos, coberturas y puntos de exposición que no siempre aparecen en los números, pero que condicionan el riesgo real del hogar.';
  if (lower.includes('prevision social')) return 'La auditoría de previsión social compara las prestaciones públicas estimadas con los gastos mensuales requeridos, separando cada contingencia para detectar brechas concretas.';
  if (lower.includes('brecha de jubilacion')) return 'El estudio de jubilación estima la pensión pública, el capital necesario para sostener el retiro hasta los 90 años y la suficiencia del patrimonio proyectado.';
  if (lower.includes('seguridad') || lower.includes('vulnerabilidad')) return 'El mapa de seguridad resume en una lectura visual las áreas críticas: liquidez, protección de ingresos, protección familiar, sanidad, inflación y orden legal.';
  if (lower.includes('diagnostico')) return 'El diagnóstico convierte los resultados en prioridades de actuación, diferenciando deficiencias graves, moderadas y leves.';
  if (lower.includes('resumen ejecutivo')) return 'El resumen ejecutivo sintetiza la situación actual, los riesgos principales y las recomendaciones prioritarias para mejorar la seguridad financiera y patrimonial.';
  return 'Información recogida en la aplicación e incorporada al informe para mantener una auditoría completa y trazable.';
}
function appSections(): AppSection[] {
  return Array.from(document.querySelectorAll('main section')).map((section, index) => {
    const raw = (section as HTMLElement).innerText || '';
    const lines = raw.split(/\n+/).map(clean).filter((line) => line && !/descargar.*pdf/i.test(line));
    const heading = lines.find((line) => /^\d+\.|objetivos|cuestionario/i.test(line)) || clean((section.querySelector('h2,h1,h3') as HTMLElement | null)?.innerText || `Sección ${index + 1}`);
    const body = lines.filter((line, lineIndex) => lineIndex === 0 ? line !== heading : true);
    return { heading, lines: body, explanation: sectionExplanation(heading) };
  }).filter((section) => section.heading && section.lines.length > 0);
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
  const adjustedExpenses = Number(estate.adjustedExpenses ?? Math.max(0, expenses - Number(estate.realEstateRents || 0)));
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = years + yearsToRetirement;
  const retirementRate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  const retirementPension = Number(estate.retirementPension ?? base * retirementRate);
  const state = fieldValue('estado civil');
  const married = state === 'Casado/a' || state === 'Pareja de Hecho';
  const children = fieldNumber('hijos menores');
  const benefits: Benefit[] = [
    { label: 'Baja laboral', value: base * 0.75, gap: Math.max(0, expenses - base * 0.75) },
    { label: 'Invalidez absoluta', value: base, gap: Math.max(0, expenses - base) },
    { label: 'Invalidez profesional', value: age >= 55 ? base * 0.75 : base * 0.55, gap: Math.max(0, expenses - (age >= 55 ? base * 0.75 : base * 0.55)) },
    { label: 'Viudedad', value: married ? base * 0.52 : 0, gap: Math.max(0, expenses - (married ? base * 0.52 : 0)) },
    { label: 'Orfandad', value: base * 0.2 * children, gap: Math.max(0, expenses - base * 0.2 * children) },
    { label: 'Jubilación', value: retirementPension, gap: Math.max(0, expenses - retirementPension) },
  ];
  const retirementGap = Number(estate.retirementGap ?? Math.max(0, adjustedExpenses - retirementPension));
  const targetCapital = retirementGap * 12 * 23;
  const retirementMonths = 23 * 12;
  const accumulationMonths = Math.max(1, yearsToRetirement * 12);
  const recommendedSaving = Math.ceil(targetCapital / accumulationMonths);
  const projectedInvested = Number(estate.projectedInvested ?? invested * Math.pow(1 + investmentReturn / 100, yearsToRetirement));
  const projectedSaving = Number(estate.projectedSaving ?? (savingReturn > 0 ? monthlySaving * 12 * ((Math.pow(1 + savingReturn / 100, yearsToRetirement) - 1) / (savingReturn / 100)) : monthlySaving * 12 * yearsToRetirement));
  const projectedRents = Number(estate.projectedRents ?? Number(estate.realEstateRents || 0) * 12 * yearsToRetirement);
  const realEstateInvestments = Number(estate.realEstateInvestments || 0);
  const projectedTotal = Number(estate.projectedTotal ?? bank + projectedInvested + projectedSaving + projectedRents + realEstateInvestments);
  const emergencyMonths = expenses > 0 ? bank / expenses : 0;
  const capacity = Math.max(0, salary - expenses);
  return { estate, salary, base, age, years, expenses, adjustedExpenses, bank, invested, investmentReturn, monthlySaving, savingReturn, yearsToRetirement, retirementMonths, accumulationMonths, retirementPension, retirementGap, targetCapital, recommendedSaving, benefits, projectedInvested, projectedSaving, projectedRents, realEstateInvestments, projectedTotal, emergencyMonths, capacity };
}
function scoresFromApp() {
  const section = sectionByText('4. Niveles de Seguridad y Vulnerabilidad') || sectionByText('Niveles de Seguridad y Vulnerabilidad');
  const text = section?.innerText || '';
  const labels = ['Fondo', 'Baja', 'Familia', 'Sanidad', 'Inflación', 'Legal'];
  return labels.map((label) => {
    const match = text.match(new RegExp(`${label}[^0-9]*(\\d{1,3})(?:\/10|%)`, 'i'));
    const raw = Number(match?.[1] || 50);
    const score = raw > 10 ? Math.round(raw / 10) : raw;
    return { label, score: Math.max(0, Math.min(10, score)) };
  });
}
function clientFields(m: Metrics): Field[] {
  return [
    { label: 'Nombre del cliente', value: fieldValue('nombre') || 'No indicado' },
    { label: 'Teléfono del cliente', value: fieldValue('teléfono') || 'No indicado' },
    { label: 'Email del cliente', value: fieldValue('email') || 'No indicado' },
    { label: 'Edad', value: `${fieldValue('edad') || '-'} años` },
    { label: 'Años cotizados', value: `${fieldValue('años cotizados') || '-'} años` },
    { label: 'Base de cotización', value: euroMonth(m.base) },
    { label: 'Estado civil', value: fieldValue('estado civil') || 'No indicado' },
    { label: 'Hijos menores de 25 años', value: fieldValue('hijos menores') || '0' },
    { label: 'Salario neto mensual', value: euroMonth(m.salary) },
    { label: 'Gastos mensuales personales', value: euroMonth(fieldNumber('gastos mensuales')) },
    { label: 'Alquiler, hipoteca y préstamos', value: euroMonth(fieldNumber('alquiler, hipoteca y préstamos')) },
    { label: 'Gasto mensual total utilizado en la app', value: euroMonth(m.expenses) },
    { label: 'Dinero en banco', value: euro(m.bank) },
    { label: 'Dinero invertido actual', value: euro(m.invested) },
    { label: 'Rentabilidad dinero invertido', value: percent(m.investmentReturn) },
    { label: 'Ahorro sistemático mensual', value: euroMonth(m.monthlySaving) },
    { label: 'Rentabilidad ahorro sistemático', value: percent(m.savingReturn) },
    { label: 'Inversiones inmobiliarias', value: euro(m.realEstateInvestments) },
    { label: 'Rentas inmobiliarias mensuales', value: euroMonth(Number(m.estate.realEstateRents || 0)) },
  ];
}
function pageHeader(doc: jsPDF, subtitle: string) {
  doc.setFillColor(...BLACK); doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(255, 255, 255); doc.rect(14, 7, 3, 17, 'F'); doc.rect(32, 7, 3, 17, 'F'); doc.rect(23, 7, 3, 7, 'F'); doc.rect(23, 17, 3, 7, 'F');
  doc.setFillColor(...GOLD); doc.circle(24.5, 15.5, 4.4, 'F');
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255); doc.text('JOSÉ CARLOS HIDALGO', 42, 11);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GOLD); doc.text(subtitle, 42, 19);
  doc.setTextColor(255, 255, 255); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 42, 26);
}
function footer(doc: jsPDF, page: number) {
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(130, 130, 130);
  doc.text('Informe profesional de auditoría de riesgos financieros y patrimoniales.', 14, 285);
  doc.text(`Página ${page}`, 196, 285, { align: 'right' });
}
function newPage(doc: jsPDF, state: PageState, title: string) {
  if (state.page > 1) doc.addPage();
  state.title = title; state.y = 42; pageHeader(doc, title.toUpperCase());
}
function ensure(doc: jsPDF, state: PageState, needed = 22) {
  if (state.y + needed <= 274) return;
  footer(doc, state.page++); doc.addPage(); pageHeader(doc, state.title.toUpperCase()); state.y = 42;
}
function heading(doc: jsPDF, state: PageState, text: string, size = 13) {
  ensure(doc, state, 14); doc.setFont('Helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(...SLATE); doc.text(text, M, state.y); state.y += size * 0.6 + 4;
}
function paragraph(doc: jsPDF, state: PageState, text: string, size = 8.3) {
  const lines = doc.splitTextToSize(clean(text), W) as string[];
  ensure(doc, state, lines.length * 4.2 + 5); doc.setFont('Helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...MUTED); doc.text(lines, M, state.y); state.y += lines.length * 4.2 + 4;
}
function rule(doc: jsPDF, state: PageState) { doc.setDrawColor(...GOLD); doc.line(M, state.y, M + 42, state.y); state.y += 7; }
function rows(doc: jsPDF, state: PageState, fields: Field[], columns = 1) {
  const gap = 5; const colW = columns === 1 ? W : (W - gap) / 2; const rowH = 13;
  fields.forEach((field, index) => {
    const col = columns === 1 ? 0 : index % 2;
    if (columns === 1 || col === 0) ensure(doc, state, rowH + 4);
    const x = M + col * (colW + gap); const y = state.y;
    doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.roundedRect(x, y, colW, rowH, 2, 2, 'FD');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(...MUTED); doc.text(field.label, x + 3, y + 4.5);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SLATE); doc.text(doc.splitTextToSize(field.value, colW - 6).slice(0, 1), x + 3, y + 10.3);
    if (field.note) { doc.setFont('Helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(...MUTED); doc.text(field.note, x + colW - 3, y + 10.3, { align: 'right' }); }
    if (columns === 1 || col === 1 || index === fields.length - 1) state.y += rowH + 4;
  });
  state.y += 2;
}
function bulletLines(doc: jsPDF, state: PageState, lines: string[], maxLines = 42) {
  lines.slice(0, maxLines).forEach((line) => {
    const wrapped = doc.splitTextToSize(clean(line), 174) as string[];
    ensure(doc, state, wrapped.length * 4 + 5);
    doc.setFillColor(...GOLD); doc.circle(M + 1.5, state.y - 1.5, 0.8, 'F');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.7); doc.setTextColor(...SLATE); doc.text(wrapped, M + 6, state.y);
    state.y += wrapped.length * 4 + 2;
  });
}
function axis(doc: jsPDF, x: number, y: number, w: number, h: number, max: number, xLabels: string[], percentAxis = false) {
  doc.setDrawColor(...BORDER); doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(...MUTED);
  [0, .25, .5, .75, 1].forEach((r) => { const yy = y + h - r * h; doc.line(x, yy, x + w, yy); doc.text(percentAxis ? `${Math.round(r * 100)}%` : shortEuro(max * r), x - 4, yy + 2, { align: 'right' }); });
  xLabels.forEach((label, i) => { const xx = x + (w / Math.max(1, xLabels.length - 1)) * i; doc.text(label, xx, y + h + 7, { align: 'center', maxWidth: 24 }); });
}
function drawBenefitChart(doc: jsPDF, state: PageState, m: Metrics) {
  heading(doc, state, 'Comparativa gráfica de prestaciones frente a gastos', 11);
  paragraph(doc, state, `El gráfico reproduce la lógica de la app: cada barra representa la prestación pública estimada y la línea roja representa los gastos mensuales requeridos (${euroMonth(m.expenses)}).`);
  ensure(doc, state, 116); const x = 43, top = state.y + 4, w = 140, h = 82; const max = Math.max(m.expenses, ...m.benefits.map((b) => b.value), 1);
  axis(doc, x, top, w, h, max, m.benefits.map((b) => b.label));
  const slot = w / m.benefits.length; const barW = slot * 0.48;
  m.benefits.forEach((b, i) => { const bh = (b.value / max) * h; const bx = x + i * slot + slot * 0.25; doc.setFillColor(...GOLD); doc.roundedRect(bx, top + h - bh, barW, bh, 1, 1, 'F'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(...SLATE); doc.text(shortEuro(b.value), bx + barW / 2, top + h - bh - 2, { align: 'center' }); });
  const gy = top + h - (m.expenses / max) * h; doc.setDrawColor(...RED); doc.setLineWidth(0.9); doc.line(x, gy, x + w, gy); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...RED); doc.text(`Gastos: ${shortEuro(m.expenses)}`, x + w, gy - 2, { align: 'right' });
  state.y = top + h + 18;
}
function drawRetirementChart(doc: jsPDF, state: PageState, m: Metrics) {
  heading(doc, state, 'Estudio brecha de jubilación', 11);
  paragraph(doc, state, `La curva muestra la proyección patrimonial hasta los 67 años con las mismas variables de la aplicación: dinero en banco, dinero invertido, ahorro sistemático, rentabilidad, rentas inmobiliarias e inversiones inmobiliarias.`);
  ensure(doc, state, 120); const x = 43, top = state.y + 4, w = 140, h = 84; const max = Math.max(m.projectedTotal, m.targetCapital, m.bank, 1);
  const midAge = Math.round((m.age + 67) / 2); axis(doc, x, top, w, h, max, [`${m.age || 0} años`, `${midAge} años`, '67 años']);
  const points = Array.from({ length: 6 }, (_, i) => { const r = i / 5; const val = m.bank + m.projectedInvested * r + m.projectedSaving * r + m.projectedRents * r + m.realEstateInvestments * r; return { px: x + w * r, py: top + h - (val / max) * h, val }; });
  doc.setDrawColor(...GOLD); doc.setLineWidth(1.2); points.forEach((p, i) => { if (i) doc.line(points[i - 1].px, points[i - 1].py, p.px, p.py); doc.setFillColor(...GOLD); doc.circle(p.px, p.py, 1.5, 'F'); });
  const targetY = top + h - (m.targetCapital / max) * h; doc.setDrawColor(...RED); doc.setLineDashPattern([3, 2], 0); doc.line(x, targetY, x + w, targetY); doc.setLineDashPattern([], 0); doc.setTextColor(...RED); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.text(`Capital objetivo: ${shortEuro(m.targetCapital)}`, x + w, targetY - 2, { align: 'right' });
  doc.setTextColor(...GOLD); doc.text(`Proyección: ${shortEuro(m.projectedTotal)}`, x + w, points[points.length - 1].py - 3, { align: 'right' });
  state.y = top + h + 18;
}
function drawRadarChart(doc: jsPDF, state: PageState) {
  heading(doc, state, 'Mapa de seguridad y vulnerabilidad', 11);
  paragraph(doc, state, 'El gráfico radial muestra el nivel de seguridad por área. Una figura amplia y equilibrada indica mayor estabilidad; una figura pequeña o deformada señala concentración de riesgo.');
  ensure(doc, state, 118); const scores = scoresFromApp(); const cx = 105, cy = state.y + 54, radius = 40; const sides = scores.length;
  doc.setDrawColor(...BORDER); doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...MUTED);
  [0.25, .5, .75, 1].forEach((r) => { const pts = scores.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; return [cx + Math.cos(a) * radius * r, cy + Math.sin(a) * radius * r]; }); pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; doc.line(p[0], p[1], n[0], n[1]); }); doc.text(`${Math.round(r * 100)}%`, cx + radius * r + 3, cy); });
  const poly = scores.map((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; const r = radius * (s.score / 10); doc.line(cx, cy, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); doc.text(`${s.label} ${s.score}/10`, cx + Math.cos(a) * (radius + 17), cy + Math.sin(a) * (radius + 17), { align: 'center' }); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  doc.setDrawColor(...GOLD); doc.setLineWidth(1.1); poly.forEach((p, i) => { const n = poly[(i + 1) % poly.length]; doc.line(p[0], p[1], n[0], n[1]); doc.setFillColor(...GOLD); doc.circle(p[0], p[1], 1.5, 'F'); });
  state.y += 112;
}
function diagnosisRows(m: Metrics): Field[] {
  const sev = (gap: number, score = 10) => gap > 600 || score <= 3 ? 'Grave' : gap > 0 || score <= 6 ? 'Moderada' : 'Leve';
  const scores = scoresFromApp().reduce<Record<string, number>>((acc, item) => { acc[item.label] = item.score; return acc; }, {});
  return [
    { label: `Baja laboral - ${sev(m.benefits[0].gap, scores.Baja)}`, value: m.benefits[0].gap > 0 ? `Brecha de ${euroMonth(m.benefits[0].gap)}. Recomendación: complementar la prestación pública con cobertura privada temporal.` : 'La prestación estimada cubre el gasto mensual requerido.' },
    { label: `Invalidez profesional - ${sev(m.benefits[2].gap)}`, value: m.benefits[2].gap > 0 ? `Brecha de ${euroMonth(m.benefits[2].gap)}. Recomendación: revisar capitales de invalidez y amortización de deuda.` : 'No se detecta brecha mensual relevante frente al gasto declarado.' },
    { label: `Protección familiar - ${sev(Math.max(m.benefits[3].gap, m.benefits[4].gap), scores.Familia)}`, value: `Viudedad estimada: ${euroMonth(m.benefits[3].value)}. Orfandad estimada: ${euroMonth(m.benefits[4].value)}. Recomendación: definir capital familiar objetivo.` },
    { label: `Liquidez - ${sev(0, scores.Fondo)}`, value: `La reserva cubre aproximadamente ${m.emergencyMonths.toFixed(1)} meses de gastos. Recomendación: construir una reserva de 6 a 9 meses.` },
    { label: `Jubilación - ${sev(m.retirementGap)}`, value: `Brecha mensual ajustada: ${euroMonth(m.retirementGap)}. Capital objetivo: ${euro(m.targetCapital)}. Ahorro recomendado: ${euroMonth(m.recommendedSaving)}.` },
    { label: `Protección legal - ${sev(0, scores.Legal)}`, value: 'Recomendación: mantener testamento, inventario patrimonial, pólizas, claves y documentación crítica localizables para la familia.' },
  ];
}
function cover(doc: jsPDF, clientName: string) {
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 297, 'F'); doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(18, 44, 192, 44);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(25); doc.setTextColor(...BLACK); doc.text('INFORME DE AUDITORÍA', 18, 76); doc.setFontSize(20); doc.text('DE RIESGOS FINANCIEROS', 18, 91); doc.text('Y PATRIMONIALES', 18, 105);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...GOLD); doc.text('Previsión social, protección familiar y brecha de jubilación', 18, 123);
  doc.setTextColor(...SLATE); doc.setFontSize(10.5); doc.text(`Cliente: ${clientName}`, 18, 154); doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 18, 164);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.text('Realizado por José Carlos Hidalgo', 18, 232); doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.text('consultor financiero, hipotecario y patrimonial', 18, 241); doc.setTextColor(...MUTED); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 18, 251);
}
function executiveParagraphs(m: Metrics) {
  const global = Math.round(scoresFromApp().reduce((sum, item) => sum + item.score, 0) / 6);
  return [
    `Situación de partida. La auditoría muestra una seguridad global aproximada de ${global}/10. El cliente presenta ingresos netos de ${euroMonth(m.salary)}, gastos mensuales requeridos de ${euroMonth(m.expenses)} y una capacidad de ahorro real de ${euroMonth(m.capacity)}. Esta capacidad debe protegerse antes de asumir nuevas obligaciones financieras.`,
    `Previsión social. Las prestaciones públicas estimadas no deben analizarse de forma aislada, sino frente al gasto real del hogar. La baja laboral, la invalidez, la viudedad, la orfandad y la jubilación muestran el grado de dependencia de las coberturas públicas y permiten cuantificar las brechas mensuales por contingencia.`,
    `Jubilación. La pensión estimada asciende a ${euroMonth(m.retirementPension)}. Una vez consideradas las rentas inmobiliarias declaradas, la brecha mensual ajustada es de ${euroMonth(m.retirementGap)} y el capital objetivo para financiar el retiro hasta los 90 años es de ${euro(m.targetCapital)}.`,
    `Patrimonio proyectado. La proyección a los 67 años asciende a ${euro(m.projectedTotal)}, desglosada entre dinero acumulado, dinero invertido, ahorro sistemático, rentas inmobiliarias e inversiones inmobiliarias. Si esta cifra queda por debajo del capital objetivo, conviene elevar aportaciones, revisar rentabilidades y separar liquidez, inversión y jubilación.`,
    `Recomendaciones. El plan de acción debe priorizar protección de ingresos, capital familiar, reserva líquida de 6 a 9 meses, estrategia antiinflación y orden legal. Las áreas graves deben resolverse antes de optimizar inversión o fiscalidad, porque una contingencia personal sin cobertura puede forzar deuda o ventas patrimoniales en mal momento.`,
  ];
}
function appSectionPage(doc: jsPDF, state: PageState, section: AppSection) {
  newPage(doc, state, section.heading); heading(doc, state, section.heading); paragraph(doc, state, section.explanation); rule(doc, state);
  heading(doc, state, 'Datos reflejados en la aplicación', 10); bulletLines(doc, state, section.lines, 50); footer(doc, state.page++);
}
async function generatePdf() {
  window.dispatchEvent(new CustomEvent('audit-real-estate-updated'));
  await new Promise<void>((resolve) => window.setTimeout(resolve, 160));
  const clientName = fieldValue('nombre') || 'Cliente'; const m = collectMetrics(); const sections = appSections();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); const state: PageState = { page: 1, y: 42, title: '' };
  cover(doc, clientName); footer(doc, state.page++);

  newPage(doc, state, 'Resumen de datos del cliente'); heading(doc, state, '1. Resumen de datos del Cliente'); paragraph(doc, state, 'El resumen inicial ordena los datos personales, familiares, económicos y patrimoniales que condicionan toda la auditoría. Cada dato se presenta de forma independiente para facilitar la lectura profesional del informe.'); rule(doc, state); rows(doc, state, clientFields(m), 1); footer(doc, state.page++);

  const objectives = sections.find((s) => normalize(s.heading).includes('objetivos'));
  if (objectives) appSectionPage(doc, state, objectives);
  const questionnaire = sections.find((s) => normalize(s.heading).includes('cuestionario'));
  if (questionnaire) appSectionPage(doc, state, questionnaire);

  newPage(doc, state, 'Auditoría de previsión social'); heading(doc, state, '2. Auditoría de Previsión Social'); paragraph(doc, state, 'Esta sección cuantifica el impacto de cada contingencia sobre la estabilidad económica del hogar. El objetivo es identificar qué prestaciones públicas cubren el gasto mensual y cuáles dejan una brecha que debe asegurarse o planificarse.'); rows(doc, state, m.benefits.map((b) => ({ label: b.label, value: `Prestación estimada: ${euroMonth(b.value)}`, note: b.gap > 0 ? `Brecha: ${euroMonth(b.gap)}` : 'Cubierto' })), 1); drawBenefitChart(doc, state, m); footer(doc, state.page++);

  newPage(doc, state, 'Estudio brecha de jubilación'); heading(doc, state, '3. Estudio brecha de jubilación'); paragraph(doc, state, 'El estudio de jubilación estima la diferencia entre la pensión pública y el nivel de gasto actual, proyectando el capital necesario para sostener un retiro hasta los 90 años.'); rows(doc, state, [
    { label: 'Pensión de jubilación estimada', value: euroMonth(m.retirementPension) },
    { label: 'Gasto mensual declarado en la app', value: euroMonth(m.expenses) },
    { label: 'Gasto ajustado por rentas inmobiliarias', value: euroMonth(m.adjustedExpenses) },
    { label: 'Déficit mensual de jubilación', value: euroMonth(m.retirementGap) },
    { label: 'Capital total previsor requerido', value: euro(m.targetCapital) },
    { label: 'Años para acumular', value: `${m.yearsToRetirement} años (${m.accumulationMonths} meses)` },
    { label: 'Esfuerzo mensual recomendado', value: euroMonth(m.recommendedSaving) },
  ], 1); drawRetirementChart(doc, state, m); heading(doc, state, 'Desglose de proyección a los 67 años', 10); rows(doc, state, [
    { label: 'Dinero acumulado', value: euro(m.bank) },
    { label: 'Dinero invertido proyectado', value: euro(m.projectedInvested) },
    { label: 'Ahorro sistemático acumulado', value: euro(m.projectedSaving) },
    { label: 'Rentas inmobiliarias acumuladas', value: euro(m.projectedRents) },
    { label: 'Inversiones inmobiliarias', value: euro(m.realEstateInvestments) },
    { label: 'Proyección total a los 67', value: euro(m.projectedTotal) },
  ], 1); footer(doc, state.page++);

  newPage(doc, state, 'Niveles de seguridad y vulnerabilidad'); heading(doc, state, '4. Niveles de Seguridad y Vulnerabilidad'); paragraph(doc, state, 'La lectura de seguridad sintetiza la robustez del cliente frente a escenarios adversos. No sustituye al análisis técnico de cada prestación, pero permite visualizar dónde se concentra la vulnerabilidad.'); rows(doc, state, scoresFromApp().map((s) => ({ label: s.label, value: `${s.score}/10 (${s.score * 10}%)` })), 2); drawRadarChart(doc, state); footer(doc, state.page++);

  newPage(doc, state, 'Diagnóstico estratégico y plan de acción'); heading(doc, state, '5. Diagnóstico estratégico y plan de acción'); paragraph(doc, state, 'El diagnóstico prioriza las medidas según gravedad. Las deficiencias graves deben atenderse primero; las moderadas requieren seguimiento y ajuste; las leves deben mantenerse controladas para evitar deterioro futuro.'); rows(doc, state, diagnosisRows(m), 1); footer(doc, state.page++);

  newPage(doc, state, 'Resumen ejecutivo'); heading(doc, state, '6. Resumen ejecutivo'); executiveParagraphs(m).forEach((text) => paragraph(doc, state, text, 8.4)); rule(doc, state); paragraph(doc, state, 'Mensaje final. Si desea mejorar las áreas con mayor vulnerabilidad, el siguiente paso recomendable es revisar de forma personalizada las coberturas, capitales asegurados, estrategia de ahorro, planificación de jubilación y documentación familiar. Una auditoría solo genera valor cuando se transforma en decisiones concretas y medibles.'); footer(doc, state.page++);

  sections.filter((section) => ![objectives?.heading, questionnaire?.heading].includes(section.heading) && !/^\d+\./.test(section.heading)).forEach((section) => appSectionPage(doc, state, section));
  doc.save(`informe-auditoria-profesional-${slug(clientName)}.pdf`);
}
function buttonBusy(button: HTMLButtonElement, busy: boolean) {
  if (busy) { button.dataset.originalHtml = button.innerHTML; button.disabled = true; button.style.opacity = '0.72'; button.innerHTML = '<span>Generando informe profesional PDF...</span>'; }
  else { button.disabled = false; button.style.opacity = ''; if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml; }
}
function isPdfButton(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest('button') as HTMLButtonElement | null;
  return button && /descargar.*pdf|descargar informe pdf|descargar auditoría/i.test(button.innerText || '') ? button : null;
}
function install() {
  const win = window as typeof window & { [FLAG]?: boolean };
  if (win[FLAG]) return; win[FLAG] = true;
  document.addEventListener('click', async (event) => {
    const button = isPdfButton(event.target); if (!button) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    try { buttonBusy(button, true); await generatePdf(); }
    catch (error) { console.error(error); window.alert('No se pudo generar el informe profesional. Revisa los datos y vuelve a intentarlo.'); }
    finally { buttonBusy(button, false); }
  }, true);
}
install();
