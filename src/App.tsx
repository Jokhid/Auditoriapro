import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PiggyBank,
  FileText,
  Sparkles,
  Calculator,
  Download,
  ArrowRight,
  Plus,
  Trash2,
  HelpCircle,
  Activity,
  Heart,
  Percent,
  Briefcase,
  Calendar,
  Users,
  Menu,
  X,
  Sparkle,
  Lock,
  ArrowLeft,
  ChevronRight
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  ReferenceLine
} from "recharts";
import { jsPDF } from "jspdf";
import { ClientData, PrestacionesCalculadas, AIAnalysisResult, AuditQuestions } from "./types";

// Default seed data for a standard Spanish household
const defaultQuestions: AuditQuestions = {
  p01: "No",
  p02: "No",
  p03: "No",
  p04: "Sí",
  p05: "No",
  p06: "No",
  p07: "No",
  p08: "No"
};

const defaultClientData: ClientData = {
  nombre: "Carlos Gómez",
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
  preguntas: defaultQuestions,
  proyectosMedioPlazo: "Comprar un coche familiar en 3 años (18.000€)",
  objetivosLargoPlazo: "Crear un fondo de jubilación privado para compensar la pensión pública."
};

interface ProyectoItem {
  id: string;
  nombre: string;
  coste: number;
  plazoAnos: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"audit" | "results">("audit");
  const [formData, setFormData] = useState<ClientData>(defaultClientData);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // Custom project items for the planning section
  const [proyectos, setProyectos] = useState<ProyectoItem[]>([
    { id: "1", nombre: "Coche Familiar", coste: 18000, plazoAnos: 3 },
    { id: "2", nombre: "Entrada Vivienda / Reforma", coste: 30000, plazoAnos: 5 }
  ]);
  const [nuevoProyectoNombre, setNuevoProyectoNombre] = useState("");
  const [nuevoProyectoCoste, setNuevoProyectoCoste] = useState(10000);
  const [nuevoProyectoPlazo, setNuevoProyectoPlazo] = useState(4);

  // States to hold calculated benefits and deficits
  const [calcPrestaciones, setCalcPrestaciones] = useState<PrestacionesCalculadas>({
    it: 0, ipa: 0, ipt: 0, viudedad: 0, orfandad: 0, jubilacion: 0
  });

  // Keep track of AI consult results
  const [aiReport, setAiReport] = useState<AIAnalysisResult | null>(null);
  const [isConsultingAI, setIsConsultingAI] = useState(false);

  // Perform social security calculations locally in real-time
  const computeBenefits = (data: ClientData): PrestacionesCalculadas => {
    const B = data.baseCotizacion;
    const hijos = data.numeroHijos;
    const esCasado = data.estadoCivil === "Casado/a" || data.estadoCivil === "Pareja de Hecho";

    // Standard Spanish Social Security Formula Approximations:
    // IT (Baja temporal por enfermedad común avanzada): typically 75% of regulatory scale
    const it = B * 0.75;
    
    // IPA (Invalidez Permanente Absoluta): 100% of regulatory base
    const ipa = B * 1.0;

    // IPT (Invalidez Permanente Total): 55% of regulatory base (elevates to 75% if age >= 55)
    const ipt = data.edad >= 55 ? B * 0.75 : B * 0.55;

    // Viudedad: 52% of regulator base for surviving partner
    const viudedad = esCasado ? B * 0.52 : 0;

    // Orfandad: 20% of base per child (Max 2 children fully covered up to limits unless special situations)
    const orfandad = B * 0.20 * hijos;

    // Pensión Jubilación: basada en los años que le quedan hasta la jubilación (asumiendo 67 años) más los años cotizados
    const anosRestantes = Math.max(0, 67 - data.edad);
    const anosCotizadosEstimados = data.anosCotizados + anosRestantes;

    let porcentajeJubilacion = 0;
    if (anosCotizadosEstimados >= 15) {
      if (anosCotizadosEstimados >= 36.5) {
        porcentajeJubilacion = 1.0;
      } else {
        // En España 15 años da derecho al 50%. A partir de ahí, se escala linealmente hasta el 100% con 36.5 años.
        porcentajeJubilacion = 0.5 + (anosCotizadosEstimados - 15) * (0.5 / 21.5);
      }
    }
    const jubilacion = B * porcentajeJubilacion;

    return { it, ipa, ipt, viudedad, orfandad, jubilacion };
  };

  useEffect(() => {
    setCalcPrestaciones(computeBenefits(formData));
  }, [formData]);

  // Combined monthly expenses (standard bills + debt/rent/mortgage)
  const gastosTotalesMensuales = Number(formData.gastosMensuales) + Number(formData.alquilerHipotecaPrestamos);
  const capacidadAhorroMensual = Number(formData.salarioNetoMensual) - gastosTotalesMensuales;
  const tasaEndeudamiento = Number(formData.salarioNetoMensual) > 0 
    ? (Number(formData.alquilerHipotecaPrestamos) / Number(formData.salarioNetoMensual)) * 100 
    : 0;

  // Deficits Calculations (Expenses confronted with public benefits)
  const deficitIt = gastosTotalesMensuales - calcPrestaciones.it;
  const deficitIpa = gastosTotalesMensuales - calcPrestaciones.ipa;
  const deficitIpt = gastosTotalesMensuales - calcPrestaciones.ipt;
  const deficitViudedad = (formData.estadoCivil === "Casado/a" || formData.estadoCivil === "Pareja de Hecho") 
    ? gastosTotalesMensuales - calcPrestaciones.viudedad 
    : 0;
  const deficitOrfandad = formData.numeroHijos > 0 
    ? (gastosTotalesMensuales - calcPrestaciones.orfandad) 
    : 0;
  const deficitJubilacion = gastosTotalesMensuales - calcPrestaciones.jubilacion;

  // 90-year life expectancy pension and gap calculations
  const anosRestantesHasta67 = Math.max(0, 67 - formData.edad);
  const anosRetiroFinanciar = 23; // From 67 to 90 years is 23 years of retirement
  const brechaMensualJubilacion = Math.max(0, deficitJubilacion);
  const capitalRetiroNecesario = brechaMensualJubilacion * 12 * anosRetiroFinanciar;
  const ahorroMensualJubilacionRecomendado = anosRestantesHasta67 > 0 
    ? (capitalRetiroNecesario / (anosRestantesHasta67 * 12)) 
    : 0;

  // Scores calculations from 1 to 10 for vulnerability thermometers
  const mesesFondoEmergencia = gastosTotalesMensuales > 0 
    ? Number(formData.dineroBanco) / gastosTotalesMensuales 
    : 0;
  
  const scoreFondoEmergencia = Math.min(10, Math.max(1, Math.round(mesesFondoEmergencia * 1.8)));
  
  const scoreBajaLaboral = formData.preguntas.p01 === "Sí" ? 10 
    : formData.preguntas.p01 === "Parcialmente" ? 6 
    : formData.preguntas.p01 === "No" ? 2 : 4;

  const scoreViudedadOrfandad = (formData.preguntas.p02 === "Sí") ? 10 : 3;

  const scoreAccesoSanitario = formData.preguntas.p03 === "Sí" ? 10 : 3;

  const scoreEnemigoInflacion = formData.preguntas.p06 === "Sí" ? 10 
    : formData.preguntas.p06 === "No" && Number(formData.dineroBanco) > 6000 ? 2 : 5;

  const scoreProteccionLegal = 
    (formData.preguntas.p07 === "Sí" ? 5 : 1) + 
    (formData.preguntas.p08 === "Sí" ? 5 : 1);

  // Average Vulnerability score (High vulnerability if score is low, low vulnerability if score is high)
  const averageVulnerabilityScore = Math.round(
    (scoreFondoEmergencia + scoreBajaLaboral + scoreViudedadOrfandad + scoreAccesoSanitario + scoreEnemigoInflacion + scoreProteccionLegal) / 6
  );

  // Recharts Chart Data
  const chartData = [
    { name: "Mis Gastos", Importe: gastosTotalesMensuales, fill: "#000000" },
    { name: "Baja Laboral", Importe: Math.round(calcPrestaciones.it), fill: calcPrestaciones.it >= gastosTotalesMensuales ? "#18181b" : "#ff5500" },
    { name: "Inv. Absoluta", Importe: Math.round(calcPrestaciones.ipa), fill: calcPrestaciones.ipa >= gastosTotalesMensuales ? "#18181b" : "#ff5500" },
    { name: "Inv. Total", Importe: Math.round(calcPrestaciones.ipt), fill: calcPrestaciones.ipt >= gastosTotalesMensuales ? "#18181b" : "#ff5500" },
    { name: "Jubilación", Importe: Math.round(calcPrestaciones.jubilacion), fill: calcPrestaciones.jubilacion >= gastosTotalesMensuales ? "#18181b" : "#ff5500" },
  ];

  if (formData.estadoCivil === "Casado/a" || formData.estadoCivil === "Pareja de Hecho") {
    chartData.push({ name: "Viudedad", Importe: Math.round(calcPrestaciones.viudedad), fill: calcPrestaciones.viudedad >= gastosTotalesMensuales ? "#18181b" : "#ff5500" });
  }
  if (formData.numeroHijos > 0) {
    chartData.push({ name: "Orfandad", Importe: Math.round(calcPrestaciones.orfandad), fill: calcPrestaciones.orfandad >= gastosTotalesMensuales ? "#18181b" : "#ff5500" });
  }

  // Radar data for Vulnerability parameters
  const radarData = [
    { subject: "Fondo Emergencia", A: scoreFondoEmergencia * 10, fullMark: 100 },
    { subject: "Protección por IT", A: scoreBajaLaboral * 10, fullMark: 100 },
    { subject: "Seguro Familiar", A: scoreViudedadOrfandad * 10, fullMark: 100 },
    { subject: "Acceso Sanitario", A: scoreAccesoSanitario * 10, fullMark: 100 },
    { subject: "Control Inflación", A: scoreEnemigoInflacion * 10, fullMark: 100 },
    { subject: "Protección legal", A: scoreProteccionLegal * 10, fullMark: 100 },
  ];

  // Projects calculations to reach goals
  const totalMensualProyectos = proyectos.reduce((sum, p) => sum + (p.coste / (p.plazoAnos * 12)), 0);

  const strategicDiagnostics = [
    {
      area: "Baja laboral e incapacidad temporal",
      severity: deficitIt > 600 ? "grave" : deficitIt > 0 ? "moderada" : "leve",
      issue: deficitIt > 0
        ? `Existe una brecha mensual estimada de ${Math.round(deficitIt).toLocaleString()} EUR frente a los gastos familiares.`
        : "La prestación estimada cubre el nivel actual de gasto mensual.",
      action: deficitIt > 0
        ? "Contratar o revisar un subsidio privado por baja laboral que cubra la diferencia entre prestación pública y gasto real."
        : "Mantener la cobertura actual y revisar importes una vez al año."
    },
    {
      area: "Invalidez y protección profesional",
      severity: deficitIpt > 600 ? "grave" : deficitIpt > 0 ? "moderada" : "leve",
      issue: deficitIpt > 0
        ? `La invalidez profesional dejaría un déficit mensual de ${Math.round(deficitIpt).toLocaleString()} EUR.`
        : "La cobertura proyectada ante invalidez profesional no muestra déficit frente al gasto actual.",
      action: deficitIpt > 0
        ? "Ajustar capitales de invalidez y amortización de deudas para asegurar vivienda, préstamos y gastos familiares."
        : "Conservar el nivel de protección y actualizarlo si cambian ingresos o deuda."
    },
    {
      area: "Protección familiar por fallecimiento",
      severity: (deficitViudedad > 600 || deficitOrfandad > 600) ? "grave" : (deficitViudedad > 0 || deficitOrfandad > 0) ? "moderada" : "leve",
      issue: (deficitViudedad > 0 || deficitOrfandad > 0)
        ? `La familia presenta una brecha potencial de hasta ${Math.round(Math.max(deficitViudedad, deficitOrfandad, 0)).toLocaleString()} EUR/mes.`
        : "La cobertura familiar estimada no presenta brecha mensual relevante.",
      action: (deficitViudedad > 0 || deficitOrfandad > 0)
        ? "Definir un capital de vida temporal suficiente para cubrir impuestos, vivienda, estudios y transición de ingresos."
        : "Mantener beneficiarios, capitales y testamento revisados."
    },
    {
      area: "Fondo de emergencia y liquidez",
      severity: scoreFondoEmergencia <= 3 ? "grave" : scoreFondoEmergencia <= 6 ? "moderada" : "leve",
      issue: `El fondo disponible cubre aproximadamente ${mesesFondoEmergencia.toFixed(1)} meses de gastos.`,
      action: scoreFondoEmergencia < 8
        ? "Construir una reserva líquida de 6 a 9 meses de gastos antes de asumir nuevos compromisos de inversión."
        : "Separar la reserva de emergencia del capital destinado a inversión."
    },
    {
      area: "Jubilación e inflación",
      severity: (deficitJubilacion > 600 || scoreEnemigoInflacion <= 3) ? "grave" : (deficitJubilacion > 0 || scoreEnemigoInflacion <= 6) ? "moderada" : "leve",
      issue: deficitJubilacion > 0
        ? `La jubilación proyectada deja una brecha mensual de ${Math.round(deficitJubilacion).toLocaleString()} EUR.`
        : "La pensión estimada no deja brecha mensual frente al gasto actual.",
      action: "Aumentar ahorro sistemático, diversificar capital improductivo y revisar rentabilidad neta después de impuestos."
    },
    {
      area: "Protección legal y protocolo familiar",
      severity: scoreProteccionLegal <= 3 ? "grave" : scoreProteccionLegal <= 6 ? "moderada" : "leve",
      issue: scoreProteccionLegal < 8
        ? "Hay margen de mejora en testamento, acceso familiar a información crítica o instrucciones de actuación."
        : "La protección legal declarada es adecuada.",
      action: scoreProteccionLegal < 8
        ? "Formalizar testamento, inventario patrimonial y protocolo de acceso familiar a documentación clave."
        : "Revisar el protocolo legal cuando haya cambios familiares o patrimoniales."
    }
  ];

  const severityClasses = {
    grave: "bg-red-50 text-red-700 border-red-200",
    moderada: "bg-orange-50 text-orange-700 border-orange-200",
    leve: "bg-emerald-50 text-emerald-700 border-emerald-200"
  } as const;

  const strategicSummary = `La auditoría refleja una seguridad global de ${averageVulnerabilityScore}/10. Los puntos críticos se concentran en las brechas entre prestaciones públicas y gastos reales, la suficiencia del fondo de emergencia, la protección familiar y la preparación de jubilación.`;

  const addProyecto = () => {
    if (!nuevoProyectoNombre.trim()) return;
    const item: ProyectoItem = {
      id: Date.now().toString(),
      nombre: nuevoProyectoNombre,
      coste: nuevoProyectoCoste,
      plazoAnos: nuevoProyectoPlazo
    };
    setProyectos([...proyectos, item]);
    setNuevoProyectoNombre("");
  };

  const removeProyecto = (id: string) => {
    setProyectos(proyectos.filter(p => p.id !== id));
  };

  // Connect to server `/api/audit` trigger Gemini model
  const triggerAIAudit = async () => {
    setIsConsultingAI(true);
    setLoadingMessage("Conectando con la consultoría IA de José Carlos Hidalgo...");
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          tasaEndeudamiento,
          capacidadAhorro: capacidadAhorroMensual,
          gastosTotales: gastosTotalesMensuales,
          prestaciones: calcPrestaciones,
          deficitIt,
          deficitIpa,
          deficitIpt,
          deficitViudedad,
          deficitOrfandad
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || data.error || !data.riskAuditAdvice) {
        throw new Error(data?.error || "Formato de respuesta de IA no válido");
      }
      
      setAiReport(data);
    } catch (err) {
      console.error(err);
      // Populate standard robust advice in case of network issues
      setAiReport({
        summary: `Estimado/a ${formData.nombre}, los niveles actuales sugieren vulnerabilidades críticas en Incapacidad Temporal y Viudedad. Posees una capacidad de ahorro de ${capacidadAhorroMensual}€ pero el 100% de tu capital líquido está desprotegido frente a la inflación de medio plazo.`,
        riskAuditAdvice: {
          incapacidadTemporal: "Falta un seguro de subsidio por baja médica que compense el déficit mensual.",
          invalidezAbsoluta: `Se identifica un desfase relevante. Adquirir un seguro de muerte e invalidez absoluta que garantice el equilibrio familiar.`,
          invalidezTotal: "Dado que las prestaciones públicas decaerían ante tu profesión habitual, es crítico contratar amortizaciones privadas de deuda.",
          viudedad: "Tu pareja se encontraría bajo déficit crítico para mantener el hogar actual si no se establece una renta de vida.",
          orfandad: "Constituye un capital garantizado para la educación de tus hijos."
        },
        financialPlanningAdvice: {
          inflationBeatStrategy: "Es prioritario mover al menos 6.000€ a un plan indexado con un objetivo mínimo del 3.5% anual.",
          favorableTaxes: "Realiza deducciones fiscales sistemáticas de hasta 1.500€ aportación previsible para devaluar el cobro del IRPF.",
          savingsPlan: `Tu capacidad excedida de ${capacidadAhorroMensual}€ te habilita a asignar 300€ al Fondo de Emergencia y 200€ a planes indexados mensualmente.`
        },
        actionPlanSteps: [
          { step: "Aportar 1.500 € mínimos anuales a sistemas previsores de empleo", priority: "Alta", impact: "Reducción fiscal inmediata del 30% medio en hacienda." },
          { step: "Contratar seguro de vida temporal de 150.000 €", priority: "Alta", impact: "Garantiza sustento inmediato y estudios superiores para tus hijos menor edad." },
          { step: "Traspasar 5.000 € a fondo monetario liquido remunerado a más del 2.5%", priority: "Media", impact: "Mitiga devaluación por el IPC actual." }
        ]
      });
    } finally {
      setIsConsultingAI(false);
    }
  };

  // Direct calculation submit
  const handleCalculate = () => {
    setLoading(true);
    setLoadingMessage("Calculando bases reguladoras y coeficientes estatales...");
    setTimeout(() => {
      setLoading(false);
      setActiveTab("results");
      triggerAIAudit();
    }, 1200);
  };

  // Generate highly formatted professional PDF
  const downloadPDFReport = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const orangeColor = "#ff5500";
    const darkSlateColor = "#000000";

    const drawBrandHeader = (docInst: typeof doc, pageTitle: string) => {
      docInst.setFillColor(26, 26, 26);
      docInst.rect(0, 0, 210, 34, "F");

      docInst.setDrawColor(255, 255, 255);
      docInst.setLineWidth(1.5);
      docInst.line(15, 9, 15, 25);
      docInst.line(27, 9, 27, 25);
      docInst.setFillColor(197, 165, 102);
      docInst.circle(21, 17, 3.2, "F");

      docInst.setTextColor(255, 255, 255);
      docInst.setFont("Helvetica", "bold");
      docInst.setFontSize(15);
      docInst.text("JOSÉ CARLOS HIDALGO", 39, 14);

      docInst.setFont("Helvetica", "normal");
      docInst.setFontSize(7.5);
      docInst.setTextColor(145, 151, 160);
      docInst.text("GESTIÓN PATRIMONIAL E HIPOTECARIA", 39, 21);

      docInst.setFont("Helvetica", "bold");
      docInst.setFontSize(7.2);
      docInst.setTextColor(197, 165, 102);
      docInst.text(pageTitle, 39, 28);

      docInst.setFont("Helvetica", "normal");
      docInst.setFontSize(7.2);
      docInst.setTextColor(255, 255, 255);
      docInst.text("Email: josecarlos@hilolegal.es", 144, 13);
      docInst.text("Teléfono: 647 50 60 40", 144, 20);
      docInst.text(`Fecha: ${new Date().toLocaleDateString()}`, 144, 27);
    };

    // Helper to draw the elegant brand/technical footer on any page
    const drawFooter = (docInst: typeof doc, pageNum: number) => {
      docInst.setFillColor(248, 250, 252); // Soft background (slate-50)
      docInst.rect(14, 258, 182, 16, "F");
      docInst.setDrawColor(226, 232, 240); // slate-200
      docInst.setLineWidth(0.25);
      docInst.rect(14, 258, 182, 16, "D");
      
      docInst.setFont("Helvetica", "normal");
      docInst.setFontSize(7);
      docInst.setTextColor(148, 163, 184); // slate-400
      const descText = "Aviso de Responsabilidad: Este informe de auditoría se deriva de modelos de estimación paramétricos. Ante cualquier decisión, consulte siempre con la consultoría especializada de José Carlos Hidalgo.";
      const splitDesc = docInst.splitTextToSize(descText, 172);
      docInst.text(splitDesc, 18, 262);
      
      docInst.setFont("Helvetica", "bold");
      docInst.setFontSize(8);
      docInst.setTextColor(100, 116, 139); // slate-500
      docInst.text(`Página ${pageNum}`, 188, 271, { align: "right" });
    };

    drawBrandHeader(doc, "AUDITORÍA DE PREVISIÓN Y PLANIFICACIÓN FINANCIERA PERSONALIZADA");

    // Section 1: Resumen de Datos del Cliente
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("1. Resumen de Datos del Cliente", 14, 50);
    
    doc.setFillColor(248, 250, 252); // slate-50 background
    doc.rect(14, 54, 182, 37, "F");
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.35);
    doc.rect(14, 54, 182, 37, "D");

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text(`Nombre del Cliente: ${formData.nombre}`, 18, 61);
    doc.text(`Contacto: ${formData.telefono || "No indicado"} | ${formData.email || "No indicado"}`, 18, 67);
    doc.text(`Edad actual: ${formData.edad} años (Jubilación a 67)`, 18, 73);
    doc.text(`Estado Civil: ${formData.estadoCivil}`, 18, 79);
    doc.text(`Hijos menores de 25 años: ${formData.numeroHijos}`, 18, 85);

    doc.text(`Base de Cotización S.S.: ${formData.baseCotizacion.toLocaleString()} €/mes`, 108, 61);
    doc.text(`Salario Neto Mensual: ${formData.salarioNetoMensual.toLocaleString()} €/mes`, 108, 67);
    doc.text(`Presupuesto de Gastos Totales: ${gastosTotalesMensuales.toLocaleString()} €/mes`, 108, 73);
    doc.text(`Patrimonio Líquido + Inversión: ${(formData.dineroBanco + formData.dineroInvertido).toLocaleString()} €`, 108, 79);
    doc.text(`Rentabilidades (Inv / Ahorro): ${(formData.rentabilidadInversion ?? 5)}% / ${(formData.rentabilidadAhorro ?? 6)}% anual`, 108, 85);

    // Section 2: Public benefits and deficit checks
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("2. Auditoría de Previsión Social (Seguridad Social vs Gastos)", 14, 96);

    doc.setFontSize(8);
    doc.setFont("Helvetica", "bold");
    doc.setFillColor(241, 245, 249); // slate-100 header
    doc.rect(14, 100, 182, 7, "F");
    doc.setTextColor(15, 23, 42);
    doc.text("Concepto de Prestación", 18, 104.5);
    doc.text("Cálculo S.S. (€/mes)", 78, 104.5);
    doc.text("Gastos Necesarios (€)", 118, 104.5);
    doc.text("Estado / Déficit", 158, 104.5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    
    // Rows list mapping
    const rows = [
      { label: "Incapacidad Temp. / Baja Laboral", val: calcPrestaciones.it, def: deficitIt },
      { label: "Invalidez Absoluta (IPA)", val: calcPrestaciones.ipa, def: deficitIpa },
      { label: "Invalidez Profesional (IPT)", val: calcPrestaciones.ipt, def: deficitIpt },
    ];
    
    if (formData.estadoCivil === "Casado/a" || formData.estadoCivil === "Pareja de Hecho") {
      rows.push({ label: "Pensión Viudedad", val: calcPrestaciones.viudedad, def: deficitViudedad });
    }
    if (formData.numeroHijos > 0) {
      rows.push({ label: "Pensión Orfandad (Total)", val: calcPrestaciones.orfandad, def: deficitOrfandad });
    }
    rows.push({ label: "Pensión Jubilación Estimada", val: calcPrestaciones.jubilacion, def: deficitJubilacion });
    
    rows.forEach((r, idx) => {
      const rowY = 111 + (idx * 5.8);
      // Row alternating style
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, rowY - 4.2, 182, 5.8, "F");
      }
      
      doc.setTextColor(15, 23, 42);
      doc.text(r.label, 18, rowY - 0.2);
      doc.text(`${Math.round(r.val).toLocaleString()} €`, 78, rowY - 0.2);
      doc.text(`${gastosTotalesMensuales.toLocaleString()} €`, 118, rowY - 0.2);
      
      if (r.def > 0) {
        doc.setTextColor(220, 38, 38); // Alert red
        doc.setFont("Helvetica", "bold");
        doc.text(`Brecha -${Math.round(r.def).toLocaleString()} €`, 158, rowY - 0.2);
      } else {
        doc.setTextColor(16, 185, 129); // Safe green
        doc.setFont("Helvetica", "bold");
        doc.text(`Superavit +${Math.round(Math.abs(r.def)).toLocaleString()} €`, 158, rowY - 0.2);
      }
      doc.setFont("Helvetica", "normal");
    });

    // Gráfico de Previsión Social
    const chartYStart = 162;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(14, chartYStart, 182, 74, "F");
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.rect(14, chartYStart, 182, 74, "D");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Gráfico de Cobertura de Prestaciones Públicas vs Gastos del Mes", 20, chartYStart + 7);

    // Build bar chart vectors
    const bAxisX = 34;
    const bAxisY = chartYStart + 58;
    const bHeight = 42;
    const bWidth = 146;

    // Determine max value for scaling
    const maxVal = Math.max(
      gastosTotalesMensuales,
      calcPrestaciones.it,
      calcPrestaciones.ipa,
      calcPrestaciones.ipt,
      calcPrestaciones.jubilacion,
      calcPrestaciones.viudedad || 0,
      calcPrestaciones.orfandad || 0
    );
    const chartMaxY = maxVal * 1.15; // 15% padding top

    const getYCoord = (val: number) => bAxisY - (val / chartMaxY) * bHeight;

    // Draw horizontal chart gridlines and labels
    [0.25, 0.5, 0.75, 1.0].forEach(p => {
      const gridVal = chartMaxY * p;
      const valY = getYCoord(gridVal);
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(bAxisX, valY, bAxisX + bWidth, valY);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`${Math.round(gridVal).toLocaleString()}€`, bAxisX - 3, valY + 1.2, { align: "right" });
    });

    // Draw solid RED-ORANGE line for client monthly expenses
    const yGastosLine = getYCoord(gastosTotalesMensuales);
    doc.setDrawColor(239, 68, 68); // Red-500
    doc.setLineWidth(0.65);
    doc.line(bAxisX, yGastosLine, bAxisX + bWidth, yGastosLine);
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(239, 68, 68); // Red-500
    doc.text(`GASTO MENSUAL REQUERIDO: ${gastosTotalesMensuales.toLocaleString()} €`, bAxisX + bWidth - 2, yGastosLine - 1.5, { align: "right" });

    // Populate chart list
    const chartBars = [
      { label: "Baja Laboral", val: calcPrestaciones.it },
      { label: "Invalidez Abs.", val: calcPrestaciones.ipa },
      { label: "Invalidez Total", val: calcPrestaciones.ipt },
      { label: "Jubilación S.S.", val: calcPrestaciones.jubilacion },
    ];
    if (formData.estadoCivil === "Casado/a" || formData.estadoCivil === "Pareja de Hecho") {
      chartBars.push({ label: "Viudedad", val: calcPrestaciones.viudedad });
    }
    if (formData.numeroHijos > 0) {
      chartBars.push({ label: "Orfandad", val: calcPrestaciones.orfandad });
    }

    // Draw bars
    const nBars = chartBars.length;
    const barSpacing = bWidth / nBars;
    const barRealWidth = barSpacing * 0.45;

    chartBars.forEach((barData, idx) => {
      const xBarCenter = bAxisX + idx * barSpacing + barSpacing / 2;
      const xBarLeft = xBarCenter - barRealWidth / 2;
      const yBarTop = getYCoord(barData.val);
      const bH = Math.max(0.5, bAxisY - yBarTop);

      // Bar color
      if (barData.val >= gastosTotalesMensuales) {
        doc.setFillColor(30, 41, 59); // slate-800
      } else {
        doc.setFillColor(234, 88, 12); // orange-600 (vulnerable gap)
      }
      doc.rect(xBarLeft, yBarTop, barRealWidth, bH, "F");

      // Draw values above bars
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${Math.round(barData.val).toLocaleString()}€`, xBarCenter, yBarTop - 2, { align: "center" });

      // Label underneath X axis
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(barData.label, xBarCenter, bAxisY + 4, { align: "center" });
    });

    // Base axis line
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.4);
    doc.line(bAxisX, bAxisY, bAxisX + bWidth, bAxisY);

    // Draw page 1 footer
    drawFooter(doc, 1);

    // Page 2: Security levels checklist & vulnerability meter board
    doc.addPage();

    drawBrandHeader(doc, "INFORME TÉCNICO DE SEGURIDAD PREVISIONAL Y PLAN DE ACCIÓN");

    // Section 3 Title
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("3. Niveles de Seguridad y Vulnerabilidad", 14, 43);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Análisis técnico ponderado del blindaje patrimonial para contingencias imprevistas:", 14, 49);

    // Score descriptors lists (displaying all 6 categories matching the instructions and gauges)
    const indexDetails = [
      { title: "1. Reserva de Emergencia", desc: `Fondo líquido real para cubrir ${mesesFondoEmergencia.toFixed(1)} meses de gastos corrientes.` },
      { title: "2. Amparo por Baja Laboral", desc: "Cobertura de ingresos garantizados frente a incapacidad temporal en periodos de inactividad." },
      { title: "3. Protección por Fallecimiento", desc: "Suficiencia de capitales y pensiones de viudedad/orfandad para protección familiar." },
      { title: "4. Cobertura Sanitaria", desc: "Seguridad y velocidad de acceso a la medicina privada frente a listas de espera." },
      { title: "5. Batir la Inflación", desc: "Optimización de rendimientos contra la devaluación acumulada del capital rentable." },
      { title: "6. Protección legal", desc: "Planificación de testamento notarial, adaptabilidad actual y protocolo de actuación familiar." }
    ];

    indexDetails.forEach((id, idx) => {
      const iy = 56 + idx * 5.4;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`- ${id.title}:`, 18, iy);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      doc.text(id.desc, 60, iy);
    });

    // Gráfico 2: Niveles de Seguridad (the thermometers visual panel!)
    const gaugeYStart = 91;
    doc.setFillColor(248, 250, 252); // slate-50 background container
    doc.rect(14, gaugeYStart, 182, 64, "F");
    doc.setDrawColor(226, 232, 240); // slate-200 border
    doc.setLineWidth(0.3);
    doc.rect(14, gaugeYStart, 182, 64, "D");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("Gráfico de Análisis Paramétrico de Seguridad Financiera (0 - 100%)", 20, gaugeYStart + 7);

    // Criteria mapping
    const criteriaGauges = [
      { label: "1. Reserva Banco", score: scoreFondoEmergencia },
      { label: "2. Baja Laboral S.S.", score: scoreBajaLaboral },
      { label: "3. Seguro Familiar", score: scoreViudedadOrfandad },
      { label: "4. Acceso Sanitario", score: scoreAccesoSanitario },
      { label: "5. Batir Inflación", score: scoreEnemigoInflacion },
      { label: "6. Protección legal", score: scoreProteccionLegal }
    ];

    // --- INTEGRACIÓN DE GRÁFICO RADIAL (RADAR) EN PDF (Sección 3: Izquierda) ---
    const cx = 56;
    const cy = gaugeYStart + 36;
    const R = 18;

    const getRadarXY = (i: number, val: number) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / 3;
      return {
        x: cx + Math.cos(angle) * (val / 100) * R,
        y: cy + Math.sin(angle) * (val / 100) * R,
      };
    };

    // Dibujar anillos concéntricos hexagonales de referencia (25%, 50%, 75%, 100%)
    [25, 50, 75, 100].forEach(level => {
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.15);
      for (let i = 0; i < 6; i++) {
        const pt1 = getRadarXY(i, level);
        const pt2 = getRadarXY((i + 1) % 6, level);
        doc.line(pt1.x, pt1.y, pt2.x, pt2.y);
      }
    });

    // Dibujar los 6 ejes radiales
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    for (let i = 0; i < 6; i++) {
      const outer = getRadarXY(i, 100);
      doc.line(cx, cy, outer.x, outer.y);
    }

    // Dibujar las etiquetas de texto de cada eje
    const radarLabels = ["Reserva", "Baja IT", "Seg. Fam", "Sanitario", "Inflación", "Tributario"];
    for (let i = 0; i < 6; i++) {
      const outer = getRadarXY(i, 122); // Un poco más afuera de R=18 para que no solape
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139); // slate-500
      let alignMode: "center" | "left" | "right" = "center";
      if (i === 1 || i === 2) alignMode = "left";
      if (i === 4 || i === 5) alignMode = "right";
      doc.text(radarLabels[i], outer.x, outer.y + 1, { align: alignMode });
    }

    // Dibujar el polígono de datos reales del cliente
    doc.setDrawColor(249, 115, 22); // active orange-500
    doc.setLineWidth(0.55);
    const radarPoints = criteriaGauges.map((cg, i) => getRadarXY(i, cg.score * 10));
    for (let i = 0; i < 6; i++) {
      const p1 = radarPoints[i];
      const p2 = radarPoints[(i + 1) % 6];
      doc.line(p1.x, p1.y, p2.x, p2.y);
    }

    // Añadir pequeños circulitos (vértices) en cada puntuación
    radarPoints.forEach(p => {
      doc.setFillColor(249, 115, 22);
      doc.ellipse(p.x, p.y, 0.8, 0.8, "F");
    });

    // --- DIBUJAR LOS TERMÓMETROS DE SEGURIDAD EN LA DERECHA (Sección 3: Derecha) ---
    criteriaGauges.forEach((cg, idx) => {
      const rY = gaugeYStart + 15 + idx * 7.4;

      // Label (columna derecha, x = 104)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(cg.label, 104, rY + 3);

      // Progress bar track (empieza en x = 144, ancho = 28)
      doc.setFillColor(226, 232, 240); // slate-200 track
      doc.rect(144, rY + 1, 28, 2.2, "F");

      // Filling bar color de acuerdo con el score de la categoría
      if (cg.score < 5) {
        doc.setFillColor(239, 68, 68); // Red-500
      } else if (cg.score < 8) {
        doc.setFillColor(245, 158, 11); // Amber-500
      } else {
        doc.setFillColor(16, 185, 129); // Emerald-500
      }

      const barW = (cg.score / 10) * 28;
      if (barW > 0) {
        doc.rect(144, rY + 1, barW, 2.2, "F");
      }

      // Display score & quality indicator tag
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(`${cg.score * 10}%`, 175, rY + 3);

      let tagText = "Grave";
      if (cg.score >= 8) tagText = "Exc.";
      else if (cg.score >= 5) tagText = "Ópt.";
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(tagText, 185, rY + 3);
    });

    // Global Indicator Banner on Page 2
    const globalBannerY = gaugeYStart + 68;
    doc.setFillColor(255, 247, 237); // Very light solid orange/amber banner
    doc.rect(14, globalBannerY, 182, 10, "F");
    doc.setDrawColor(253, 186, 116); // light border
    doc.setLineWidth(0.25);
    doc.rect(14, globalBannerY, 182, 10, "D");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(234, 88, 12); // brand orange
    doc.text(`VALORACIÓN PREVISIONAL GLOBAL: ${averageVulnerabilityScore} / 10`, 20, globalBannerY + 6.5);

    // --- ESTUDIO PREVISOR ADICIONAL (BRECHA RETIRO A 90 AÑOS) ---
    const retirementBoxY = globalBannerY + 13; // y = 157
    doc.setFillColor(15, 23, 42); // deep slate-900
    doc.rect(14, retirementBoxY, 182, 28, "F");
    doc.setDrawColor(249, 115, 22); // active orange border
    doc.setLineWidth(0.35);
    doc.rect(14, retirementBoxY, 182, 28, "D");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(249, 115, 22); 
    doc.text("ESTUDIO PREVISOR: BRECHA DE JUBILACIÓN HASTA LOS 90 AÑOS", 19, retirementBoxY + 6);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(241, 245, 249); // slate-100 text
    const textRetiroInfo = `Considerando una esperanza de vida de 90 años, financiando un retiro de 23 años (276 meses) tras jubilarse a los 67 años:`;
    doc.text(textRetiroInfo, 19, retirementBoxY + 11.5);

    // Calculate compound projection at retirement for the PDF report
    const rInversionPdf = ((formData.rentabilidadInversion !== undefined ? formData.rentabilidadInversion : 5)) / 100;
    const rAhorroPdf = ((formData.rentabilidadAhorro !== undefined ? formData.rentabilidadAhorro : 6)) / 100;
    const ahorroMensualPdf = formData.ahorroSistematico !== undefined ? formData.ahorroSistematico : 150;
    const ahorroAnualPdf = ahorroMensualPdf * 12;
    const targetCapitalObjetivoPdf = Math.max(0, Math.round(capitalRetiroNecesario));

    const pdfBancoVal = Number(formData.dineroBanco);
    const pdfInvertidoVal = Math.round(Number(formData.dineroInvertido) * Math.pow(1 + rInversionPdf, anosRestantesHasta67));

    let pdfAhorroAcumuladoVal = 0;
    if (ahorroMensualPdf > 0) {
      if (rAhorroPdf > 0) {
        pdfAhorroAcumuladoVal = Math.round(ahorroAnualPdf * (Math.pow(1 + rAhorroPdf, anosRestantesHasta67) - 1) / rAhorroPdf);
      } else {
        pdfAhorroAcumuladoVal = ahorroAnualPdf * anosRestantesHasta67;
      }
    }

    const pdfPatrimonioTotalProyectado = pdfBancoVal + pdfInvertidoVal + pdfAhorroAcumuladoVal;
    const pdfDiferenciaAlRetiro = pdfPatrimonioTotalProyectado - targetCapitalObjetivoPdf;

    let pdfAjusteAhorroRecomendado = 0;
    if (pdfDiferenciaAlRetiro < 0 && anosRestantesHasta67 > 0) {
      const deficit = Math.abs(pdfDiferenciaAlRetiro);
      if (rAhorroPdf > 0) {
        pdfAjusteAhorroRecomendado = deficit * rAhorroPdf / (12 * (Math.pow(1 + rAhorroPdf, anosRestantesHasta67) - 1));
      } else {
        pdfAjusteAhorroRecomendado = deficit / (anosRestantesHasta67 * 12);
      }
    }

    // Grid data
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(241, 245, 249);
    doc.text(`- Déficit mensual S.S.: ${Math.round(brechaMensualJubilacion).toLocaleString()} EUR/mes`, 19, retirementBoxY + 17.5);
    doc.text(`- Capital total previsor requerido: ${Math.round(capitalRetiroNecesario).toLocaleString()} EUR`, 108, retirementBoxY + 17.5);

    if (pdfDiferenciaAlRetiro >= 0) {
      doc.setTextColor(52, 211, 153); // Emerald/Green-400 light-medium
      doc.text("- ¡OBJETIVO ALCANZADO! Tu patrimonio de jubilación proyectado cubre plenamente el capital objetivo.", 19, retirementBoxY + 23);
    } else {
      doc.setTextColor(253, 186, 116); // light orange
      doc.text(`- Años para acumular: ${anosRestantesHasta67} años (${anosRestantesHasta67 * 12} meses)`, 19, retirementBoxY + 23);
      doc.text(`- Esfuerzo Mensual Recomendado: ${Math.round(pdfAjusteAhorroRecomendado).toLocaleString()} EUR/mes`, 108, retirementBoxY + 23);
    }

    // Flowing Section 4: Diagnóstico Estratégico y Plan de Acción
    let currentY = 197;
    let pageNum = 2;

    const printParagraph = (headerText: string, textStr: string, isAIPriority: boolean = false, priorityLevel: string = "") => {
      if (!textStr || textStr.trim() === "") return;
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      const splitHeader = doc.splitTextToSize(headerText, 175);
      const headerLinesCount = splitHeader.length;
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.2);
      const splitBody = doc.splitTextToSize(textStr, 175);
      const bodyLinesCount = splitBody.length;
      
      // Compute estimated vertical space needed
      const totHeight = (headerLinesCount * 4.2) + (bodyLinesCount * 3.8) + 5;
      
      if (currentY + totHeight > 248) {
        // Close current page with a footer
        drawFooter(doc, pageNum);
        
        doc.addPage();
        pageNum++;
        
        drawBrandHeader(doc, "PLAN DE ACCIÓN - DIAGNÓSTICO ESTRATÉGICO CONTINUACIÓN");
        
        currentY = 43; // Start top of page
      }

      // Draw Header block
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      
      if (isAIPriority) {
        if (priorityLevel === "Alta" || priorityLevel === "grave") {
          doc.setTextColor(220, 38, 38); // red
        } else if (priorityLevel === "Media" || priorityLevel === "moderada") {
          doc.setTextColor(217, 119, 6); // amber
        } else {
          doc.setTextColor(22, 163, 74); // green
        }
      } else {
        doc.setTextColor(15, 23, 42); // deep slate
      }
      
      splitHeader.forEach((line: string) => {
        doc.text(line, 14, currentY);
        currentY += 4.5;
      });

      // Draw Paragraph Body Text
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(71, 85, 105); // slate-600
      
      splitBody.forEach((line: string) => {
        doc.text(line, 16, currentY);
        currentY += 3.8;
      });
      
      currentY += 3; // Gap between paragraphs
    };

    // Print section 4 banner
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("4. Diagnóstico Estratégico y Plan de Acción", 14, 191);

    printParagraph("Resumen integral de la auditoría", strategicSummary);

    strategicDiagnostics.forEach((item, idx) => {
      printParagraph(
        `${idx + 1}. Deficiencia ${item.severity.toUpperCase()} - ${item.area}`,
        `Diagnóstico: ${item.issue}\nMedida a adoptar: ${item.action}`,
        true,
        item.severity
      );
    });

    if (aiReport) {
      // Summary Executive
      printParagraph("Complemento de diagnóstico IA", aiReport.summary);
      
      // Proteccion SS details
      printParagraph("Auditoría de Protección S.S.: Baja Laboral", aiReport.riskAuditAdvice.incapacidadTemporal);
      printParagraph("Auditoría de Protección S.S.: Invalidez Permanente", aiReport.riskAuditAdvice.invalidezAbsoluta);
      
      if (formData.estadoCivil === "Casado/a" || formData.estadoCivil === "Pareja de Hecho") {
        printParagraph("Auditoría de Protección S.S.: Viudedad Familiar", aiReport.riskAuditAdvice.viudedad);
      }
      
      // Financial planning strategy
      printParagraph("Estrategias frente a la Inflación", aiReport.financialPlanningAdvice.inflationBeatStrategy);
      printParagraph("Eficiencia en Ahorro Tributario", aiReport.financialPlanningAdvice.favorableTaxes);

      // Prioritized Action Steps
      aiReport.actionPlanSteps.forEach((st, idx) => {
        printParagraph(
          `Acción ${idx + 1} [Prioridad ${st.priority}] - ${st.step}`,
          `Impacto de Blindaje Estimado: ${st.impact}\n¿Por qué es necesario adoptar esta medida?: ${st.whyNecessary}`,
          true,
          st.priority
        );
      });
    } else {
      // Offline fallback text advice rendered beautifully under same mechanics
      printParagraph(
        "1. Fondo de Reserva Ponderado (Alerta)",
        `Tu fondo de emergencia real de ${formData.dineroBanco.toLocaleString()}€ es viable únicamente para cubrir ${mesesFondoEmergencia.toFixed(1)} meses de contingencias e imprevistos. Se recomienda imperativamente planificar un ahorro sistemático mensual para llevarlo a un rango mínimo aconsejable de 6 meses de gastos constantes.`
      );
      printParagraph(
        "2. Cobertura Sanitaria y Familiar de Reserva",
        "Se registra un desfase preocupante para la protección ante casos sobrevenidos de invalidez permanente absoluta u orfandad con cargas activas menores de 25 años. Te recomendamos constituir a título privado un seguro de vida complementario con un capital no menor de 100.000€."
      );
      printParagraph(
        "3. Estructura de Ahorros Tributarios",
        "Se aconseja planificar aportaciones a planes de previsión individuales para aprovechar al máximo las deducciones y reducciones fiscales de la base imponible y consolidar un capital estable complementario con la consultoría acreditada de José Carlos Hidalgo."
      );
    }

    // Wrap-up current page footer
    drawFooter(doc, pageNum);

    // Save document
    doc.save(`Auditoria_Prevision_Social_${formData.nombre.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="min-h-screen text-slate-800 font-sans flex flex-col justify-between selection:bg-[#C5A566] selection:text-white relative overflow-x-hidden bg-white pb-8">
      {/* HEADER: Luxury Sticky Glassmorphic Nav of josecarlos.hilolegal.es */}
      <header className="sticky top-0 z-50 bg-[#1A1A1A] border-b border-white/10 px-4 py-4 sm:px-8 transition-all duration-300 text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center space-x-4">
            <a href="https://josecarlos.hilolegal.es" target="_blank" rel="noopener noreferrer" className="flex items-center transition-opacity duration-300 hover:opacity-85 cursor-pointer shrink-0">
              <img src="/jose-carlos-hidalgo-logo.svg" alt="José Carlos Hidalgo - Gestión patrimonial e hipotecaria" className="h-14 w-auto max-w-[260px] object-contain" />
            </a>
            <div className="hidden sm:block">
              <p className="text-[11px] sm:text-xs text-white font-mono font-bold uppercase tracking-wider">
                Email: josecarlos@hilolegal.es · Teléfono: 647 50 60 40
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-6 justify-between md:justify-end text-xs font-mono uppercase tracking-wider">
            
            {/* Nav links mimicking those of josecarlos.hilolegal.es */}
            <div className="hidden lg:flex items-center space-x-6 text-[10px] text-slate-350 mr-4">
              <a href="https://josecarlos.hilolegal.es" target="_blank" className="hover:text-[#b89047] transition-all">Inicio</a>
              <span className="text-slate-600">•</span>
              <span className="text-[#b89047] font-bold">Auditoría Previsional</span>
              <span className="text-slate-600">•</span>
              <a href="https://josecarlos.hilolegal.es" target="_blank" className="hover:text-[#b89047] transition-all">Hipotecas</a>
              <span className="text-slate-600">•</span>
              <a href="https://josecarlos.hilolegal.es" target="_blank" className="hover:text-[#b89047] transition-all">Planes y Seguros</a>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              <button 
                onClick={() => setActiveTab("audit")} 
                className={`transition-all duration-300 relative py-2 px-3 sm:px-4 rounded-lg cursor-pointer text-[10px] sm:text-xs font-bold ${activeTab === "audit" ? "text-white bg-[#b89047] shadow-[0_2px_10px_rgba(184,144,71,0.25)]" : "text-slate-300 hover:text-[#b89047] hover:bg-white/5"}`}
              >
                <span>Ficha Financiera</span>
              </button>
              
              <button 
                onClick={() => setActiveTab("results")} 
                className={`transition-all duration-300 relative py-2 px-3 sm:px-4 rounded-lg cursor-pointer text-[10px] sm:text-xs font-bold ${activeTab === "results" ? "text-white bg-[#b89047] shadow-[0_2px_10px_rgba(184,144,71,0.25)]" : "text-slate-300 hover:text-[#b89047] hover:bg-white/5"}`}
              >
                <span>Diagnóstico</span>
              </button>
            </div>

            <div className="h-6 w-[1px] bg-slate-800 hidden md:block" />

            <a 
              href="tel:647506040" 
              className="bg-white/5 border border-slate-700 hover:border-[#b89047] hover:bg-white/10 text-slate-100 px-3.5 py-2 text-[10px] sm:text-xs rounded-xl flex items-center gap-2 transition-all duration-300"
            >
              <span className="h-2 w-2 rounded-full bg-[#b89047] animate-pulse" />
              <span>Llamar: <strong className="font-mono text-white text-[11px] sm:text-xs">647 50 60 40</strong></span>
            </a>

          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 sm:px-8 relative z-10">
        
        {/* Loading Overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#0f172a]/70 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md"
            >
              <div className="relative flex flex-col items-center border border-[#b89047]/30 bg-white p-8 max-w-sm rounded-3xl shadow-2xl">
                <div className="h-16 w-16 border-2 border-t-2 border-t-[#b89047] border-slate-200 rounded-full animate-spin mb-6" />
                <Sparkles className="h-8 w-8 text-[#b89047] animate-pulse absolute top-4" />
                <h3 className="text-lg font-mono uppercase font-black text-slate-900 text-center">{loadingMessage}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-3 text-center uppercase tracking-wide">Analizando coberturas con rigor técnico...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO TITLE BLOCK - EXACT COPY OF josecarlos.hilolegal.es ESSENCE */}
        <section className="mb-12 p-8 sm:p-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#111c33] to-[#0f172a] border border-[#b89047]/30 shadow-xl text-white">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#b89047]/5 translate-x-24 -translate-y-24 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#1e40af]/5 -translate-x-24 translate-y-24 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="inline-flex items-center space-x-2 bg-[#b89047]/20 text-[#e9c488] border border-[#b89047]/30 px-4 py-1.5 text-[10px] font-mono uppercase font-black tracking-widest mb-6 rounded-full shadow-sm">
            <Sparkle className="h-3.5 w-3.5 text-[#b89047]" />
            <span>Planificación Inteligente sin Intuición bajo la Red hilolegal.es</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight text-slate-50 tracking-tight mb-4 font-serif">
            Tu hipoteca, tus seguros y tu futuro financiero <br />
            <span className="font-serif italic font-normal text-[#b89047]">no deberían decidirse por intuición.</span>
          </h1>
          
          <p className="text-sm sm:text-base text-slate-300 max-w-4xl leading-relaxed font-sans font-light mt-4">
            Antes de decidir, mira bien dónde estás expuesto. No se trata de contratar más productos; se trata de <strong className="text-white font-semibold">decidir mucho mejor</strong>. Ejecuta este programa de simulación oficial coordinado por <strong className="text-[#b89047]">José Carlos Hidalgo</strong> para detectar inmediatamente los riesgos previsionales y estructurales de tu familia.
          </p>

          {/* Slogans pillars from josecarlos.hilolegal.es */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 pt-8 border-t border-slate-800/80">
            <div className="p-5 rounded-2xl bg-white/5 border border-[#b89047]/10 hover:border-[#b89047]/30 transition-all duration-300">
              <span className="h-9 w-9 rounded-xl bg-[#b89047]/15 text-[#b89047] flex items-center justify-center font-serif text-lg font-bold italic mb-3">1</span>
              <h3 className="text-sm font-semibold text-slate-100 mb-1">Ingresos y estabilidad</h3>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Protección matemática tuya y de tus seres queridos ante bajas profesionales, orfandad, viudedad o invalidez sobrevenida.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-[#b89047]/10 hover:border-[#b89047]/30 transition-all duration-300">
              <span className="h-9 w-9 rounded-xl bg-[#b89047]/15 text-[#b89047] flex items-center justify-center font-serif text-lg font-bold italic mb-3">2</span>
              <h3 className="text-sm font-semibold text-slate-100 mb-1">Hipoteca y endeudamiento</h3>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Blindaje sistemático de tu mayor compromiso financiero en las comarcas de Altea, Benidorm y Alicante.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-[#b89047]/10 hover:border-[#b89047]/30 transition-all duration-300">
              <span className="h-9 w-9 rounded-xl bg-[#b89047]/15 text-[#b89047] flex items-center justify-center font-serif text-lg font-bold italic mb-3">3</span>
              <h3 className="text-sm font-semibold text-slate-100 mb-1">Ahorro, pensión y protección</h3>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Neutralizar la inflación (+2.5% anual) y rentabilizar saldos mediante desgravaciones óptimas en la declaración del IRPF.
              </p>
            </div>
          </div>
        </section>

        {/* TAB CONTROLS (MOBILE) */}
        <div className="flex bg-slate-150 p-1.5 border border-slate-200 mb-8 md:hidden shadow-sm rounded-xl">
          <button 
            onClick={() => setActiveTab("audit")}
            className={`flex-1 py-2.5 text-xs font-mono uppercase font-bold tracking-wider transition-all duration-300 rounded-lg ${activeTab === "audit" ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white shadow-md font-black" : "text-slate-550 hover:text-slate-900"}`}
          >
            Ficha Financiera
          </button>
          <button 
            onClick={() => setActiveTab("results")}
            className={`flex-1 py-2.5 text-xs font-mono uppercase font-bold tracking-wider transition-all duration-300 rounded-lg ${activeTab === "results" ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white shadow-md font-black" : "text-slate-550 hover:text-slate-900"}`}
          >
            Auditoría
          </button>
        </div>

        {/* CONTAINER FOR BOTH SECTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative pb-10">
          
          {/* TAB 1: FORM INPUTS (LEFT) */}
          <div className={`md:col-span-12 lg:col-span-5 space-y-8 ${activeTab === "audit" ? "block" : "hidden md:block"}`}>
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center space-x-3 mb-6 border-b border-slate-200 pb-4">
                <Calculator className="h-5 w-5 text-orange-600 shrink-0" />
                <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900 tracking-tight">Ficha del Cliente</h2>
              </div>

              <div className="space-y-5">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Nombre Completo</label>
                  <input 
                    type="text" 
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full cyber-input px-4 py-3 text-sm font-semibold"
                    placeholder="Ej. Carlos Ramón Gómez" 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Teléfono del Cliente</label>
                    <input 
                      type="tel" 
                      value={formData.telefono}
                      onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full cyber-input px-4 py-3 text-sm font-semibold"
                      placeholder="Ej. 600 000 000" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Email del Cliente</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full cyber-input px-4 py-3 text-sm font-semibold"
                      placeholder="Ej. cliente@email.com" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Edad */}
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Edad actual</label>
                    <input 
                      type="number" 
                      value={formData.edad}
                      onChange={e => setFormData({ ...formData, edad: Number(e.target.value) })}
                      className="w-full cyber-input px-4 py-3 text-sm font-semibold"
                      placeholder="Ej. 40" 
                    />
                  </div>
                  {/* Años cotizados */}
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Años Cotizados</label>
                    <input 
                      type="number" 
                      value={formData.anosCotizados}
                      onChange={e => setFormData({ ...formData, anosCotizados: Number(e.target.value) })}
                      className="w-full cyber-input px-4 py-3 text-sm font-semibold"
                      placeholder="Ej. 15" 
                    />
                  </div>
                </div>

                {/* Base de cotización habitual */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wide">Base de Cotización Mensual</label>
                    <span className="text-[10px] text-orange-600 hover:text-orange-500 cursor-help font-mono transition-colors flex items-center gap-1 font-bold uppercase">
                      <HelpCircle className="h-3.5 w-3.5 text-orange-600" /> Ver tu Nómina
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formData.baseCotizacion}
                      onChange={e => setFormData({ ...formData, baseCotizacion: Number(e.target.value) })}
                      className="w-full cyber-input pl-4 pr-16 py-3 text-sm font-semibold"
                      placeholder="Ej. 2800" 
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-mono font-bold">€/mes</span>
                  </div>
                </div>

                {/* Estado Civil */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Estado Civil</label>
                  <select 
                    value={formData.estadoCivil}
                    onChange={e => setFormData({ ...formData, estadoCivil: e.target.value as any })}
                    className="w-full cyber-input px-3 py-3 text-sm font-bold"
                  >
                    <option value="Soltero/a" className="bg-white text-slate-900">Soltero/a</option>
                    <option value="Casado/a" className="bg-white text-slate-900">Casado/a</option>
                    <option value="Divorciado/a" className="bg-white text-slate-900">Divorciado/a</option>
                    <option value="Pareja de Hecho" className="bg-white text-slate-900">Pareja de Hecho</option>
                    <option value="Viudo/a" className="bg-white text-slate-900">Viudo/a</option>
                  </select>
                </div>

                {/* Hijos menores 25 */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Hijos Menores de 25 Años</label>
                  <input 
                    type="number" 
                    value={formData.numeroHijos}
                    onChange={e => setFormData({ ...formData, numeroHijos: Number(e.target.value) })}
                    className="w-full cyber-input px-4 py-3 text-sm font-semibold"
                    placeholder="Ej. 2" 
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN PATRIMONIO */}
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center space-x-3 mb-6 border-b border-slate-200 pb-4">
                <PiggyBank className="h-5 w-5 text-orange-600 shrink-0" />
                <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900 tracking-tight">Presupuesto y Balance</h2>
              </div>

              <div className="space-y-5">
                {/* Salario Neto */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Salario Neto Mensual</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formData.salarioNetoMensual}
                      onChange={e => setFormData({ ...formData, salarioNetoMensual: Number(e.target.value) })}
                      className="w-full cyber-input pl-4 pr-16 py-3 text-sm font-semibold"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-mono font-bold">€/mes</span>
                  </div>
                </div>

                {/* Gastos Mensuales */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Gastos habituales (Comida, Suministros...)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formData.gastosMensuales}
                      onChange={e => setFormData({ ...formData, gastosMensuales: Number(e.target.value) })}
                      className="w-full cyber-input pl-4 pr-16 py-3 text-sm font-semibold"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-mono font-bold">€/mes</span>
                  </div>
                </div>

                {/* Deuda / Hipoteca / Alquiler */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Alquiler, Hipoteca o Préstamos Activos</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formData.alquilerHipotecaPrestamos}
                      onChange={e => setFormData({ ...formData, alquilerHipotecaPrestamos: Number(e.target.value) })}
                      className="w-full cyber-input pl-4 pr-16 py-3 text-sm font-semibold"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-mono font-bold">€/mes</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Dinero Banco */}
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Dinero en Banco</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={formData.dineroBanco}
                        onChange={e => setFormData({ ...formData, dineroBanco: Number(e.target.value) })}
                        className="w-full cyber-input pl-4 pr-10 py-3 text-sm font-semibold"
                      />
                      <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-mono">€</span>
                    </div>
                  </div>
                  {/* Dinero Invertido */}
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Capital Invertido</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={formData.dineroInvertido}
                        onChange={e => setFormData({ ...formData, dineroInvertido: Number(e.target.value) })}
                        className="w-full cyber-input pl-4 pr-10 py-3 text-sm font-semibold"
                      />
                      <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-mono">€</span>
                    </div>
                  </div>
                </div>

                {/* Dependent field for Rentabilidad del Capital Invertido */}
                <AnimatePresence>
                  {Number(formData.dineroInvertido) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-[#b89047]/5 border border-[#b89047]/15 rounded-2xl p-4 mt-1">
                        <label className="block text-xs font-mono font-bold text-[#b89047] mb-2 uppercase tracking-wide">Rentabilidad del Capital Invertido (Anual %)</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.rentabilidadInversion ?? 5}
                            onChange={e => setFormData({ ...formData, rentabilidadInversion: Number(e.target.value) })}
                            className="w-full cyber-input pl-4 pr-12 py-3 text-sm font-semibold border-[#b89047]/30 focus:border-[#b89047]"
                          />
                          <span className="absolute right-4 top-3.5 text-xs text-[#b89047] font-mono font-bold">% anual</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 font-light">
                          Indica el rendimiento neto anual estimado de tu cartera actual de inversiones.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Planes de ahorro sistemático & Rentabilidad de Ahorro */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Planes de Ahorro Sistemático</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={formData.ahorroSistematico ?? 0}
                        onChange={e => setFormData({ ...formData, ahorroSistematico: Number(e.target.value) })}
                        className="w-full cyber-input pl-4 pr-16 py-3 text-sm font-semibold"
                        placeholder="Ej. 150"
                      />
                      <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-mono font-bold">€/mes</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Rentabilidad de este Ahorro</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.1"
                        value={formData.rentabilidadAhorro ?? 0}
                        onChange={e => setFormData({ ...formData, rentabilidadAhorro: Number(e.target.value) })}
                        className="w-full cyber-input pl-4 pr-12 py-3 text-sm font-semibold"
                        placeholder="Ej. 6"
                      />
                      <span className="absolute right-4 top-3.5 text-xs text-[#b89047] font-mono font-bold">% anual</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PREGUNTAS DE AUDITORÍA */}
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
              <div className="flex items-center space-x-3 mb-6 border-b border-slate-200 pb-4">
                <Shield className="h-5 w-5 text-orange-600 shrink-0" />
                <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900 tracking-tight">Test de Previsión y Futuro</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <span className="block text-[11px] text-orange-600 uppercase tracking-widest font-mono mb-4 font-bold">Bloque 1: Protección Básica</span>
                  
                  {/* P01: Baja Laboral */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl mb-4 hover:border-[#b89047]/30 transition-all duration-300">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">01. Si sufrieras una enfermedad o accidente por 6 meses, ¿tienes fondo de emergencia o seguro complementario?</p>
                    <div className="flex flex-wrap gap-2">
                       {["Sí", "No", "Parcialmente", "No lo sé"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p01: opt }
                          })}
                          className={`px-4 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p01 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* P02: Desgracia familiar */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl mb-4 hover:border-[#b89047]/30 transition-all duration-300">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">02. En caso de fallecimiento repentino, ¿dispone tu familia de más de 50.000 € de inmediato para afrontar impuestos y gastos vitales?</p>
                    <div className="flex gap-2">
                      {["Sí", "No"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p02: opt }
                          })}
                          className={`flex-1 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p02 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* P03: Acceso sanitario */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl mb-4 hover:border-[#b89047]/30 transition-all duration-300">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">03. ¿Tienes seguro privado o acceso médico sin listas de espera de la Seguridad Social?</p>
                    <div className="flex gap-2">
                      {["Sí", "No"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p03: opt }
                          })}
                          className={`flex-1 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p03 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* P04: Dependencia */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl mb-4 hover:border-[#b89047]/30 transition-all duration-300">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">04. ¿Los ingresos de tu familia dependen principalmente de ti?</p>
                    <div className="flex gap-2">
                      {["Sí", "No", "Parcialmente"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p04: opt }
                          })}
                          className={`flex-1 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p04 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-[#b89047] uppercase tracking-widest font-mono mb-4 font-bold">Bloque 2: Futuro y Crecimiento</span>

                  {/* P05: Jubilacion */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl mb-4 hover:border-[#b89047]/30 transition-all duration-300">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">05. ¿Sabes cuál será tu pensión pública de jubilación y tienes un plan para cubrir el resto?</p>
                    <div className="flex gap-2">
                      {["Sí", "No", "Tengo una idea"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p05: opt }
                          })}
                          className={`flex-1 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p05 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* P06: Inflación */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl mb-4 hover:border-[#b89047]/30 transition-all duration-300">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">06. El dinero que tienes ahorrado en el banco "por si acaso", ¿te genera al menos un 2,5% de rentabilidad anual?</p>
                    <div className="flex gap-2">
                      {["Sí", "No"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p06: opt }
                          })}
                          className={`flex-1 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p06 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* P07: Testamento */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl hover:border-[#b89047]/30 transition-all duration-300">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">07. ¿Tienes hecho testamento ante notario y revisado en los últimos 5 años para adaptarlo a tu situación actual?</p>
                    <div className="flex gap-2">
                      {["Sí", "No", "No lo sé"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p07: opt }
                          })}
                          className={`flex-1 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p07 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* P08: Acceso familiar a documentación */}
                  <div className="bg-slate-50 p-5 border border-slate-200/60 rounded-2xl hover:border-[#b89047]/30 transition-all duration-300 mt-4">
                    <p className="text-xs sm:text-sm text-slate-800 font-bold mb-3 leading-relaxed">08. ¿Tu familia sabría exactamente qué hacer, en caso de incapacidad o fallecimiento y tiene acceso a documentación clave?</p>
                    <div className="flex gap-2">
                      {["Sí", "No", "No lo sé"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preguntas: { ...formData.preguntas, p08: opt }
                          })}
                          className={`flex-1 py-2 border rounded-xl text-xs font-mono uppercase transition-all duration-200 cursor-pointer ${formData.preguntas.p08 === opt ? "bg-gradient-to-r from-[#b89047] to-[#8c6d34] text-white border-transparent shadow-[0_4px_12px_rgba(184,144,71,0.25)] font-bold scale-[1.02]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TEXTAREAS: PROYECTOS */}
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden transition-all duration-300 col-span-1">
              <div className="flex items-center space-x-3 mb-6 border-b border-slate-200 pb-4">
                <Briefcase className="h-5 w-5 text-orange-600 shrink-0" />
                <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900 tracking-tight">Proyectos y Objetivos</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Fines/Proyectos a Medio Plazo</label>
                  <textarea
                    rows={2}
                    value={formData.proyectosMedioPlazo}
                    onChange={e => setFormData({ ...formData, proyectosMedioPlazo: e.target.value })}
                    className="w-full cyber-input px-4 py-3 text-xs resize-none font-semibold"
                    placeholder="Ej. Coche familiar o entrada de casa en 3 años..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wide">Objetivos de Jubilación o Largo Plazo</label>
                  <textarea
                    rows={2}
                    value={formData.objetivosLargoPlazo}
                    onChange={e => setFormData({ ...formData, objetivosLargoPlazo: e.target.value })}
                    className="w-full cyber-input px-4 py-3 text-xs resize-none font-semibold"
                    placeholder="Ej. Sostener la pensión pública y retiro desahogado..."
                  />
                </div>
              </div>
            </div>

            {/* CALCULAR BUTTON */}
            <button
              onClick={handleCalculate}
              className="w-full bg-gradient-to-r from-[#b89047] via-[#8c6d34] to-[#b89047] hover:from-[#c5a880] hover:to-[#b89047] text-white font-mono uppercase font-extrabold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-[0_5px_20px_rgba(184,144,71,0.25)] hover:shadow-[0_8px_30px_rgba(184,144,71,0.45)] flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer border-0"
            >
              <Calculator className="h-5 w-5 text-white" />
              <span>Ejecutar Auditoría de Previsión Social</span>
              <ArrowRight className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* TAB 2: AUDIT RESULTS DASHBOARD (RIGHT / MAIN) */}
          <div className={`md:col-span-12 lg:col-span-7 space-y-8 ${activeTab === "results" ? "block" : "hidden md:block"}`}>
            
            {/* BLOQUE 1: PREVISIÓN SOCIAL (Calculated benefits dashboard vs costs) */}
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden bg-white border border-slate-200/85 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-6 mb-6 gap-4">
                <div className="flex items-center space-x-3">
                  <Activity className="h-6 w-6 text-[#b89047] shrink-0" />
                  <div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                      1. Auditoría de Previsión Social
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                      Prestaciones de la Seguridad Social confrontadas con tus gastos de {gastosTotalesMensuales.toLocaleString()}€/mes
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-500 font-mono font-bold uppercase">B. Cotización:</span>
                  <p className="text-lg font-mono font-extrabold text-orange-600">{formData.baseCotizacion.toLocaleString()} €</p>
                </div>
              </div>

              {/* STAGE COMPARATIVE CHART */}
              <div className="h-[280px] w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.05)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} style={{ fontSize: '10px', fill: '#64748b' }} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} style={{ fontSize: '10px', fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#ffffff", border: "1px solid rgba(249, 115, 22, 0.25)", borderRadius: "12px", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}
                      labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
                      itemStyle={{ color: "#ea580c" }}
                    />
                    <ReferenceLine 
                      y={gastosTotalesMensuales} 
                      stroke="#ef4444" 
                      strokeWidth={2} 
                      strokeDasharray="4 4" 
                      label={{ 
                        value: "Gasto mensual requerido", 
                        fill: "#ef4444", 
                        position: "top", 
                        style: { fontSize: "10px", fontWeight: "bold", fontFamily: "monospace" } 
                      }} 
                    />
                    <Bar dataKey="Importe" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* GRID OF CALCULATED BENEFITS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* 1. Incapacidad Temporal */}
                <div className="bg-slate-50 border border-slate-200/70 p-5 relative hover:border-orange-500/30 transition-all rounded-2xl duration-300">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Baja Laboral Enfermedad</span>
                  <div className="flex justify-between items-end mb-3">
                    <h4 className="font-mono uppercase font-black text-slate-900 text-xs sm:text-sm">Incapacidad Temporal</h4>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-mono px-2 py-0.5 rounded-lg font-bold">75% Base</span>
                  </div>
                  <p className="text-2xl font-mono font-extrabold text-slate-900">{calcPrestaciones.it.toLocaleString()} €<span className="text-xs text-slate-500 font-normal"> /mes</span></p>
                  <div className="mt-4 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono uppercase text-[10px]">Balance:</span>
                    {deficitIt > 0 ? (
                      <span className="text-orange-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                        ⚠️ Déficit -{deficitIt.toLocaleString()} €
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                        ✓ Superávit +{Math.abs(deficitIt).toLocaleString()} €
                      </span>
                    )}
                  </div>
                  {aiReport && (
                    <p className="mt-3 text-[11px] text-slate-600 italic font-sans leading-relaxed border-t border-slate-200/50 pt-2 font-medium">
                      {aiReport?.riskAuditAdvice?.incapacidadTemporal}
                    </p>
                  )}
                </div>

                {/* 2. Invalidez Temporal Absoluta */}
                <div className="bg-slate-50 border border-slate-200/70 p-5 relative hover:border-orange-500/30 transition-all rounded-2xl duration-300">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Invalidez Permanente</span>
                  <div className="flex justify-between items-end mb-3">
                    <h4 className="font-mono uppercase font-black text-slate-900 text-xs sm:text-sm">Invalidez Absoluta (IPA)</h4>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-mono px-2 py-0.5 rounded-lg font-bold">100% Base</span>
                  </div>
                  <p className="text-2xl font-mono font-extrabold text-slate-900">{calcPrestaciones.ipa.toLocaleString()} €<span className="text-xs text-slate-500 font-normal"> /mes</span></p>
                  <div className="mt-4 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono uppercase text-[10px]">Balance:</span>
                    {deficitIpa > 0 ? (
                      <span className="text-orange-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                        ⚠️ Déficit -{deficitIpa.toLocaleString()} €
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                        ✓ Superávit +{Math.abs(deficitIpa).toLocaleString()} €
                      </span>
                    )}
                  </div>
                  {aiReport && (
                    <p className="mt-3 text-[11px] text-slate-600 italic font-sans leading-relaxed border-t border-slate-200/50 pt-2 font-medium">
                      {aiReport?.riskAuditAdvice?.invalidezAbsoluta}
                    </p>
                  )}
                </div>

                {/* 3. Invalidez Total */}
                <div className="bg-slate-50 border border-slate-200/70 p-5 relative hover:border-orange-500/30 transition-all rounded-2xl duration-300">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Invalidez Profesión Habitual</span>
                  <div className="flex justify-between items-end mb-3">
                    <h4 className="font-mono uppercase font-black text-slate-900 text-xs sm:text-sm">Invalidez Total (IPT)</h4>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-mono px-2 py-0.5 rounded-lg font-bold">{formData.edad >= 55 ? "75%" : "55%"} Base</span>
                  </div>
                  <p className="text-2xl font-mono font-extrabold text-slate-900">{calcPrestaciones.ipt.toLocaleString()} €<span className="text-xs text-slate-500 font-normal"> /mes</span></p>
                  <div className="mt-4 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono uppercase text-[10px]">Balance:</span>
                    {deficitIpt > 0 ? (
                      <span className="text-orange-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                        ⚠️ Déficit -{deficitIpt.toLocaleString()} €
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                        ✓ Superávit +{Math.abs(deficitIpt).toLocaleString()} €
                      </span>
                    )}
                  </div>
                  {aiReport && (
                    <p className="mt-3 text-[11px] text-slate-600 italic font-sans leading-relaxed border-t border-slate-200/50 pt-2 font-medium">
                      {aiReport?.riskAuditAdvice?.invalidezTotal}
                    </p>
                  )}
                </div>

                {/* 4. Viudedad */}
                <div className="bg-slate-50 border border-slate-200/70 p-5 relative hover:border-orange-500/30 transition-all rounded-2xl duration-300">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Pensión para tu Cónyuge</span>
                  <div className="flex justify-between items-end mb-3">
                    <h4 className="font-mono uppercase font-black text-slate-900 text-xs sm:text-sm">Viudedad</h4>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-mono px-2 py-0.5 rounded-lg font-bold">52% Base</span>
                  </div>
                  {formData.estadoCivil === "Casado/a" || formData.estadoCivil === "Pareja de Hecho" ? (
                    <>
                      <p className="text-2xl font-mono font-extrabold text-slate-900">{calcPrestaciones.viudedad.toLocaleString()} €<span className="text-xs text-slate-500 font-normal"> /mes</span></p>
                      <div className="mt-4 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-mono uppercase text-[10px]">Balance:</span>
                        {deficitViudedad > 0 ? (
                          <span className="text-orange-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                            ⚠️ Déficit -{deficitViudedad.toLocaleString()} €
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                            ✓ Superávit +{Math.abs(deficitViudedad).toLocaleString()} €
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 py-3 italic uppercase font-semibold">No aplica bajo tu estado de {formData.estadoCivil}.</p>
                  )}
                  {aiReport && (formData.estadoCivil === "Casado/a" || formData.estadoCivil === "Pareja de Hecho") && (
                    <p className="mt-3 text-[11px] text-slate-600 italic font-sans leading-relaxed border-t border-slate-200/50 pt-2 font-medium">
                      {aiReport?.riskAuditAdvice?.viudedad}
                    </p>
                  )}
                </div>

                {/* 5. Orfandad */}
                {formData.numeroHijos > 0 && (
                  <div className="bg-slate-50 border border-slate-200/70 p-5 relative col-span-1 sm:col-span-2 hover:border-orange-500/30 transition-all rounded-2xl duration-300">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Pensión para Hijos &lt; 25 años</span>
                    <div className="flex justify-between items-end mb-3">
                      <h4 className="font-mono uppercase font-black text-slate-900 text-xs sm:text-sm">Orfandad (Cálculo integral)</h4>
                      <span className="bg-orange-100 text-orange-700 text-[10px] font-mono px-2 py-0.5 rounded-lg font-bold">20% Base /Hijo</span>
                    </div>
                    <p className="text-2xl font-mono font-extrabold text-slate-900">{calcPrestaciones.orfandad.toLocaleString()} €<span className="text-xs text-slate-500 font-normal"> /mes</span></p>
                    <div className="mt-4 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-mono uppercase text-[10px]">Balance:</span>
                      {deficitOrfandad > 0 ? (
                        <span className="text-orange-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                          ⚠️ Déficit de -{deficitOrfandad.toLocaleString()} €
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                          ✓ Superávit +{Math.abs(deficitOrfandad).toLocaleString()} €
                        </span>
                      )}
                    </div>
                    {aiReport && (
                      <p className="mt-3 text-[11px] text-slate-600 italic font-sans leading-relaxed border-t border-slate-200/50 pt-2 font-medium">
                        {aiReport?.riskAuditAdvice?.orfandad}
                      </p>
                    )}
                  </div>
                )}

                {/* 6. Pensión de Jubilación */}
                <div className="bg-slate-50 border border-slate-200/70 p-5 relative hover:border-orange-500/30 transition-all rounded-2xl duration-300 col-span-1 sm:col-span-2">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Planificación del Retiro</span>
                  {(() => {
                    const anosRestantes = Math.max(0, 67 - formData.edad);
                    const anosCotizadosEstimados = formData.anosCotizados + anosRestantes;
                    const pctJub = anosCotizadosEstimados < 15 
                      ? 0 
                      : Math.min(100, Math.round((0.5 + Math.min(0.5, Math.max(0, anosCotizadosEstimados - 15) * (0.5 / 21.5))) * 100));
                    return (
                      <>
                        <div className="flex justify-between items-end mb-3">
                          <h4 className="font-mono uppercase font-black text-slate-900 text-xs sm:text-sm">Pensión de Jubilación Previsible</h4>
                          <span className="bg-orange-100 text-orange-700 text-[10px] font-mono px-2 py-0.5 rounded-lg font-bold">
                            {pctJub}% Base al jubilarse (67 años)
                          </span>
                        </div>
                        <p className="text-2xl font-mono font-extrabold text-slate-900">
                          {calcPrestaciones.jubilacion.toLocaleString()} €
                          <span className="text-xs text-slate-500 font-normal"> /mes</span>
                        </p>
                        
                        {anosCotizadosEstimados < 15 && (
                          <p className="text-[11px] text-orange-600 font-bold mt-2 font-mono uppercase">
                            ⚠️ Atención: Se requieren un mínimo de 15 años cotizados estimados al jubilarse para acceder al 50% de la pensión contributiva. Su cálculo es actualmente 0€.
                          </p>
                        )}

                        <div className="mt-4 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-mono uppercase text-[10px]">Balance frente a Gastos:</span>
                          {deficitJubilacion > 0 ? (
                            <span className="text-orange-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                              ⚠️ Déficit de -{Math.round(deficitJubilacion).toLocaleString()} €
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-black flex items-center gap-1 font-mono uppercase text-[10px]">
                              ✓ Superávit +{Math.round(Math.abs(deficitJubilacion)).toLocaleString()} €
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-[11px] text-slate-600 font-sans leading-relaxed border-t border-slate-200/50 pt-2 font-medium">
                          Calculado estimando {anosCotizadosEstimados} años cotizados al jubilarse a los 67 años ({formData.anosCotizados} años cotizados actuales más {anosRestantes} años que le quedan hasta la jubilación). Cubrir este desfase mensual con un plan de jubilación privado te garantiza prolongar tu calidad de vida sin depender exclusivamente de las reformas del sistema público.
                        </p>

                        <p className="mt-3 text-[11px] text-slate-600 font-sans leading-relaxed border-t border-slate-200/50 pt-2 font-medium">
                          Calculado estimando {anosCotizadosEstimados} años cotizados al jubilarse a los 67 años ({formData.anosCotizados} años cotizados actuales más {anosRestantes} años que le quedan hasta la jubilación). Cubrir este desfase mensual con un plan de jubilación privado te garantiza prolongar tu calidad de vida sin depender exclusivamente de las reformas del sistema público.
                        </p>

                        {/* Visual 90-year lifespan previsional gap calculator & projection chart */}
                        {(() => {
                          const rInversion = ((formData.rentabilidadInversion !== undefined ? formData.rentabilidadInversion : 5)) / 100;
                          const rAhorro = ((formData.rentabilidadAhorro !== undefined ? formData.rentabilidadAhorro : 6)) / 100;
                          const ahorroMensual = formData.ahorroSistematico !== undefined ? formData.ahorroSistematico : 150;
                          const ahorroAnual = ahorroMensual * 12;
                          const targetCapitalObjetivo = Math.max(0, Math.round(capitalRetiroNecesario));

                          const projectionData = [];
                          // Project up to retirement, or at least 15 years to give a beautiful long-term visual trajectory
                          const stepsToShow = Math.max(15, anosRestantes);
                          
                          for (let i = 0; i <= stepsToShow; i++) {
                            const ageSimulated = formData.edad + i;
                            const bancoVal = Number(formData.dineroBanco);
                            const invertidoVal = Math.round(Number(formData.dineroInvertido) * Math.pow(1 + rInversion, i));
                            
                            let ahorroAcumuladoVal = 0;
                            if (ahorroMensual > 0) {
                              if (rAhorro > 0) {
                                ahorroAcumuladoVal = Math.round(ahorroAnual * (Math.pow(1 + rAhorro, i) - 1) / rAhorro);
                              } else {
                                ahorroAcumuladoVal = ahorroAnual * i;
                              }
                            }
                            
                            const totalPatrimonioSimuladoVal = bancoVal + invertidoVal + ahorroAcumuladoVal;
                            
                            projectionData.push({
                              edad: ageSimulated,
                              name: `${ageSimulated} años`,
                              "Liquidez en Banco": bancoVal,
                              "Inversión Proyectada": invertidoVal,
                              "Plan de Ahorro": ahorroAcumuladoVal,
                              "Patrimonio Total": totalPatrimonioSimuladoVal,
                              "Capital Objetivo": targetCapitalObjetivo
                            });
                          }

                          // Find wealth at retirement age 67
                          const indexRetirement = Math.max(0, Math.min(projectionData.length - 1, anosRestantes));
                          const projectedDataRetirement = projectionData[indexRetirement] || projectionData[projectionData.length - 1];
                          const patrimonioProyectadoAlRetiro = projectedDataRetirement ? projectedDataRetirement["Patrimonio Total"] : 0;
                          const diferenciaPrevisionalTotal = patrimonioProyectadoAlRetiro - targetCapitalObjetivo;

                          let ajusteAhorroRecomendado = 0;
                          if (diferenciaPrevisionalTotal < 0 && anosRestantes > 0) {
                            const deficit = Math.abs(diferenciaPrevisionalTotal);
                            if (rAhorro > 0) {
                              ajusteAhorroRecomendado = deficit * rAhorro / (12 * (Math.pow(1 + rAhorro, anosRestantes) - 1));
                            } else {
                              ajusteAhorroRecomendado = deficit / (anosRestantes * 12);
                            }
                          }

                          return (
                            <div className="mt-8 p-6 sm:p-8 bg-gradient-to-br from-[#0f172a] via-[#152038] to-[#0f172a] border border-[#b89047]/40 rounded-3xl relative overflow-hidden text-slate-100 shadow-2xl">
                              <div className="absolute top-0 right-0 w-96 h-96 bg-[#b89047]/5 rounded-full blur-[120px] pointer-events-none" />
                              <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
                              
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-slate-700/50 pb-5">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-[#b89047]/15 rounded-xl border border-[#b89047]/30 flex items-center justify-center shrink-0">
                                    <TrendingUp className="h-5 w-5 text-[#b89047]" />
                                  </div>
                                  <div>
                                    <h5 className="font-serif italic text-lg sm:text-xl text-[#b89047] font-bold">
                                      Simulación de Retiro Sostenible
                                    </h5>
                                    <p className="text-xs text-slate-400 font-light mt-0.5">
                                      Modelo de capitalización vs. Brecha de la Seguridad Social (Vida a 90 años)
                                    </p>
                                  </div>
                                </div>

                                <span className="bg-[#b89047]/20 text-[#e9c488] border border-[#b89047]/30 px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-lg font-bold shrink-0">
                                  Modelo José Carlos Hidalgo
                                </span>
                              </div>

                              {/* EXPLICACION MUY VISUAL Y ATRACTIVA */}
                              <div className="bg-white/[0.02] border border-white/[0.05] p-5 rounded-2xl mb-6 text-sm leading-relaxed text-slate-300">
                                <p className="mb-3 font-light text-justify">
                                  Antes de decidir cualquier producto, hay que entender bien la exposición matemática. Este simulación confronta tu nivel de gasto familiar con la pensión pública prevista. La diferencia mensual determina el capital objetivo necesario para sostener tu vida de los <strong className="text-white font-medium">67 a los 90 años</strong> (esperanza de vida estimulada de 23 años de retiro).
                                </p>
                                <p className="font-light text-justify">
                                  A continuación proyectamos cómo influye el <strong className="text-[#b89047] font-medium">interés compuesto</strong> sobre tu patrimonio total disponible: tu liquidez inicial del banco de <strong className="text-white font-medium">{(formData.dineroBanco).toLocaleString()} €</strong> se mantiene líquida para emergencias, mientras que tu inversión inicial de <strong className="text-white font-medium">{(formData.dineroInvertido).toLocaleString()} €</strong> capitaliza al <strong className="text-[#b89047] font-medium">{(formData.rentabilidadInversion !== undefined ? formData.rentabilidadInversion : 5)}% anual</strong>, sumada al crecimiento progresivo de tu plan de ahorro sistemático de <strong className="text-white font-medium">{ahorroMensual.toLocaleString()} €/mes</strong> proyectado al <strong className="text-[#b89047] font-medium">{(formData.rentabilidadAhorro !== undefined ? formData.rentabilidadAhorro : 6)}% anual</strong>.
                                </p>
                              </div>

                              {/* STATS HIGHLIGHTS GRID */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <div className="bg-slate-900/60 border border-slate-800 p-4.5 rounded-2xl relative overflow-hidden">
                                  <div className="absolute top-2 right-2 opacity-5 text-[#b89047]">
                                    <PiggyBank className="h-10 w-10" />
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Capital Objetivo Necesario</span>
                                  <span className="text-xl font-mono font-black text-[#e9c488] block">
                                    {targetCapitalObjetivo.toLocaleString()} €
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-1.5 font-light leading-snug">
                                    Monto acumulado requerido para solventar tu brecha previsible de <strong className="text-white">{Math.round(brechaMensualJubilacion).toLocaleString()} €/mes</strong> durante los 23 años de jubilación.
                                  </span>
                                </div>

                                <div className="bg-slate-900/60 border border-slate-800 p-4.5 rounded-2xl relative overflow-hidden">
                                  <div className="absolute top-2 right-2 opacity-5 text-[#b89047]">
                                    <TrendingUp className="h-10 w-10" />
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Patrimonio Proyectado (67 años)</span>
                                  <span className="text-xl font-mono font-black text-white block">
                                    {patrimonioProyectadoAlRetiro.toLocaleString()} €
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-1.5 font-light leading-snug">
                                    Patrimonio total acumulado a la edad de jubilación, compuesto por inversiones revalorizadas y tu plan sistemático de aportes.
                                  </span>
                                </div>

                                <div className={`p-4.5 rounded-2xl relative overflow-hidden border ${diferenciaPrevisionalTotal >= 0 ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-100" : "bg-rose-500/5 border-rose-500/20 text-rose-100"}`}>
                                  <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Diagnóstico de Cobertura</span>
                                  <span className={`text-xl font-mono font-black block ${diferenciaPrevisionalTotal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {diferenciaPrevisionalTotal >= 0 
                                      ? `+${Math.round(diferenciaPrevisionalTotal).toLocaleString()} € Superávit` 
                                      : `-${Math.abs(Math.round(diferenciaPrevisionalTotal)).toLocaleString()} € Déficit`
                                    }
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-1.5 font-light leading-snug">
                                    {diferenciaPrevisionalTotal >= 0 
                                      ? "✓ ¡Planificación Sostenible! Tus activos proyectados son suficientes para salvaguardar tu nivel de vida futuro." 
                                      : "⚠️ Brecha Financiera. Tu patrimonio compuesto no alcanza el capital objetivo. Conviene elevar el ahorro o potenciar rentabilidad."
                                    }
                                  </span>
                                </div>
                              </div>

                              {/* CHART CONTAINER */}
                              <div className="bg-slate-950/80 border border-slate-850 p-4 sm:p-6 rounded-3xl mb-6">
                                <h6 className="text-[11px] font-mono text-[#b89047] uppercase tracking-wider mb-4 font-bold flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-[#b89047] animate-pulse" />
                                  Evolución Temporal del Patrimonio vs. Línea de Capital Objetivo
                                </h6>
                                <div className="h-[300px] w-full text-xs font-mono">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                                      <defs>
                                        <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#b89047" stopOpacity={0.4}/>
                                          <stop offset="95%" stopColor="#b89047" stopOpacity={0.0}/>
                                        </linearGradient>
                                        <linearGradient id="colorAhorro" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(184, 144, 71, 0.08)" />
                                      <XAxis 
                                        dataKey="edad" 
                                        stroke="#94a3b8" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickFormatter={(val) => `${val} años`}
                                      />
                                      <YAxis 
                                        stroke="#94a3b8" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickFormatter={(val) => `${(val / 1000).toFixed(0)} k€`}
                                      />
                                      <Tooltip 
                                        contentStyle={{ 
                                          backgroundColor: "rgba(15, 23, 42, 0.95)", 
                                          borderColor: "rgba(184, 144, 71, 0.4)", 
                                          color: "#ffffff", 
                                          borderRadius: "12px",
                                          fontSize: "11px"
                                        }} 
                                        formatter={(value: any) => [`${Number(value).toLocaleString()} €`]}
                                      />
                                      <Legend verticalAlign="top" height={36} iconType="circle" />
                                      <Area 
                                        type="monotone" 
                                        name="Patrimonio Total Proyectado" 
                                        dataKey="Patrimonio Total" 
                                        stroke="#b89047" 
                                        strokeWidth={2.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorPatrimonio)" 
                                      />
                                      <Area 
                                        type="monotone" 
                                        name="Plan de Ahorro Acumulado" 
                                        dataKey="Ahorro Sistemático" 
                                        stroke="#3b82f6" 
                                        strokeWidth={1} 
                                        fillOpacity={1} 
                                        fill="url(#colorAhorro)" 
                                      />
                                      <Line 
                                        type="monotone" 
                                        name="Línea Capital Objetivo" 
                                        dataKey="Capital Objetivo" 
                                        stroke="#ef4444" 
                                        strokeDasharray="5 5" 
                                        strokeWidth={2} 
                                        dot={false} 
                                      />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* BOTTOM RECOMMENDATION NOTES */}
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 text-xs mt-4">
                                <div>
                                  <p className="text-[10px] text-[#b89047] uppercase font-mono font-bold tracking-wide">Fórmula de Seguridad del Capital Objetivo</p>
                                  <p className="text-slate-350 mt-1 font-light leading-snug">
                                    Cálculo técnico: <code className="text-[#e9c488] bg-[#0f172a]/80 px-2 py-0.5 border border-[#b89047]/20 rounded font-mono font-bold">Capital Objetivo = (Gasto Mensual - Pensión pública estimada) × 12 meses × 23 años (hasta los 90 de edad)</code>
                                  </p>
                                </div>
                                
                                {diferenciaPrevisionalTotal >= 0 ? (
                                  <div className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 text-emerald-400">
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                                    <span className="font-bold text-xs uppercase text-emerald-400 font-mono tracking-wide">¡OBJETIVO ALCANZADO!</span>
                                  </div>
                                ) : (
                                  <div className="bg-[#b89047]/25 border border-[#b89047]/40 p-3 rounded-xl text-center sm:text-right shrink-0">
                                    <span className="text-[9px] text-[#e9c488] font-mono uppercase font-black block tracking-wider">Ajuste de Ahorro Recomendado</span>
                                    <span className="text-base font-mono font-bold text-white mt-0.5 block">
                                      {Math.round(ajusteAhorroRecomendado).toLocaleString()} €/mes
                                    </span>
                                  </div>
                                )}
                              </div>

                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* BLOQUE 2: PLANIFICACIÓN FINANCIERA */}
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden bg-white border border-slate-200/85 shadow-md">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-6 mb-6">
                <TrendingUp className="h-6 w-6 text-orange-600 shrink-0" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                    2. Planificación Financiera Patrimonial
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    Análisis de presupuestos acumulados, nivel de ahorro y consecución de proyectos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-500 font-mono block mb-1 font-bold uppercase">INGRESOS ANUALES</span>
                  <p className="text-xl font-mono font-extrabold text-slate-900">{(formData.salarioNetoMensual * 12).toLocaleString()} €</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-500 font-mono block mb-1 font-bold uppercase">GASTOS ANUALES</span>
                  <p className="text-xl font-mono font-extrabold text-slate-900">{(gastosTotalesMensuales * 12).toLocaleString()} €</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-500 font-mono block mb-1 font-bold uppercase">CAPACIDAD DE AHORRO ANUAL</span>
                  <p className={`text-xl font-mono font-extrabold ${capacidadAhorroMensual >= 0 ? "text-orange-600" : "text-rose-600"}`}>
                    {(capacidadAhorroMensual * 12).toLocaleString()} €
                  </p>
                </div>
              </div>

              {/* TASA DE ENDEUDAMIENTO PROGRESS BAR */}
              <div className="bg-slate-100/50 border border-slate-200 p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wide">Tasa de Endeudamiento Mensual</span>
                  <span className={`text-sm font-mono font-extrabold ${tasaEndeudamiento > 40 ? "text-orange-600" : tasaEndeudamiento > 30 ? "text-orange-500" : "text-slate-900"}`}>
                    {tasaEndeudamiento.toFixed(1)} %
                  </span>
                </div>
                
                <div className="h-2 w-full bg-slate-200/60 border border-slate-300/40 overflow-hidden mb-3 rounded-full">
                  <div 
                    className={`h-full transition-all duration-300 rounded-full ${tasaEndeudamiento > 40 ? "bg-orange-600" : tasaEndeudamiento > 30 ? "bg-orange-500" : "bg-gradient-to-r from-orange-500 to-amber-400"}`}
                    style={{ width: `${Math.min(100, tasaEndeudamiento)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 font-mono font-bold uppercase">
                  <span>Recomendado &lt; 35%</span>
                  {tasaEndeudamiento > 40 ? (
                    <span className="text-orange-600 flex items-center gap-1 font-extrabold">⚠️ Sobreendeudado</span>
                  ) : tasaEndeudamiento > 30 ? (
                    <span className="text-orange-500 font-extrabold">🟡 Al límite sugerido</span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1 font-extrabold">🟢 Nivel óptimo saludable</span>
                  )}
                </div>
              </div>

              {/* INTERACTIVE PROJECTS SIMULATOR */}
              <div className="bg-slate-50 border border-slate-200 p-6 mt-6 rounded-2xl shadow-sm">
                <div className="flex items-center space-x-2.5 mb-4 border-b border-slate-200 pb-3">
                  <PiggyBank className="h-5 w-5 text-orange-600" />
                  <h4 className="font-mono uppercase font-black text-slate-900 text-xs">Simulador de Objetivos Corrector</h4>
                </div>

                <p className="text-xs text-slate-500 mb-4 font-semibold">
                  Define el coste y plazo de tus proyectos a medio plazo para computar el plan de ahorro requerido.
                </p>

                {/* Projects list */}
                <div className="space-y-3.5 mb-6">
                  {proyectos.map(p => {
                    const ahorroReq = Math.round(p.coste / (p.plazoAnos * 12));
                    return (
                      <div key={p.id} className="bg-white border border-slate-200 p-3.5 rounded-xl flex justify-between items-center text-xs shadow-sm">
                        <div className="flex-1 mr-4">
                          <span className="font-bold text-slate-900 block mb-1">{p.nombre}</span>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Importe:</span>
                            <input 
                              type="number" 
                              value={p.coste}
                              onChange={e => {
                                const nuevoCoste = Math.max(0, Number(e.target.value));
                                setProyectos(proyectos.map(item => item.id === p.id ? { ...item, coste: nuevoCoste } : item));
                              }}
                              className="w-20 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-[10px] text-slate-500 font-bold">€</span>
                            <span className="text-[10px] text-slate-400 font-bold pl-1 uppercase shrink-0">Plazo:</span>
                            <input 
                              type="number" 
                              value={p.plazoAnos}
                              onChange={e => {
                                const nuevoPlazo = Math.max(1, Number(e.target.value));
                                setProyectos(proyectos.map(item => item.id === p.id ? { ...item, plazoAnos: nuevoPlazo } : item));
                              }}
                              className="w-12 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">años</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[9px] text-slate-400 block font-mono font-black tracking-wider">REQ. MENSUAL</span>
                            <span className="font-mono font-extrabold text-orange-600">{ahorroReq} €</span>
                          </div>
                          <button 
                            onClick={() => removeProyecto(p.id)}
                            className="p-1 px-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:border-rose-400/20 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add new Project inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-slate-100 p-4 border border-slate-200 rounded-2xl shadow-inner">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase font-black">Nuevo Proyecto</label>
                    <input 
                      type="text" 
                      value={nuevoProyectoNombre}
                      onChange={e => setNuevoProyectoNombre(e.target.value)}
                      className="w-full cyber-input px-3 py-1.5 text-xs font-semibold"
                      placeholder="Ej. Matrícula Universidad" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase font-black">Coste (€)</label>
                    <input 
                      type="number" 
                      value={nuevoProyectoCoste}
                      onChange={e => setNuevoProyectoCoste(Number(e.target.value))}
                      className="w-full cyber-input px-3 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 font-mono uppercase font-black">Plazo (Años)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={nuevoProyectoPlazo}
                        onChange={e => setNuevoProyectoPlazo(Number(e.target.value))}
                        className="w-full cyber-input px-3 py-1.5 text-xs font-semibold"
                      />
                      <button 
                        onClick={addProyecto}
                        type="button"
                        className="bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white rounded-xl border-0 p-2.5 shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center transition-all shrink-0 font-bold"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Accumulation Summary bar */}
                <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs gap-3">
                  <div>
                    <span className="text-slate-500 font-semibold font-mono uppercase text-[9px] block">Ahorro total para proyectos:</span>
                    <p className="font-mono font-extrabold text-slate-900 text-sm">{Math.round(totalMensualProyectos)} €/mes</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold font-mono uppercase text-[9px] block">Capacidad real de ahorro:</span>
                    <p className={`font-mono font-extrabold text-sm ${capacidadAhorroMensual >= totalMensualProyectos ? "text-slate-900" : "text-orange-600"}`}>
                      {capacidadAhorroMensual} €/mes
                    </p>
                  </div>
                  <div className="text-center sm:text-right bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-mono text-[10px]">
                    {capacidadAhorroMensual >= totalMensualProyectos ? (
                      <span className="text-emerald-700 font-extrabold uppercase">🟢 Viable con ahorro</span>
                    ) : (
                      <span className="text-orange-600 font-extrabold uppercase">⚠️ Brecha -{Math.round(totalMensualProyectos - capacidadAhorroMensual)} €/mes</span>
                    )}
                  </div>
                </div>

                {aiReport && (
                  <p className="mt-4 text-[11px] text-slate-600 italic font-sans leading-relaxed border-t border-slate-200 pt-3 font-medium">
                    {aiReport?.financialPlanningAdvice?.savingsPlan}
                  </p>
                )}
              </div>
            </div>

            {/* BLOQUE 3: VULNERABILIDAD FINANCIERA (THERMOMETERS & PDF DOWNLOAD) */}
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden bg-white border border-slate-200/85 shadow-md">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-6 mb-6">
                <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                    3. Niveles de Seguridad y Vulnerabilidad
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    Evaluación paramétrica académica de tus áreas clave de blindaje financiero
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center mb-8">
                
                {/* RADAR CHART ANALYSIS */}
                <div className="h-[235px] w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-2 relative overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="rgba(15, 23, 42, 0.06)" strokeWidth={0.5} />
                      <PolarAngleAxis dataKey="subject" stroke="#475569" fontSize={9} style={{ fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(15, 23, 42, 0.05)" />
                      <Radar name="Mis Capacidades" dataKey="A" stroke="#ea580c" strokeWidth={2} fill="#ea580c" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* THERMOMETERS DETAILS */}
                <div className="space-y-3">
                  {/* Item 1: Fondo de emergencia */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-bold font-mono text-slate-700 uppercase">
                      <span>1. Fondo de Reserva (Banco)</span>
                      <span className="text-orange-600 font-extrabold">{scoreFondoEmergencia}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/60 border border-slate-300/40 overflow-hidden rounded-full shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" 
                        style={{ width: `${scoreFondoEmergencia * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Item 2: Baja Laboral */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-bold font-mono text-slate-700 uppercase">
                      <span>2. Amparo por Baja Laboral S.S.</span>
                      <span className="text-orange-600 font-extrabold">{scoreBajaLaboral}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/60 border border-slate-300/40 overflow-hidden rounded-full shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" 
                        style={{ width: `${scoreBajaLaboral * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Item 3: Seguridad Familiar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-bold font-mono text-slate-700 uppercase">
                      <span>3. Protección Familiar (Seguros)</span>
                      <span className="text-orange-600 font-extrabold">{scoreViudedadOrfandad}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/60 border border-slate-300/40 overflow-hidden rounded-full shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" 
                        style={{ width: `${scoreViudedadOrfandad * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Item 4: Cobertura Sanitaria */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-bold font-mono text-slate-700 uppercase">
                      <span>4. Cobertura Sanitaria Privada</span>
                      <span className="text-orange-600 font-extrabold">{scoreAccesoSanitario}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/60 border border-slate-300/40 overflow-hidden rounded-full shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" 
                        style={{ width: `${scoreAccesoSanitario * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Item 5: Control Inflación */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-bold font-mono text-slate-700 uppercase">
                      <span>5. Batir la Inflación (&gt; 2.5% anual)</span>
                      <span className="text-orange-600 font-extrabold">{scoreEnemigoInflacion}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/60 border border-slate-300/40 overflow-hidden rounded-full shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" 
                        style={{ width: `${scoreEnemigoInflacion * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Item 6: Protección legal */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-bold font-mono text-slate-700 uppercase">
                      <span>6. Protección legal</span>
                      <span className="text-orange-600 font-extrabold">{scoreProteccionLegal}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/60 border border-slate-300/40 overflow-hidden rounded-full shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" 
                        style={{ width: `${scoreProteccionLegal * 10}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOQUE 4: DIAGNÓSTICO ESTRATÉGICO Y PLAN DE ACCIÓN */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex items-center space-x-3 mb-5">
                  <CheckCircle2 className="h-6 w-6 text-orange-600 shrink-0" />
                  <div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                      4. Diagnóstico estratégico y plan de acción
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                      Resumen ejecutivo de deficiencias detectadas y medidas recomendadas
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{strategicSummary}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {strategicDiagnostics.map((item, index) => (
                    <div key={item.area} className={`border rounded-2xl p-4 ${severityClasses[item.severity as keyof typeof severityClasses]}`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="text-sm font-black text-slate-900">{index + 1}. {item.area}</h3>
                        <span className="text-[10px] font-mono uppercase font-black border rounded-lg px-2 py-1 bg-white/70">
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed font-semibold mb-3">{item.issue}</p>
                      <div className="bg-white/75 border border-white/80 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-black font-mono block mb-1">Plan de acción</span>
                        <p className="text-xs leading-relaxed font-medium">{item.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTION PLAN STEPS */}
              {aiReport && (
                <div className="mb-8 pt-6 border-t border-slate-200">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-orange-600 animate-pulse" /> Medidas De Blindaje Priorizadas:
                  </h4>
                  <div className="space-y-3">
                    {aiReport?.actionPlanSteps?.map((stepItem, index) => (
                      <div key={index} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4 text-xs leading-relaxed hover:bg-slate-100/60 transition-all duration-300">
                        <span className={`px-2 py-1 rounded-lg font-mono text-[9px] font-black uppercase shrink-0 h-6 flex items-center justify-center ${stepItem.priority === "Alta" ? "bg-orange-100 text-orange-700 border border-orange-200/60 shadow-sm" : stepItem.priority === "Media" ? "bg-amber-100 text-amber-700 border border-amber-200/60" : "bg-slate-100 border border-slate-200 text-slate-500"}`}>
                           {stepItem.priority}
                        </span>
                        <div className="flex-1">
                          <p className="text-slate-900 font-extrabold mb-1">{stepItem.step}</p>
                          <p className="text-slate-600 font-medium mb-2">{stepItem.impact}</p>
                          <div className="text-[11px] bg-slate-200/40 border-l-2 border-orange-500 pl-2.5 py-1.5 text-slate-700 font-medium rounded-r-lg leading-relaxed">
                            <strong className="text-[10px] uppercase font-bold text-orange-600 block mb-0.5 font-mono">¿Por qué es necesario adoptar esta recomendación?</strong>
                            {stepItem.whyNecessary}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REPORT PDF DOWNLOAD BUTTON */}
              <button
                onClick={downloadPDFReport}
                className="w-full bg-gradient-to-r from-[#b89047] via-[#8c6d34] to-[#b89047] hover:from-[#c5a880] hover:to-[#b89047] text-white font-mono uppercase font-black py-4 px-6 rounded-2xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-[0_5px_20px_rgba(184,144,71,0.25)] hover:shadow-[0_8px_30px_rgba(184,144,71,0.45)] border-0 flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Download className="h-5 w-5" />
                <span>Descargar Auditoría Oficial en PDF</span>
              </button>
            </div>

            {/* BUTTON BACK TO FORM */}
            <button 
              onClick={() => {
                setActiveTab("audit");
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 py-4 font-mono font-bold tracking-wider uppercase text-xs rounded-2xl transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-2 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" /> Modificar Datos / Añadir Respuestas
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER: Premium Minimalist Black and Gold inspired by josecarlos.hilolegal.es */}
      <footer className="bg-[#1A1A1A] text-white border-t border-white/10 px-6 py-16 sm:px-8 relative z-10 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
          
          <div className="md:col-span-4 space-y-4">
            <div className="flex flex-col gap-1.5 text-[11px] text-slate-400 font-sans pt-2">
              <p className="flex items-center gap-1.5">
                <span className="text-[#b89047]">📍</span> Altea • Benidorm • Alicante, España
              </p>
              <p className="flex items-center gap-1.5">
                <span className="text-[#b89047]">📞</span> Teléfono: <a href="tel:647506040" className="text-[#b89047] hover:underline font-bold font-mono">647 50 60 40</a>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="text-[#b89047]">✉️</span> Email: <a href="mailto:josecarlos@hilolegal.es" className="text-[#b89047] hover:underline font-bold font-mono">josecarlos@hilolegal.es</a>
              </p>
            </div>
          </div>

          <div className="md:col-span-4 border-t border-slate-800 md:border-t-0 pt-6 md:pt-0 space-y-3">
            <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-[#b89047]">Soluciones en Altea, Benidorm y Alicante</h5>
            <ul className="text-xs space-y-2 text-slate-400 font-light">
              <li>• Planificación Financiera Personal Automatizada</li>
              <li>• Hipotecas de Máxima Financiación (Nacional e Internacional)</li>
              <li>• Servicios de Protección de Ingresos y Coberturas Familiares</li>
              <li>• Planes de Pensiones, Ahorro Inteligente e Inversión con Ventajas Fiscales</li>
              <li>• Salud Premium y Cobertura Sanitaria Completa</li>
              <li>• Administración de Fincas y Optimización Patrimonial</li>
            </ul>
          </div>

          <div className="md:col-span-4 border-t border-slate-800 md:border-t-0 pt-6 md:pt-0">
            <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-[#b89047] mb-2">Cláusula de Salvaguarda Legal</h5>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Las estimaciones de prestaciones públicas del sistema de la Seguridad Social española (como incapacidades, invalideces permanentes, viudedad u orfandad) se basan en fórmulas aproximadas estándar vigentes para 2026. Los resultados tienen carácter diagnóstico y de simulación inicial complementaria. Este simulador no constituye oferta contractual vinculante. Se recomienda solicitar una consultoría personal con José Carlos Hidalgo Ortega para el diseño final de sus seguros de vida, ahorro y pensiones privadas.
            </p>
          </div>

        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4 font-medium">
          <span>© 2026 José Carlos Hidalgo | HILO LEGAL. Todos los derechos reservados.</span>
          <div className="flex gap-4">
            <a href="https://josecarlos.hilolegal.es" target="_blank" className="hover:text-[#b89047] transition-colors">Términos del Portal</a>
            <span className="text-slate-800">|</span>
            <a href="https://josecarlos.hilolegal.es" target="_blank" className="hover:text-[#b89047] transition-colors">Protección de Datos</a>
            <span className="text-slate-800">|</span>
            <a href="https://josecarlos.hilolegal.es" target="_blank" className="hover:text-[#b89047] transition-colors font-bold">Tranquilidad Familiar</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
