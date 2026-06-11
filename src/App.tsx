import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Phone,
  Shield,
  TrendingUp,
  UserRound
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { jsPDF } from "jspdf";
import { ClientData, PrestacionesCalculadas } from "./types";

type Severity = "grave" | "moderada" | "leve";

const brand = {
  black: "#1A1A1A",
  gold: "#C5A566",
  goldDark: "#A8833F",
  slate: "#111827",
  muted: "#64748B",
  line: "#E5E7EB",
  soft: "#F8FAFC",
  red: "#DC2626",
  orange: "#EA580C",
  green: "#16A34A"
};

const logoSvg = encodeURIComponent(`
<svg width="120" height="140" viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="7" y="8" width="18" height="124" fill="#fff"/>
  <rect x="95" y="8" width="18" height="124" fill="#fff"/>
  <rect x="52" y="8" width="16" height="48" fill="#fff"/>
  <rect x="52" y="86" width="16" height="46" fill="#fff"/>
  <circle cx="60" cy="70" r="27" fill="#C5A566"/>
  <rect x="0" y="8" width="9" height="14" fill="#fff"/>
  <rect x="0" y="118" width="9" height="14" fill="#fff"/>
  <rect x="111" y="8" width="9" height="14" fill="#fff"/>
  <rect x="111" y="118" width="9" height="14" fill="#fff"/>
</svg>`);

const brandLogo = `data:image/svg+xml;charset=utf-8,${logoSvg}`;

const defaultClientData: ClientData = {
  nombre: "Carlos Gomez",
  telefono: "600 000 000",
  email: "cliente@email.com",
  edad: 38,
  anosCotizados: 12,
  baseCotizacion: 2800,
  estadoCivil: "Casado/a",
  numeroHijos: 2,
  salarioNetoMensual: 2400,
  gastosMensuales: 1200,
  alquilerHipotecaPrestamos: 750,
  dineroBanco: 9000,
  dineroInvertido: 4000,
  rentabilidadInversion: 5,
  ahorroSistematico: 150,
  rentabilidadAhorro: 6,
  preguntas: {
    p01: "No",
    p02: "No",
    p03: "No",
    p04: "Si",
    p05: "No",
    p06: "No",
    p07: "No",
    p08: "No"
  },
  proyectosMedioPlazo: "Comprar un coche familiar en 3 anos (18.000 EUR)",
  objetivosLargoPlazo: "Crear un fondo de jubilacion privado para compensar la pension publica."
};

const formatEUR = (value: number) =>
  `${Math.round(value).toLocaleString("es-ES")} EUR`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function App() {
  const [formData, setFormData] = useState<ClientData>(defaultClientData);
  const [prestaciones, setPrestaciones] = useState<PrestacionesCalculadas>({
    it: 0,
    ipa: 0,
    ipt: 0,
    viudedad: 0,
    orfandad: 0,
    jubilacion: 0
  });

  const gastosTotalesMensuales =
    Number(formData.gastosMensuales) + Number(formData.alquilerHipotecaPrestamos);

  const capacidadAhorroMensual =
    Number(formData.salarioNetoMensual) - gastosTotalesMensuales;

  const calculateBenefits = (data: ClientData): PrestacionesCalculadas => {
    const base = Number(data.baseCotizacion);
    const married = data.estadoCivil === "Casado/a" || data.estadoCivil === "Pareja de Hecho";
    const yearsToRetirement = Math.max(0, 67 - Number(data.edad));
    const estimatedContributionYears = Number(data.anosCotizados) + yearsToRetirement;
    const retirementRate =
      estimatedContributionYears < 15
        ? 0
        : estimatedContributionYears >= 36.5
          ? 1
          : 0.5 + (estimatedContributionYears - 15) * (0.5 / 21.5);

    return {
      it: base * 0.75,
      ipa: base,
      ipt: Number(data.edad) >= 55 ? base * 0.75 : base * 0.55,
      viudedad: married ? base * 0.52 : 0,
      orfandad: base * 0.2 * Number(data.numeroHijos),
      jubilacion: base * retirementRate
    };
  };

  useEffect(() => {
    setPrestaciones(calculateBenefits(formData));
  }, [formData]);

  const deficits = {
    it: gastosTotalesMensuales - prestaciones.it,
    ipa: gastosTotalesMensuales - prestaciones.ipa,
    ipt: gastosTotalesMensuales - prestaciones.ipt,
    viudedad: gastosTotalesMensuales - prestaciones.viudedad,
    orfandad: gastosTotalesMensuales - prestaciones.orfandad,
    jubilacion: gastosTotalesMensuales - prestaciones.jubilacion
  };

  const yearsToRetirement = Math.max(0, 67 - Number(formData.edad));
  const retirementYears = 23;
  const retirementGap = Math.max(0, deficits.jubilacion);
  const targetCapital = retirementGap * 12 * retirementYears;
  const emergencyMonths = gastosTotalesMensuales > 0 ? Number(formData.dineroBanco) / gastosTotalesMensuales : 0;

  const scores = {
    fondo: clamp(Math.round(emergencyMonths * 1.8), 1, 10),
    baja: formData.preguntas.p01 === "Si" ? 10 : formData.preguntas.p01 === "Parcialmente" ? 6 : 2,
    familia: formData.preguntas.p02 === "Si" ? 10 : 3,
    sanitario: formData.preguntas.p03 === "Si" ? 10 : 3,
    inflacion: formData.preguntas.p06 === "Si" ? 10 : Number(formData.dineroBanco) > 6000 ? 2 : 5,
    legal:
      (formData.preguntas.p07 === "Si" ? 5 : 1) +
      (formData.preguntas.p08 === "Si" ? 5 : 1)
  };

  const globalScore = Math.round(
    (scores.fondo + scores.baja + scores.familia + scores.sanitario + scores.inflacion + scores.legal) / 6
  );

  const projectionData = useMemo(() => {
    const investmentRate = Number(formData.rentabilidadInversion ?? 5) / 100;
    const savingRate = Number(formData.rentabilidadAhorro ?? 6) / 100;
    const annualSaving = Number(formData.ahorroSistematico ?? 0) * 12;
    const years = Math.max(15, yearsToRetirement);

    return Array.from({ length: years + 1 }, (_, year) => {
      const age = Number(formData.edad) + year;
      const investment = Number(formData.dineroInvertido) * Math.pow(1 + investmentRate, year);
      const saving =
        savingRate > 0
          ? annualSaving * ((Math.pow(1 + savingRate, year) - 1) / savingRate)
          : annualSaving * year;
      const total = Number(formData.dineroBanco) + investment + saving;

      return {
        edad: age,
        "Patrimonio Total": Math.round(total),
        "Plan de Ahorro": Math.round(saving),
        "Capital Objetivo": Math.round(targetCapital)
      };
    });
  }, [formData, targetCapital, yearsToRetirement]);

  const projectedAtRetirement =
    projectionData[Math.min(yearsToRetirement, projectionData.length - 1)]?.["Patrimonio Total"] ?? 0;

  const diagnostics = useMemo(() => {
    const severity = (value: number, warning = 0): Severity =>
      value > 600 || warning <= 3 ? "grave" : value > 0 || warning <= 6 ? "moderada" : "leve";

    return [
      {
        area: "Baja laboral e incapacidad temporal",
        severity: severity(deficits.it),
        issue:
          deficits.it > 0
            ? `Brecha mensual de ${formatEUR(deficits.it)} entre prestación pública y gasto familiar.`
            : "La prestación estimada cubre el gasto mensual declarado.",
        action: "Revisar o contratar subsidio privado por baja laboral para cubrir el diferencial mensual real."
      },
      {
        area: "Invalidez y protección profesional",
        severity: severity(deficits.ipt),
        issue:
          deficits.ipt > 0
            ? `La invalidez profesional dejaría un déficit mensual de ${formatEUR(deficits.ipt)}.`
            : "La invalidez profesional no muestra déficit frente al gasto actual.",
        action: "Ajustar capitales de invalidez y amortización de deuda para proteger vivienda, préstamos e ingresos."
      },
      {
        area: "Protección familiar",
        severity: severity(Math.max(deficits.viudedad, deficits.orfandad, 0)),
        issue:
          Math.max(deficits.viudedad, deficits.orfandad) > 0
            ? `La familia presenta una brecha potencial de hasta ${formatEUR(Math.max(deficits.viudedad, deficits.orfandad, 0))} al mes.`
            : "La cobertura familiar estimada no presenta brecha mensual relevante.",
        action: "Definir capital de vida temporal para vivienda, educación, impuestos y transición de ingresos."
      },
      {
        area: "Fondo de emergencia y liquidez",
        severity: severity(0, scores.fondo),
        issue: `La reserva líquida cubre aproximadamente ${emergencyMonths.toFixed(1)} meses de gastos.`,
        action: "Construir una reserva líquida de 6 a 9 meses y separarla del capital de inversión."
      },
      {
        area: "Jubilación e inflación",
        severity: severity(deficits.jubilacion, scores.inflacion),
        issue:
          retirementGap > 0
            ? `La jubilación proyectada deja una brecha mensual de ${formatEUR(retirementGap)}.`
            : "La pensión estimada cubre el gasto mensual declarado.",
        action: "Aumentar ahorro sistemático, diversificar capital improductivo y revisar rentabilidad neta después de impuestos."
      },
      {
        area: "Protección legal",
        severity: severity(0, scores.legal),
        issue:
          scores.legal < 8
            ? "Falta reforzar testamento, inventario patrimonial o protocolo de acceso familiar."
            : "La protección legal declarada es adecuada.",
        action: "Formalizar testamento, inventario patrimonial y acceso familiar a documentación crítica."
      }
    ];
  }, [deficits, emergencyMonths, retirementGap, scores]);

  const updateField = <K extends keyof ClientData>(field: K, value: ClientData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const updateQuestion = (field: keyof ClientData["preguntas"], value: string) => {
    setFormData((current) => ({
      ...current,
      preguntas: { ...current.preguntas, [field]: value }
    }));
  };

  const drawPdfLogo = (doc: jsPDF, x: number, y: number, scale = 1) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, 2.8 * scale, 18 * scale, "F");
    doc.rect(x + 17 * scale, y, 2.8 * scale, 18 * scale, "F");
    doc.rect(x + 8.6 * scale, y, 2.4 * scale, 7 * scale, "F");
    doc.rect(x + 8.6 * scale, y + 11 * scale, 2.4 * scale, 7 * scale, "F");
    doc.setFillColor(197, 165, 102);
    doc.circle(x + 9.8 * scale, y + 9 * scale, 4.5 * scale, "F");
  };

  const drawHeader = (doc: jsPDF, title: string) => {
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, 210, 34, "F");
    drawPdfLogo(doc, 14, 7, 1.1);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(197, 165, 102);
    doc.text(title, 42, 13);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(255, 255, 255);
    doc.text("Email: josecarlos@hilolegal.es | Teléfono: 647 50 60 40", 42, 21);
    doc.setTextColor(150, 150, 150);
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES")}`, 42, 28);
  };

  const drawFooter = (doc: jsPDF, page: number) => {
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("Informe diagnóstico orientativo. Requiere validación personalizada antes de contratar productos financieros o aseguradores.", 14, 283);
    doc.text(`Página ${page}`, 196, 283, { align: "right" });
  };

  const downloadPDFReport = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let page = 1;

    const newPage = (title: string) => {
      if (page > 1) doc.addPage();
      drawHeader(doc, title);
    };

    newPage("AUDITORÍA DE PREVISIÓN SOCIAL");
    doc.setTextColor(17, 24, 39);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.text("1. Resumen de Datos del Cliente", 14, 48);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    [
      `Nombre: ${formData.nombre}`,
      `Teléfono: ${formData.telefono || "No indicado"}`,
      `Email: ${formData.email || "No indicado"}`,
      `Edad: ${formData.edad} años | Cotizados: ${formData.anosCotizados} años`,
      `Estado civil: ${formData.estadoCivil} | Hijos: ${formData.numeroHijos}`,
      `Ingresos netos: ${formatEUR(formData.salarioNetoMensual)} / mes`,
      `Gastos totales: ${formatEUR(gastosTotalesMensuales)} / mes`
    ].forEach((line, index) => doc.text(line, 18, 60 + index * 6));

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.text("2. Auditoría de Previsión Social", 14, 112);
    const rows = [
      ["Baja laboral", prestaciones.it, deficits.it],
      ["Invalidez absoluta", prestaciones.ipa, deficits.ipa],
      ["Invalidez profesional", prestaciones.ipt, deficits.ipt],
      ["Viudedad", prestaciones.viudedad, deficits.viudedad],
      ["Orfandad", prestaciones.orfandad, deficits.orfandad],
      ["Jubilación estimada", prestaciones.jubilacion, deficits.jubilacion]
    ];
    doc.setFontSize(8);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 120, 182, 8, "F");
    doc.text("Prestación", 18, 125);
    doc.text("Estimación", 88, 125);
    doc.text("Gasto", 125, 125);
    doc.text("Resultado", 160, 125);
    rows.forEach(([label, benefit, gap], index) => {
      const y = 135 + index * 8;
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      doc.text(String(label), 18, y);
      doc.text(formatEUR(Number(benefit)), 88, y);
      doc.text(formatEUR(gastosTotalesMensuales), 125, y);
      doc.setTextColor(Number(gap) > 0 ? 220 : 22, Number(gap) > 0 ? 38 : 163, Number(gap) > 0 ? 38 : 74);
      doc.text(Number(gap) > 0 ? `Brecha ${formatEUR(Number(gap))}` : "Cubierto", 160, y);
    });
    drawFooter(doc, page++);

    newPage("ESTUDIO BRECHA DE JUBILACIÓN");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text("3. Estudio brecha de jubilación", 14, 48);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    const retirementText = doc.splitTextToSize(
      `La brecha de jubilación compara el gasto mensual declarado (${formatEUR(gastosTotalesMensuales)}) con la pensión pública estimada (${formatEUR(prestaciones.jubilacion)}). Si existe diferencia, se calcula el capital necesario para sostener el nivel de vida desde los 67 hasta los 90 años. El capital objetivo actual es ${formatEUR(targetCapital)} y el patrimonio proyectado a la jubilación es ${formatEUR(projectedAtRetirement)}.`,
      178
    );
    doc.text(retirementText, 14, 58);
    const chartX = 20;
    const chartY = 105;
    const chartW = 165;
    const chartH = 70;
    const maxValue = Math.max(targetCapital, ...projectionData.map((d) => d["Patrimonio Total"]), 1);
    doc.setDrawColor(229, 231, 235);
    doc.rect(chartX, chartY, chartW, chartH, "D");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("Gráfico: Estudio brecha de jubilación", chartX, chartY - 5);
    const point = (value: number, index: number) => ({
      x: chartX + (index / Math.max(1, projectionData.length - 1)) * chartW,
      y: chartY + chartH - (value / maxValue) * chartH
    });
    doc.setDrawColor(197, 165, 102);
    doc.setLineWidth(0.7);
    projectionData.forEach((d, index) => {
      if (index === 0) return;
      const prev = point(projectionData[index - 1]["Patrimonio Total"], index - 1);
      const next = point(d["Patrimonio Total"], index);
      doc.line(prev.x, prev.y, next.x, next.y);
    });
    doc.setDrawColor(59, 130, 246);
    projectionData.forEach((d, index) => {
      if (index === 0) return;
      const prev = point(projectionData[index - 1]["Plan de Ahorro"], index - 1);
      const next = point(d["Plan de Ahorro"], index);
      doc.line(prev.x, prev.y, next.x, next.y);
    });
    doc.setDrawColor(220, 38, 38);
    doc.setLineDashPattern([2, 2], 0);
    const targetY = point(targetCapital, 0).y;
    doc.line(chartX, targetY, chartX + chartW, targetY);
    doc.setLineDashPattern([], 0);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Ocre: patrimonio total | Azul: plan de ahorro | Rojo: capital objetivo", chartX, chartY + chartH + 8);
    drawFooter(doc, page++);

    newPage("NIVELES DE SEGURIDAD Y VULNERABILIDAD");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text("4. Niveles de Seguridad y Vulnerabilidad", 14, 48);
    const scoreRows = [
      ["Fondo de emergencia", scores.fondo],
      ["Protección por baja laboral", scores.baja],
      ["Protección familiar", scores.familia],
      ["Acceso sanitario", scores.sanitario],
      ["Inflación e inversión", scores.inflacion],
      ["Protección legal", scores.legal]
    ];
    scoreRows.forEach(([label, score], index) => {
      const y = 64 + index * 20;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(31, 41, 55);
      doc.text(`${label}: ${score}/10`, 18, y);
      doc.setFillColor(229, 231, 235);
      doc.rect(18, y + 4, 150, 5, "F");
      doc.setFillColor(Number(score) <= 3 ? 220 : Number(score) <= 6 ? 234 : 22, Number(score) <= 3 ? 38 : Number(score) <= 6 ? 88 : 163, Number(score) <= 3 ? 38 : Number(score) <= 6 ? 12 : 74);
      doc.rect(18, y + 4, Number(score) * 15, 5, "F");
    });
    drawFooter(doc, page++);

    newPage("DIAGNÓSTICO ESTRATÉGICO Y PLAN DE ACCIÓN");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text("5. Diagnóstico estratégico y plan de acción", 14, 48);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      doc.splitTextToSize(
        `Resumen integral de la auditoría: la seguridad global es ${globalScore}/10. Las deficiencias se clasifican por gravedad para priorizar las medidas de protección.`,
        178
      ),
      14,
      60
    );
    let y = 82;
    diagnostics.forEach((item, index) => {
      if (y > 245) {
        drawFooter(doc, page++);
        doc.addPage();
        drawHeader(doc, "DIAGNÓSTICO ESTRATÉGICO Y PLAN DE ACCIÓN");
        y = 48;
      }
      const color = item.severity === "grave" ? brand.red : item.severity === "moderada" ? brand.orange : brand.green;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(color);
      doc.text(`${index + 1}. ${item.area} - ${item.severity.toUpperCase()}`, 14, y);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(`Deficiencia: ${item.issue}`, 178), 18, y + 6);
      doc.text(doc.splitTextToSize(`Plan de acción: ${item.action}`, 178), 18, y + 17);
      y += 34;
    });
    drawFooter(doc, page++);

    doc.addPage();
    drawHeader(doc, "RESUMEN EJECUTIVO");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text("6. Resumen ejecutivo", 14, 48);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    const summary = [
      `Cliente: ${formData.nombre}.`,
      `Seguridad global: ${globalScore}/10.`,
      `Brecha mensual de jubilación: ${formatEUR(retirementGap)}.`,
      `Capital objetivo para cubrir retiro hasta los 90 años: ${formatEUR(targetCapital)}.`,
      `Patrimonio proyectado a los 67 años: ${formatEUR(projectedAtRetirement)}.`,
      `Medida prioritaria: ${diagnostics.find((item) => item.severity === "grave")?.action ?? diagnostics[0].action}`
    ];
    doc.text(doc.splitTextToSize(summary.join(" "), 178), 14, 60);
    drawFooter(doc, page);
    doc.save(`auditoria-prevision-social-${formData.nombre.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const severityClass = (severity: Severity) =>
    severity === "grave"
      ? "border-red-200 bg-red-50 text-red-700"
      : severity === "moderada"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 bg-[#1A1A1A] text-white border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src={brandLogo} alt="Logo Hilo Legal" className="h-16 w-14 object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C5A566]">Auditoría patrimonial</p>
              <h1 className="text-lg font-black text-white sm:text-2xl">Previsión social y brecha de jubilación</h1>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-white/80 sm:items-end">
            <a className="flex items-center gap-2 hover:text-[#C5A566]" href="mailto:josecarlos@hilolegal.es">
              <Mail className="h-4 w-4" /> josecarlos@hilolegal.es
            </a>
            <a className="flex items-center gap-2 hover:text-[#C5A566]" href="tel:647506040">
              <Phone className="h-4 w-4" /> 647 50 60 40
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <UserRound className="h-6 w-6 text-[#C5A566]" />
            <h2 className="text-xl font-black">1. Resumen de datos del Cliente</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input label="Nombre" value={formData.nombre} onChange={(value) => updateField("nombre", value)} />
            <Input label="Teléfono" value={formData.telefono} onChange={(value) => updateField("telefono", value)} />
            <Input label="Email" value={formData.email} onChange={(value) => updateField("email", value)} />
            <NumberInput label="Edad" value={formData.edad} onChange={(value) => updateField("edad", value)} />
            <NumberInput label="Años cotizados" value={formData.anosCotizados} onChange={(value) => updateField("anosCotizados", value)} />
            <NumberInput label="Base cotización" value={formData.baseCotizacion} onChange={(value) => updateField("baseCotizacion", value)} />
            <NumberInput label="Salario neto mensual" value={formData.salarioNetoMensual} onChange={(value) => updateField("salarioNetoMensual", value)} />
            <NumberInput label="Gastos mensuales" value={formData.gastosMensuales} onChange={(value) => updateField("gastosMensuales", value)} />
            <NumberInput label="Alquiler, hipoteca y préstamos" value={formData.alquilerHipotecaPrestamos} onChange={(value) => updateField("alquilerHipotecaPrestamos", value)} />
            <NumberInput label="Dinero en banco" value={formData.dineroBanco} onChange={(value) => updateField("dineroBanco", value)} />
            <NumberInput label="Dinero invertido" value={formData.dineroInvertido} onChange={(value) => updateField("dineroInvertido", value)} />
            <NumberInput label="Ahorro sistemático mensual" value={formData.ahorroSistematico ?? 0} onChange={(value) => updateField("ahorroSistematico", value)} />
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <Shield className="h-6 w-6 text-[#C5A566]" />
            <h2 className="text-xl font-black">2. Auditoría de Previsión Social</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              ["Baja laboral", prestaciones.it, deficits.it],
              ["Invalidez absoluta", prestaciones.ipa, deficits.ipa],
              ["Invalidez profesional", prestaciones.ipt, deficits.ipt],
              ["Viudedad", prestaciones.viudedad, deficits.viudedad],
              ["Orfandad", prestaciones.orfandad, deficits.orfandad],
              ["Jubilación", prestaciones.jubilacion, deficits.jubilacion]
            ].map(([label, benefit, gap]) => {
              const cardKey = String(label);
              return (
                <div key={cardKey}>
                  <ResultCard label={cardKey} benefit={Number(benefit)} gap={Number(gap)} />
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-lg bg-[#1A1A1A] p-5 text-white shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-[#C5A566]" />
            <div>
              <h2 className="text-xl font-black text-[#C5A566]">3. Estudio brecha de jubilación</h2>
              <p className="text-sm text-white/70">
                Simulación de retiro sostenible con capital objetivo, patrimonio proyectado y plan de ahorro acumulado.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DarkMetric label="Brecha mensual" value={formatEUR(retirementGap)} />
            <DarkMetric label="Capital objetivo" value={formatEUR(targetCapital)} />
            <DarkMetric label="Proyección a los 67" value={formatEUR(projectedAtRetirement)} />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-white/75">
            Este estudio compara el gasto actual con la pensión pública estimada y calcula el capital necesario para
            sostener la calidad de vida entre los 67 y los 90 años. El gráfico incluye el plan de ahorro sistemático,
            el patrimonio total proyectado y la línea de capital objetivo.
          </p>
          <div className="mt-6 h-80 rounded-lg border border-white/10 bg-black/25 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" strokeDasharray="3 3" />
                <XAxis dataKey="edad" stroke="#CBD5E1" tickFormatter={(value) => `${value}`} />
                <YAxis stroke="#CBD5E1" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => formatEUR(Number(value))} />
                <Legend />
                <Area dataKey="Patrimonio Total" name="Patrimonio Total Proyectado" stroke={brand.gold} fill={brand.gold} fillOpacity={0.25} />
                <Area dataKey="Plan de Ahorro" name="Plan de Ahorro Acumulado" stroke="#60A5FA" fill="#60A5FA" fillOpacity={0.16} />
                <Line dataKey="Capital Objetivo" name="Línea Capital Objetivo" stroke={brand.red} strokeDasharray="6 6" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-[#C5A566]" />
            <h2 className="text-xl font-black">4. Niveles de Seguridad y Vulnerabilidad</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              ["Fondo de emergencia", scores.fondo],
              ["Protección por baja laboral", scores.baja],
              ["Protección familiar", scores.familia],
              ["Acceso sanitario", scores.sanitario],
              ["Inflación e inversión", scores.inflacion],
              ["Protección legal", scores.legal]
            ].map(([label, score]) => {
              const scoreKey = String(label);
              return (
                <div key={scoreKey}>
                  <ScoreBar label={scoreKey} score={Number(score)} />
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <Question label="Baja laboral privada" value={formData.preguntas.p01} onChange={(value) => updateQuestion("p01", value)} />
            <Question label="Seguro familiar" value={formData.preguntas.p02} onChange={(value) => updateQuestion("p02", value)} />
            <Question label="Sanidad privada" value={formData.preguntas.p03} onChange={(value) => updateQuestion("p03", value)} />
            <Question label="Inversión antiinflación" value={formData.preguntas.p06} onChange={(value) => updateQuestion("p06", value)} />
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-[#C5A566]" />
            <div>
              <h2 className="text-xl font-black">5. Diagnóstico estratégico y plan de acción</h2>
              <p className="text-sm text-slate-500">Deficiencias graves, moderadas y leves según los resultados obtenidos.</p>
            </div>
          </div>
          <p className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            La auditoría refleja una seguridad global de <strong>{globalScore}/10</strong>. El diagnóstico prioriza
            las brechas de ingresos, la reserva de liquidez, la protección familiar, la jubilación y el blindaje legal.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {diagnostics.map((item, index) => (
              <article key={item.area} className={`rounded-lg border p-4 ${severityClass(item.severity)}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-black text-slate-900">{index + 1}. {item.area}</h3>
                  <span className="text-xs font-black uppercase">{item.severity}</span>
                </div>
                <p className="text-sm font-semibold">{item.issue}</p>
                <p className="mt-3 text-sm text-slate-700"><strong>Plan de acción:</strong> {item.action}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <FileText className="h-6 w-6 text-[#C5A566]" />
            <h2 className="text-xl font-black">6. Resumen ejecutivo</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Metric label="Seguridad global" value={`${globalScore}/10`} />
            <Metric label="Ahorro disponible" value={formatEUR(capacidadAhorroMensual)} />
            <Metric label="Medida prioritaria" value={diagnostics.find((item) => item.severity === "grave")?.area ?? "Mantenimiento"} />
          </div>
          <button
            onClick={downloadPDFReport}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#C5A566] px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-[#A8833F]"
          >
            <Download className="h-5 w-5" />
            Descargar informe PDF
          </button>
        </section>
      </main>

      <footer className="mt-10 bg-[#1A1A1A] px-5 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img src={brandLogo} alt="Logo Hilo Legal" className="h-16 w-14 object-contain" />
            <div>
              <p className="text-sm font-black text-white">HILO LEGAL</p>
              <p className="text-xs text-white/60">Gestión patrimonial e hipotecaria</p>
            </div>
          </div>
          <div className="text-sm text-white/75">
            <p>josecarlos@hilolegal.es</p>
            <p>647 50 60 40</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Question({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="Si">Si</option>
        <option value="Parcialmente">Parcialmente</option>
        <option value="No">No</option>
      </select>
    </label>
  );
}

function ResultCard({ label, benefit, gap }: { label: string; benefit: number; gap: number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{formatEUR(benefit)}</p>
      <p className={`mt-2 text-sm font-bold ${gap > 0 ? "text-red-600" : "text-emerald-600"}`}>
        {gap > 0 ? `Brecha ${formatEUR(gap)}` : "Cubierto"}
      </p>
    </article>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score <= 3 ? "bg-red-600" : score <= 6 ? "bg-orange-500" : "bg-emerald-600";
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span>{score}/10</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score * 10}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase text-white/50">{label}</p>
      <p className="mt-2 text-xl font-black text-[#C5A566]">{value}</p>
    </div>
  );
}
