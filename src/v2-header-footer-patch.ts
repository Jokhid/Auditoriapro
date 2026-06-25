const STYLE_ID = "v2-header-footer-style";
const PATCH_FLAG = "data-v2-header-footer";

const logoMarkup = `
  <svg class="v2-brand-logo" viewBox="0 0 120 140" fill="none" aria-hidden="true">
    <rect x="7" y="8" width="18" height="124" fill="#fff"></rect>
    <rect x="95" y="8" width="18" height="124" fill="#fff"></rect>
    <rect x="52" y="8" width="16" height="48" fill="#fff"></rect>
    <rect x="52" y="86" width="16" height="46" fill="#fff"></rect>
    <circle cx="60" cy="70" r="27" fill="#C5A566"></circle>
  </svg>
`;

function ensureStyle() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    header[${PATCH_FLAG}], footer[${PATCH_FLAG}] {
      background: #1A1A1A !important;
      color: #ffffff !important;
      border-color: rgba(255,255,255,.1) !important;
      font-family: inherit;
    }

    header[${PATCH_FLAG}] {
      position: sticky;
      top: 0;
      z-index: 50;
      border-bottom: 1px solid rgba(255,255,255,.1);
    }

    header[${PATCH_FLAG}] .v2-shell,
    footer[${PATCH_FLAG}] .v2-shell {
      width: 100%;
      max-width: 80rem;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      padding: 1rem 1.5rem;
    }

    footer[${PATCH_FLAG}] .v2-shell {
      padding-top: 2.5rem;
      padding-bottom: 2.5rem;
    }

    header[${PATCH_FLAG}] .v2-brand,
    footer[${PATCH_FLAG}] .v2-brand {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
    }

    header[${PATCH_FLAG}] .v2-brand-logo,
    footer[${PATCH_FLAG}] .v2-brand-logo {
      width: 2.5rem;
      height: 3rem;
      flex: 0 0 auto;
      object-fit: contain;
    }

    header[${PATCH_FLAG}] .v2-eyebrow {
      margin: 0;
      font-size: .75rem;
      line-height: 1rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .22em;
      color: #C5A566 !important;
    }

    header[${PATCH_FLAG}] .v2-name,
    footer[${PATCH_FLAG}] .v2-name {
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.75rem;
      font-weight: 900;
      color: #ffffff !important;
    }

    footer[${PATCH_FLAG}] .v2-role {
      margin: .15rem 0 0;
      font-size: .875rem;
      line-height: 1.25rem;
      color: rgba(255,255,255,.6) !important;
    }

    header[${PATCH_FLAG}] .v2-contact,
    footer[${PATCH_FLAG}] .v2-contact {
      display: flex;
      flex-direction: column;
      gap: .2rem;
      text-align: right;
      font-size: .875rem;
      line-height: 1.25rem;
      color: rgba(255,255,255,.75) !important;
      white-space: nowrap;
    }

    header[${PATCH_FLAG}] .v2-contact a,
    footer[${PATCH_FLAG}] .v2-contact a {
      color: rgba(255,255,255,.75) !important;
      text-decoration: none;
    }

    header[${PATCH_FLAG}] .v2-contact a:hover,
    footer[${PATCH_FLAG}] .v2-contact a:hover {
      color: #C5A566 !important;
    }

    @media (max-width: 720px) {
      header[${PATCH_FLAG}] .v2-shell,
      footer[${PATCH_FLAG}] .v2-shell {
        align-items: flex-start;
        flex-direction: column;
      }

      header[${PATCH_FLAG}] .v2-contact,
      footer[${PATCH_FLAG}] .v2-contact {
        text-align: left;
        white-space: normal;
      }
    }
  `;
  document.head.appendChild(style);
}

function applyHeader() {
  const header = document.querySelector("header");
  if (!header || header.getAttribute(PATCH_FLAG) === "true") return;
  header.setAttribute(PATCH_FLAG, "true");
  header.innerHTML = `
    <div class="v2-shell">
      <div class="v2-brand">
        ${logoMarkup}
        <div>
          <p class="v2-eyebrow">Auditoría patrimonial premium</p>
          <h1 class="v2-name">JOSÉ CARLOS HIDALGO</h1>
        </div>
      </div>
      <div class="v2-contact">
        <a href="mailto:josecarlos@hilolegal.es">josecarlos@hilolegal.es</a>
        <a href="tel:647506040">647 50 60 40</a>
      </div>
    </div>
  `;
}

function applyFooter() {
  const footer = document.querySelector("footer");
  if (!footer || footer.getAttribute(PATCH_FLAG) === "true") return;
  footer.setAttribute(PATCH_FLAG, "true");
  footer.innerHTML = `
    <div class="v2-shell">
      <div class="v2-brand">
        ${logoMarkup}
        <div>
          <p class="v2-name">JOSÉ CARLOS HIDALGO</p>
          <p class="v2-role">Consultor financiero, hipotecario y patrimonial</p>
        </div>
      </div>
      <div class="v2-contact">
        <a href="mailto:josecarlos@hilolegal.es">josecarlos@hilolegal.es</a>
        <a href="tel:647506040">647 50 60 40</a>
      </div>
    </div>
  `;
}

function applyPatch() {
  if (typeof document === "undefined") return;
  ensureStyle();
  applyHeader();
  applyFooter();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.setTimeout(applyPatch, 100);
  window.setTimeout(applyPatch, 500);
  window.setTimeout(applyPatch, 1200);
  const observer = new MutationObserver(applyPatch);
  observer.observe(document.body, { childList: true, subtree: true });
}
