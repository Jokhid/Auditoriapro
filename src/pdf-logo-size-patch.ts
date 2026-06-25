import { jsPDF } from 'jspdf';

const PDF_LOGO_SIZE_PATCH_FLAG = '__auditPdfLogoSizePatchInstalled';

type PdfDoc = jsPDF & {
  __auditLogoPatchApplied?: boolean;
  rect: (...args: unknown[]) => unknown;
  circle: (...args: unknown[]) => unknown;
  text: (...args: unknown[]) => unknown;
};

function near(value: unknown, expected: number) {
  return Math.abs(Number(value) - expected) < 0.01;
}

function scaledHeaderRect(args: unknown[]) {
  const [x, y, w, h, style] = args;
  if (near(x, 14) && near(y, 7) && near(w, 3) && near(h, 17)) return [14, 8.8, 0.75, 4.25, style];
  if (near(x, 32) && near(y, 7) && near(w, 3) && near(h, 17)) return [18.5, 8.8, 0.75, 4.25, style];
  if (near(x, 23) && near(y, 7) && near(w, 3) && near(h, 7)) return [16.25, 8.8, 0.75, 1.75, style];
  if (near(x, 23) && near(y, 17) && near(w, 3) && near(h, 7)) return [16.25, 11.3, 0.75, 1.75, style];
  return args;
}

function scaledHeaderCircle(args: unknown[]) {
  const [x, y, r, style] = args;
  if (near(x, 24.5) && near(y, 15.5) && near(r, 4.4)) return [16.63, 10.93, 1.1, style];
  return args;
}

function shiftedHeaderText(args: unknown[]) {
  const [text, x, y, options] = args;
  if (!near(x, 42)) return args;
  if (near(y, 11)) return [text, 24, 11, options];
  if (near(y, 19)) return [text, 24, 19, options];
  if (near(y, 26)) return [text, 196, 11, { ...(typeof options === 'object' && options ? options : {}), align: 'right' }];
  return args;
}

function patchDocument(doc: PdfDoc) {
  if (doc.__auditLogoPatchApplied) return;
  doc.__auditLogoPatchApplied = true;

  const originalRect = doc.rect.bind(doc);
  doc.rect = (...args: unknown[]) => originalRect(...scaledHeaderRect(args));

  const originalCircle = doc.circle.bind(doc);
  doc.circle = (...args: unknown[]) => originalCircle(...scaledHeaderCircle(args));

  const originalText = doc.text.bind(doc);
  doc.text = (...args: unknown[]) => originalText(...shiftedHeaderText(args));
}

function installPdfLogoSizePatch() {
  const win = window as typeof window & { [PDF_LOGO_SIZE_PATCH_FLAG]?: boolean };
  if (win[PDF_LOGO_SIZE_PATCH_FLAG]) return;
  win[PDF_LOGO_SIZE_PATCH_FLAG] = true;

  const api = jsPDF.API as typeof jsPDF.API & { events?: Array<[string, (...args: unknown[]) => void]> };
  if (!Array.isArray(api.events)) api.events = [];
  api.events.push(['initialized', function onPdfInitialized(this: PdfDoc) { patchDocument(this); }]);
}

installPdfLogoSizePatch();
