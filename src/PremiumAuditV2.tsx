import { ReactNode, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, LineChart as LineChartIcon, Mail, Phone, Shield, Target, Trash2, UserRound } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { jsPDF } from 'jspdf';
import { calculateAudit } from './audit-calculations';

type CivilStatus = 'Soltero/a' | 'Casado/a' | 'Divorciado/a' | 'Pareja de Hecho' | 'Viudo/a';
type RiskLevel = 'grave' | 'moderada' | 'leve';
type Answer = 'Si' | 'Parcialmente' | 'No' | 'Baja' | 'Media' | 'Alta' | 'Sí, lo superan' | 'No, están por debajo' | 'Están justo en el límite';
type QuestionKey = 'income' | 'sickLeave' | 'familyCapital' | 'health' | 'retirementPlan' | 'publicDependency' | 'debtRatio' | 'inflation' | 'will' | 'familyAccess';

type Client = {
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
};

type Project = { id: number; name: string; target: number; years: number };
type Benefit = { label: string; rate: string; value: number; gap: number; note?: string };
type Risk = { area: string; score: number; level: RiskLevel; impact: string; recommendation: string; priority: string; reason?: string };

const GOLD = '#C5A566';
const RED = '#DC2626';
const ORANGE = '#F97316';
const GREEN = '#16A34A';
const BLUE = '#2563EB';

const defaultClient: Client = {
  nombre: 'Carlos Gomez', telefono: '600 000 000', email: 'cliente@email.com', edad: 38, anosCotizados: 12, baseCotizacion: 2800,
  estadoCivil: 'Casado/a', numeroHijos: 2, salarioNetoMensual: 2400, gastosMensuales: 1200, alquilerHipotecaPrestamos: 750,
  dineroBanco: 9000, dineroInvertido: 4000, rentabilidadInversion: 5, ahorroSistematico: 150, rentabilidadAhorro: 6,
  inversionesInmobiliarias: 0, rentasInmobiliarias: 0,
};

const defaultQuestions: Record<QuestionKey, Answer> = {
  income: 'Si', sickLeave: 'No', familyCapital: 'No', health: 'No', retirementPlan: 'No', publicDependency: 'Alta', debtRatio: 'No, están por debajo', inflation: 'No', will: 'No', familyAccess: 'No',
};

const questionList: Array<{ key: QuestionKey; label: string; title: string; why: string; options: Answer[] }> = [
  { key: 'income', label: 'Motor económico', title: '¿Los ingresos de tu familia dependen principalmente de ti?', why: 'Permite identificar si una baja, invalidez o fallecimiento tendría un impacto directo en la estabilidad económica del hogar.', options: ['Si', 'Parcialmente', 'No'] },
  { key: 'sickLeave', label: 'Baja laboral', title: '¿Tienes protección privada que complemente la baja laboral?', why: 'Una baja prolongada puede reducir ingresos mientras los gastos fijos continúan; esta respuesta mide la exposición de caja.', options: ['Si', 'Parcialmente', 'No'] },
  { key: 'familyCapital', label: 'Capital familiar', title: '¿Tu familia tendría capital suficiente ante fallecimiento o invalidez grave?', why: 'Ayuda a dimensionar el capital necesario para vivienda, estudios, transición de ingresos e impuestos.', options: ['Si', 'Parcialmente', 'No'] },
  { key: 'health', label: 'Acceso sanitario', title: '¿Dispones de acceso sanitario privado o alternativa equivalente?', why: 'El diagnóstico rápido protege la salud y también la capacidad de generar ingresos.', options: ['Si', 'Parcialmente', 'No'] },
  { key: 'retirementPlan', label: 'Jubilación privada', title: '¿Tienes un plan privado para complementar la pensión pública?', why: 'Permite valorar si existe una estrategia real para cubrir la brecha entre pensión y nivel de vida deseado.', options: ['Si', 'Parcialmente', 'No'] },
  { key: 'publicDependency', label: 'Dependencia pública', title: '¿Dependencia prevista del sistema público en la jubilación?', why: 'Cuanto mayor sea la dependencia del sistema público, más importante es construir patrimonio líquido y finalista.', options: ['Baja', 'Media', 'Alta'] },
  { key: 'debtRatio', label: 'Carga financiera', title: '¿El total de tus préstamos e hipotecas superan el 35% de tus ingresos?', why: 'Una carga de deuda elevada reduce ahorro, aumenta fragilidad y condiciona cualquier plan financiero.', options: ['Sí, lo superan', 'No, están por debajo', 'Están justo en el límite'] },
  { key: 'inflation', label: 'Inflación', title: '¿Tu dinero trabaja para batir inflación e impuestos?', why: 'La liquidez improductiva pierde poder adquisitivo; medirlo ayuda a separar reserva, inversión y jubilación.', options: ['Si', 'Parcialmente', 'No'] },
  { key: 'will', label: 'Testamento', title: '¿Tienes testamento y estructura legal actualizada?', why: 'Reduce incertidumbre, costes, conflictos y tiempos de reacción ante una contingencia familiar.', options: ['Si', 'Parcialmente', 'No'] },
  { key: 'familyAccess', label: 'Acceso documental', title: '¿Tu familia sabría localizar documentación, claves y pólizas?', why: 'Sin acceso ordenado a documentación crítica, una buena planificación puede ser inútil en el momento de necesidad.', options: ['Si', 'Parcialmente', 'No'] },
];

function eur(value: number) { return `${Math.round(value || 0).toLocaleString('es-ES')} €`; }
function eurMonth(value: number) { return `${eur(value)} / mes`; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function slug(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'; }
function shortEur(value: number) { const v = Math.round(value || 0); return Math.abs(v) >= 1000000 ? `${(v / 1000000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M €` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000).toLocaleString('es-ES')} k €` : eur(v); }
function riskColor(level: RiskLevel) { return level === 'grave' ? RED : level === 'moderada' ? ORANGE : GREEN; }

function calculate(client: Client, answers: Record<QuestionKey, Answer>, projects: Project[]) {
  return calculateAudit(client, answers, projects);
}

function drawLogo(doc: jsPDF, x: number, y: number, scale = 1) {
  doc.setFillColor(255, 255, 255); doc.rect(x, y, 3 * scale, 17 * scale, 'F'); doc.rect(x + 18 * scale, y, 3 * scale, 17 * scale, 'F'); doc.rect(x + 9 * scale, y, 3 * scale, 7 * scale, 'F'); doc.rect(x + 9 * scale, y + 10 * scale, 3 * scale, 7 * scale, 'F'); doc.setFillColor(197, 165, 102); doc.circle(x + 10.5 * scale, y + 8.5 * scale, 4.4 * scale, 'F');
}

function generatePdf(client: Client, answers: Record<QuestionKey, Answer>, projects: Project[], data: ReturnType<typeof calculate>) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const M = 16; const W = 178; let y = 0; let page = 1;
  const text = (t: string | string[], x: number, yy: number, options?: Record<string, unknown>) => doc.text(t, x, yy, options as never);
  const paragraph = (body: string, size = 8.5) => { doc.setFont('Helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(71, 85, 105); const lines = doc.splitTextToSize(body, W); const paragraphTopGap = 3; if (y + paragraphTopGap + lines.length * 4.5 > 270) newPage('CONTINUACIÓN'); y += paragraphTopGap; text(lines, M, y); y += lines.length * 4.5 + 5; };
  const title = (t: string) => { if (y > 246) newPage(t); doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(15, 23, 42); text(t, M, y); y += 7; doc.setDrawColor(197, 165, 102); doc.line(M, y, M + 42, y); y += 9; };
  const header = (subtitle: string) => { doc.setFillColor(26, 26, 26); doc.rect(0, 0, 210, 25, 'F'); drawLogo(doc, 14, 8.4, 0.32); doc.setFont('Helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255); text('JOSÉ CARLOS HIDALGO', 25, 10.5); doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); text('josecarlos@hilolegal.es | 647 50 60 40', 196, 10.5, { align: 'right' }); doc.setTextColor(197, 165, 102); text(subtitle, 25, 18); };
  const footer = () => { doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(130, 130, 130); text('Informe profesional de auditoría de riesgos financieros y patrimoniales', M, 285); text(`Página ${page}`, 196, 285, { align: 'right' }); };
  const newPage = (subtitle: string) => { if (page > 1) footer(); if (page > 1) doc.addPage(); header(subtitle); y = 40; page += page === 1 ? 0 : 1; };
  const metric = (label: string, value: string, x: number, yy: number, w = 55) => { doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(x, yy, w, 18, 2, 2, 'FD'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139); text(label, x + 3, yy + 6); doc.setFontSize(9); doc.setTextColor(15, 23, 42); text(doc.splitTextToSize(value, w - 6).slice(0, 1), x + 3, yy + 13); };

  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 297, 'F'); doc.setDrawColor(197, 165, 102); doc.line(18, 42, 192, 42); doc.setFont('Helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(26, 26, 26); text('INFORME DE AUDITORÍA', 18, 76); doc.setFontSize(19); text('DE RIESGOS FINANCIEROS', 18, 91); text('Y PATRIMONIALES', 18, 105); doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(197, 165, 102); text('Previsión social, protección familiar y brecha de jubilación', 18, 123); doc.setTextColor(15, 23, 42); doc.setFontSize(10); text(`Cliente: ${client.nombre}`, 18, 154); text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 18, 164); doc.setFont('Helvetica', 'bold'); text('Realizado por José Carlos Hidalgo', 18, 232); doc.setFont('Helvetica', 'normal'); text('consultor financiero, hipotecario y patrimonial', 18, 241); text('josecarlos@hilolegal.es | 647 50 60 40', 18, 251); footer(); page++;

  newPage('RESUMEN EJECUTIVO'); title('1. Resumen ejecutivo'); metric('Seguridad global', `${data.globalScore}/10`, M, y); metric('Capacidad ahorro', eurMonth(data.capacity), M + 61, y); metric('Capital jubilación', eur(data.targetCapital), M + 122, y); y += 27; paragraph(`La auditoría muestra una seguridad global de ${data.globalScore}/10. El cliente dispone de ingresos netos de ${eurMonth(client.salarioNetoMensual)}, rentas inmobiliarias de ${eurMonth(client.rentasInmobiliarias)}, gastos mensuales requeridos de ${eurMonth(data.totalExpenses)}, capacidad de ahorro real de ${eurMonth(data.capacity)} y capacidad prudente de ${eurMonth(data.capacityPrudent)} excluyendo rentas pendientes de validar. La prioridad profesional es proteger ingresos, familia y vivienda antes de optimizar inversión o fiscalidad.`); paragraph(`En previsión social, las prestaciones públicas deben compararse con el gasto real del hogar. La mayor brecha mensual detectada en contingencias de ingresos asciende a ${eurMonth(Math.max(...data.benefits.map(b => b.gap)))}. Esta cifra orienta la necesidad de coberturas privadas y capitales de protección.`); paragraph(`En jubilación, la pensión pública estimada es de ${eurMonth(data.pension)} y la brecha ajustada, considerando rentas inmobiliarias declaradas, es de ${eurMonth(data.retirementGap)}. El capital total previsor requerido es de ${eur(data.targetCapital)}, incluyendo gastos ordinarios hasta los 90 años y cuota hipotecaria/préstamos hasta los 75.`);

  title('Calidad del diagnóstico y datos pendientes'); metric('Advertencias críticas', String(data.warnings.filter(w => w.level === 'critica').length), M, y, 55); metric('Advertencias importantes', String(data.warnings.filter(w => w.level === 'importante').length), M + 61, y, 55); metric('Fiabilidad', data.warnings.some(w => w.level === 'critica') ? 'Media-baja' : data.warnings.some(w => w.level === 'importante') ? 'Media' : 'Alta', M + 122, y, 55); y += 27; data.warnings.slice(0, 6).forEach((warning) => { if (y > 260) newPage('DATOS PENDIENTES'); doc.setFillColor(248,250,252); doc.setDrawColor(warning.level === 'critica' ? 220 : warning.level === 'importante' ? 249 : 197, warning.level === 'critica' ? 38 : warning.level === 'importante' ? 115 : 165, warning.level === 'critica' ? 38 : warning.level === 'importante' ? 22 : 102); doc.roundedRect(M, y, W, 14, 2, 2, 'FD'); doc.setFont('Helvetica','bold'); doc.setFontSize(7); doc.setTextColor(warning.level === 'critica' ? 220 : warning.level === 'importante' ? 249 : 197, warning.level === 'critica' ? 38 : warning.level === 'importante' ? 115 : 165, warning.level === 'critica' ? 38 : warning.level === 'importante' ? 22 : 102); text(`${warning.level.toUpperCase()} · ${warning.area}`, M + 3, y + 5); doc.setFont('Helvetica','normal'); doc.setTextColor(71,85,105); text(doc.splitTextToSize(warning.message, W - 6).slice(0, 1), M + 3, y + 11); y += 17; }); paragraph('Nota metodológica: este informe utiliza datos declarados y cálculos estimativos para orientar decisiones de planificación financiera, patrimonial y de previsión social. Las prestaciones públicas dependen de bases reguladoras, periodos de cotización, contingencia causante, normativa aplicable y resolución administrativa.');

  title('2. Resumen de datos del cliente');
  const fields = [
    ['Nombre', client.nombre],
    ['Teléfono', client.telefono],
    ['Email', client.email],
    ['Edad', `${client.edad} años`],
    ['Años cotizados', `${client.anosCotizados} años`],
    ['Base cotización', eurMonth(client.baseCotizacion)],
    ['Estado civil', client.estadoCivil],
    ['Hijos menores de 25', String(client.numeroHijos)],
    ['Ingresos netos', eurMonth(client.salarioNetoMensual)],
    ['Gastos mensuales', eurMonth(client.gastosMensuales)],
    ['Hipoteca/préstamos', eurMonth(client.alquilerHipotecaPrestamos)],
    ['Dinero en banco', eur(client.dineroBanco)],
    ['Dinero invertido', eur(client.dineroInvertido)],
    ['Ahorro sistemático', eurMonth(client.ahorroSistematico)],
    ['Inversiones inmobiliarias', eur(client.inversionesInmobiliarias)],
    ['Rentas inmobiliarias', eurMonth(client.rentasInmobiliarias)]
  ];
  const clientCardW = 84;
  const clientRowH = 24;
  fields.forEach((f, i) => {
    if (i % 2 === 0 && y + clientRowH > 266) newPage('DATOS DEL CLIENTE');
    const x = M + (i % 2) * (clientCardW + 10);
    metric(f[0], f[1], x, y, clientCardW);
    if (i % 2 === 1 || i === fields.length - 1) y += clientRowH;
  });
  y += 4;

  title('3. Objetivos a medio y largo plazo'); paragraph('Los objetivos se comparan con la capacidad de ahorro real y con la capacidad prudente para detectar si son viables sin depender de rentas aún pendientes de confirmar.'); doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setFillColor(26, 26, 26); doc.rect(M, y, W, 9, 'F'); doc.setTextColor(255,255,255); ['Proyecto','Importe','Años','Ahorro/mes','Estado'].forEach((h,i)=>text(h, M + [3,72,104,124,158][i], y+6)); y += 9; data.projectRows.forEach((p, i) => { doc.setFillColor(i % 2 ? 255 : 248, i % 2 ? 255 : 250, i % 2 ? 255 : 252); doc.rect(M, y, W, 9, 'F'); doc.setTextColor(15,23,42); doc.setFont('Helvetica','normal'); doc.setFontSize(7); text(p.name, M+3, y+6); text(eur(p.target), M+72, y+6); text(`${p.years}`, M+104, y+6); text(eurMonth(p.monthly), M+124, y+6); doc.setTextColor(p.status === 'No viable' ? 220 : p.status === 'Ajustado' ? 249 : 22, p.status === 'No viable' ? 38 : p.status === 'Ajustado' ? 115 : 163, p.status === 'No viable' ? 38 : p.status === 'Ajustado' ? 22 : 74); text(p.status, M+158, y+6); y += 9; }); y += 8; metric('Capacidad real', eurMonth(data.capacity), M, y, 41); metric('Capacidad prudente', eurMonth(data.capacityPrudent), M+46, y, 41); metric('Necesidad objetivos', eurMonth(data.totalProjectNeed), M+92, y, 41); metric('Viabilidad global', data.globalProjectStatus, M+138, y, 40); y += 28;

  title('4. Auditoría de previsión social'); paragraph('Esta sección mide qué prestaciones públicas cubren el gasto mensual y cuáles dejan una brecha económica que debe asegurarse o planificarse.'); data.benefits.forEach((b, i) => { if (y > 260) newPage('PREVISIÓN SOCIAL'); metric(`${b.label} (${b.rate})`, `Prestación: ${eurMonth(b.value)} | ${b.gap > 0 ? `Brecha: ${eurMonth(b.gap)}` : 'Cubierto'}`, M + (i % 2) * 91, y + Math.floor((i % 6) / 2) * 20, 86); if (i % 6 === 5) y += 66; }); y += 68; paragraph(`Lectura profesional: la baja laboral no debe tratarse como cubierta solo por alcanzar el tramo del 75%; el tramo común inicial al 60% deja una brecha de ${eurMonth(data.temporaryDisability.commonInitialGap)}. La protección familiar se analiza de forma conjunta: viudedad más orfandad estimadas ascienden a ${eurMonth(data.survivorBenefits.familyTotal)}.`);

  title('5. Estudio brecha de jubilación'); metric('Pensión estimada', eurMonth(data.pension), M, y); metric('Brecha mensual', eurMonth(data.retirementGap), M+61, y); metric('Capital requerido', eur(data.targetCapital), M+122, y); y += 28; paragraph(`El capital objetivo se calcula sumando la brecha mensual ordinaria hasta los 90 años y la cuota de hipoteca/préstamos hasta los 75 años. La proyección patrimonial a los 67 años asciende a ${eur(data.projectedTotal)}.`); metric('Esfuerzo lineal', eurMonth(data.recommendedSavingLinear), M, y, 55); metric('Con rentabilidad', eurMonth(data.recommendedSaving), M+61, y, 55); metric('Rentas reinvertidas', data.projectedRentsAreReinvested ? 'Sí' : 'Pendiente', M+122, y, 55); y += 28; paragraph('La pensión pública de jubilación proyectada no es un derecho consolidado actual. Depende de cotizaciones futuras, bases reguladoras, edad legal, posibles lagunas y normativa vigente en la fecha de jubilación. Los cálculos se presentan en euros actuales.'); const chartX = 42, chartY = y + 6, chartW = 142, chartH = 70; const max = Math.max(data.targetCapital, data.projectedTotal, ...data.projection.map(p => p.patrimonio), 1); doc.setDrawColor(226,232,240); [0,.25,.5,.75,1].forEach(r => { const yy = chartY + chartH - r*chartH; doc.line(chartX, yy, chartX+chartW, yy); doc.setFontSize(6); doc.setTextColor(100,116,139); text(shortEur(max*r), chartX-4, yy+2, { align:'right' }); }); const pt = (v:number,i:number) => ({ x: chartX + (i / Math.max(1, data.projection.length-1)) * chartW, yy: chartY + chartH - (v / max) * chartH }); doc.setDrawColor(197,165,102); doc.setLineWidth(1.2); data.projection.forEach((p,i)=>{ if(i){ const a=pt(data.projection[i-1].patrimonio,i-1), b=pt(p.patrimonio,i); doc.line(a.x,a.yy,b.x,b.yy); }}); const targetY = chartY + chartH - (data.targetCapital / max) * chartH; doc.setDrawColor(220,38,38); doc.setLineDashPattern([2,2],0); doc.line(chartX,targetY,chartX+chartW,targetY); doc.setLineDashPattern([],0); doc.setFontSize(7); doc.setTextColor(220,38,38); text(`Capital objetivo: ${shortEur(data.targetCapital)}`, chartX+chartW, targetY-2, {align:'right'}); y = chartY + chartH + 18; paragraph('Escenarios de jubilación:'); data.retirementScenarios.forEach((scenario) => { if (y > 248) newPage('ESCENARIOS DE JUBILACIÓN'); metric(scenario.name, `${eurMonth(scenario.pension)} · brecha ${eurMonth(scenario.gap)}`, M, y, 55); metric('Años cotizados', `${scenario.projectedContributionYears.toFixed(1)}`, M+61, y, 55); metric('Fiabilidad', scenario.reliability, M+122, y, 55); y += 22; });

  title('6. Niveles de seguridad y vulnerabilidad'); paragraph('La matriz sintetiza puntuación, gravedad, impacto económico y recomendación.'); data.risks.forEach((r, i) => { if (y > 260) newPage('VULNERABILIDAD'); doc.setDrawColor(226,232,240); doc.setFillColor(248,250,252); doc.roundedRect(M, y, W, 18, 2, 2, 'FD'); doc.setFont('Helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(riskColor(r.level)); text(`${r.area} · ${r.level.toUpperCase()} · ${r.score}/10`, M+3, y+6); doc.setFont('Helvetica','normal'); doc.setFontSize(6.8); doc.setTextColor(71,85,105); text(doc.splitTextToSize(`${r.impact} Recomendación: ${r.recommendation}`, W-6).slice(0,2), M+3, y+12); y += 22; });

  title('7. Diagnóstico estratégico y plan de acción'); paragraph('Las medidas se ordenan por prioridad para transformar el diagnóstico en una hoja de ruta práctica.'); data.risks.forEach((r, i) => paragraph(`${i+1}. ${r.area}. Prioridad ${r.priority}. ${r.recommendation}`, 8));

  title('8. Cierre profesional'); paragraph('La buena noticia es que la mayoría de vulnerabilidades detectadas son corregibles con una estrategia coordinada. Para transformar este diagnóstico en decisiones concretas, puede contactar con José Carlos Hidalgo en el teléfono 647 50 60 40 o en josecarlos@hilolegal.es. El objetivo es ayudarle a proteger ingresos, familia, vivienda y patrimonio con un plan claro, medible y revisable.'); footer();
  doc.save(`informe-auditoria-premium-${slug(client.nombre)}.pdf`);
}

export default function PremiumAuditV2() {
  const [client, setClient] = useState<Client>(defaultClient);
  const [answers, setAnswers] = useState<Record<QuestionKey, Answer>>(defaultQuestions);
  const [projects, setProjects] = useState<Project[]>([{ id: 1, name: 'Comprar coche familiar', target: 18000, years: 3 }, { id: 2, name: 'Fondo de jubilación privado', target: 60000, years: 20 }]);
  const [draft, setDraft] = useState<Project>({ id: 0, name: 'Nuevo objetivo', target: 12000, years: 5 });
  const data = useMemo(() => calculate(client, answers, projects), [client, answers, projects]);
  const update = <K extends keyof Client>(key: K, value: Client[K]) => setClient((current) => ({ ...current, [key]: value }));
  const addProject = () => { if (!draft.name.trim()) return; setProjects((rows) => [...rows, { ...draft, id: Date.now(), years: clamp(draft.years, 1, 20), target: Math.max(0, draft.target) }]); };
  const updateProject = <K extends keyof Project>(id: number, key: K, value: Project[K]) => setProjects((rows) => rows.map((row) => row.id === id ? { ...row, [key]: value } : row));
  const deleteProject = (id: number) => setProjects((rows) => rows.filter((row) => row.id !== id));
  const criticalWarnings = data.warnings.filter((warning) => warning.level === 'critica');
  const importantWarnings = data.warnings.filter((warning) => warning.level === 'importante');
  const reliability = criticalWarnings.length ? 'Media-baja' : importantWarnings.length ? 'Media' : 'Alta';
  const securityChartData = useMemo(() => {
    const labels: Record<string, string> = {
      fondo: 'Fondo',
      baja: 'Baja',
      incapacidad: 'Incapacidad',
      familia: 'Familia',
      deuda: 'Deuda',
      jubilacion: 'Jubilación',
      patrimonio: 'Patrimonio',
      legal: 'Legal',
    };
    return Object.entries(data.scores).map(([subject, score]) => ({
      subject: labels[subject] || subject,
      score: Number(score) * 10,
    }));
  }, [data.scores]);

  return <div className="premium-v2 min-h-screen bg-[#f7f7f5] text-slate-950">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1A1A1A] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4"><div className="flex items-center gap-4"><Logo className="h-12 w-10"/><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C5A566]">Auditoría patrimonial premium</p><h1 className="text-xl font-black">JOSÉ CARLOS HIDALGO</h1></div></div><div className="hidden text-right text-sm text-white/75 md:block"><p>josecarlos@hilolegal.es</p><p>647 50 60 40</p></div></div>
    </header>
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-lg border border-slate-200 bg-white p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#C5A566]">Informe profesional</p><h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Auditoría de riesgos financieros y patrimoniales</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">Herramienta de diagnóstico para cuantificar brechas de previsión social, jubilación, liquidez, deuda, protección familiar y orden patrimonial.</p><div className="mt-6 grid gap-3 md:grid-cols-4"><Metric label="Seguridad global" value={`${data.globalScore}/10`}/><Metric label="Ahorro real" value={eurMonth(data.capacity)}/><Metric label="Capital objetivo" value={eur(data.targetCapital)}/><Metric label="Reserva" value={`${data.emergencyMonths.toFixed(1)} meses`}/></div></div><div className="priority-map rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-950">Mapa de prioridades</h3><div className="mt-4 space-y-3">{data.risks.slice(0,5).map(r=><div key={r.area}><RiskMini risk={r}/></div>)}</div></div></section>

      <Section title="Calidad del diagnóstico" icon={<AlertTriangle/>}><div className="grid gap-3 md:grid-cols-4"><Metric label="Datos suficientes" value={criticalWarnings.length ? 'Revisar' : 'Sí'}/><Metric label="Datos pendientes" value={`${data.warnings.length}`}/><Metric label="Fiabilidad" value={reliability}/><Metric label="Capacidad prudente" value={eurMonth(data.capacityPrudent)}/></div><div className="mt-4 grid gap-3 lg:grid-cols-3">{data.warnings.slice(0,6).map((warning)=><div key={`${warning.area}-${warning.message}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className={`text-xs font-black uppercase ${warning.level === 'critica' ? 'text-red-600' : warning.level === 'importante' ? 'text-orange-500' : 'text-[#C5A566]'}`}>{warning.level} · {warning.area}</p><p className="mt-2 text-sm leading-6 text-slate-700">{warning.message}</p></div>)}</div><p className="mt-4 text-sm leading-7 text-slate-600">La capacidad de ahorro real incluye las rentas inmobiliarias declaradas. La capacidad prudente las excluye hasta confirmar si son netas, disponibles y no destinadas a consumo, deuda o reinversión.</p></Section>

      <Section title="1. Resumen de datos del Cliente" icon={<UserRound/>}><div className="client-data-grid grid gap-5"><TextInput label="Nombre" value={client.nombre} onChange={v=>update('nombre',v)}/><TextInput label="Teléfono" value={client.telefono} onChange={v=>update('telefono',v)}/><TextInput label="Email" value={client.email} onChange={v=>update('email',v)}/><NumberInput label="Edad" value={client.edad} onChange={v=>update('edad',v)}/><NumberInput label="Años cotizados" value={client.anosCotizados} onChange={v=>update('anosCotizados',v)}/><NumberInput label="Base cotización" value={client.baseCotizacion} onChange={v=>update('baseCotizacion',v)}/><SelectInput label="Estado civil" value={client.estadoCivil} options={['Soltero/a','Casado/a','Divorciado/a','Pareja de Hecho','Viudo/a']} onChange={v=>update('estadoCivil',v as CivilStatus)}/><NumberInput label="Nº hijos menores de 25" value={client.numeroHijos} onChange={v=>update('numeroHijos',v)}/><NumberInput label="Salario neto mensual" value={client.salarioNetoMensual} onChange={v=>update('salarioNetoMensual',v)}/><NumberInput label="Gastos mensuales" value={client.gastosMensuales} onChange={v=>update('gastosMensuales',v)}/><NumberInput label="Hipoteca y préstamos" value={client.alquilerHipotecaPrestamos} onChange={v=>update('alquilerHipotecaPrestamos',v)}/><NumberInput label="Dinero en banco" value={client.dineroBanco} onChange={v=>update('dineroBanco',v)}/><NumberInput label="Dinero invertido" value={client.dineroInvertido} onChange={v=>update('dineroInvertido',v)}/><NumberInput label="Rentabilidad inversión (%)" value={client.rentabilidadInversion} onChange={v=>update('rentabilidadInversion',v)}/><NumberInput label="Ahorro sistemático mensual" value={client.ahorroSistematico} onChange={v=>update('ahorroSistematico',v)}/><NumberInput label="Rentabilidad ahorro (%)" value={client.rentabilidadAhorro} onChange={v=>update('rentabilidadAhorro',v)}/><NumberInput label="Inversiones inmobiliarias" value={client.inversionesInmobiliarias} onChange={v=>update('inversionesInmobiliarias',v)}/><NumberInput label="Rentas inmobiliarias" value={client.rentasInmobiliarias} onChange={v=>update('rentasInmobiliarias',v)}/></div></Section>

      <Section title="Objetivos a medio y largo plazo" icon={<Target/>}>
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_220px_130px]">
          <TextInput label="Proyecto" value={draft.name} onChange={v=>setDraft({...draft,name:v})}/>
          <NumberInput label="Importe" value={draft.target} onChange={v=>setDraft({...draft,target:v})}/>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Plazo: {draft.years} años</span>
            <input className="w-full accent-[#C5A566]" type="range" min="1" max="20" value={draft.years} onChange={e=>setDraft({...draft,years:Number(e.target.value)})}/>
          </label>
          <button className="self-end rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-black text-white" onClick={addProject}>Añadir</button>
        </div>

        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-12 gap-x-4 bg-slate-100 px-4 py-3 text-xs font-black uppercase text-slate-500">
              <span className="col-span-4">Proyecto</span>
              <span className="col-span-2">Importe</span>
              <span className="col-span-1">Años</span>
              <span className="col-span-2">Ahorro/mes</span>
              <span className="col-span-2">Estado</span>
              <span className="col-span-1 text-right">Eliminar</span>
            </div>
            {data.projectRows.map(row=>
              <div key={row.id} className="grid grid-cols-12 gap-x-4 items-center border-t border-slate-100 px-4 py-3 text-sm">
                <label className="col-span-4">
                  <span className="sr-only">Editar proyecto</span>
                  <input className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-bold text-slate-900 outline-none transition focus:border-[#C5A566] focus:ring-2 focus:ring-[#C5A566]/20" value={row.name} onChange={e=>updateProject(row.id, 'name', e.target.value)}/>
                </label>
                <label className="col-span-2">
                  <span className="sr-only">Editar importe</span>
                  <input className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#C5A566] focus:ring-2 focus:ring-[#C5A566]/20" type="number" min="0" value={row.target} onChange={e=>updateProject(row.id, 'target', Math.max(0, Number(e.target.value)))}/>
                </label>
                <label className="col-span-1">
                  <span className="sr-only">Editar años</span>
                  <input className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-[#C5A566] focus:ring-2 focus:ring-[#C5A566]/20" type="number" min="1" max="20" value={row.years} onChange={e=>updateProject(row.id, 'years', clamp(Number(e.target.value), 1, 20))}/>
                </label>
                <span className="col-span-2 font-bold">{eurMonth(row.monthly)}</span>
                <span className="col-span-2"><Badge text={row.status} tone={row.status==='Viable'?'green':row.status==='Ajustado'?'orange':'red'}/></span>
                <div className="col-span-1 flex justify-end">
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" onClick={()=>deleteProject(row.id)} title="Eliminar proyecto" aria-label={`Eliminar ${row.name}`}>
                    <Trash2 className="h-4 w-4"/>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4"><Metric label="Capacidad real" value={eurMonth(data.capacity)}/><Metric label="Capacidad prudente" value={eurMonth(data.capacityPrudent)}/><Metric label="Necesidad objetivos" value={eurMonth(data.totalProjectNeed)}/><Metric label="Viabilidad global" value={data.globalProjectStatus}/></div>
      </Section>

      <Section title="Cuestionario completo de auditoría" icon={<FileText/>}><div className="grid gap-4 md:grid-cols-2">{questionList.map(q=><label key={q.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-black uppercase text-[#C5A566]">{q.label}</span><span className="mt-1 block text-sm font-black text-slate-950">{q.title}</span><span className="mt-2 block text-xs leading-5 text-slate-600">{q.why}</span><select className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={answers[q.key]} onChange={e=>setAnswers({...answers,[q.key]:e.target.value as Answer})}>{q.options.map(option=><option key={option} value={option}>{option}</option>)}</select></label>)}</div></Section>

      <Section title="2. Auditoría de Previsión Social" icon={<Shield/>}><div className="grid gap-4 lg:grid-cols-3">{data.benefits.map(b=><article key={b.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{b.label}</p><p className="mt-1 text-xs text-[#C5A566]">{b.rate}</p><p className="mt-2 text-2xl font-black">{eurMonth(b.value)}</p><p className={`mt-2 text-sm font-bold ${b.gap>0?'text-red-600':'text-emerald-600'}`}>{b.gap>0?`Brecha ${eurMonth(b.gap)}`:'Cubierto'}</p>{b.note ? <p className="mt-3 text-xs leading-5 text-slate-600">{b.note}</p> : null}</article>)}</div><ChartFrame><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.benefits.map(b=>({name:b.label, Prestación:Math.round(b.value), Gastos:Math.round(data.totalExpenses)}))}><CartesianGrid stroke="#E2E8F0"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tickFormatter={v=>eur(Number(v))} width={86}/><Tooltip formatter={v=>eur(Number(v))}/><Legend/><Bar dataKey="Prestación" fill={GOLD}/><Line dataKey="Gastos" stroke={RED} strokeWidth={3}/></ComposedChart></ResponsiveContainer></ChartFrame></Section>

      <Section title="3. Estudio brecha de jubilación" icon={<LineChartIcon/>}><div className="grid gap-3 md:grid-cols-4"><Metric label="Pensión estimada" value={eurMonth(data.pension)}/><Metric label="Brecha mensual" value={eurMonth(data.retirementGap)}/><Metric label="Capital requerido" value={eur(data.targetCapital)}/><Metric label="Ahorro recomendado" value={eurMonth(data.recommendedSaving)}/></div><p className="mt-5 text-sm leading-7 text-slate-600">El capital objetivo suma la brecha mensual ordinaria hasta los 90 años y la cuota de hipoteca/préstamos hasta los 75 años. Las rentas inmobiliarias reducen la brecha mensual; las inversiones inmobiliarias se incorporan a la proyección a los 67.</p><ChartFrame><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.projection}><CartesianGrid stroke="#E2E8F0"/><XAxis dataKey="edad"/><YAxis tickFormatter={v=>eur(Number(v))} width={90}/><Tooltip formatter={v=>eur(Number(v))}/><Legend/><Area dataKey="patrimonio" name="Patrimonio proyectado" stroke={GOLD} fill={GOLD} fillOpacity={0.22}/><Area dataKey="ahorro" name="Ahorro acumulado" stroke={BLUE} fill={BLUE} fillOpacity={0.12}/><Line dataKey="objetivo" name="Capital objetivo" stroke={RED} strokeDasharray="6 6" dot={false}/></AreaChart></ResponsiveContainer></ChartFrame><div className="mt-4 grid gap-3 md:grid-cols-5"><Metric label="Banco" value={eur(client.dineroBanco)}/><Metric label="Invertido proyectado" value={eur(data.projectedInvested)}/><Metric label="Ahorro acumulado" value={eur(data.projectedSaving)}/><Metric label="Rentas acumuladas" value={eur(data.projectedRents)}/><Metric label="Inmuebles" value={eur(client.inversionesInmobiliarias)}/></div></Section>

      <Section title="4. Niveles de Seguridad y Vulnerabilidad" icon={<AlertTriangle/>}><div className="grid gap-8 xl:grid-cols-[460px_1fr]"><ChartFrame className="security-radar-frame mt-0 h-[28rem]"><div className="security-radar-canvas"><ResponsiveContainer width="100%" height="100%"><RadarChart data={securityChartData} cx="50%" cy="52%" outerRadius="68%"><PolarGrid stroke="#CBD5E1"/><PolarAngleAxis dataKey="subject" tick={{fontSize:11,fill:'#334155',fontWeight:700}}/><PolarRadiusAxis angle={90} domain={[0,100]} tick={{fontSize:9,fill:'#94A3B8'}} tickCount={6}/><Radar dataKey="score" name="Seguridad" stroke={GOLD} fill={GOLD} fillOpacity={0.32}/><Tooltip formatter={v=>`${v}%`}/></RadarChart></ResponsiveContainer></div></ChartFrame><div className="space-y-4">{data.risks.map(r=><div key={r.area}><RiskMini risk={r}/></div>)}</div></div></Section>

      <Section title="5. Diagnóstico estratégico y plan de acción" icon={<CheckCircle2/>}><div className="grid gap-4 lg:grid-cols-2">{data.risks.map((r,i)=><article key={r.area} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{i+1}. {r.area}</h3><Badge text={r.level} tone={r.level==='grave'?'red':r.level==='moderada'?'orange':'green'}/></div><p className="mt-3 text-sm text-slate-600"><strong>Impacto:</strong> {r.impact}</p><p className="mt-2 text-sm text-slate-600"><strong>Plan:</strong> {r.recommendation}</p><p className="mt-2 text-xs font-black uppercase text-[#C5A566]">Prioridad: {r.priority}</p></article>)}</div></Section>

      <Section title="6. Resumen ejecutivo" icon={<FileText/>}><div className="space-y-4 text-sm leading-7 text-slate-700"><p><strong>Situación actual.</strong> La auditoría muestra una seguridad global de {data.globalScore}/10, con ingresos de {eurMonth(client.salarioNetoMensual)}, rentas inmobiliarias de {eurMonth(client.rentasInmobiliarias)}, gastos requeridos de {eurMonth(data.totalExpenses)} y capacidad real de ahorro de {eurMonth(data.capacity)}.</p><p><strong>Previsión social.</strong> Las prestaciones públicas dejan brechas que deben contrastarse con la realidad familiar, especialmente en protección de ingresos, invalidez profesional y protección familiar.</p><p><strong>Jubilación.</strong> La pensión estimada es de {eurMonth(data.pension)}, la brecha ajustada es de {eurMonth(data.retirementGap)} y el capital total previsor requerido asciende a {eur(data.targetCapital)}.</p><p><strong>Plan recomendado.</strong> Resolver primero las áreas graves, construir reserva, proteger vivienda e ingresos, y después optimizar inversión, ahorro sistemático y planificación patrimonial.</p></div><button onClick={()=>generatePdf(client, answers, projects, data)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A1A1A] px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-[#C5A566]"><Download className="h-5 w-5"/> Descargar informe PDF premium</button></Section>
    </main>
    <footer className="mt-10 bg-[#1A1A1A] px-6 py-10 text-white"><div className="mx-auto flex max-w-7xl justify-between gap-6"><div className="flex items-center gap-4"><Logo className="h-12 w-10"/><div><p className="font-black">JOSÉ CARLOS HIDALGO</p><p className="text-sm text-white/60">Consultor financiero, hipotecario y patrimonial</p></div></div><div className="text-right text-sm text-white/70"><p>josecarlos@hilolegal.es</p><p>647 50 60 40</p></div></div></footer>
  </div>;
}

function Logo({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 120 140" fill="none"><rect x="7" y="8" width="18" height="124" fill="#fff"/><rect x="95" y="8" width="18" height="124" fill="#fff"/><rect x="52" y="8" width="16" height="48" fill="#fff"/><rect x="52" y="86" width="16" height="46" fill="#fff"/><circle cx="60" cy="70" r="27" fill={GOLD}/></svg>; }
function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <section className="mt-7 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="mb-6 flex items-start gap-4 text-slate-950"><span className="pt-0.5 text-[#C5A566] [&_svg]:h-6 [&_svg]:w-6">{icon}</span><h2 className="text-xl font-black leading-tight md:text-2xl">{title}</h2></div><div className="section-content md:pl-10">{children}</div></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-5"><p className="text-xs font-black uppercase leading-5 text-slate-500">{label}</p><p className="metric-value mt-2 text-base font-black leading-tight text-slate-950 md:text-lg">{value}</p></div>; }
function ChartFrame({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`chart-frame mt-6 h-80 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-5 ${className}`}>{children}</div>; }
function Badge({ text, tone }: { text: string; tone: 'green'|'orange'|'red' }) { const cls = tone === 'green' ? 'bg-emerald-600' : tone === 'orange' ? 'bg-orange-500' : 'bg-red-600'; return <span className={`rounded px-2 py-1 text-xs font-black uppercase text-white ${cls}`}>{text}</span>; }
function RiskMini({ risk }: { risk: Risk }) { return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black">{risk.area}</p><Badge text={`${risk.score}/10`} tone={risk.level==='grave'?'red':risk.level==='moderada'?'orange':'green'}/></div>{risk.reason ? <p className="mt-2 text-xs leading-5 text-slate-500">{risk.reason}</p> : null}<p className="mt-2 text-xs leading-5 text-slate-700">{risk.recommendation}</p></div>; }
function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={value} onChange={e=>onChange(e.target.value)}/></label>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" type="number" value={value} onChange={e=>onChange(Number(e.target.value))}/></label>; }
function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span><select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select></label>; }
