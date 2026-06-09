import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize GoogleGenAI client (gracefully checking GEMINI_API_KEY)
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Warning: GEMINI_API_KEY is not set. AI advice features will run in mock-advice mode.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const getFallbackResponse = (clientData: any) => {
  const dineroEmgRequired = (clientData.gastosMensuales || 1000) * 4;
  const it = clientData.prestaciones?.it || 0;
  const ipa = clientData.prestaciones?.ipa || 0;
  const ipt = clientData.prestaciones?.ipt || 0;
  const viudedad = clientData.prestaciones?.viudedad || 0;
  const orfandad = clientData.prestaciones?.orfandad || 0;

  const deficitIt = clientData.gastosMensuales - it;
  const deficitIpa = clientData.deficitIpa !== undefined ? clientData.deficitIpa : (clientData.gastosMensuales - ipa);
  const deficitIpt = clientData.deficitIpt !== undefined ? clientData.deficitIpt : (clientData.gastosMensuales - ipt);
  const deficitViudedad = clientData.deficitViudedad !== undefined ? clientData.deficitViudedad : (clientData.gastosMensuales - viudedad);
  const deficitOrfandad = clientData.deficitOrfandad !== undefined ? clientData.deficitOrfandad : (clientData.gastosMensuales - orfandad);

  return {
    summary: `Hola ${clientData.nombre || "Cliente"}. Tras evaluar cuantitativamente tus datos financieros para tus ${clientData.edad} años de edad, tu salario neto de ${clientData.salarioNetoMensual} € y tus gastos estimados de vida familiar, hemos identificado los puntos más críticos de tu blindaje patrimonial. Tu capacidad de ahorro real consolidada es de ${clientData.capacidadAhorro} €/mes y tu tasa de endeudamiento mensual está en el ${clientData.tasaEndeudamiento?.toFixed(1)}%. Frente a imprevistos o tu futura jubilación (vida activa a 90 años), sugerimos balancear tu exposición mediante coberturas optimizadas e instrumentar ahorro de forma fiscalmente eficiente.`,
    riskAuditAdvice: {
      incapacidadTemporal: clientData.preguntas?.p01 === "Sí" 
        ? "Cuentas con protección parcial o de corto plazo declarada. Sin embargo, dado que la prestación por Incapacidad Temporal de la S.S. disminuye a partir del día 21 de baja (pasando al 75% o menos de tu base de cotización), tu ingreso real mensual se reducirá. Se aconseja consolidar un saldo de reserva específico para cubrir el hipotético desfase."
        : `La incapacidad temporal derivada de enfermedad común o accidente no laboral supondrá una merma de ingresos inmediata si no ejerces actividad. Tu prestación estimada de la S.S. es de ${it.toFixed(0)} €/mes frente a tus gastos mensuales de ${clientData.gastosMensuales} € (desfase de -${Math.max(0, deficitIt).toFixed(0)} €/mes). Te sugerimos contratar un seguro de subsidio de baja profesional o complementar tus reservas de liquidez inmediatamente.`,
      invalidezAbsoluta: deficitIpa > 0 
        ? `En caso de Invalidez Permanente Absoluta, recibirías una pensión pública estimada de ${ipa.toFixed(0)} €/mes, lo que te expone a una brecha mensual severa de -${Math.round(deficitIpa).toLocaleString()} € respecto a tus compromisos. Requiere cobertura complementaria de amortización para préstamos y un plan de contingencia privado.`
        : `Tu pensión pública de Invalidez Permanente Absoluta estimada de ${ipa.toFixed(0)} €/mes resulta suficiente respecto a tus gastos de vida familiar de ${clientData.gastosMensuales} €. Vigila la evolución de tu base de cotización para mantener esta cobertura en positivo.`,
      invalidezTotal: deficitIpt > 0
        ? `La pensión por Invalidez Permanente Total (inhabilitación para tu profesión habitual) estimada por la Seguridad Social es de ${ipt.toFixed(0)} €/mes. Esto te genera un déficit mensual de -${Math.round(deficitIpt).toLocaleString()} €. Debes prever un seguro de invalidez profesional o capital de reestructuración para evitar pérdidas de calidad de vida.`
        : `La pensión estimada por Invalidez Permanente Total de ${ipt.toFixed(0)} €/mes es adecuada para tu nivel de gasto actual, pero podría generar tensiones financieras si tus costes familiares aumentan.`,
      viudedad: deficitViudedad > 0
        ? `En supuesto de fallecimiento, la pensión de viudedad estimada para tu cónyuge de la Seguridad Social es de ${viudedad.toFixed(0)} €/mes, lo que generaría una brecha severa de -${Math.round(deficitViudedad).toLocaleString()} €/mes en la economía de tu hogar. Es altamente recomendable instrumentar un seguro de fallecimiento temporal renovable para proteger el núcleo familiar.`
        : `La pensión de viudedad estimada de ${viudedad.toFixed(0)} €/mes es adecuada para cubrir los costes de vida declarados, aunque se aconseja verificar la existencia de deudas o contratos de alquiler pendientes.`,
      orfandad: deficitOrfandad > 0
        ? `Tus hijos menores de 25 años contarían con una pensión pública estimada de orfandad de ${orfandad.toFixed(0)} €/mes, resultando en una falta de cobertura familiar de -${Math.round(deficitOrfandad).toLocaleString()} €/mes. Evalúa capitalizar este riesgo con un seguro de vida específico.`
        : `La protección estimada de orfandad conjunta de ${orfandad.toFixed(0)} €/mes cubre de manera segura las necesidades básicas, no obstante, conviene mantener siempre un fondo de rentas líquidas de estudio.`
    },
    financialPlanningAdvice: {
      inflationBeatStrategy: clientData.preguntas?.p06 === "Sí"
        ? `Felicidades por batir la inflación con rentabilidades superiores al 2.5% anual en tus ahorros. Sigue diversificando tu capital para blindar tus activos de la devaluación monetaria del IPC.`
        : `Tienes un capital líquido de ${clientData.dineroBanco || 0} € inmóvil en el banco. Sin un rendimiento mínimo del 2.5%, la inflación diluye tu poder de compra de forma progresiva. Es imperativo posicionar tus ahorros en productos que batan la inflación (como carteras indexadas, renta fija garantizada o cuentas remuneradas).`,
      favorableTaxes: clientData.preguntas?.p07 === "Sí"
        ? "Excelente que ya aproveches las deducciones fiscales de previsión social. Recuerda que puedes aportar y deducir hasta 1.500 € individuales (o hasta 5.750 € si cuentas con planes sectoriales de empleo o eres autónomo)."
        : "No estás optimizando los beneficios fiscales que ofrece la ley de previsión. Proponemos instrumentar parte de tu ahorro mensual a través de planes que te permitan desgravar directamente en tu declaración del IRPF (pudiendo recuperar entre un 19% y un 47% de impuestos según tu tramo de ingresos).",
      savingsPlan: `Para financiar tus proyectos a medio plazo y objetivos previstos, se aconseja actuar estructurando un plan de ahorro sistemático inteligente destinando aproximadamente un 30% de tu capacidad de ahorro libre (${Math.round((clientData.capacidadAhorro || 100) * 0.3)} €/mes).`
    },
    actionPlanSteps: [
      {
        step: "Consolidar un Fondo de Emergencia de liquidez instantánea",
        priority: (clientData.dineroBanco < (clientData.gastosMensuales * 3)) ? "Alta" : "Media",
        impact: "Crea un escudo de liquidez ante cualquier contingencia ordinaria o médica de corto plazo de manera directa y libre de deudas.",
        whyNecessary: "Tus ahorros líquidos deben ser como mínimo de 3 a 6 meses de tus gastos corrientes fijos para blindarte de imprevistos sin descapitalizar tus inversiones u obligarte a solicitar préstamos bancarios de intereses elevados."
      },
      {
        step: "Contratar o ajustar un Seguro de Vida, Accidentes e Invalidez",
        priority: (deficitIpa > 0 || deficitViudedad > 0) ? "Alta" : "Media",
        impact: "Garantiza a tu cónyuge e hijos un capital de protección inmediato para subsanar los desfases calculados por incapacidad o deceso.",
        whyNecessary: "Las coberturas públicas actuales de la S.S. dejan desprotegidos a los miembros más vulnerables de tu familia si sucediese un hecho trágico o invalidez profesional permanente."
      },
      {
        step: "Rentabilizar el saldo bancario ocioso en carteras que superen el 2.5% anual",
        priority: (clientData.preguntas?.p06 === "No" && clientData.dineroBanco > 5000) ? "Alta" : "Media",
        impact: "Evita la pérdida silenciosa y constante de poder adquisitivo del ahorro bancario tradicional.",
        whyNecessary: "Dejar el dinero excesivo libre parado en cuenta corriente es incurrir en pérdidas reales anuales debido al incremento de precios derivado de la inflación estructural."
      },
      {
        step: "Optimizar el ahorro a largo plazo a través de planes con ventajas fiscales",
        priority: (clientData.preguntas?.p07 === "No") ? "Media" : "Baja",
        impact: "Genera desgravaciones anuales directas disminuyendo tu base imponible del IRPF y transformando impuestos en patrimonio privado.",
        whyNecessary: "Supone un beneficio técnico garantizado donde Hacienda devuelve de inmediato una parte del ahorro efectuado (según tu tipo de retención de nómina), acelerando el interés compuesto."
      }
    ]
  };
};

app.use(express.json());

// API route: Perform high-quality AI analysis of financial & social security risks
app.post("/api/audit", async (req, res) => {
  const clientData = req.body;
  try {
    const ai = getAiClient();

    if (!ai) {
      console.warn("No AI client available (Missing key). Falling back to calculated dynamic report.");
      return res.json(getFallbackResponse(clientData));
    }

    // Prompt content dynamically built utilizing client variables
    const prompt = `
Actúa como un Auditor de Riesgos, Previsión Social de élite y Consultor de Planificación Financiera Patrimonial en España. 
Analiza detalladamente los siguientes datos de un cliente y proporciona recomendaciones y un plan de acción precisos.

DATOS PERSONALES Y FINANCIEROS:
- Nombre: ${clientData.nombre || "No provisto"}
- Edad: ${clientData.edad} años
- Años cotizados a la Seguridad Social: ${clientData.anosCotizados} años
- Base de Cotización mensual: ${clientData.baseCotizacion} €
- Estado Civil: ${clientData.estadoCivil}
- Número de hijos menores de 25 años: ${clientData.numeroHijos}
- Salario neto mensual: ${clientData.salarioNetoMensual} €
- Gastos mensuales habituales (excluyendo préstamos): ${clientData.gastosMensuales} €
- Préstamos, Alquiler o Hipoteca mensual: ${clientData.prestamosAlquilerHipoteca} €
- Dinero líquido en banco: ${clientData.dineroBanco} €
- Dinero invertido en otros productos: ${clientData.dineroInvertido} €

RESPUESTAS A PREGUNTAS CLAVE:
1. Baja laboral (¿Fondo/seguro auxilio 6 meses?): ${clientData.preguntas?.p01}
2. Fallecimiento (¿Familia dispone inmediato de >50k€?): ${clientData.preguntas?.p02}
3. Acceso Sanitario (¿Tiene seguro privado de salud?): ${clientData.preguntas?.p03}
4. Dependencia familiar (¿Ingresos dependen de él/ella?): ${clientData.preguntas?.p04}
5. Jubilación (¿Sabe pensión y tiene plan alternativo?): ${clientData.preguntas?.p05}
6. Inflación (¿Sus ahorros le rentan al menos al 2.5%?): ${clientData.preguntas?.p06}
7. Eficiencia fiscal (¿Optimiza aportación de previsión hasta 1500€/5750€?): ${clientData.preguntas?.p07}

PROYECTOS Y OBJETIVOS:
- Proyectos a medio plazo: ${clientData.proyectosMedioPlazo || "No provisto"}
- Objetivos a largo plazo: ${clientData.objetivosLargoPlazo || "No provisto"}

CÁLCULOS TÉCNICOS EFECTUADOS:
- Tasa de endeudamiento actual: ${clientData.tasaEndeudamiento?.toFixed(1)}%
- Capacidad de ahorro mensual: ${clientData.capacidadAhorro} €
- Beneficios estimados de S.S.:
  * Incapacidad Temporal: ${clientData.prestaciones?.it?.toFixed(0)}€/mes
  * Invalidez Permanente Absoluta (IPA): ${clientData.prestaciones?.ipa?.toFixed(0)}€/mes (Déficit/superávit con gastos del cliente: ${-clientData.deficitIpa}€/mes)
  * Invalidez Permanente Total (IPT): ${clientData.prestaciones?.ipt?.toFixed(0)}€/mes (Déficit/superávit con gastos: ${-clientData.deficitIpt}€/mes)
  * Viudedad: ${clientData.prestaciones?.viudedad?.toFixed(0)}€/mes (Déficit/superávit con gastos: ${-clientData.deficitViudedad}€/mes)
  * Orfandad totalestimada: ${clientData.prestaciones?.orfandad?.toFixed(0)}€/mes (Déficit/superávit con gastos familiares: ${-clientData.deficitOrfandad}€/mes)

Proporciona un resultado estructurado con:
- Un resumen ejecutivo ('summary') empático pero directo.
- Consejos específicos de 'riskAuditAdvice' para Incapacidad Temporal, Invalidez Absoluta, Invalidez Total, Viudedad y Orfandad enfocados en proteger su déficit.
- Consejos de 'financialPlanningAdvice' sobre la Rentabilidad para batir la inflación, Eficiencia Fiscal y Ahorro sistemático para sus metas.
- Una serie de pasos jerarquizados para el plan de acción ('actionPlanSteps') que contenga 'step' (acción), 'priority' (Alta/Media/Baja), 'impact' (beneficio que reportará) y obligatoriamente 'whyNecessary' (especificación analítica de por qué es necesario adoptar esta recomendación exacta según el estado patrimonial y familiar del cliente).

Responde exclusivamente utilizando la estructura de JSON solicitada, sin añadir bloques de markdown ni explicaciones adicionales fuera de él.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Declaración ejecutiva y análisis preliminar del cliente en español." },
            riskAuditAdvice: {
              type: Type.OBJECT,
              properties: {
                incapacidadTemporal: { type: Type.STRING },
                invalidezAbsoluta: { type: Type.STRING },
                invalidezTotal: { type: Type.STRING },
                viudedad: { type: Type.STRING },
                orfandad: { type: Type.STRING }
              }
            },
            financialPlanningAdvice: {
              type: Type.OBJECT,
              properties: {
                inflationBeatStrategy: { type: Type.STRING },
                favorableTaxes: { type: Type.STRING },
                savingsPlan: { type: Type.STRING }
              }
            },
            actionPlanSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.STRING },
                  priority: { type: Type.STRING, description: "Debe ser Alta, Media o Baja" },
                  impact: { type: Type.STRING },
                  whyNecessary: { type: Type.STRING, description: "Justificación de por qué es técnicamente necesario adoptar esta medida y el riesgo específico que mitiga al cliente." }
                },
                required: ["step", "priority", "impact", "whyNecessary"]
              }
            }
          },
          required: ["summary", "riskAuditAdvice", "financialPlanningAdvice", "actionPlanSteps"]
        }
      }
    });

    const resultText = response.text || "{}";
    const resultObj = JSON.parse(resultText.trim());
    res.json(resultObj);
  } catch (err: any) {
    console.warn("AI Generation exception caught (429/Prepayment empty/Quota exhaustion). Gracefully falling back to pre-generator calculations.", err);
    res.json(getFallbackResponse(clientData));
  }
});

// Vite middleware setup
const setupServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
};

setupServer();
