// Shared between vk-tabla/export.js and jk-sorszam/export.js: the parts of
// building a print/PDF document that don't depend on either page's own
// content — cloning a live element into the print document, wrapping
// content in a titled section, the brand header/footer chrome (both pages
// show the same "Digit" wordmark and dot marks), and wiring the export
// button to window.print(). Each page's own export.js still owns its
// actual sections (which live elements to clone, in what order) and its
// page-specific header subtitle/meta line and footer tagline.

function cloneById(id) {
  const el = document.getElementById(id);
  return el ? el.cloneNode(true) : null;
}

function makeSection(titleText, hintText, ...children) {
  const sec = document.createElement("section");
  sec.className = "print-section";

  const h2 = document.createElement("h2");
  h2.textContent = titleText;
  sec.appendChild(h2);

  if (hintText) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = hintText;
    sec.appendChild(p);
  }

  children.forEach(c => { if (c) sec.appendChild(c); });
  return sec;
}

// the top of the document: colored strip, kicker, "Digit" title +
// brand dots — identical on both pages. Returns a fragment; the caller
// appends its own page-specific subtitle/meta paragraphs after it.
function buildPrintBrandHeader() {
  const frag = document.createDocumentFragment();

  // a colored strip at the very top of the document — the same gradient
  // treatment as the closing footer, so the report is bookended by the
  // brand instead of just trailing off with it at the end
  const bar = document.createElement("div");
  bar.className = "print-header-bar";
  frag.appendChild(bar);

  const kicker = document.createElement("p");
  kicker.className = "print-kicker";
  kicker.textContent = "Automatikusan generált összefoglaló";
  frag.appendChild(kicker);

  const brandRow = document.createElement("div");
  brandRow.className = "print-brand-row";

  const title = document.createElement("h1");
  title.className = "print-title";
  title.textContent = "Digit";
  brandRow.appendChild(title);

  const dots = document.createElement("div");
  dots.className = "print-brand-dots";
  dots.innerHTML = "<span></span><span></span><span></span><span></span>";
  brandRow.appendChild(dots);

  frag.appendChild(brandRow);
  return frag;
}

// a small branded closing strip — a colored top edge plus the wordmark, in
// the same gradient treatment as the landing page's hero title, so an
// exported/printed page still points back to where it came from. Only the
// tagline differs between the two pages.
function buildPrintFooter(taglineText) {
  const footer = document.createElement("div");
  footer.className = "print-footer";

  const brand = document.createElement("p");
  brand.className = "print-footer-brand";
  brand.textContent = "Digit";
  footer.appendChild(brand);

  const tagline = document.createElement("p");
  tagline.className = "print-footer-tagline";
  tagline.textContent = taglineText;
  footer.appendChild(tagline);

  return footer;
}

// wires the export button to the standard build-then-print flow: a static,
// dependency-free site has no other way to produce a PDF — window.print()
// and its dialog (pick a printer, or "Save as PDF") is the only mechanism,
// so print and download are really the same action here.
function wirePrintExport(exportBtn, buildPrintDoc) {
  function exportPdf() {
    buildPrintDoc();
    document.body.classList.add("printing");
    window.print();
  }

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing");
  });

  exportBtn.addEventListener("click", exportPdf);
}
