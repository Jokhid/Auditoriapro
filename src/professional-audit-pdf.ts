import { jsPDF } from 'jspdf';

const PROFESSIONAL_PDF_FLAG = '__auditProfessionalPdfInstalled';
const GOLD = [197, 165, 102] as const;
const BLACK = [26, 26, 26] as const;
const SLATE = [15, 23, 42] as const;
const MUTED = [71, 85, 105] as const;
const LIGHT = [248, 250, 252] as const;

type ChartCapture = { title: string; dataUrl: string; width: number; height: number; x: string[]; y: string[] };

type ReportField = { label: string; value: string };

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function fileName(value: string) {
  return cleanText(value || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cliente';
}

function eur(value: number) {
  return `${Math.round(value).toLocaleString('es-ES')} EUR`;
}

function fieldValue(labelText: string) {
  const needle = labelText.toLowerCase();
  const label = Array.from(document.querySelectorAll('label')).find((item) =>
    (item.textContent || '').toLowerCase().includes(needle),
  );
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return cleanText(input?.value || '');
}

function fieldNumber(labelText: string) {
  return Number(fieldValue(labelText).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function sectionByText(text: string) {
  const needle = text.toLowerCase();
  return Array.from(document.querySelectorAll('main section')).find((section) =>
    (section.textContent || '').toLowerCase().includes(needle),
  ) as HTMLElement | undefined;
}

function getRealEstateData() {
  const win = window as typeof window & { auditRealEstateData?: () => Record<string, number> };
  if (typeof win.auditRealEstateData === 'function') return win.auditRealEstateData();
  return {} as Record<string, number>;
}

function getClientFields(): ReportField[] {
  const realEstate = getRealEstateData();
  return [
    { label: 'Cliente', value: fieldValue('nombre') || 'No indicado' },
    { label: 'Teléfono', value: fieldValue('teléfono') || 'No indicado' },
    { label: 'Email', value: fieldValue('email') || 'No indicado' },
    { label: 'Edad', value: `${fieldValue('edad') || '-'} años` },
    { label: 'Años cotizados', value: `${fieldValue('años cotizados') || '-'} años` },
    { label: 'Base de cotización', value: `${fieldValue('base cotización') || '-'} EUR / mes` },
    { label: 'Estado civil', value: fieldValue('estado civil') || 'No indicado' },
    { label: 'Hijos menores de 25 años', value: fieldValue('hijos menores') || '0' },
    { label: 'Salario neto mensual', value: `${fieldValue('salario neto mensual') || '-'} EUR` },
    { label: 'Gastos mensuales', value: `${fieldValue('gastos mensuales') || '-'} EUR` },
    { label: 'Alquiler, hipoteca y préstamos', value: `${fieldValue('alquiler, hipoteca y préstamos') || '-'} EUR` },
    { label: 'Dinero en banco', value: `${fieldValue('dinero en banco') || '-'} EUR` },
    { label: 'Dinero invertido', value: `${fieldValue('dinero invertido') || '-'} EUR` },
    { label: 'Ahorro sistemático mensual', value: `${fieldValue('ahorro sistemático mensual') || '-'} EUR` },
    { label: 'Inversiones inmobiliarias', value: eur(Number(realEstate.realEstateInvestments || 0)) },
    { label: 'Rentas inmobiliarias', value: `${eur(Number(realEstate.realEstateRents || 0))} / mes` },
  ];
}

function calculateMetrics() {
  const realEstate = getRealEstateData();
  const base = fieldNumber('base cotización') || fieldNumber('base cotizacion');
  const age = fieldNumber('edad');
  const years = fieldNumber('años cotizados') || fieldNumber('anos cotizados');
  const expenses = fieldNumber('gastos mensuales') + fieldNumber('alquiler, hipoteca y préstamos');
  const adjustedExpenses = Number(realEstate.adjustedExpenses ?? Math.max(0, expenses - Number(realEstate.realEstateRents || 0)));
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = years + yearsToRetirement;
  const retirementRate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  const retirementPension = base * retirementRate;
  const retirementGap = Number(realEstate.retirementGap ?? Math.max(0, adjustedExpenses - retirementPension));
  const targetCapital = retirementGap * 12 * 23;
  const projectedTotal = Number(realEstate.projectedTotal || 0);
  const maxBenefit = Math.max(expenses, adjustedExpenses, base, base * 0.75, retirementPension, 1);
  const maxRetirement = Math.max(targetCapital, projectedTotal, 1);
  return { base, age, years, expenses, adjustedExpenses, yearsToRetirement, retirementPension, retirementGap, targetCapital, projectedTotal, maxBenefit, maxRetirement };
}

function ticks(max: number, percent = false) {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => percent ? `${Math.round(ratio * 100)}%` : eur(max * ratio));
}

function chartMeta(sectionName: string) {
  const metrics = calculateMetrics();
  if (sectionName.includes('Auditoría')) {
    return {
      title: 'Comparativa gráfica de prestaciones frente a gastos',
      x: ['Baja laboral', 'Inv. absoluta', 'Inv. profesional', 'Viudedad', 'Orfandad', 'Jubilación'],
      y: ticks(metrics.maxBenefit),
    };
  }
  if (sectionName.includes('brecha')) {
    const age = metrics.age || 0;
    return {
      title: 'Estudio brecha de jubilación',
      x: [`${age} años`, `${Math.round((age + 67) / 2)} años`, '67 años', '90 años'],
      y: ticks(metrics.maxRetirement),
    };
  }
  return {
    title: 'Niveles de Seguridad y Vulnerabilidad',
    x: ['Fondo', 'Baja', 'Familia', 'Sanidad', 'Inflación', 'Legal'],
    y: ticks(100, true),
  };
}

function prepareSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(560, Math.round(rect.width || 720));
  const height = Math.max(260, Math.round(rect.height || 320));
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
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo preparar el gráfico.'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL('image/png', 1), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo convertir el gráfico.'));
    };
    image.src = url;
  });
}

async function captureChart(sectionText: string): Promise<ChartCapture | null> {
  const section = sectionByText(sectionText);
  const svg = section?.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return null;
  const meta = chartMeta(sectionText);
  const image = await svgToPng(svg);
  return { title: meta.title, dataUrl: image.dataUrl, width: image.width, height: image.height, x: meta.x, y: meta.y };
}

async function captureCharts() {
  const chartNames = ['2. Auditoría de Previsión Social', '3. Estudio brecha de jubilación', '4. Niveles de Seguridad y Vulnerabilidad'];
  const captures: ChartCapture[] = [];
  for (const name of chartNames) {
    try {
      const capture = await captureChart(name);
      if (capture) captures.push(capture);
    } catch (error) {
      console.warn('No se pudo capturar un gráfico:', error);
    }
  }
  return captures;
}

function drawLogo(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, 3, 20, 'F');
  doc.rect(x + 18, y, 3, 20, 'F');
  doc.rect(x + 9, y, 3, 8, 'F');
  doc.rect(x + 9, y + 12, 3, 8, 'F');
  doc.setFillColor(...GOLD);
  doc.circle(x + 10.5, y + 10, 5, 'F');
}

function header(doc: jsPDF, title: string) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, 210, 28, 'F');
  drawLogo(doc, 12, 5);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('JOSÉ CARLOS HIDALGO', 38, 11);
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD);
  doc.text(title, 38, 17);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(255, 255, 255);
  doc.text('josecarlos@hilolegal.es | 647 50 60 40', 38, 23);
}

function footer(doc: jsPDF, page: number) {
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(120, 120, 120);
  doc.text('Informe de auditoría de riesgos financieros y patrimoniales. Documento diagnóstico y de planificación.', 14, 285);
  doc.text(`Página ${page}`, 196, 285, { align: 'right' });
}

function addPage(doc: jsPDF, title: string, page: number) {
  if (page > 1) doc.addPage();
  header(doc, title);
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...SLATE);
  doc.text(title, 14, y);
}

function paragraph(doc: jsPDF, text: string, x: number, y: number, width = 182, size = 8.5) {
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...MUTED);
  const lines = doc.splitTextToSize(cleanText(text), width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * (size * 0.48) + 4;
}

function drawInfoGrid(doc: jsPDF, fields: ReportField[], x: number, y: number, columns = 2) {
  const colWidth = columns === 2 ? 88 : 58;
  const rowHeight = 15;
  fields.forEach((field, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const boxX = x + col * (colWidth + 6);
    const boxY = y + row * (rowHeight + 4);
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, boxY, colWidth, rowHeight, 2, 2, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(...MUTED);
    doc.text(field.label, boxX + 3, boxY + 5);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(doc.splitTextToSize(field.value, colWidth - 6).slice(0, 1), boxX + 3, boxY + 11);
  });
  return y + Math.ceil(fields.length / columns) * (rowHeight + 4);
}

function drawChart(doc: jsPDF, chart: ChartCapture, y: number) {
  sectionTitle(doc, chart.title, y);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Eje X: ${chart.x.join(' | ')}`, 14, y + 8);
  doc.text(`Eje Y: ${chart.y.join(' | ')}`, 14, y + 14);

  const maxW = 182;
  const maxH = 86;
  const ratio = Math.min(maxW / chart.width, maxH / chart.height);
  const w = chart.width * ratio;
  const h = chart.height * ratio;
  const x = 14 + (maxW - w) / 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y + 19, 182, h + 8, 2, 2, 'FD');
  doc.addImage(chart.dataUrl, 'PNG', x, y + 23, w, h);
  return y + h + 34;
}

function sectionText(sectionName: string) {
  const section = sectionByText(sectionName);
  return cleanText((section?.innerText || '').replace(/Descargar informe PDF/gi, ''));
}

function getExecutiveSummary() {
  const formatted = document.querySelector('.audit-executive-summary-paragraphs') as HTMLElement | null;
  if (formatted) return cleanText(formatted.innerText);
  const section = sectionByText('6. Resumen ejecutivo');
  return cleanText(section?.innerText || '');
}

function drawCover(doc: jsPDF, clientName: string) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, 210, 297, 'F');
  drawLogo(doc, 18, 22);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(27);
  doc.setTextColor(255, 255, 255);
  doc.text('INFORME DE AUDITORÍA', 18, 78);
  doc.setFontSize(22);
  doc.text('DE RIESGOS FINANCIEROS', 18, 92);
  doc.text('Y PATRIMONIALES', 18, 106);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(18, 118, 150, 118);
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text('Previsión social, protección familiar y brecha de jubilación', 18, 132);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Cliente: ${clientName || 'No indicado'}`, 18, 158);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 18, 166);
  doc.setFont('Helvetica', 'bold');
  doc.text('JOSÉ CARLOS HIDALGO', 18, 242);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Gestión patrimonial e hipotecaria', 18, 250);
  doc.text('josecarlos@hilolegal.es | 647 50 60 40', 18, 258);
}

async function generateProfessionalPdf() {
  window.dispatchEvent(new CustomEvent('audit-real-estate-updated'));
  await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
  const clientName = fieldValue('nombre') || 'Cliente';
  const charts = await captureCharts();
  const metrics = calculateMetrics();
  const realEstate = getRealEstateData();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let page = 1;

  drawCover(doc, clientName);
  footer(doc, page++);

  addPage(doc, 'RESUMEN DE LA AUDITORÍA', page);
  sectionTitle(doc, 'Índice y alcance del informe', 42);
  let y = paragraph(doc, 'Este documento recoge el resultado completo de la auditoría financiera y patrimonial realizada a partir de los datos introducidos en la aplicación. El objetivo es identificar brechas de protección, valorar la seguridad económica familiar, proyectar la jubilación y proponer líneas de actuación priorizadas.', 14, 54);
  const indexItems = [
    '1. Resumen de datos del cliente',
    '2. Objetivos a medio y largo plazo',
    '3. Cuestionario completo de auditoría',
    '4. Auditoría de previsión social',
    '5. Estudio brecha de jubilación',
    '6. Niveles de seguridad y vulnerabilidad',
    '7. Diagnóstico estratégico y plan de acción',
    '8. Resumen ejecutivo y recomendaciones',
  ];
  drawInfoGrid(doc, indexItems.map((item) => ({ label: item, value: 'Incluido en el informe' })), 14, y + 4, 2);
  footer(doc, page++);

  addPage(doc, 'DATOS DEL CLIENTE', page);
  sectionTitle(doc, '1. Resumen de datos del Cliente', 42);
  drawInfoGrid(doc, getClientFields(), 14, 54, 2);
  footer(doc, page++);

  addPage(doc, 'OBJETIVOS Y CAPACIDAD DE AHORRO', page);
  sectionTitle(doc, '2. Objetivos a medio y largo plazo', 42);
  y = paragraph(doc, sectionText('Objetivos a medio y largo plazo') || 'No se han localizado objetivos personalizados en la aplicación.', 14, 54);
  sectionTitle(doc, 'Desglose de proyección patrimonial a los 67 años', y + 4);
  drawInfoGrid(doc, [
    { label: 'Dinero acumulado', value: eur(Number(realEstate.accumulatedBank || fieldNumber('dinero en banco'))) },
    { label: 'Dinero invertido', value: eur(Number(realEstate.projectedInvested || fieldNumber('dinero invertido'))) },
    { label: 'Ahorro sistemático', value: eur(Number(realEstate.projectedSaving || 0)) },
    { label: 'Rentas inmobiliarias', value: eur(Number(realEstate.projectedRents || 0)) },
    { label: 'Inversiones inmobiliarias', value: eur(Number(realEstate.realEstateInvestments || 0)) },
    { label: 'Proyección total a los 67', value: eur(metrics.projectedTotal) },
  ], 14, y + 16, 2);
  footer(doc, page++);

  addPage(doc, 'CUESTIONARIO DE AUDITORÍA', page);
  sectionTitle(doc, '3. Cuestionario completo de auditoría', 42);
  paragraph(doc, sectionText('Cuestionario completo de auditoría') || 'Cuestionario no localizado.', 14, 54, 182, 7.8);
  footer(doc, page++);

  addPage(doc, 'AUDITORÍA DE PREVISIÓN SOCIAL', page);
  sectionTitle(doc, '4. Auditoría de Previsión Social', 42);
  y = paragraph(doc, `La auditoría compara las prestaciones públicas estimadas frente al gasto mensual real. Cuando existen rentas inmobiliarias, estas reducen el gasto neto a cubrir. Gasto mensual declarado: ${eur(metrics.expenses)}. Gasto neto tras rentas inmobiliarias: ${eur(metrics.adjustedExpenses)}.`, 14, 54);
  const benefitChart = charts.find((chart) => chart.title.includes('prestaciones'));
  if (benefitChart) y = drawChart(doc, benefitChart, y + 3);
  paragraph(doc, sectionText('Ajuste por rentas inmobiliarias') || sectionText('2. Auditoría de Previsión Social'), 14, y, 182, 7.8);
  footer(doc, page++);

  addPage(doc, 'ESTUDIO BRECHA DE JUBILACIÓN', page);
  sectionTitle(doc, '5. Estudio brecha de jubilación', 42);
  y = paragraph(doc, `La brecha de jubilación ajustada asciende a ${eur(metrics.retirementGap)} al mes. Para sostener el nivel de vida entre los 67 y los 90 años, el capital objetivo estimado es ${eur(metrics.targetCapital)}. La proyección patrimonial total a los 67 años es ${eur(metrics.projectedTotal)}.`, 14, 54);
  const retirementChart = charts.find((chart) => chart.title.includes('jubilación'));
  if (retirementChart) y = drawChart(doc, retirementChart, y + 3);
  paragraph(doc, sectionText('Desglose de proyección patrimonial') || sectionText('3. Estudio brecha de jubilación'), 14, y, 182, 7.8);
  footer(doc, page++);

  addPage(doc, 'SEGURIDAD Y VULNERABILIDAD', page);
  sectionTitle(doc, '6. Niveles de Seguridad y Vulnerabilidad', 42);
  y = paragraph(doc, 'El gráfico de seguridad resume el grado de protección por áreas: liquidez, baja laboral, protección familiar, sanidad, inflación/inversión y protección legal. Su lectura permite priorizar medidas de corrección.', 14, 54);
  const vulnerabilityChart = charts.find((chart) => chart.title.includes('Vulnerabilidad'));
  if (vulnerabilityChart) y = drawChart(doc, vulnerabilityChart, y + 3);
  paragraph(doc, sectionText('4. Niveles de Seguridad y Vulnerabilidad'), 14, y, 182, 7.8);
  footer(doc, page++);

  addPage(doc, 'DIAGNÓSTICO Y PLAN DE ACCIÓN', page);
  sectionTitle(doc, '7. Diagnóstico estratégico y plan de acción', 42);
  paragraph(doc, sectionText('5. Diagnóstico estratégico y plan de acción') || 'Diagnóstico no localizado.', 14, 54, 182, 7.8);
  footer(doc, page++);

  addPage(doc, 'RESUMEN EJECUTIVO', page);
  sectionTitle(doc, '8. Resumen ejecutivo', 42);
  y = paragraph(doc, getExecutiveSummary(), 14, 54, 182, 8.2);
  sectionTitle(doc, 'Mensaje final', Math.min(y + 8, 240));
  paragraph(doc, 'Este informe identifica las áreas de mayor vulnerabilidad y las medidas prioritarias para mejorar la protección financiera, familiar y patrimonial. Para transformar este diagnóstico en un plan ejecutable, es recomendable revisar personalmente las coberturas, capitales asegurados, ahorro sistemático, estructura de inversión y planificación legal.', 14, Math.min(y + 20, 252), 182, 8.2);
  footer(doc, page);

  doc.save(`informe-auditoria-profesional-${fileName(clientName)}.pdf`);
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean) {
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.style.opacity = '0.72';
    button.innerHTML = '<span>Generando informe profesional PDF...</span>';
  } else {
    button.disabled = false;
    button.style.opacity = '';
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

function isPdfDownloadButton(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest('button') as HTMLButtonElement | null;
  if (!button) return null;
  return /descargar.*pdf|descargar informe pdf|descargar auditoría/i.test(button.innerText || '') ? button : null;
}

function installProfessionalPdf() {
  const win = window as typeof window & { [PROFESSIONAL_PDF_FLAG]?: boolean };
  if (win[PROFESSIONAL_PDF_FLAG]) return;
  win[PROFESSIONAL_PDF_FLAG] = true;
  document.addEventListener('click', async (event) => {
    const button = isPdfDownloadButton(event.target);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    try {
      setButtonBusy(button, true);
      await generateProfessionalPdf();
    } catch (error) {
      console.error(error);
      window.alert('No se pudo generar el informe profesional. Revisa que los gráficos estén visibles y vuelve a intentarlo.');
    } finally {
      setButtonBusy(button, false);
    }
  }, true);
}

installProfessionalPdf();
