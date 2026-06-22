import { jsPDF } from 'jspdf';

const FULL_APP_PDF_FLAG = '__auditFullAppPdfDownloadInstalled';
const CAPTURE_TIMEOUT_MS = 3500;

type CaptureBlock = {
  title: string;
  dataUrl: string;
  width: number;
  height: number;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function fieldValue(labelText: string) {
  const needle = labelText.toLowerCase();
  const label = Array.from(document.querySelectorAll('label')).find((item) =>
    (item.textContent || '').toLowerCase().includes(needle),
  );
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return cleanText(input?.value || 'cliente');
}

function fileName(value: string) {
  return cleanText(value || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cliente';
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then((value) => {
      window.clearTimeout(timeout);
      resolve(value);
    }).catch((error) => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}

function copyInputState(source: HTMLElement, clone: HTMLElement) {
  const sourceFields = Array.from(source.querySelectorAll('input, textarea, select')) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  const cloneFields = Array.from(clone.querySelectorAll('input, textarea, select')) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

  sourceFields.forEach((field, index) => {
    const clonedField = cloneFields[index];
    if (!clonedField) return;
    if (field instanceof HTMLInputElement && clonedField instanceof HTMLInputElement) {
      clonedField.setAttribute('value', field.value);
      if (field.type === 'range') clonedField.value = field.value;
      if (field.checked) clonedField.setAttribute('checked', 'checked');
    }
    if (field instanceof HTMLTextAreaElement && clonedField instanceof HTMLTextAreaElement) {
      clonedField.textContent = field.value;
    }
    if (field instanceof HTMLSelectElement && clonedField instanceof HTMLSelectElement) {
      Array.from(clonedField.options).forEach((option) => {
        if (option.value === field.value) option.setAttribute('selected', 'selected');
        else option.removeAttribute('selected');
      });
    }
  });
}

function inlineStyles(source: Element, clone: Element) {
  const computed = window.getComputedStyle(source);
  let cssText = '';
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed[index];
    cssText += `${property}:${computed.getPropertyValue(property)};`;
  }
  (clone as HTMLElement).style.cssText = cssText;

  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    if (cloneChildren[index]) inlineStyles(child, cloneChildren[index]);
  });
}

function prepareClone(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const clone = element.cloneNode(true) as HTMLElement;
  copyInputState(element, clone);
  inlineStyles(element, clone);

  clone.querySelectorAll('button').forEach((button) => {
    if (/descargar.*pdf|descargar informe pdf|generando informe/i.test(button.textContent || '')) {
      button.remove();
    }
  });

  clone.querySelectorAll('[data-chart-title], .audit-chart-heading').forEach((item) => item.remove());
  clone.style.position = 'static';
  clone.style.transform = 'none';
  clone.style.width = `${Math.max(360, Math.ceil(rect.width || element.scrollWidth || 1000))}px`;
  clone.style.height = 'auto';
  clone.style.maxWidth = clone.style.width;
  clone.style.boxSizing = 'border-box';
  clone.style.background = window.getComputedStyle(element).backgroundColor || '#ffffff';

  return {
    clone,
    width: Math.max(360, Math.ceil(rect.width || element.scrollWidth || 1000)),
    height: Math.max(80, Math.ceil(element.scrollHeight || rect.height || 200)),
  };
}

function elementToPng(element: HTMLElement): Promise<CaptureBlock> {
  const { clone, width, height } = prepareClone(element);
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.minHeight = `${height}px`;
  wrapper.style.background = '#ffffff';
  wrapper.appendChild(clone);

  const html = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  return withTimeout(new Promise<CaptureBlock>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = 1.25;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo preparar la captura del informe.'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({
        title: cleanText(element.querySelector('h1,h2,h3')?.textContent || element.tagName.toLowerCase()),
        dataUrl: canvas.toDataURL('image/png', 0.92),
        width: canvas.width,
        height: canvas.height,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo convertir la sección a imagen.'));
    };
    image.src = url;
  }), CAPTURE_TIMEOUT_MS, 'La captura de una sección tardó demasiado.');
}

function loadImage(src: string) {
  return withTimeout(new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar una captura para paginarla.'));
    image.src = src;
  }), CAPTURE_TIMEOUT_MS, 'La carga de una captura tardó demasiado.');
}

function getBlocksToCapture() {
  const blocks: HTMLElement[] = [];
  const header = document.querySelector('header') as HTMLElement | null;
  const sections = Array.from(document.querySelectorAll('main section')) as HTMLElement[];
  const footer = document.querySelector('footer') as HTMLElement | null;
  if (header) blocks.push(header);
  blocks.push(...sections);
  if (footer) blocks.push(footer);
  return blocks;
}

async function captureApplication() {
  window.dispatchEvent(new CustomEvent('audit-real-estate-updated'));
  await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
  const blocks = getBlocksToCapture();
  const captures: CaptureBlock[] = [];
  for (const block of blocks) {
    try {
      captures.push(await elementToPng(block));
    } catch (error) {
      console.warn('Se omitió una sección del PDF literal:', error);
    }
  }
  return captures;
}

async function addCapture(doc: jsPDF, capture: CaptureBlock, cursorY: number) {
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 10;
  const marginBottom = 10;
  const usableWidth = pageWidth - marginX * 2;
  const imageHeight = (capture.height / capture.width) * usableWidth;

  if (imageHeight <= pageHeight - marginBottom * 2) {
    if (cursorY + imageHeight > pageHeight - marginBottom) {
      doc.addPage();
      cursorY = marginBottom;
    }
    doc.addImage(capture.dataUrl, 'PNG', marginX, cursorY, usableWidth, imageHeight);
    return cursorY + imageHeight + 5;
  }

  const sourceImage = await loadImage(capture.dataUrl);
  const sliceHeightPx = Math.floor((capture.width / usableWidth) * (pageHeight - marginBottom * 2));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return cursorY;

  let offset = 0;
  while (offset < capture.height) {
    const currentSliceHeight = Math.min(sliceHeightPx, capture.height - offset);
    canvas.width = capture.width;
    canvas.height = currentSliceHeight;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(sourceImage, 0, offset, capture.width, currentSliceHeight, 0, 0, capture.width, currentSliceHeight);
    const sliceUrl = canvas.toDataURL('image/png', 0.92);
    const sliceMmHeight = (currentSliceHeight / capture.width) * usableWidth;
    if (cursorY !== marginBottom) {
      doc.addPage();
      cursorY = marginBottom;
    }
    doc.addImage(sliceUrl, 'PNG', marginX, cursorY, usableWidth, sliceMmHeight);
    cursorY += sliceMmHeight + 5;
    offset += currentSliceHeight;
    if (offset < capture.height) {
      doc.addPage();
      cursorY = marginBottom;
    }
  }

  return cursorY;
}

function generateFallbackPdf() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('Informe de auditoría', 14, 22);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const text = cleanText((document.querySelector('main') as HTMLElement | null)?.innerText || 'No se pudo capturar la aplicación visualmente.');
  doc.text(doc.splitTextToSize(text, 180).slice(0, 55), 14, 36);
  doc.save(`auditoria-literal-app-${fileName(fieldValue('nombre'))}.pdf`);
}

async function generateFullAppPdf() {
  const captures = await captureApplication();
  if (!captures.length) {
    generateFallbackPdf();
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let cursorY = 10;
  for (const capture of captures) {
    cursorY = await addCapture(doc, capture, cursorY);
  }

  doc.save(`auditoria-literal-app-${fileName(fieldValue('nombre'))}.pdf`);
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean) {
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.style.opacity = '0.72';
    button.innerHTML = '<span>Generando copia literal PDF...</span>';
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

function installFullAppPdfDownload() {
  const win = window as typeof window & { [FULL_APP_PDF_FLAG]?: boolean };
  if (win[FULL_APP_PDF_FLAG]) return;
  win[FULL_APP_PDF_FLAG] = true;

  document.addEventListener('click', async (event) => {
    const button = isPdfDownloadButton(event.target);
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      setButtonBusy(button, true);
      await generateFullAppPdf();
    } catch (error) {
      console.error(error);
      generateFallbackPdf();
    } finally {
      setButtonBusy(button, false);
    }
  }, true);
}

installFullAppPdfDownload();
