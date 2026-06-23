import { jsPDF } from 'jspdf';

const FLAG = '__auditProfessionalPdfV3Installed';
const BLACK = [26, 26, 26] as const;
const SLATE = [15, 23, 42] as const;
const MUTED = [71, 85, 105] as const;
const BORDER = [226, 232, 240] as const;
const LIGHT = [248, 250, 252] as const;
const GOLD = [197, 165, 102] as const;
const RED = [220, 38, 38] as const;
const BLUE = [96, 165, 250] as const;
const GREEN = [22, 163, 74] as const;
const ORANGE = [249, 115, 22] as const;
const M = 14;
const W = 182;

type Field = { label: string; value: string };
type AppSection = { heading: string; text: string; explanation: string };
type Benefit = { label: string; value: number };

type Metrics = ReturnType<typeof collectMetrics>;

function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function slug(value: string) { return clean(value || 'cliente').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'; }
function euro(value: number) { return `${Math.round(value).toLocaleString('es-ES')} EUR`; }
function shortEuro(value: number) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000000) return `${(rounded / 1000000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M EUR`;
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 1000).toLocaleString('es-ES')} k EUR`;
  return `${rounded.toLocaleString('es-ES')} EUR`;
}
function fieldValue(labelText: string) {
  const needle = labelText.toLowerCase();
  const label = Array.from(document.querySelectorAll('label')).find((item) => (item.textContent || '').toLowerCase().includes(needle));
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return clean(input?.value || '');
}
function fieldNumber(labelText: string) { return Number(fieldValue(labelText).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0; }
function sectionByText(text: string) {
  const needle = text.toLowerCase();
  return Array.from(document.querySelectorAll('main section')).find((section) => (section.textContent || '').toLowerCase().includes(needle)) as HTMLElement | undefined;
}
function realEstateData() {
  const win = window as typeof window & { auditRealEstateData?: () => Record<string, number> };
  return typeof win.auditRealEstateData === 'function' ? win.auditRealEstateData() : {} as Record<string, number>;
}
function sectionExplanation(heading: string) {
  const lower = heading.toLowerCase();
  if (lower.includes('resumen de datos')) return 'Fotografía personal, familiar, económica y patrimonial de partida. Estos datos sostienen todos los cálculos posteriores.';
  if (lower.includes('objetivos')) return 'Contrasta proyectos vitales con capacidad real de ahorro, mostrando viabilidad y esfuerzo mensual necesario.';
  if (lower.includes('cuestionario')) return 'Convierte hábitos, coberturas y preparación familiar en señales de riesgo cualitativas.';
  if (lower.includes('previsión social')) return 'Compara prestaciones públicas estimadas frente al gasto real del hogar para detectar brechas de ingresos.';
  if (lower.includes('brecha de jubilación')) return 'Proyecta la diferencia entre pensión pública, patrimonio acumulado y capital necesario para sostener el retiro.';
  if (lower.includes('seguridad') || lower.includes('vulnerabilidad')) return 'Resume la seguridad financiera por áreas críticas: liquidez, ingresos, familia, salud, inflación y planificación legal.';
  if (lower.includes('diagnóstico')) return 'Ordena las deficiencias detectadas por gravedad y las transforma en medidas concretas.';
  if (lower.includes('resumen ejecutivo')) return 'Sintetiza la situación actual, riesgos principales y recomendaciones de actuación.';
  return 'Información introducida o calculada en la aplicación incorporada al informe para mantener una auditoría completa.';
}
function getSections(): AppSection[] {
  return Array.from(document.querySelectorAll('main section')).map((section, index) => {
    const heading = clean((section.querySelector('h2,h1,h3') as HTMLElement | null)?.innerText || `Sección ${index + 1}`);
    const text = clean((section as HTMLElement).innerText.replace(/Descargar informe PDF/gi, ''));
    return { heading, text, explanation: sectionExplanation(heading) };
  }).filter((section) => section.text.length > 0);
}
function collectMetrics() {
  const estate = realEstateData();
  const base = fieldNumber('base cotización') || fieldNumber('base cotizacion');
  const age = fieldNumber('edad');
  const years = fieldNumber('años cotizados') || fieldNumber('anos cotizados');
  const expenses = fieldNumber('gastos mensuales') + fieldNumber('alquiler, hipoteca y préstamos');
  const adjustedExpenses = Number(estate.adjustedExpenses ?? Math.max(0, expenses - Number(estate.realEstateRents || 0)));
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = years + yearsToRetirement;
  const retirementRate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  const retirementPension = base * retirementRate;
  const retirementGap = Number(estate.retirementGap ?? Math.max(0, adjustedExpenses - retirementPension));
  const targetCapital = retirementGap * 12 * 23;
  const projectedTotal = Number(estate.projectedTotal || 0);
  const state = fieldValue('estado civil');
  const married = state === 'Casado/a' || state === 'Pareja de Hecho';
  const children = fieldNumber('hijos menores');
  const benefits: Benefit[] = [
    { label: 'Baja laboral', value: base * 0.75 },
    { label: 'Inv. absoluta', value: base },
    { label: 'Inv. profesional', value: age >= 55 ? base * 0.75 : base * 0.55 },
    { label: 'Viudedad', value: married ? base * 0.52 : 0 },
    { label: 'Orfandad', value: base * 0.2 * children },
    { label: 'Jubilación', value: retirementPension },
  ];
  const bank = Number(estate.accumulatedBank ?? fieldNumber('dinero en banco'));
  const invested = Number(estate.projectedInvested ?? fieldNumber('dinero invertido'));
  const saving = Number(estate.projectedSaving ?? 0);
  const rents = Number(estate.projectedRents ?? 0);
  const realEstateInvestments = Number(estate.realEstateInvestments ?? 0);
  return { estate, base, age, years, expenses, adjustedExpenses, yearsToRetirement, retirementPension, retirementGap, targetCapital, projectedTotal, benefits, bank, invested, saving, rents, realEstateInvestments };
}
function clientFields(m: Metrics): Field[] {
  return [
    ['Cliente', fieldValue('nombre') || 'No indicado'], ['Teléfono', fieldValue('teléfono') || 'No indicado'], ['Email', fieldValue('email') || 'No indicado'],
    ['Edad', `${fieldValue('edad') || '-'} años`], ['Años cotizados', `${fieldValue('años cotizados') || '-'} años`], ['Base de cotización', `${fieldValue('base cotización') || '-'} EUR / mes`],
    ['Estado civil', fieldValue('estado civil') || 'No indicado'], ['Hijos menores de 25 años', fieldValue('hijos menores') || '0'],
    ['Salario neto mensual', `${fieldValue('salario neto mensual') || '-'} EUR`], ['Gastos mensuales', `${fieldValue('gastos mensuales') || '-'} EUR`],
    ['Alquiler, hipoteca y préstamos', `${fieldValue('alquiler, hipoteca y préstamos') || '-'} EUR`], ['Dinero en banco', `${fieldValue('dinero en banco') || '-'} EUR`],
    ['Dinero invertido', `${fieldValue('dinero invertido') || '-'} EUR`], ['Ahorro sistemático mensual', `${fieldValue('ahorro sistemático mensual') || '-'} EUR`],
    ['Inversiones inmobiliarias', euro(m.realEstateInvestments)], ['Rentas inmobiliarias', `${euro(Number(m.estate.realEstateRents || 0))} / mes`],
  ].map(([label, value]) => ({ label, value }));
}
function scoresFromApp() {
  const section = sectionByText('4. Niveles de Seguridad y Vulnerabilidad');
  const text = section?.innerText || '';
  const labels = ['Fondo', 'Baja', 'Familia', 'Sanidad', 'Inflación', 'Legal'];
  return labels.map((label) => {
    const pattern = new RegExp(`${label}[^0-9]*(\\d{1,2})\\/10`, 'i');
    const match = text.match(pattern);
    return { label, score: Math.max(0, Math.min(10, Number(match?.[1] || 5))) };
  });
}
function pageHeader(doc: jsPDF, title: string) {
  doc.setFillColor(...BLACK); doc.rect(0, 0, 210, 30, 'F');
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text('JOSÉ CARLOS HIDALGO', 14, 12);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...GOLD); doc.text(title, 14, 20);
  doc.setTextColor(255, 255, 255); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 132, 12);
}
function pageFooter(doc: jsPDF, page: number) {
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(120, 120, 120);
  doc.text('Informe profesional de auditoría de riesgos financieros y patrimoniales.', 14, 285);
  doc.text(`Página ${page}`, 196, 285, { align: 'right' });
}
function newPage(doc: jsPDF, title: string, page: number) { if (page > 1) doc.addPage(); pageHeader(doc, title); }
function title(doc: jsPDF, text: string, y: number, size = 13) { doc.setFont('Helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(...SLATE); doc.text(text, M, y); }
function paragraph(doc: jsPDF, text: string, x: number, y: number, width = 182, size = 8.4) {
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...MUTED);
  const lines = doc.splitTextToSize(clean(text), width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * (size * 0.48) + 4;
}
function cardGrid(doc: jsPDF, fields: Field[], x: number, y: number, columns = 2) {
  const colW = columns === 2 ? 88 : 58;
  const rowH = 16;
  fields.forEach((field, i) => {
    const col = i % columns; const row = Math.floor(i / columns); const bx = x + col * (colW + 6); const by = y + row * (rowH + 4);
    doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.roundedRect(bx, by, colW, rowH, 2, 2, 'FD');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(field.label, bx + 3, by + 5);
    doc.setFontSize(8); doc.setTextColor(...SLATE); doc.text(doc.splitTextToSize(field.value, colW - 6).slice(0, 1), bx + 3, by + 12);
  });
  return y + Math.ceil(fields.length / columns) * (rowH + 4);
}
function axisLabels(doc: jsPDF, x: number, y: number, w: number, h: number, max: number, xLabels: string[], percent = false) {
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(...MUTED); doc.setDrawColor(...BORDER);
  [0, .25, .5, .75, 1].forEach((r) => { const yy = y + h - r * h; doc.line(x - 2, yy, x + w, yy); doc.text(percent ? `${Math.round(r * 100)}%` : shortEuro(max * r), x - 4, yy + 2, { align: 'right' }); });
  xLabels.forEach((label, i) => { const xx = x + (w / Math.max(1, xLabels.length - 1)) * i; doc.text(label, xx, y + h + 8, { align: 'center', maxWidth: 24 }); });
}
function drawBenefitChart(doc: jsPDF, m: Metrics, y: number) {
  title(doc, 'Comparativa gráfica de prestaciones frente a gastos', y); y = paragraph(doc, `Compara cada prestación estimada con el gasto mensual real. Gasto declarado: ${euro(m.expenses)}. Gasto ajustado por rentas inmobiliarias: ${euro(m.adjustedExpenses)}.`, 14, y + 10);
  const x = 42, top = y + 6, w = 142, h = 96; const max = Math.max(m.adjustedExpenses, m.expenses, ...m.benefits.map(b => b.value), 1);
  axisLabels(doc, x, top, w, h, max, m.benefits.map(b => b.label));
  const slot = w / m.benefits.length; const barW = slot * .45;
  m.benefits.forEach((b, i) => { const bh = (b.value / max) * h; const bx = x + i * slot + slot * .28; doc.setFillColor(...GOLD); doc.roundedRect(bx, top + h - bh, barW, bh, 1, 1, 'F'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.3); doc.setTextColor(...SLATE); doc.text(shortEuro(b.value), bx + barW / 2, top + h - bh - 2, { align: 'center' }); });
  const gy = top + h - (m.adjustedExpenses / max) * h; doc.setDrawColor(...RED); doc.setLineWidth(.8); doc.line(x, gy, x + w, gy); doc.setTextColor(...RED); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.text('Gasto neto', x + w, gy - 2, { align: 'right' });
  return top + h + 18;
}
function drawRetirementChart(doc: jsPDF, m: Metrics, y: number) {
  title(doc, 'Estudio brecha de jubilación', y); y = paragraph(doc, `Proyección del patrimonio frente al capital objetivo necesario para sostener el nivel de vida hasta los 90 años. Brecha mensual ajustada: ${euro(m.retirementGap)}.`, 14, y + 10);
  const x = 42, top = y + 6, w = 142, h = 98; const max = Math.max(m.projectedTotal, m.targetCapital, 1); const years = Math.max(1, m.yearsToRetirement);
  axisLabels(doc, x, top, w, h, max, [`${m.age || 0}`, `${Math.round((m.age + 67) / 2)}`, '67']);
  const points = Array.from({ length: 6 }, (_, i) => { const r = i / 5; const val = m.bank + m.invested * r + m.saving * r + m.rents * r + m.realEstateInvestments * r; return { px: x + w * r, py: top + h - (val / max) * h, val }; });
  doc.setDrawColor(...GOLD); doc.setLineWidth(1.2); points.forEach((p, i) => { if (i) doc.line(points[i - 1].px, points[i - 1].py, p.px, p.py); doc.setFillColor(...GOLD); doc.circle(p.px, p.py, 1.5, 'F'); });
  const targetY = top + h - (m.targetCapital / max) * h; doc.setDrawColor(...RED); doc.setLineDashPattern([3, 2], 0); doc.line(x, targetY, x + w, targetY); doc.setLineDashPattern([], 0); doc.setTextColor(...RED); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.text('Capital objetivo', x + w, targetY - 2, { align: 'right' });
  cardGrid(doc, [
    { label: 'Dinero acumulado', value: euro(m.bank) }, { label: 'Dinero invertido', value: euro(m.invested) }, { label: 'Ahorro sistemático', value: euro(m.saving) }, { label: 'Rentas inmobiliarias', value: euro(m.rents) }, { label: 'Inversiones inmobiliarias', value: euro(m.realEstateInvestments) }, { label: 'Proyección total a los 67', value: euro(m.projectedTotal) },
  ], 14, top + h + 18, 2);
  return top + h + 86;
}
function drawRadarChart(doc: jsPDF, y: number) {
  title(doc, 'Niveles de Seguridad y Vulnerabilidad', y); y = paragraph(doc, 'Representa de forma visual el nivel de seguridad en las áreas clave de protección financiera y patrimonial. Escala de 0% a 100%.', 14, y + 10);
  const scores = scoresFromApp(); const cx = 105, cy = y + 58, radius = 42; const sides = scores.length;
  doc.setDrawColor(...BORDER); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
  [0.25, .5, .75, 1].forEach(r => { const pts = scores.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; return [cx + Math.cos(a) * radius * r, cy + Math.sin(a) * radius * r]; }); pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; doc.line(p[0], p[1], n[0], n[1]); }); doc.text(`${Math.round(r * 100)}%`, cx + radius * r + 3, cy); });
  const poly = scores.map((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; const r = radius * (s.score / 10); const lx = cx + Math.cos(a) * (radius + 13); const ly = cy + Math.sin(a) * (radius + 13); doc.line(cx, cy, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); doc.text(s.label, lx, ly, { align: 'center' }); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  doc.setDrawColor(...GOLD); doc.setLineWidth(1.1); poly.forEach((p, i) => { const n = poly[(i + 1) % poly.length]; doc.line(p[0], p[1], n[0], n[1]); doc.setFillColor(...GOLD); doc.circle(p[0], p[1], 1.4, 'F'); });
  return y + 118;
}
function textPages(doc: jsPDF, section: AppSection, page: number) {
  newPage(doc, section.heading.toUpperCase(), page); title(doc, section.heading, 42); let y = paragraph(doc, section.explanation, 14, 52, 182, 8.2); doc.setDrawColor(...GOLD); doc.line(14, y, 55, y); y += 8;
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.7); doc.setTextColor(...MUTED); const lines = doc.splitTextToSize(clean(section.text), 182) as string[]; let current = page;
  lines.forEach(line => { if (y > 276) { pageFooter(doc, current++); doc.addPage(); pageHeader(doc, section.heading.toUpperCase()); y = 42; } doc.text(line, 14, y); y += 4; });
  pageFooter(doc, current); return current + 1;
}
function cover(doc: jsPDF, clientName: string) {
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 297, 'F'); doc.setDrawColor(...GOLD); doc.setLineWidth(.8); doc.line(18, 44, 192, 44);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(25); doc.setTextColor(...BLACK); doc.text('INFORME DE AUDITORÍA', 18, 76); doc.setFontSize(20); doc.text('DE RIESGOS FINANCIEROS', 18, 91); doc.text('Y PATRIMONIALES', 18, 105);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...GOLD); doc.text('Previsión social, protección familiar y brecha de jubilación', 18, 123);
  doc.setTextColor(...SLATE); doc.setFontSize(10.5); doc.text(`Cliente: ${clientName}`, 18, 154); doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 18, 164);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.text('Realizado por José Carlos Hidalgo', 18, 232); doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.text('consultor financiero, hipotecario y patrimonial', 18, 241); doc.setTextColor(...MUTED); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 18, 251);
}
function executiveParagraphs(sections: AppSection[], m: Metrics) {
  const txt = (needle: string) => sections.find(s => s.heading.toLowerCase().includes(needle))?.text || '';
  return [
    `Datos del cliente. La auditoría parte de una fotografía económica y familiar que permite evaluar ingresos, gastos, base de cotización, situación familiar, patrimonio líquido e inversiones. El gasto mensual declarado es ${euro(m.expenses)} y el gasto ajustado por rentas es ${euro(m.adjustedExpenses)}.`,
    `Objetivos. Los objetivos a medio y largo plazo deben contrastarse con la capacidad de ahorro disponible. ${clean(txt('objetivos')).slice(0, 260)}`,
    `Previsión social. Las prestaciones públicas estimadas deben compararse con el gasto real del hogar. Las rentas inmobiliarias ayudan a reducir la brecha, pero no eliminan la necesidad de revisar coberturas personales y familiares.`,
    `Jubilación. La pensión estimada es de ${euro(m.retirementPension)} al mes y la brecha ajustada es de ${euro(m.retirementGap)} al mes. El capital objetivo estimado es ${euro(m.targetCapital)}, frente a una proyección a los 67 de ${euro(m.projectedTotal)}.`,
    `Seguridad y vulnerabilidad. Las áreas con menor puntuación deben abordarse antes de asumir nuevos riesgos financieros, porque una contingencia sin cobertura puede forzar deuda, desinversión o pérdida de estabilidad familiar.`,
    `Recomendaciones. Priorizar protección de ingresos, capital familiar, reserva líquida, estrategia antiinflación, ahorro sistemático de jubilación y documentación legal accesible para la familia.`,
  ];
}
async function generatePdf() {
  window.dispatchEvent(new CustomEvent('audit-real-estate-updated')); await new Promise<void>(resolve => window.setTimeout(resolve, 120));
  const clientName = fieldValue('nombre') || 'Cliente'; const m = collectMetrics(); const sections = getSections(); const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); let page = 1;
  cover(doc, clientName); pageFooter(doc, page++);
  newPage(doc, 'RESUMEN Y DATOS DEL CLIENTE', page); title(doc, 'Resumen inicial', 42); let y = paragraph(doc, 'Informe profesional, visual y didáctico basado en todos los datos introducidos en la aplicación. El objetivo es transformar la información financiera y patrimonial en un diagnóstico claro, útil y accionable.', 14, 54); y = cardGrid(doc, clientFields(m), 14, y + 4, 2); title(doc, 'Indicadores principales', y + 4); cardGrid(doc, [{ label: 'Gasto mensual declarado', value: euro(m.expenses) }, { label: 'Gasto ajustado por rentas', value: euro(m.adjustedExpenses) }, { label: 'Pensión jubilación estimada', value: `${euro(m.retirementPension)} / mes` }, { label: 'Brecha jubilación ajustada', value: `${euro(m.retirementGap)} / mes` }, { label: 'Capital objetivo jubilación', value: euro(m.targetCapital) }, { label: 'Proyección total a los 67', value: euro(m.projectedTotal) }], 14, y + 16, 2); pageFooter(doc, page++);
  newPage(doc, 'AUDITORÍA DE PREVISIÓN SOCIAL', page); drawBenefitChart(doc, m, 42); pageFooter(doc, page++);
  newPage(doc, 'ESTUDIO BRECHA DE JUBILACIÓN', page); drawRetirementChart(doc, m, 42); pageFooter(doc, page++);
  newPage(doc, 'SEGURIDAD Y VULNERABILIDAD', page); drawRadarChart(doc, 42); pageFooter(doc, page++);
  sections.forEach(section => { page = textPages(doc, section, page); });
  newPage(doc, 'RESUMEN EJECUTIVO', page); title(doc, 'Resumen ejecutivo y recomendaciones', 42); y = 54; executiveParagraphs(sections, m).forEach(text => { y = paragraph(doc, text, 14, y, 182, 8.2); y += 2; }); pageFooter(doc, page++);
  newPage(doc, 'CONCLUSIÓN PROFESIONAL', page); title(doc, 'Cierre y próximos pasos', 42); paragraph(doc, 'Este informe está diseñado para servir como herramienta de decisión. El siguiente paso recomendable es convertir el diagnóstico en un plan de acción concreto: revisar coberturas, capitales asegurados, estructura de ahorro, estrategia de inversión, planificación de jubilación y documentación legal familiar.', 14, 54, 182, 8.5); pageFooter(doc, page);
  doc.save(`informe-auditoria-profesional-${slug(clientName)}.pdf`);
}
function buttonBusy(button: HTMLButtonElement, busy: boolean) { if (busy) { button.dataset.originalHtml = button.innerHTML; button.disabled = true; button.style.opacity = '0.72'; button.innerHTML = '<span>Generando informe profesional PDF...</span>'; } else { button.disabled = false; button.style.opacity = ''; if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml; } }
function isPdfButton(target: EventTarget | null) { const element = target instanceof Element ? target : null; const button = element?.closest('button') as HTMLButtonElement | null; return button && /descargar.*pdf|descargar informe pdf|descargar auditoría/i.test(button.innerText || '') ? button : null; }
function install() { const win = window as typeof window & { [FLAG]?: boolean }; if (win[FLAG]) return; win[FLAG] = true; document.addEventListener('click', async (event) => { const button = isPdfButton(event.target); if (!button) return; event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); try { buttonBusy(button, true); await generatePdf(); } catch (error) { console.error(error); window.alert('No se pudo generar el informe profesional. Revisa los datos y vuelve a intentarlo.'); } finally { buttonBusy(button, false); } }, true); }
install();
