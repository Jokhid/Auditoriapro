import { jsPDF } from "jspdf";

type PriorityTone = "grave" | "moderada" | "leve";
type PriorityItem = {
  priority: string;
  title: string;
  description: string;
  tone: PriorityTone;
};

const PRIORITY_MAP_ID = "executive-priority-map";
const STYLE_ID = "executive-priority-map-style";

const priorityItems: PriorityItem[] = [
  {
    priority: "Alta",
    title: "Proteger ingresos y familia",
    description: "Cubrir primero las brechas que podrían comprometer vivienda, gastos fijos y estabilidad familiar ante baja, invalidez o fallecimiento.",
    tone: "grave",
  },
  {
    priority: "Alta",
    title: "Consolidar reserva de emergencia",
    description: "Separar una reserva líquida de 6 a 9 meses de gasto para evitar endeudamiento o venta forzada de inversiones.",
    tone: "grave",
  },
  {
    priority: "Media",
    title: "Reducir brecha de jubilación",
    description: "Ajustar ahorro sistemático, rentabilidad objetivo y horizonte temporal para acercar la proyección al capital necesario.",
    tone: "moderada",
  },
  {
    priority: "Media",
    title: "Ordenar patrimonio e inversión",
    description: "Asignar cada bloque de dinero a una función concreta: liquidez, objetivos, inversión, protección y jubilación.",
    tone: "moderada",
  },
  {
    priority: "Preventiva",
    title: "Reforzar protocolo legal y documental",
    description: "Mantener testamento, pólizas, beneficiarios y documentación crítica localizables para la familia.",
    tone: "leve",
  },
];

const toneColor = (tone: PriorityTone) => tone === "grave" ? "#DC2626" : tone === "moderada" ? "#F97316" : "#16A34A";

function ensureStyle() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PRIORITY_MAP_ID} {
      margin-top: 1.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      background: #ffffff;
      padding: 1.25rem;
      color: #111827;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }
    #${PRIORITY_MAP_ID} * { color: #111827; }
    #${PRIORITY_MAP_ID} h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 900;
      letter-spacing: 0;
    }
    #${PRIORITY_MAP_ID} .priority-map-lead {
      margin: .5rem 0 1rem;
      font-size: .875rem;
      line-height: 1.6;
    }
    #${PRIORITY_MAP_ID} .priority-map-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: .75rem;
    }
    #${PRIORITY_MAP_ID} .priority-map-card {
      border: 1px solid #e2e8f0;
      border-left-width: 5px;
      border-radius: .5rem;
      background: #f8fafc;
      padding: .9rem;
    }
    #${PRIORITY_MAP_ID} .priority-map-priority {
      display: inline-flex;
      margin-bottom: .45rem;
      font-size: .7rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    #${PRIORITY_MAP_ID} .priority-map-title {
      margin: 0 0 .35rem;
      font-size: .92rem;
      font-weight: 900;
    }
    #${PRIORITY_MAP_ID} .priority-map-description {
      margin: 0;
      font-size: .82rem;
      line-height: 1.55;
    }
  `;
  document.head.appendChild(style);
}

function findExecutiveSection() {
  if (typeof document === "undefined") return null;
  return Array.from(document.querySelectorAll("section")).find((section) => {
    const heading = section.querySelector("h2");
    return heading?.textContent?.toLowerCase().includes("resumen ejecutivo");
  }) ?? null;
}

function renderPriorityMap() {
  const section = findExecutiveSection();
  if (!section || section.querySelector(`#${PRIORITY_MAP_ID}`)) return;
  ensureStyle();

  const button = Array.from(section.querySelectorAll("button")).find((item) => item.textContent?.toLowerCase().includes("descargar"));
  const container = document.createElement("div");
  container.id = PRIORITY_MAP_ID;
  container.innerHTML = `
    <h3>Mapa de prioridades</h3>
    <p class="priority-map-lead">Síntesis final de actuación para transformar el diagnóstico en decisiones concretas, ordenadas por urgencia y efecto patrimonial.</p>
    <div class="priority-map-grid">
      ${priorityItems.map((item) => `
        <article class="priority-map-card" style="border-left-color:${toneColor(item.tone)}">
          <p class="priority-map-priority">Prioridad ${item.priority}</p>
          <h4 class="priority-map-title">${item.title}</h4>
          <p class="priority-map-description">${item.description}</p>
        </article>
      `).join("")}
    </div>
  `;

  if (button?.parentElement) {
    section.insertBefore(container, button);
  } else {
    section.appendChild(container);
  }
}

function installDomPatch() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const tick = () => renderPriorityMap();
  window.setTimeout(tick, 250);
  window.setTimeout(tick, 900);
  const observer = new MutationObserver(tick);
  observer.observe(document.body, { childList: true, subtree: true });
}

function addPriorityMapToPdf(doc: jsPDF) {
  const pageHeight = 297;
  const margin = 14;
  let y = 176;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("Mapa de prioridades", margin, y);
  y += 7;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(17, 24, 39);
  const lead = doc.splitTextToSize("Síntesis final de actuación para transformar el diagnóstico en decisiones concretas, ordenadas por urgencia y efecto patrimonial.", 178);
  doc.text(lead, margin, y);
  y += lead.length * 4 + 4;

  priorityItems.forEach((item, index) => {
    if (y > pageHeight - 38) {
      doc.addPage();
      y = 24;
    }
    const x = index % 2 === 0 ? margin : 106;
    const cardY = y;
    const cardW = 88;
    const cardH = 30;
    if (index % 2 === 0 && index > 0) y += cardH + 5;

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "FD");
    const color = toneColor(item.tone);
    const rgb = color.match(/\w\w/g)?.map((part) => parseInt(part, 16)) ?? [17, 24, 39];
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, cardY, 1.8, cardH, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(17, 24, 39);
    doc.text(`Prioridad ${item.priority}`, x + 5, cardY + 6);
    doc.setFontSize(7.8);
    doc.text(doc.splitTextToSize(item.title, cardW - 10), x + 5, cardY + 12);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(6.7);
    doc.setTextColor(17, 24, 39);
    doc.text(doc.splitTextToSize(item.description, cardW - 10).slice(0, 3), x + 5, cardY + 20);
  });
}

function installPdfPatch() {
  const api = jsPDF.API as unknown as { save?: (...args: unknown[]) => unknown; __priorityMapPatch?: boolean };
  if (api.__priorityMapPatch || typeof api.save !== "function") return;
  const originalSave = api.save;
  api.__priorityMapPatch = true;
  api.save = function patchedSave(this: jsPDF, ...args: unknown[]) {
    try {
      addPriorityMapToPdf(this);
    } catch (error) {
      console.warn("No se pudo añadir el mapa de prioridades al PDF", error);
    }
    return originalSave.apply(this, args);
  };
}

installDomPatch();
installPdfPatch();
