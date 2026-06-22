import { jsPDF } from 'jspdf';

const FLAG = '__auditPdfPrevisorBoxFixInstalled';
const DARK_FILL = [15, 23, 42];
const ORANGE_BORDER = [249, 115, 22];
const GOLD_TEXT = [197, 165, 102];
const BODY_TEXT = [15, 23, 42];

type PdfPatchState = {
  fillColor: number[];
  drawColor: number[];
  textColor: number[];
  previsorBox?: { page: number; y: number; h: number };
};

const states = new WeakMap<object, PdfPatchState>();

function getState(doc: object): PdfPatchState {
  let state = states.get(doc);
  if (!state) {
    state = { fillColor: [0, 0, 0], drawColor: [0, 0, 0], textColor: [0, 0, 0] };
    states.set(doc, state);
  }
  return state;
}

function pageOf(doc: any) {
  return Number(doc.internal?.getNumberOfPages?.() || 1);
}

function numbers(args: unknown[]) {
  return args.map((value) => Number(value)).slice(0, 3);
}

function sameColor(actual: number[], expected: number[]) {
  return expected.every((value, index) => Math.abs((actual[index] ?? -999) - value) <= 2);
}

function sameBox(x: number, w: number, h: number) {
  return Math.abs(x - 14) < 1 && Math.abs(w - 182) < 2 && Math.abs(h - 28) < 2;
}

function normalizeText(value: unknown) {
  return Array.isArray(value) ? value.join(' ') : String(value || '');
}

function installPdfPrevisorBoxFix() {
  const ctor = jsPDF as any;
  const api = ctor.API;
  if (!api || ctor[FLAG]) return;
  ctor[FLAG] = true;

  const originalSetFillColor = api.setFillColor;
  const originalSetDrawColor = api.setDrawColor;
  const originalSetTextColor = api.setTextColor;
  const originalRect = api.rect;
  const originalText = api.text;

  api.setFillColor = function patchedSetFillColor(this: any, ...args: unknown[]) {
    getState(this).fillColor = numbers(args);
    return originalSetFillColor.apply(this, args);
  };

  api.setDrawColor = function patchedSetDrawColor(this: any, ...args: unknown[]) {
    getState(this).drawColor = numbers(args);
    return originalSetDrawColor.apply(this, args);
  };

  api.setTextColor = function patchedSetTextColor(this: any, ...args: unknown[]) {
    getState(this).textColor = numbers(args);
    return originalSetTextColor.apply(this, args);
  };

  api.rect = function patchedRect(this: any, ...args: unknown[]) {
    const [rawX, rawY, rawW, rawH, style] = args;
    const x = Number(rawX);
    const y = Number(rawY);
    const w = Number(rawW);
    const h = Number(rawH);
    const state = getState(this);

    if (sameBox(x, w, h) && style === 'F' && sameColor(state.fillColor, DARK_FILL)) {
      state.previsorBox = { page: pageOf(this), y, h };
      return this;
    }

    if (sameBox(x, w, h) && style === 'D' && sameColor(state.drawColor, ORANGE_BORDER)) {
      state.previsorBox = { page: pageOf(this), y, h };
      return this;
    }

    return originalRect.apply(this, args);
  };

  api.text = function patchedText(this: any, ...args: unknown[]) {
    const state = getState(this);
    const text = normalizeText(args[0]).toLowerCase();
    const y = Number(args[2]);
    const box = state.previsorBox;
    const insidePrevisorBox = box && box.page === pageOf(this) && y >= box.y - 1 && y <= box.y + box.h + 3;

    if (!insidePrevisorBox) {
      return originalText.apply(this, args);
    }

    const isTitle = text.includes('estudio previsor: brecha de jubilación hasta los 90 años') ||
      text.includes('estudio previsor: brecha de jubilacion hasta los 90 anos');
    const color = isTitle ? GOLD_TEXT : BODY_TEXT;

    originalSetTextColor.call(this, color[0], color[1], color[2]);
    const result = originalText.apply(this, args);
    originalSetTextColor.apply(this, state.textColor);
    return result;
  };
}

installPdfPrevisorBoxFix();
