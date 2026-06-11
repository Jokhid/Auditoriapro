export interface AuditQuestions {
  p01: string; // Baja Laboral
  p02: string; // Desgracia Familiar
  p03: string; // Acceso Sanitario
  p04: string; // Motor de la economía
  p05: string; // Jubilación
  p06: string; // Guerra contra la Inflación
  p07: string; // Testamento (Protección legal)
  p08: string; // Acceso familiar (Protección legal)
}

export interface ClientData {
  nombre: string;
  telefono: string;
  email: string;
  edad: number;
  anosCotizados: number;
  baseCotizacion: number;
  estadoCivil: "Soltero/a" | "Casado/a" | "Divorciado/a" | "Pareja de Hecho" | "Viudo/a";
  numeroHijos: number;
  salarioNetoMensual: number;
  gastosMensuales: number;
  alquilerHipotecaPrestamos: number;
  dineroBanco: number;
  dineroInvertido: number;
  rentabilidadInversion?: number; // Rentabilidad del capital invertido (%)
  ahorroSistematico?: number;     // Planes de ahorro sistemático (€/mes)
  rentabilidadAhorro?: number;    // Rentabilidad del ahorro sistemático (%)
  preguntas: AuditQuestions;
  proyectosMedioPlazo: string;
  objetivosLargoPlazo: string;
}

export interface PrestacionesCalculadas {
  it: number; // Incapacidad Temporal
  ipa: number; // Invalidez Permanente Absoluta
  ipt: number; // Invalidez Permanente Total
  viudedad: number; // Pensión Viudedad
  orfandad: number; // Pensión Orfandad total (para todos los hijos)
  jubilacion: number; // Pensión Jubilación previsible
}

export interface AIAnalysisResult {
  summary: string;
  riskAuditAdvice: {
    incapacidadTemporal: string;
    invalidezAbsoluta: string;
    invalidezTotal: string;
    viudedad: string;
    orfandad: string;
  };
  financialPlanningAdvice: {
    inflationBeatStrategy: string;
    favorableTaxes: string;
    savingsPlan: string;
  };
  actionPlanSteps: Array<{
    step: string;
    priority: "Alta" | "Media" | "Baja";
    impact: string;
    whyNecessary: string;
  }>;
}
