import { jsPDF } from 'jspdf';

const PDF_LOGO_SIZE_PATCH_FLAG = '__auditPdfLogoSizePatchInstalled';

function near(value: unknown, expected: number) {
  return Math.abs(Number(value) - expected) < 0.01;
}

function scaledHeaderRect(args: unknown[]) {
  const [x, y, w, h, style] = args;
  if (near(x, 14) && near(y, 7) && near(w, 3) && near(h, 17)) return [15.97, 12.09, 0.56, 3.19, style];
  if (near(x, 32) && near(y, 7) && near(w, 3) && near(h, 17)) return [19.35, 12.09, 0.56, 3.19, style];
  if (near(x, 23) && near(y, 7) && near(w, 3) && near(h, 7)) return [17.66, 12.09, 0.56, 1.31, style];
  if (near(x, 23) && near(y, 17) && near(w, 3) && near(h, 7)) return [17.66, 13.97, 0.56, 1.31, style];
  return args;
}

function scaledHeaderCircle(args: unknown[]) {
  const [x, y, r, style] = args;
  if (near(x, 24.5) && near(y, 15.5) && near(r, 4.4)) return [17.94, 13.69, 0.83, style];
  return args;
}

function shiftedHeaderText(args: unknown[]) {
  const [text, x, y, options] = args;
  if (near(x, 42) && (near(y, 11) || near(y, 19) || near(y, 26))) return [text, 25, y, options];
  return args;
}

function installPdfLogoSizePatch() {
  const win = window as typeof window & { [PDF_LOGO_SIZE_PATCH_FLAG]?: boolean };
  if (win[PDF_LOGO_SIZE_PATCH_FLAG]) return;
  win[PDF_LOGO_SIZE_PATCH_FLAG] = true;

  const api = jsPDF.API as typeof jsPDF.API & {
    rect?: (...args: unknown[]) => unknown;
    circle?: (...args: unknown[]) => unknown;
    text?: (...args: unknown[]) => unknown;
  };

  const originalRect = api.rect;
  if (typeof originalRect === 'function') {
    api.rect = function patchedRect(this: unknown, ...args: unknown[]) {
      return originalRect.apply(this, scaledHeaderRect(args));
    };
  }

  const originalCircle = api.circle;
  if (typeof originalCircle === 'function') {
    api.circle = function patchedCircle(this: unknown, ...args: unknown[]) {
      return originalCircle.apply(this, scaledHeaderCircle(args));
    };
  }

  const originalText = api.text;
  if (typeof originalText === 'function') {
    api.text = function patchedText(this: unknown, ...args: unknown[]) {
      return originalText.apply(this, shiftedHeaderText(args));
    };
  }
}

installPdfLogoSizePatch();
