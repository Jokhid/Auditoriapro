import { jsPDF } from 'jspdf';

const FLAG = '__auditProfessionalPdfV2Installed';
const GOLD = [197, 165, 102] as const;
const BLACK = [26, 26, 26] as const;
const SLATE = [15, 23, 42] as const;
const MUTED = [71, 85, 105] as const;
const LIGHT = [248, 250, 252] as const;
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

type ChartCapture = { title: string; dataUrl: string; width: number; height: number; x: string[]; y: string[] };
type Field = { label: string; value: string };

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function slug(value: string) {
  return clean(value || 'cliente').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente';
}

function euro(value: number) {
  return `${Math.round(value).toLocaleString('es-ES')} EUR`;
}

function fieldValue(labelText: string) {
  const needle = labelText.toLowerCase();
  const label = Array.from(document.querySelectorAll('label')).find((item) => (item.textContent || '').toLowerCase().includes(needle));
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return clean(input?.value || '');
}

function fieldNumber(labelText: string) {
  return Number(fieldValue(labelText).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function sectionByText(text: string) {
  const needle = text.toLowerCase();
  return Array.from(document.querySelectorAll('main section')).find((section) => (section.textContent || '').toLowerCase().includes(needle)) as HTMLElement | undefined;
}

function realEstateData() {
  const win = window as typeof window & { auditRealEstateData?: () => Record<string, number> };
  return typeof win.auditRealEstateData === 'function' ? win.auditRealEstateData() : {} as Record<string, number>;
}

function getAllSections() {
  return Array.from(document.querySelectorAll('main section')).map((section, index) => {
    const heading = clean((section.querySelector('h2,h1,h3') as HTMLElement | null)?.innerText || `Sección ${index + 1}`);
    const text = clean((section as HTMLElement).innerText.replace(/Descargar informe PDF/gi, ''));
    return { heading, text };
  }).filter((section) => section.text.length > 0);
}

function clientFields(): Field[] {
  const estate = realEstateData();
  return [
    ['Cliente', fieldValue('nombre') || 'No indicado'],
    ['Teléfono', fieldValue('teléfono') || 'No indicado'],
    ['Email', fieldValue('email') || 'No indicado'],
    ['Edad', `${fieldValue('edad') || '-'} años`],
    ['Años cotizados', `${fieldValue('años cotizados') || '-'} años`],
    ['Base de cotización', `${fieldValue('base cotización') || '-'} EUR / mes`],
    ['Estado civil', fieldValue('estado civil') || 'No indicado'],
    ['Hijos menores de 25 años', fieldValue('hijos menores') || '0'],
    ['Salario neto mensual', `${fieldValue('salario neto mensual') || '-'} EUR`],
    ['Gastos mensuales', `${fieldValue('gastos mensuales') || '-'} EUR`],
    ['Alquiler, hipoteca y préstamos', `${fieldValue('alquiler, hipoteca y préstamos') || '-'} EUR`],
    ['Dinero en banco', `${fieldValue('dinero en banco') || '-'} EUR`],
    ['Dinero invertido', `${fieldValue('dinero invertido') || '-'} EUR`],
    ['Ahorro sistemático mensual', `${fieldValue('ahorro sistemático mensual') || '-'} EUR`],
    ['Inversiones inmobiliarias', euro(Number(estate.realEstateInvestments || 0))],
    ['Rentas inmobiliarias', `${euro(Number(estate.realEstateRents || 0))} / mes`],
  ].map(([label, value]) => ({ label, value }));
}

function metrics() {
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
  return { base, age, expenses, adjustedExpenses, yearsToRetirement, retirementPension, retirementGap, targetCapital, projectedTotal };
}

function tickValues(max: number, percent = false) {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => percent ? `${Math.round(ratio * 100)}%` : euro(Math.max(1, max) * ratio));
}

function chartInfo(sectionName: string) {
  const m = metrics();
  if (sectionName.includes('Auditoría')) {
    return { title: 'Comparativa gráfica de prestaciones frente a gastos', x: ['Baja laboral', 'Inv. absoluta', 'Inv. profesional', 'Viudedad', 'Orfandad', 'Jubilación'], y: tickValues(Math.max(m.expenses, m.adjustedExpenses, m.base, m.retirementPension, 1)) };
  }
  if (sectionName.includes('brecha')) {
    const age = m.age || 0;
    return { title: 'Estudio brecha de jubilación', x: [`${age} años`, `${Math.round((age + 67) / 2)} años`, '67 años', '90 años'], y: tickValues(Math.max(m.targetCapital, m.projectedTotal, 1)) };
  }
  return { title: 'Niveles de Seguridad y Vulnerabilidad', x: ['Fondo', 'Baja', 'Familia', 'Sanidad', 'Inflación', 'Legal'], y: tickValues(100, true) };
}

function prepareSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(720, Math.round(rect.width || 900));
  const height = Math.max(360, Math.round(rect.height || 420));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', clone.getAttribute('viewBox') || `0 0 ${width} ${height}`);
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = 'text{font-family:Arial,Helvetica,sans-serif}.recharts-text{fill:#475569}.recharts-legend-item-text{fill:#475569;color:#475569}';
  clone.insertBefore(style, clone.firstChild);
  return { clone, width, height };
}

function svgToPng(svg: SVGSVGElement) {
  const { clone, width, height } = prepareSvg(svg);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  return new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext('2d');
      if (!context) { URL.revokeObjectURL(url); reject(new Error('No se pudo preparar el gráfico.')); return; }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL('image/png', 1), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo convertir el gráfico.')); };
    image.src = url;
  });
}

async function captureChart(sectionName: string): Promise<ChartCapture | null> {
  const section = sectionByText(sectionName);
  const svg = section?.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return null;
  const info = chartInfo(sectionName);
  const image = await svgToPng(svg);
  return { title: info.title, dataUrl: image.dataUrl, width: image.width, height: image.height, x: info.x, y: info.y };
}

async function captureCharts() {
  const names = ['2. Auditoría de Previsión Social', '3. Estudio brecha de jubilación', '4. Niveles de Seguridad y Vulnerabilidad'];
  const charts: ChartCapture[] = [];
  for (const name of names) {
    try {
      const chart = await captureChart(name);
      if (chart) charts.push(chart);
    } catch (error) {
      console.warn('No se pudo capturar gráfico', error);
    }
  }
  return charts;
}

function logo(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(255, 255, 255); doc.rect(x, y, 3, 20, 'F'); doc.rect(x + 18, y, 3, 20, 'F'); doc.rect(x + 9, y, 3, 8, 'F'); doc.rect(x + 9, y + 12, 3, 8, 'F'); doc.setFillColor(...GOLD); doc.circle(x + 10.5, y + 10, 5, 'F');
}

function header(doc: jsPDF, title: string) {
  doc.setFillColor(...BLACK); doc.rect(0, 0, 210, 28, 'F'); logo(doc, 12, 5);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255); doc.text('JOSÉ CARLOS HIDALGO', 38, 11);
  doc.setFontSize(7.5); doc.setTextColor(...GOLD); doc.text(title, 38, 17);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.7); doc.setTextColor(255, 255, 255); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 38, 23);
}

function footer(doc: jsPDF, page: number) {
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.7); doc.setTextColor(120, 120, 120);
  doc.text('Informe profesional de auditoría de riesgos financieros y patrimoniales.', 14, 285);
  doc.text(`Página ${page}`, 196, 285, { align: 'right' });
}

function newPage(doc: jsPDF, title: string, page: number) {
  if (page > 1) doc.addPage();
  header(doc, title);
}

function title(doc: jsPDF, text: string, y: number) {
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...SLATE); doc.text(text, MARGIN, y);
}

function paragraph(doc: jsPDF, text: string, x: number, y: number, width = CONTENT_W, size = 8.3) {
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...MUTED);
  const lines = doc.splitTextToSize(clean(text), width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * (size * 0.48) + 4;
}

function grid(doc: jsPDF, fields: Field[], x: number, y: number, columns = 2) {
  const colWidth = columns === 2 ? 88 : 58;
  const rowHeight = 15;
  fields.forEach((field, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const bx = x + col * (colWidth + 6);
    const by = y + row * (rowHeight + 4);
    doc.setFillColor(...LIGHT); doc.setDrawColor(226, 232, 240); doc.roundedRect(bx, by, colWidth, rowHeight, 2, 2, 'FD');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.4); doc.setTextColor(...MUTED); doc.text(field.label, bx + 3, by + 5);
    doc.setFontSize(7.7); doc.setTextColor(...SLATE); doc.text(doc.splitTextToSize(field.value, colWidth - 6).slice(0, 1), bx + 3, by + 11);
  });
  return y + Math.ceil(fields.length / columns) * (rowHeight + 4);
}

function textPages(doc: jsPDF, heading: string, body: string, page: number) {
  newPage(doc, heading.toUpperCase(), page);
  title(doc, heading, 42);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.7); doc.setTextColor(...MUTED);
  const lines = doc.splitTextToSize(clean(body), 182) as string[];
  let y = 54;
  let currentPage = page;
  lines.forEach((line) => {
    if (y > 276) {
      footer(doc, currentPage++);
      doc.addPage(); header(doc, heading.toUpperCase()); y = 42;
    }
    doc.text(line, 14, y);
    y += 4;
  });
  footer(doc, currentPage);
  return currentPage + 1;
}

function chartPage(doc: jsPDF, chart: ChartCapture, page: number) {
  newPage(doc, chart.title.toUpperCase(), page);
  title(doc, chart.title, 42);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(7.3); doc.setTextColor(...MUTED);
  doc.text(`Eje X: ${chart.x.join(' | ')}`, 14, 51);
  doc.text(`Eje Y: ${chart.y.join(' | ')}`, 14, 58);
  const maxW = 182;
  const maxH = 142;
  const ratio = Math.min(maxW / chart.width, maxH / chart.height);
  const w = chart.width * ratio;
  const h = chart.height * ratio;
  const x = 14 + (maxW - w) / 2;
  doc.setFillColor(255, 255, 255); doc.setDrawColor(226, 232, 240); doc.roundedRect(14, 66, 182, h + 10, 2, 2, 'FD');
  doc.addImage(chart.dataUrl, 'PNG', x, 71, w, h);
  footer(doc, page);
  return page + 1;
}

function cover(doc: jsPDF, clientName: string) {
  doc.setFillColor(...BLACK); doc.rect(0, 0, 210, 297, 'F'); logo(doc, 18, 22);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(27); doc.setTextColor(255, 255, 255); doc.text('INFORME DE AUDITORÍA', 18, 78); doc.setFontSize(22); doc.text('DE RIESGOS FINANCIEROS', 18, 92); doc.text('Y PATRIMONIALES', 18, 106);
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(18, 118, 150, 118);
  doc.setFontSize(12); doc.setTextColor(...GOLD); doc.text('Previsión social, protección familiar y brecha de jubilación', 18, 132);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(255, 255, 255); doc.text(`Cliente: ${clientName}`, 18, 158); doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 18, 166);
  doc.setFont('Helvetica', 'bold'); doc.text('JOSÉ CARLOS HIDALGO', 18, 242); doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.text('Gestión patrimonial e hipotecaria', 18, 250); doc.text('josecarlos@hilolegal.es | 647 50 60 40', 18, 258);
}

async function generatePdf() {
  window.dispatchEvent(new CustomEvent('audit-real-estate-updated'));
  await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
  const clientName = fieldValue('nombre') || 'Cliente';
  const charts = await captureCharts();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let page = 1;

  cover(doc, clientName); footer(doc, page++);
  newPage(doc, 'RESUMEN Y DATOS DEL CLIENTE', page);
  title(doc, 'Resumen inicial', 42);
  let y = paragraph(doc, 'Este informe recoge todos los datos introducidos en la aplicación y los transforma en una auditoría profesional, didáctica y accionable. Incluye datos de cliente, objetivos, cuestionario, prestaciones, brecha de jubilación, seguridad financiera, diagnóstico estratégico y resumen ejecutivo.', 14, 54);
  y = grid(doc, clientFields(), 14, y + 4, 2);
  title(doc, 'Indicadores principales', y + 4);
  const m = metrics();
  grid(doc, [
    { label: 'Gasto mensual declarado', value: euro(m.expenses) },
    { label: 'Gasto ajustado por rentas', value: euro(m.adjustedExpenses) },
    { label: 'Pensión jubilación estimada', value: `${euro(m.retirementPension)} / mes` },
    { label: 'Brecha jubilación ajustada', value: `${euro(m.retirementGap)} / mes` },
    { label: 'Capital objetivo jubilación', value: euro(m.targetCapital) },
    { label: 'Proyección total a los 67', value: euro(m.projectedTotal) },
  ], 14, y + 16, 2);
  footer(doc, page++);

  charts.forEach((chart) => { page = chartPage(doc, chart, page); });

  getAllSections().forEach((section) => {
    page = textPages(doc, section.heading, section.text, page);
  });

  newPage(doc, 'CONCLUSIÓN PROFESIONAL', page);
  title(doc, 'Cierre y próximos pasos', 42);
  paragraph(doc, 'El valor del informe reside en convertir los datos personales y patrimoniales en decisiones concretas: proteger ingresos, corregir brechas, ordenar liquidez, revisar coberturas familiares, planificar jubilación y estructurar correctamente el patrimonio. Las áreas con mayor vulnerabilidad deben revisarse personalmente para transformar este diagnóstico en un plan de acción ejecutable.', 14, 54, 182, 8.5);
  footer(doc, page);
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
  if (win[FLAG]) return;
  win[FLAG] = true;
  document.addEventListener('click', async (event) => {
    const button = isPdfButton(event.target);
    if (!button) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    try { buttonBusy(button, true); await generatePdf(); }
    catch (error) { console.error(error); window.alert('No se pudo generar el informe profesional. Revisa que los gráficos estén visibles y vuelve a intentarlo.'); }
    finally { buttonBusy(button, false); }
  }, true);
}

install();
