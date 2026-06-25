export type CivilStatus = 'Soltero/a' | 'Casado/a' | 'Divorciado/a' | 'Pareja de Hecho' | 'Viudo/a';
export type RiskLevel = 'grave' | 'moderada' | 'leve';
export type Answer = 'Si' | 'Parcialmente' | 'No' | 'Baja' | 'Media' | 'Alta' | 'Sí, lo superan' | 'No, están por debajo' | 'Están justo en el límite';
export type QuestionKey = 'income' | 'sickLeave' | 'familyCapital' | 'health' | 'retirementPlan' | 'publicDependency' | 'debtRatio' | 'inflation' | 'will' | 'familyAccess';
export type RentDestination = 'consumo' | 'reinversion' | 'mixto' | 'desconocido';
export type WarningLevel = 'critica' | 'importante' | 'informativa';

export type Client = {
  nombre: string;
  telefono: string;
  email: string;
  edad: number;
  anosCotizados: number;
  baseCotizacion: number;
  estadoCivil: CivilStatus;
  numeroHijos: number;
  salarioNetoMensual: number;
  gastosMensuales: number;
  alquilerHipotecaPrestamos: number;
  dineroBanco: number;
  dineroInvertido: number;
  rentabilidadInversion: number;
  ahorroSistematico: number;
  rentabilidadAhorro: number;
  inversionesInmobiliarias: number;
  rentasInmobiliarias: number;
  otrosIngresosNetos?: number;
  rentasInmobiliariasNetas?: number | null;
  gastosInmobiliariosMensuales?: number | null;
  impuestosInmobiliariosEstimados?: number | null;
  deudaPendienteTotal?: number | null;
  capitalSeguroVidaExistente?: number | null;
  capitalSeguroIncapacidadExistente?: number | null;
  destinoRentasInmobiliarias?: RentDestination;
  convenioComplementaBaja?: boolean | null;
  empresaComplementaBaja?: boolean | null;
  seguroPrivadoBaja?: boolean | null;
  tieneTestamento?: boolean | null;
  tienePoderPreventivo?: boolean | null;
  tieneInventarioPatrimonial?: boolean | null;
};

export type Project = { id: number; name: string; target: number; years: number };
export type Benefit = { label: string; rate: string; value: number; gap: number; note: string };
export type Risk = { area: string; score: number; level: RiskLevel; impact: string; recommendation: string; priority: string; reason: string };
export type ValidationWarning = { level: WarningLevel; area: string; message: string };

type RetirementScenario = {
  name: 'Conservador' | 'Central' | 'Optimista';
  age: number;
  retirementAge: number;
  yearsToRetirement: number;
  currentContributionYears: number;
  projectedContributionYears: number;
  hypothesis: string;
  baseUsed: number;
  estimatedRate: number;
  pension: number;
  referenceExpense: number;
  passiveIncome: number;
  gap: number;
  targetCapital: number;
  reliability: 'baja' | 'media' | 'alta';
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatCurrency(value: number) {
  return `${Math.round(value || 0).toLocaleString('es-ES')} €`;
}

export function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })}%`;
}

export function formatRiskLevel(score: number): RiskLevel {
  return score <= 3 ? 'grave' : score <= 6 ? 'moderada' : 'leve';
}

function answerScore(answer: Answer) {
  if (answer === 'Si' || answer === 'Baja' || answer === 'No, están por debajo') return 10;
  if (answer === 'Parcialmente' || answer === 'Media' || answer === 'Están justo en el límite') return 6;
  return 2;
}

function pensionRate(contributionYears: number) {
  if (contributionYears < 15) return 0;
  if (contributionYears >= 36.5) return 1;
  return 0.5 + (contributionYears - 15) * (0.5 / 21.5);
}

export function calculateMonthlyExpenses(client: Client) {
  const ordinary = Math.max(0, Number(client.gastosMensuales || 0));
  const housingAndDebt = Math.max(0, Number(client.alquilerHipotecaPrestamos || 0));
  return {
    ordinary,
    housingAndDebt,
    total: ordinary + housingAndDebt,
  };
}

function availableRealEstateRents(client: Client) {
  const declared = Math.max(0, Number(client.rentasInmobiliarias || 0));
  const net = client.rentasInmobiliariasNetas;
  return {
    declared,
    netAvailable: typeof net === 'number' ? Math.max(0, net) : declared,
    isValidatedNet: typeof net === 'number',
    destination: client.destinoRentasInmobiliarias || 'desconocido',
  };
}

export function calculateRealSavingsCapacity(client: Client) {
  const expenses = calculateMonthlyExpenses(client);
  const rents = availableRealEstateRents(client);
  const salary = Math.max(0, Number(client.salarioNetoMensual || 0));
  const otherIncome = Math.max(0, Number(client.otrosIngresosNetos || 0));
  const incomeWithoutRents = salary + otherIncome;
  const incomeWithRents = incomeWithoutRents + rents.netAvailable;

  return {
    incomeWithoutRents,
    incomeWithRents,
    realEstateRentsConsidered: rents.netAvailable,
    prudent: Math.max(0, incomeWithoutRents - expenses.total),
    includingRents: Math.max(0, incomeWithRents - expenses.total),
  };
}

export function calculateDebtRatios(client: Client) {
  const expenses = calculateMonthlyExpenses(client);
  const capacity = calculateRealSavingsCapacity(client);
  const salary = Math.max(0, Number(client.salarioNetoMensual || 0));
  const debtMonthly = expenses.housingAndDebt;

  return {
    debtMonthly,
    ratioOnSalary: salary > 0 ? debtMonthly / salary : 0,
    ratioOnTotalIncome: capacity.incomeWithRents > 0 ? debtMonthly / capacity.incomeWithRents : 0,
    ratioPrudent: capacity.incomeWithoutRents > 0 ? debtMonthly / capacity.incomeWithoutRents : 0,
  };
}

export function calculateLiquidity(client: Client) {
  const expenses = calculateMonthlyExpenses(client);
  const months = expenses.total > 0 ? Math.max(0, Number(client.dineroBanco || 0)) / expenses.total : 0;
  const score = months < 2 ? 2 : months < 3 ? 4 : months < 6 ? 6 : months <= 9 ? 9 : 8;
  return {
    months,
    score,
    status: months < 3 ? 'bajo' : months < 6 ? 'medio' : months <= 9 ? 'adecuado' : 'alto',
  };
}

export function calculateTemporaryDisability(client: Client) {
  const expenses = calculateMonthlyExpenses(client);
  const base = Math.max(0, Number(client.baseCotizacion || 0));
  const commonInitial = base * 0.6;
  const commonFromDay21 = base * 0.75;
  const workAccident = base * 0.75;

  return {
    commonInitial,
    commonFromDay21,
    workAccident,
    commonInitialGap: Math.max(0, expenses.total - commonInitial),
    commonFromDay21Gap: Math.max(0, expenses.total - commonFromDay21),
    workAccidentGap: Math.max(0, expenses.total - workAccident),
    note: 'La baja por contingencia común tiene un tramo inicial estimado al 60% y otro al 75%; accidente laboral o enfermedad profesional se estima al 75%.',
  };
}

export function calculatePermanentDisability(client: Client) {
  const expenses = calculateMonthlyExpenses(client);
  const base = Math.max(0, Number(client.baseCotizacion || 0));
  const totalProfession = base * 0.55;
  const absolute = base;

  return {
    totalProfession,
    totalProfessionGap: Math.max(0, expenses.total - totalProfession),
    absolute,
    absoluteGap: Math.max(0, expenses.total - absolute),
    possibleIncreaseAt55: client.edad >= 55,
    note: 'La incapacidad permanente total se estima al 55% de la base; el incremento del 20% desde los 55 años no se aplica automáticamente sin validar requisitos.',
  };
}

export function calculateSurvivorBenefits(client: Client) {
  const expenses = calculateMonthlyExpenses(client);
  const base = Math.max(0, Number(client.baseCotizacion || 0));
  const married = client.estadoCivil === 'Casado/a' || client.estadoCivil === 'Pareja de Hecho';
  const widowhood = married ? base * 0.52 : 0;
  const orphan = base * 0.2 * Math.max(0, Number(client.numeroHijos || 0));
  const combinedBeforeLimit = widowhood + orphan;
  const familyTotal = Math.min(base, combinedBeforeLimit);

  return {
    widowhood,
    widowhoodGap: Math.max(0, expenses.total - widowhood),
    orphan,
    orphanGapIsolated: Math.max(0, expenses.total - orphan),
    familyTotal,
    familyGap: Math.max(0, expenses.total - familyTotal),
    familySurplus: Math.max(0, familyTotal - expenses.total),
    wasCappedByLimit: combinedBeforeLimit > base,
    note: 'Viudedad y orfandad deben analizarse de forma conjunta cuando hay cónyuge/pareja e hijos, con límite general orientativo del 100% de la base.',
  };
}

function calculateTargetCapital(gap: number, monthlyDebt: number, age: number, retirementAge: number) {
  const retirementStartAge = Math.max(retirementAge, age);
  const yearsTo90 = Math.max(0, 90 - retirementStartAge);
  const mortgageYearsTo75 = Math.max(0, 75 - retirementStartAge);
  return gap * 12 * yearsTo90 + monthlyDebt * 12 * mortgageYearsTo75;
}

export function calculateRetirementScenarios(client: Client): RetirementScenario[] {
  const expenses = calculateMonthlyExpenses(client);
  const rents = availableRealEstateRents(client);
  const retirementAge = 67;
  const yearsToRetirement = Math.max(0, retirementAge - client.edad);
  const currentYears = Math.max(0, Number(client.anosCotizados || 0));
  const projectedYears = currentYears + yearsToRetirement;
  const referenceExpense = expenses.ordinary;
  const passiveIncome = rents.netAvailable;

  const build = (
    name: RetirementScenario['name'],
    contributionYears: number,
    baseFactor: number,
    hypothesis: string,
    reliability: RetirementScenario['reliability'],
  ) => {
    const baseUsed = Math.max(0, Number(client.baseCotizacion || 0)) * baseFactor;
    const estimatedRate = pensionRate(contributionYears);
    const pension = baseUsed * estimatedRate;
    const gap = Math.max(0, referenceExpense - pension - passiveIncome);
    return {
      name,
      age: client.edad,
      retirementAge,
      yearsToRetirement,
      currentContributionYears: currentYears,
      projectedContributionYears: contributionYears,
      hypothesis,
      baseUsed,
      estimatedRate,
      pension,
      referenceExpense,
      passiveIncome,
      gap,
      targetCapital: calculateTargetCapital(gap, expenses.housingAndDebt, client.edad, retirementAge),
      reliability,
    };
  };

  return [
    build('Conservador', currentYears, 0.9, 'Solo considera derechos consolidados o continuidad muy prudente.', currentYears >= 15 ? 'media' : 'baja'),
    build('Central', projectedYears, 1, 'Mantiene cotizaciones y base actual hasta la edad ordinaria estimada.', 'media'),
    build('Optimista', projectedYears + 2, 1.05, 'Asume continuidad laboral, ligera mejora de base y ausencia de lagunas relevantes.', 'baja'),
  ];
}

export function calculateSavingsGoal(targetCapital: number, yearsToRetirement: number, annualReturn: number) {
  const months = Math.max(1, yearsToRetirement * 12);
  const linear = targetCapital / months;
  const monthlyRate = Math.max(0, annualReturn || 0) / 100 / 12;
  const financial = monthlyRate > 0 ? targetCapital * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1) : linear;

  return {
    months,
    linear,
    financial,
    annualReturn,
    note: 'La aportación financiera incorpora una rentabilidad esperada, que no está garantizada.',
  };
}

export function calculateProjectedWealth(client: Client) {
  const yearsToRetirement = Math.max(0, 67 - client.edad);
  const invRate = Math.max(0, Number(client.rentabilidadInversion || 0)) / 100;
  const savRate = Math.max(0, Number(client.rentabilidadAhorro || 0)) / 100;
  const rents = availableRealEstateRents(client);
  const reinvestRents = rents.destination === 'reinversion' || rents.destination === 'mixto';
  const projectedInvested = client.dineroInvertido * Math.pow(1 + invRate, yearsToRetirement);
  const projectedSaving = savRate > 0
    ? client.ahorroSistematico * 12 * ((Math.pow(1 + savRate, yearsToRetirement) - 1) / savRate)
    : client.ahorroSistematico * 12 * yearsToRetirement;
  const projectedRents = reinvestRents ? rents.netAvailable * 12 * yearsToRetirement : 0;
  const projectedTotal = client.dineroBanco + projectedInvested + projectedSaving + projectedRents + client.inversionesInmobiliarias;

  return {
    yearsToRetirement,
    invRate,
    savRate,
    projectedInvested,
    projectedSaving,
    projectedRents,
    projectedTotal,
    rentsAreReinvested: reinvestRents,
  };
}

export function validateReportConsistency(client: Client, answers: Record<QuestionKey, Answer>) {
  const warnings: ValidationWarning[] = [];
  const debt = calculateDebtRatios(client);
  const rents = availableRealEstateRents(client);
  const currentYears = Math.max(0, Number(client.anosCotizados || 0));

  if (debt.ratioOnSalary < 0.35 && answers.debtRatio === 'Sí, lo superan') {
    warnings.push({ level: 'critica', area: 'Deuda', message: 'El ratio de deuda sobre salario no supera el 35%, pero la respuesta declara que sí lo supera.' });
  }
  if (rents.declared > 0 && !rents.isValidatedNet) {
    warnings.push({ level: 'importante', area: 'Rentas inmobiliarias', message: 'Confirmar si las rentas inmobiliarias son brutas o netas y si están disponibles para ahorro.' });
  }
  if (rents.declared > 0 && rents.destination === 'desconocido') {
    warnings.push({ level: 'importante', area: 'Patrimonio', message: 'No se suman rentas inmobiliarias acumuladas al patrimonio proyectado hasta confirmar si se consumen o se reinvierten.' });
  }
  if (currentYears < 15) {
    warnings.push({ level: 'critica', area: 'Jubilación', message: 'Actualmente no existe derecho ordinario consolidado a pensión contributiva de jubilación con menos de 15 años cotizados.' });
  }
  warnings.push({ level: 'informativa', area: 'Jubilación', message: 'La pensión pública proyectada es un escenario futuro, no un derecho consolidado actual.' });
  warnings.push({ level: 'informativa', area: 'Baja laboral', message: 'Validar convenio, mejora empresarial y seguros privados antes de concluir que la baja laboral está cubierta.' });
  warnings.push({ level: 'informativa', area: 'Documentación', message: 'Validar deuda pendiente, seguros existentes, testamento, poderes e inventario patrimonial.' });

  return warnings;
}

export function calculateSecurityScores(client: Client, answers: Record<QuestionKey, Answer>) {
  const liquidity = calculateLiquidity(client);
  const temporary = calculateTemporaryDisability(client);
  const permanent = calculatePermanentDisability(client);
  const survivor = calculateSurvivorBenefits(client);
  const retirement = calculateRetirementScenarios(client)[1];
  const debt = calculateDebtRatios(client);

  const lowGapScore = (gap: number, reference: number) => {
    if (reference <= 0) return 5;
    const ratio = gap / reference;
    if (ratio <= 0) return 9;
    if (ratio <= 0.15) return 7;
    if (ratio <= 0.35) return 5;
    return 2;
  };

  return {
    fondo: liquidity.score,
    baja: lowGapScore(temporary.commonInitialGap, calculateMonthlyExpenses(client).total),
    incapacidad: Math.round((lowGapScore(permanent.totalProfessionGap, calculateMonthlyExpenses(client).total) + lowGapScore(permanent.absoluteGap, calculateMonthlyExpenses(client).total)) / 2),
    familia: survivor.familyGap > 0 ? lowGapScore(survivor.familyGap, calculateMonthlyExpenses(client).total) : Math.max(6, answerScore(answers.familyCapital)),
    deuda: debt.ratioOnSalary > 0.35 ? 2 : debt.ratioOnSalary > 0.3 ? 6 : 9,
    jubilacion: lowGapScore(retirement.gap, retirement.referenceExpense),
    patrimonio: answerScore(answers.inflation),
    legal: Math.round((answerScore(answers.will) + answerScore(answers.familyAccess)) / 2),
  };
}

export function calculateAudit(client: Client, answers: Record<QuestionKey, Answer>, projects: Project[]) {
  const expenses = calculateMonthlyExpenses(client);
  const capacity = calculateRealSavingsCapacity(client);
  const debtRatios = calculateDebtRatios(client);
  const liquidity = calculateLiquidity(client);
  const temporaryDisability = calculateTemporaryDisability(client);
  const permanentDisability = calculatePermanentDisability(client);
  const survivorBenefits = calculateSurvivorBenefits(client);
  const retirementScenarios = calculateRetirementScenarios(client);
  const centralRetirement = retirementScenarios[1];
  const wealth = calculateProjectedWealth(client);
  const savingsGoal = calculateSavingsGoal(centralRetirement.targetCapital, wealth.yearsToRetirement, client.rentabilidadAhorro);
  const warnings = validateReportConsistency(client, answers);
  const scores = calculateSecurityScores(client, answers);
  const globalScore = Math.round(Object.values(scores).reduce((sum, v) => sum + v, 0) / Object.values(scores).length);

  const benefits: Benefit[] = [
    { label: 'Baja laboral común 60%', rate: '60% base reguladora', value: temporaryDisability.commonInitial, gap: temporaryDisability.commonInitialGap, note: 'Tramo inicial de contingencia común.' },
    { label: 'Baja laboral 75%', rate: '75% base reguladora', value: temporaryDisability.commonFromDay21, gap: temporaryDisability.commonFromDay21Gap, note: 'Tramo desde día 21 o contingencia profesional.' },
    { label: 'Incapacidad permanente total', rate: '55% base reguladora', value: permanentDisability.totalProfession, gap: permanentDisability.totalProfessionGap, note: 'Para profesión habitual; incremento desde 55 años pendiente de validar.' },
    { label: 'Incapacidad permanente absoluta', rate: '100% base reguladora', value: permanentDisability.absolute, gap: permanentDisability.absoluteGap, note: 'Estimación orientativa sujeta a resolución administrativa.' },
    { label: 'Viudedad', rate: '52% base reguladora', value: survivorBenefits.widowhood, gap: survivorBenefits.widowhoodGap, note: 'Prestación aislada de viudedad.' },
    { label: 'Viudedad + orfandad', rate: 'Escenario familiar conjunto', value: survivorBenefits.familyTotal, gap: survivorBenefits.familyGap, note: 'Suma familiar con límite general orientativo del 100% de la base.' },
    { label: 'Jubilación central', rate: `${formatPercent(centralRetirement.estimatedRate * 100)} base reguladora estimada`, value: centralRetirement.pension, gap: centralRetirement.gap, note: 'Escenario futuro condicionado a cotizaciones y normativa.' },
  ];

  const projectRows = projects.map((project) => {
    const monthly = project.target / Math.max(1, project.years * 12);
    const status = monthly <= capacity.includingRents ? 'Viable' : monthly <= capacity.includingRents * 1.15 ? 'Ajustado' : 'No viable';
    return { ...project, monthly, status };
  });
  const totalProjectNeed = projectRows.reduce((sum, row) => sum + row.monthly, 0);
  const globalProjectStatus = capacity.includingRents <= 0 || totalProjectNeed > capacity.includingRents * 1.15 ? 'No viable' : totalProjectNeed > capacity.includingRents ? 'Ajustado' : 'Viable';

  const riskItems: Risk[] = [
    {
      area: 'Protección de ingresos',
      score: Math.round((scores.baja + scores.incapacidad) / 2),
      level: formatRiskLevel(Math.round((scores.baja + scores.incapacidad) / 2)),
      impact: `Brecha inicial de baja común: ${formatCurrency(temporaryDisability.commonInitialGap)} / mes. Incapacidad permanente total: ${formatCurrency(permanentDisability.totalProfessionGap)} / mes.`,
      recommendation: 'Validar convenio, mejora empresarial y subsidio privado antes de decidir capital de protección.',
      priority: temporaryDisability.commonInitialGap > 0 || permanentDisability.totalProfessionGap > 0 ? 'Inmediata' : '6 meses',
      reason: 'La estabilidad familiar depende de que los ingresos se mantengan ante una baja o incapacidad.',
    },
    {
      area: 'Protección familiar',
      score: scores.familia,
      level: formatRiskLevel(scores.familia),
      impact: `Escenario conjunto viudedad + orfandad: ${formatCurrency(survivorBenefits.familyTotal)} / mes. ${survivorBenefits.familyGap > 0 ? `Brecha: ${formatCurrency(survivorBenefits.familyGap)} / mes.` : `Superávit: ${formatCurrency(survivorBenefits.familySurplus)} / mes.`}`,
      recommendation: 'Calcular capital familiar objetivo con deuda pendiente, transición familiar y capital educativo de hijos.',
      priority: scores.familia <= 3 ? 'Inmediata' : '6 meses',
      reason: 'Viudedad y orfandad deben verse como escenario familiar conjunto, no como prestaciones aisladas.',
    },
    {
      area: 'Liquidez y reserva',
      score: scores.fondo,
      level: formatRiskLevel(scores.fondo),
      impact: `Reserva actual equivalente a ${liquidity.months.toFixed(1)} meses de gasto.`,
      recommendation: 'Construir una reserva separada de 6 a 9 meses antes de asumir más riesgo financiero.',
      priority: scores.fondo <= 3 ? 'Inmediata' : '6 meses',
      reason: 'La liquidez evita tener que endeudarse o desinvertir en un mal momento.',
    },
    {
      area: 'Jubilación',
      score: scores.jubilacion,
      level: formatRiskLevel(scores.jubilacion),
      impact: `Brecha central: ${formatCurrency(centralRetirement.gap)} / mes. Capital objetivo: ${formatCurrency(centralRetirement.targetCapital)}.`,
      recommendation: 'Trabajar con escenarios y revisar anualmente base, años cotizados, rentas e inflación.',
      priority: scores.jubilacion <= 3 ? 'Inmediata' : '12 meses',
      reason: 'La pensión futura depende de cotizaciones futuras y no debe tratarse como dato cierto.',
    },
    {
      area: 'Deuda e hipoteca',
      score: scores.deuda,
      level: formatRiskLevel(scores.deuda),
      impact: `Ratio sobre salario: ${formatPercent(debtRatios.ratioOnSalary * 100)}. Ratio sobre ingresos totales: ${formatPercent(debtRatios.ratioOnTotalIncome * 100)}.`,
      recommendation: 'Mantener deuda bajo el 35% de ingresos y proteger la cuota ante contingencias.',
      priority: scores.deuda <= 3 ? 'Inmediata' : '6 meses',
      reason: 'La deuda reduce margen de maniobra y condiciona la viabilidad de objetivos.',
    },
    {
      area: 'Patrimonio e inflación',
      score: scores.patrimonio,
      level: formatRiskLevel(scores.patrimonio),
      impact: `Patrimonio financiero proyectado: ${formatCurrency(wealth.projectedTotal)}. Rentas reinvertidas consideradas: ${formatCurrency(wealth.projectedRents)}.`,
      recommendation: 'Separar reserva, objetivos, inversión y jubilación con carteras y riesgos diferenciados.',
      priority: scores.patrimonio <= 3 ? '6 meses' : '12 meses',
      reason: 'El exceso de liquidez pierde poder adquisitivo si no tiene una función definida.',
    },
    {
      area: 'Legal y sucesorio',
      score: scores.legal,
      level: formatRiskLevel(scores.legal),
      impact: 'La falta de testamento, inventario o acceso documental puede ralentizar decisiones críticas.',
      recommendation: 'Formalizar testamento, inventario patrimonial, pólizas, beneficiarios y protocolo familiar.',
      priority: scores.legal <= 3 ? '3 meses' : '12 meses',
      reason: 'La protección patrimonial también depende de que la familia pueda ejecutar el plan.',
    },
  ];

  const projection = Array.from({ length: Math.max(10, wealth.yearsToRetirement) + 1 }, (_, year) => {
    const invested = client.dineroInvertido * Math.pow(1 + wealth.invRate, year);
    const saving = wealth.savRate > 0 ? client.ahorroSistematico * 12 * ((Math.pow(1 + wealth.savRate, year) - 1) / wealth.savRate) : client.ahorroSistematico * 12 * year;
    const rents = wealth.rentsAreReinvested ? calculateRealSavingsCapacity(client).realEstateRentsConsidered * 12 * year : 0;
    return {
      edad: client.edad + year,
      patrimonio: Math.round(client.dineroBanco + invested + saving + rents + (wealth.yearsToRetirement ? client.inversionesInmobiliarias * (year / wealth.yearsToRetirement) : client.inversionesInmobiliarias)),
      ahorro: Math.round(saving),
      objetivo: Math.round(centralRetirement.targetCapital),
    };
  });

  return {
    totalExpenses: expenses.total,
    ordinaryExpenses: expenses.ordinary,
    adjustedRetirementExpenses: Math.max(0, expenses.ordinary - calculateRealSavingsCapacity(client).realEstateRentsConsidered),
    yearsToRetirement: wealth.yearsToRetirement,
    estimatedYears: client.anosCotizados + wealth.yearsToRetirement,
    retirementRate: centralRetirement.estimatedRate,
    pension: centralRetirement.pension,
    benefits,
    retirementGap: centralRetirement.gap,
    targetCapital: centralRetirement.targetCapital,
    accumulationMonths: savingsGoal.months,
    recommendedSaving: savingsGoal.financial,
    recommendedSavingLinear: savingsGoal.linear,
    capacity: capacity.includingRents,
    capacityPrudent: capacity.prudent,
    realEstateRentsConsidered: capacity.realEstateRentsConsidered,
    emergencyMonths: liquidity.months,
    debtRatio: debtRatios.ratioOnSalary,
    debtRatios,
    projectedInvested: wealth.projectedInvested,
    projectedSaving: wealth.projectedSaving,
    projectedRents: wealth.projectedRents,
    projectedTotal: wealth.projectedTotal,
    projectRows,
    totalProjectNeed,
    globalProjectStatus,
    scores,
    globalScore,
    risks: riskItems,
    projection,
    warnings,
    temporaryDisability,
    permanentDisability,
    survivorBenefits,
    retirementScenarios,
    savingsGoal,
    projectedRentsAreReinvested: wealth.rentsAreReinvested,
  };
}
