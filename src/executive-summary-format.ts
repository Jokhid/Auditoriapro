const SUMMARY_SECTION_TEXT = 'resumen ejecutivo';
const SUMMARY_STYLE_ID = 'audit-executive-summary-paragraph-style';

const paragraphBreakMarkers = [
  'El análisis cruza ',
  'La prioridad no es ',
  'La brecha mensual ',
  'Con una rentabilidad ',
  'Si la proyección ',
  'Las deficiencias graves ',
  'Las deficiencias moderadas ',
  'Las deficiencias leves ',
  'Como conclusión operativa,'
];

function installExecutiveSummaryStyles() {
  if (document.getElementById(SUMMARY_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SUMMARY_STYLE_ID;
  style.textContent = `
    .audit-executive-summary-paragraphs {
      color: #475569;
      font-size: 14px;
      line-height: 1.68;
    }

    .audit-executive-summary-paragraphs p {
      margin: 0 0 12px;
    }

    .audit-executive-summary-paragraphs p:last-child {
      margin-bottom: 0;
    }

    @media print {
      .audit-executive-summary-paragraphs {
        font-size: 9pt;
        line-height: 1.52;
      }

      .audit-executive-summary-paragraphs p {
        margin-bottom: 3mm;
      }
    }
  `;
  document.head.appendChild(style);
}

function findExecutiveSummarySection() {
  const sections = Array.from(document.querySelectorAll('main section'));
  return sections.find((section) =>
    (section.textContent || '').toLowerCase().includes(SUMMARY_SECTION_TEXT),
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function splitSummaryText(text: string) {
  let formatted = text.replace(/\s+/g, ' ').trim();

  paragraphBreakMarkers.forEach((marker) => {
    formatted = formatted.replace(marker, '\n\n' + marker);
  });

  let paragraphs = formatted
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) return paragraphs;

  const sentences = formatted.match(/[^.!?]+[.!?]+/g) || [formatted];
  paragraphs = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(' ').trim());
  }

  return paragraphs.filter(Boolean);
}

function findSummaryTextBlock(section: Element) {
  const candidates = Array.from(section.querySelectorAll('article, p, div')).filter((element) => {
    const text = (element.textContent || '').trim();
    const hasNestedParagraph = element.querySelector('p');
    const isSectionLike = text.toLowerCase().includes(SUMMARY_SECTION_TEXT) && text.length < 120;
    return text.length > 420 && !hasNestedParagraph && !isSectionLike;
  });

  return candidates.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
}

function formatExecutiveSummaryParagraphs() {
  installExecutiveSummaryStyles();

  const section = findExecutiveSummarySection();
  if (!section) return;

  const target = findSummaryTextBlock(section);
  if (!target || target.getAttribute('data-summary-formatted') === 'true') return;

  const text = (target.textContent || '').trim();
  const paragraphs = splitSummaryText(text);
  if (paragraphs.length < 2) return;

  const html = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const replacement = target.tagName.toLowerCase() === 'p'
    ? document.createElement('div')
    : target;

  replacement.classList.add('audit-executive-summary-paragraphs');
  replacement.setAttribute('data-summary-formatted', 'true');
  replacement.innerHTML = html;

  if (replacement !== target) {
    target.replaceWith(replacement);
  }
}

function scheduleExecutiveSummaryFormat() {
  window.setTimeout(formatExecutiveSummaryParagraphs, 50);
}

document.addEventListener('DOMContentLoaded', scheduleExecutiveSummaryFormat);
window.addEventListener('load', scheduleExecutiveSummaryFormat);
document.addEventListener('input', scheduleExecutiveSummaryFormat);
document.addEventListener('change', scheduleExecutiveSummaryFormat);
window.setTimeout(formatExecutiveSummaryParagraphs, 500);
window.setTimeout(formatExecutiveSummaryParagraphs, 1500);
