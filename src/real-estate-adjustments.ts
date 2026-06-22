const REAL_ESTATE_FLAG = '__auditRealEstateAdjustmentsInstalled';
const STORAGE_INVESTMENTS = 'audit-real-estate-investments';
const STORAGE_RENTS = 'audit-real-estate-rents';

function money(value: number) {
  return `${Math.round(value).toLocaleString('es-ES')} EUR`;
}

function numberFromText(value: string) {
  return Number(String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function fieldNumber(labelText: string) {
  const needle = labelText.toLowerCase();
  const label = Array.from(document.querySelectorAll('label')).find((item) =>
    (item.textContent || '').toLowerCase().includes(needle),
  );
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return numberFromText(input?.value || '0');
}

function fieldValue(labelText: string) {
  const needle = labelText.toLowerCase();
  const label = Array.from(document.querySelectorAll('label')).find((item) =>
    (item.textContent || '').toLowerCase().includes(needle),
  );
  const input = label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return String(input?.value || '');
}

function storedNumber(key: string) {
  return numberFromText(localStorage.getItem(key) || '0');
}

function getRealEstateData() {
  const salary = fieldNumber('salario neto mensual');
  const monthlyExpenses = fieldNumber('gastos mensuales') + fieldNumber('alquiler, hipoteca y préstamos');
  const base = fieldNumber('base cotización') || fieldNumber('base cotizacion');
  const age = fieldNumber('edad');
  const contributedYears = fieldNumber('años cotizados') || fieldNumber('anos cotizados');
  const bank = fieldNumber('dinero en banco');
  const invested = fieldNumber('dinero invertido');
  const monthlySaving = fieldNumber('ahorro sistemático mensual') || fieldNumber('ahorro sistematico mensual');
  const investmentReturn = fieldNumber('rentabilidad dinero invertido') / 100;
  const savingReturn = fieldNumber('rentabilidad ahorro sistemático') / 100 || fieldNumber('rentabilidad ahorro sistematico') / 100;
  const realEstateInvestments = storedNumber(STORAGE_INVESTMENTS);
  const realEstateRents = storedNumber(STORAGE_RENTS);
  const yearsToRetirement = Math.max(0, 67 - age);
  const estimatedYears = contributedYears + yearsToRetirement;
  const retirementRate = estimatedYears < 15 ? 0 : estimatedYears >= 36.5 ? 1 : 0.5 + (estimatedYears - 15) * (0.5 / 21.5);
  const retirementPension = base * retirementRate;
  const adjustedExpenses = Math.max(0, monthlyExpenses - realEstateRents);
  const state = fieldValue('estado civil');
  const married = state === 'Casado/a' || state === 'Pareja de Hecho';
  const children = fieldNumber('hijos menores');
  const benefits = [
    { label: 'Baja laboral', value: base * 0.75 },
    { label: 'Invalidez absoluta', value: base },
    { label: 'Invalidez profesional', value: age >= 55 ? base * 0.75 : base * 0.55 },
    { label: 'Viudedad', value: married ? base * 0.52 : 0 },
    { label: 'Orfandad', value: base * 0.2 * children },
    { label: 'Jubilación', value: retirementPension },
  ];
  const adjustedBenefitGaps = benefits.map((benefit) => ({
    ...benefit,
    gap: Math.max(0, adjustedExpenses - benefit.value),
  }));
  const retirementGap = Math.max(0, adjustedExpenses - retirementPension);
  const accumulatedBank = bank;
  const projectedInvested = invested * Math.pow(1 + investmentReturn, yearsToRetirement);
  const annualSaving = monthlySaving * 12;
  const projectedSaving = savingReturn > 0
    ? annualSaving * ((Math.pow(1 + savingReturn, yearsToRetirement) - 1) / savingReturn)
    : annualSaving * yearsToRetirement;
  const projectedRents = realEstateRents * 12 * yearsToRetirement;
  const projectedTotal = accumulatedBank + projectedInvested + projectedSaving + projectedRents + realEstateInvestments;

  return {
    salary,
    monthlyExpenses,
    adjustedExpenses,
    adjustedBenefitGaps,
    realEstateInvestments,
    realEstateRents,
    retirementPension,
    retirementGap,
    accumulatedBank,
    projectedInvested,
    projectedSaving,
    projectedRents,
    projectedTotal,
    yearsToRetirement,
  };
}

function findSection(text: string) {
  const needle = text.toLowerCase();
  return Array.from(document.querySelectorAll('main section')).find((section) =>
    (section.textContent || '').toLowerCase().includes(needle),
  ) as HTMLElement | undefined;
}

function createField(label: string, storageKey: string) {
  const wrapper = document.createElement('label');
  wrapper.className = 'block audit-real-estate-field';
  wrapper.dataset.realEstateField = storageKey;
  wrapper.innerHTML =
    `<span class="mb-1 block text-xs font-bold uppercase text-slate-500">${label}</span>` +
    '<input class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min="0" step="100" />';
  const input = wrapper.querySelector('input') as HTMLInputElement;
  input.value = String(storedNumber(storageKey));
  input.addEventListener('input', () => {
    localStorage.setItem(storageKey, input.value || '0');
    window.dispatchEvent(new CustomEvent('audit-real-estate-updated'));
    window.setTimeout(renderRealEstateAdjustments, 30);
  });
  return wrapper;
}

function upsertRealEstateFields() {
  const section = findSection('1. Resumen de datos del Cliente') || findSection('Resumen de datos del Cliente');
  if (!section) return;
  const grid = section.querySelector('.grid') as HTMLElement | null;
  if (!grid) return;

  if (!grid.querySelector(`[data-real-estate-field="${STORAGE_INVESTMENTS}"]`)) {
    grid.appendChild(createField('Inversiones inmobiliarias', STORAGE_INVESTMENTS));
  }
  if (!grid.querySelector(`[data-real-estate-field="${STORAGE_RENTS}"]`)) {
    grid.appendChild(createField('Rentas inmobiliarias mensuales', STORAGE_RENTS));
  }
}

function row(label: string, value: number, note?: string) {
  return `<div class="audit-real-estate-row"><span>${label}${note ? `<small>${note}</small>` : ''}</span><strong>${money(value)}</strong></div>`;
}

function upsertRetirementBreakdown() {
  const section = findSection('3. Estudio brecha de jubilación') || findSection('Estudio brecha de jubilación');
  if (!section) return;
  const data = getRealEstateData();

  let box = section.querySelector('.audit-real-estate-breakdown') as HTMLElement | null;
  if (!box) {
    box = document.createElement('article');
    box.className = 'audit-real-estate-breakdown';
    const metricGrid = Array.from(section.querySelectorAll('div')).find((item) =>
      String((item as HTMLElement).className || '').includes('md:grid-cols-3') &&
      ((item as HTMLElement).textContent || '').toLowerCase().includes('capital objetivo'),
    );
    if (metricGrid?.parentNode) {
      metricGrid.parentNode.insertBefore(box, metricGrid.nextSibling);
    } else {
      section.appendChild(box);
    }
  }

  box.innerHTML =
    '<h3>Desglose de proyección patrimonial a los 67 años</h3>' +
    '<p>Las rentas inmobiliarias reducen la brecha mensual de prestaciones y jubilación. Las inversiones inmobiliarias se suman únicamente al patrimonio proyectado a los 67 años.</p>' +
    '<div class="audit-real-estate-grid">' +
    row('Dinero acumulado', data.accumulatedBank, 'Disponible en banco') +
    row('Dinero invertido', data.projectedInvested, 'Proyectado hasta los 67 años') +
    row('Ahorro sistemático', data.projectedSaving, 'Aportaciones acumuladas') +
    row('Rentas inmobiliarias', data.projectedRents, 'Ingresos mensuales acumulados hasta los 67') +
    row('Inversiones inmobiliarias', data.realEstateInvestments, 'Valor declarado del patrimonio inmobiliario') +
    row('Proyección total a los 67', data.projectedTotal) +
    row('Brecha jubilación ajustada', data.retirementGap, 'Después de rentas inmobiliarias') +
    '</div>';
}

function upsertGapNotice() {
  const section = findSection('2. Auditoría de Previsión Social') || findSection('Auditoría de Previsión Social');
  if (!section) return;
  const data = getRealEstateData();
  let notice = section.querySelector('.audit-real-estate-gap-notice') as HTMLElement | null;
  if (!notice) {
    notice = document.createElement('article');
    notice.className = 'audit-real-estate-gap-notice';
    section.appendChild(notice);
  }
  notice.innerHTML =
    '<h3>Ajuste por rentas inmobiliarias</h3>' +
    `<p>Gastos mensuales declarados: <strong>${money(data.monthlyExpenses)}</strong>. Rentas inmobiliarias mensuales: <strong>${money(data.realEstateRents)}</strong>. Gasto neto utilizado para analizar brechas: <strong>${money(data.adjustedExpenses)}</strong>.</p>` +
    '<div class="audit-real-estate-grid audit-real-estate-benefits">' +
    data.adjustedBenefitGaps.map((item) => row(item.label, item.gap, `Brecha ajustada. Prestación estimada: ${money(item.value)}`)).join('') +
    '</div>';
}

function installStyles() {
  if (document.getElementById('audit-real-estate-styles')) return;
  const style = document.createElement('style');
  style.id = 'audit-real-estate-styles';
  style.textContent = `
    .audit-real-estate-breakdown,
    .audit-real-estate-gap-notice {
      margin-top: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      padding: 16px;
      color: #0f172a;
    }
    .audit-real-estate-breakdown h3,
    .audit-real-estate-gap-notice h3 {
      margin: 0;
      color: #C5A566;
      font-size: 15px;
      font-weight: 900;
    }
    .audit-real-estate-breakdown p,
    .audit-real-estate-gap-notice p {
      margin: 8px 0 0;
      color: #475569;
      font-size: 13px;
      line-height: 1.55;
    }
    .audit-real-estate-grid {
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }
    @media (min-width: 768px) {
      .audit-real-estate-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .audit-real-estate-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      padding: 10px 12px;
    }
    .audit-real-estate-row span,
    .audit-real-estate-row strong { font-size: 13px; }
    .audit-real-estate-row span { color: #475569; font-weight: 800; }
    .audit-real-estate-row strong { color: #0f172a; font-weight: 900; white-space: nowrap; }
    .audit-real-estate-row small { display: block; margin-top: 2px; color: #64748b; font-size: 11px; font-weight: 600; }
  `;
  document.head.appendChild(style);
}

function renderRealEstateAdjustments() {
  installStyles();
  upsertRealEstateFields();
  upsertGapNotice();
  upsertRetirementBreakdown();
}

function installRealEstateAdjustments() {
  const win = window as typeof window & { [REAL_ESTATE_FLAG]?: boolean; auditRealEstateData?: typeof getRealEstateData };
  if (win[REAL_ESTATE_FLAG]) return;
  win[REAL_ESTATE_FLAG] = true;
  win.auditRealEstateData = getRealEstateData;

  document.addEventListener('input', () => window.setTimeout(renderRealEstateAdjustments, 80));
  document.addEventListener('change', () => window.setTimeout(renderRealEstateAdjustments, 80));
  window.addEventListener('load', renderRealEstateAdjustments);
  window.addEventListener('audit-real-estate-updated', renderRealEstateAdjustments);
  window.setTimeout(renderRealEstateAdjustments, 300);
  window.setTimeout(renderRealEstateAdjustments, 1200);
}

installRealEstateAdjustments();
