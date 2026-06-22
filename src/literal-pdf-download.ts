import { jsPDF } from 'jspdf';

const DOWNLOAD_FLAG = '__auditLiteralPdfDownloadInstalled';

type ChartCapture = { title: string; dataUrl: string; width: number; height: number };
type RealEstateData = {
  realEstateInvestments: number;
  realEstateRents: number;
  adjustedExpenses: number;
  retirementGap: number;
  accumulatedBank: number;
  projectedInvested: number;
  projectedSaving: number;
  projectedRents: number;
  projectedTotal: number;
};

function findSection(text: string) {
  const needle = text.toLowerCase();
  return Array.from(document.querySelectorAll('main section')).find((section) =>
    (section.textContent || '').toLowerCase().includes(needle),
  ) as HTMLElement | undefined;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function euroFileName(value: string) {
  return cleanText(value || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cliente';
}

function euro(value: number) {
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

function numberFromText(value: string) {
  return Number(String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function fallbackFieldNumber(labelText: string) {
  return numberFromText(fieldValue(labelText));
}

function getRealEstateData(): RealEstateData {
  const win = window as typeof window & { auditRealEstateData?: () => RealEstateData };
  if (typeof win.auditRealEstateData === 'function') return win.auditRealEstateData();

  return {
    realEstateInvestments: 0,
    realEstateRents: 0,
    adjustedExpenses: fallbackFieldNumber('gastos mensuales') + fallbackFieldNumber('alquiler, hipoteca y préstamos'),
    retirementGap: 0,
    accumulatedBank: fallbackFieldNumber('dinero en banco'),
    projectedInvested: fallbackFieldNumber('dinero invertido'),
    projectedSaving: fallbackFieldNumber('ahorro sistemático mensual'),
    projectedRents: 0,
    projectedTotal: fallbackFieldNumber('dinero en banco') + fallbackFieldNumber('dinero invertido'),
  };
}

function getExecutiveSummaryText() {
  const section = findSection('6. Resumen ejecutivo') || findSection('Resumen ejecutivo');
  if (!section) return '';

  const formatted = section.querySelector('.audit-executive-summary-paragraphs') as HTMLElement | null;
  if (formatted) return cleanText(formatted.innerText);

  const articleParagraphs = Array.from(section.querySelectorAll('article p'))
    .map((item) => cleanText((item as HTMLElement).innerText))
    .filter((text) => text.length > 80);
  if (articleParagraphs.length) return articleParagraphs.join('\n\n');

  return cleanText(section.innerText.replace(/Descargar informe PDF/gi, ''));
}

function prepareSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || Number(svg.getAttribute('width')) || 720));
  const height = Math.max(220, Math.round(rect.height || Number(svg.getAttribute('height')) || 320));

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', clone.getAttribute('viewBox') || `0 0 ${width} ${height}`);

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    text { font-family: Arial, Helvetica, sans-serif; }
    .recharts-cartesian-axis-tick-value, .recharts-text { fill: #475569; }
    .recharts-legend-item-text { color: #475569; fill: #475569; }
  `;
  clone.insertBefore(style, clone.firstChild);

  return { clone, width, height };
}

function svgToPng(svg: SVGSVGElement): Promise<ChartCapture['dataUrl']> {
  const { clone, width, height } = prepareSvg(svg);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo preparar el lienzo del gráfico.'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png', 1));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo convertir el gráfico a imagen.'));
    };
    image.src = url;
  });
}

async function captureChart(sectionName: string, title: string): Promise<ChartCapture | null> {
  const section = findSection(sectionName);
  const svg = section?.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  return {
    title,
    dataUrl: await svgToPng(svg),
    width: Math.max(320, Math.round(rect.width || 720)),
    height: Math.max(220, Math.round(rect.height || 320)),
  };
}

async function captureCharts() {
  const charts = await Promise.all([
    captureChart('2. Auditoría de Previsión Social', 'Comparativa gráfica de prestaciones frente a gastos'),
    captureChart('3. Estudio brecha de jubilación', 'Estudio brecha de jubilación'),
    captureChart('4. Niveles de Seguridad y Vulnerabilidad', 'Niveles de Seguridad y Vulnerabilidad'),
  ]);
  return charts.filter(Boolean) as ChartCapture[];
}

function drawLogo(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, 3, 20, 'F');
  doc.rect(x + 18, y, 3, 20, 'F');
  doc.rect(x + 9, y, 3, 8, 'F');
  doc.rect(x + 9, y + 12, 3, 8, 'F');
  doc.setFillColor(197, 165, 102);
  doc.circle(x + 10.5, y + 10, 5, 'F');
}

function header(doc: jsPDF, title: string) {
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, 210, 34, 'F');
  drawLogo(doc, 14, 7);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('JOSÉ CARLOS HIDALGO', 42, 12);
  doc.setFontSize(8.5);
  doc.setTextColor(197, 165, 102);
  doc.text(title, 42, 19);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('Email: josecarlos@hilolegal.es | Teléfono: 647 50 60 40', 42, 27);
}

function footer(doc: jsPDF, page: number) {
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Informe generado a partir de los gráficos y datos visibles en la aplicación.', 14, 283);
  doc.text(`Página ${page}`, 196, 283, { align: 'right' });
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y);
}

function addClientSummary(doc: jsPDF, y: number) {
  const realEstate = getRealEstateData();
  const rows = [
    `Cliente: ${fieldValue('nombre') || 'No indicado'}`,
    `Teléfono: ${fieldValue('teléfono') || 'No indicado'} | Email: ${fieldValue('email') || 'No indicado'}`,
    `Edad: ${fieldValue('edad') || '-'} años | Años cotizados: ${fieldValue('años cotizados') || '-'}`,
    `Base de cotización: ${fieldValue('base cotización') || '-'} EUR | Estado civil: ${fieldValue('estado civil') || '-'}`,
    `Inversiones inmobiliarias: ${euro(realEstate.realEstateInvestments)} | Rentas inmobiliarias: ${euro(realEstate.realEstateRents)} / mes`,
  ];

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  rows.forEach((row, index) => doc.text(row, 18, y + index * 6));
}

function addRealEstateBreakdown(doc: jsPDF, y: number) {
  const data = getRealEstateData();
  addSectionTitle(doc, 'Desglose inmobiliario y proyección a los 67', y);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(doc.splitTextToSize('Las rentas inmobiliarias reducen la brecha mensual de prestaciones y jubilación. Las inversiones inmobiliarias se suman únicamente al patrimonio proyectado a los 67 años.', 178), 14, y + 10);

  const rows = [
    ['Dinero acumulado', data.accumulatedBank, 'Disponible en banco'],
    ['Dinero invertido', data.projectedInvested, 'Proyectado hasta los 67 años'],
    ['Ahorro sistemático', data.projectedSaving, 'Aportaciones acumuladas hasta jubilación'],
    ['Rentas inmobiliarias', data.projectedRents, 'Rentas mensuales acumuladas hasta los 67'],
    ['Inversiones inmobiliarias', data.realEstateInvestments, 'Patrimonio inmobiliario declarado'],
    ['Proyección total a los 67', data.projectedTotal, 'Suma patrimonial ajustada'],
    ['Brecha jubilación ajustada', data.retirementGap, 'Después de rentas inmobiliarias'],
  ] as const;

  let rowY = y + 26;
  rows.forEach(([label, value, note], index) => {
    const x = index % 2 === 0 ? 14 : 107;
    if (index % 2 === 0 && index > 0) rowY += 20;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, rowY, 84, 15, 2, 2, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);
    doc.text(label, x + 4, rowY + 5);
    doc.setFontSize(8.3);
    doc.setTextColor(15, 23, 42);
    doc.text(euro(value), x + 80, rowY + 5, { align: 'right' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(note, 74), x + 4, rowY + 10);
  });
}

function addChart(doc: jsPDF, chart: ChartCapture, y: number) {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(197, 165, 102);
  doc.text(chart.title, 14, y);

  const maxWidth = 182;
  const maxHeight = 78;
  const ratio = Math.min(maxWidth / chart.width, maxHeight / chart.height);
  const imageWidth = chart.width * ratio;
  const imageHeight = chart.height * ratio;
  const x = 14 + (maxWidth - imageWidth) / 2;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, y + 5, 182, imageHeight + 10, 2, 2, 'FD');
  doc.addImage(chart.dataUrl, 'PNG', x, y + 10, imageWidth, imageHeight);
  return y + imageHeight + 22;
}

function addTextBlock(doc: jsPDF, title: string, text: string, startY: number) {
  addSectionTitle(doc, title, startY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);

  const paragraphs = text.split(/\n\s*\n/g).map(cleanText).filter(Boolean);
  let y = startY + 12;
  paragraphs.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, 178) as string[];
    if (y + lines.length * 4.4 > 274) return;
    doc.text(lines, 14, y);
    y += lines.length * 4.4 + 4;
  });
}

async function generateLiteralPdf() {
  window.dispatchEvent(new CustomEvent('audit-real-estate-updated'));
  await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
  const charts = await captureCharts();
  const summaryText = getExecutiveSummaryText();
  const clientName = fieldValue('nombre') || 'cliente';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let page = 1;

  header(doc, 'INFORME DE AUDITORÍA DE RIESGOS FINANCIEROS Y PATRIMONIALES');
  addSectionTitle(doc, 'Resumen de datos del cliente', 48);
  addClientSummary(doc, 60);
  addRealEstateBreakdown(doc, 100);
  footer(doc, page++);

  doc.addPage();
  header(doc, 'GRÁFICOS DE LA APLICACIÓN');
  let y = 48;
  charts.forEach((chart, index) => {
    if (index > 0 && y > 170) {
      footer(doc, page++);
      doc.addPage();
      header(doc, 'GRÁFICOS DE LA APLICACIÓN');
      y = 48;
    }
    y = addChart(doc, chart, y);
  });
  footer(doc, page++);

  doc.addPage();
  header(doc, 'RESUMEN EJECUTIVO');
  addTextBlock(doc, 'Resumen ejecutivo', summaryText || 'No se pudo localizar el texto del resumen ejecutivo en la aplicación.', 48);
  footer(doc, page);

  doc.save(`auditoria-literal-${euroFileName(clientName)}.pdf`);
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean) {
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.style.opacity = '0.72';
    button.innerHTML = '<span>Generando informe PDF...</span>';
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

function installLiteralPdfDownload() {
  const win = window as typeof window & { [DOWNLOAD_FLAG]?: boolean };
  if (win[DOWNLOAD_FLAG]) return;
  win[DOWNLOAD_FLAG] = true;

  document.addEventListener('click', async (event) => {
    const button = isPdfDownloadButton(event.target);
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      setButtonBusy(button, true);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await generateLiteralPdf();
    } catch (error) {
      console.error(error);
      window.alert('No se pudo generar el PDF. Revisa que los gráficos estén visibles en pantalla y vuelve a intentarlo.');
    } finally {
      setButtonBusy(button, false);
    }
  }, true);
}

installLiteralPdfDownload();
