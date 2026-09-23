// Builds a print/PDF-only document (#print-doc) out of the already-rendered
// live content, then hands off to the browser's native print dialog —
// that single mechanism covers reading (print preview), printing, and
// "Save as PDF" without any extra library. The document is deliberately
// laid out as a single reading column (see print.css), not a copy of the
// two-column web layout, since arbitrary-width K-maps/gate diagrams don't
// reliably fit a rigid multi-column print grid.
//
// cloneById/makeSection/buildPrintBrandHeader/buildPrintFooter/
// wirePrintExport live in ../print-export.js, shared with the
// JK-sorszám page's export.js — only the sections and header/footer copy
// below are specific to this page.

(function () {
  const exportBtn = document.getElementById("export-pdf-btn");
  const printDoc = document.getElementById("print-doc");

  // a labeled sub-block within a section (e.g. "Diszjunktív" / "Konjunktív"
  // halves of the same topic), so the reader always knows which side of
  // the duality they're looking at without needing the web page's
  // side-by-side column layout
  function subBlock(labelText, ...children) {
    const wrap = document.createElement("div");
    wrap.className = "kmap-subblock";
    const h3 = document.createElement("h3");
    h3.textContent = labelText;
    wrap.appendChild(h3);
    children.forEach(c => { if (c) wrap.appendChild(c); });
    return wrap;
  }

  function buildTruthTableSection() {
    const table = cloneById("truth-table");
    if (table) table.id = "print-truth-table";
    return makeSection(
      "Igazságtáblázat",
      "Minden sorszám, a hozzá tartozó bitminta és az F érték.",
      table
    );
  }

  function buildSorszamSection() {
    const sigma = cloneById("formula-sigma");
    const pi = cloneById("formula-pi");
    if (sigma) sigma.classList.remove("formula-active");
    if (pi) pi.classList.remove("formula-active");
    return makeSection(
      "Sorszámos alak",
      "A diszjunktív (Σ, minterm) és konjunktív (Π, maxterm) sorszámos alak — a kettő egymás komplemensre invertált párja.",
      sigma,
      pi
    );
  }

  function buildKmapSection() {
    const disj = subBlock(
      "Diszjunktív — 1-csoportok",
      cloneById("kmap-planes"),
      cloneById("kmap-legend")
    );
    const conj = subBlock(
      "Konjunktív — 0-csoportok",
      cloneById("kmap-planes2"),
      cloneById("kmap-legend2")
    );
    const sec = makeSection(
      "V-K táblák",
      "A szaggatott körvonal statikus hazárd javítására felvett, egyébként redundáns csoportot jelöl.",
      disj,
      conj
    );
    sec.classList.add("print-section-loose");
    return sec;
  }

  function buildMinimalSection() {
    return makeSection(
      "Minimál alakok",
      null,
      subBlock("Diszjunktív (szorzatösszeg)", cloneById("minimal-formula")),
      subBlock("Konjunktív (összegszorzat)", cloneById("conjunctive-minimal-formula"))
    );
  }

  function buildGateSection(titleText, hintText, diagramId, formulaId) {
    const diagram = cloneById(diagramId);
    const formula = formulaId ? cloneById(formulaId) : null;
    return makeSection(titleText, hintText, diagram, formula);
  }

  // unlike the single-sided NAND/NOR sections, the NÉV realization's title
  // doesn't say which side is which (see index.html) — on screen the
  // "Diszjunktív"/"Konjunktív" column headers above the pipeline grid supply
  // that, but the print document has no such column, so it needs its own
  // sub-labels here, same pattern as buildMinimalSection above
  function buildNameGateSection() {
    return makeSection(
      "Realizálás NÉV kapukkal",
      "A minimál alakok közvetlen, tankönyvi megvalósítása NEM, ÉS és VAGY kapukkal.",
      subBlock("Diszjunktív", cloneById("name-gate-diagram")),
      subBlock("Konjunktív", cloneById("name-conj-gate-diagram"))
    );
  }

  function buildHeader() {
    const frag = buildPrintBrandHeader();

    const subtitle = document.createElement("p");
    subtitle.className = "print-subtitle";
    subtitle.textContent = `${NUM_VARS}-változós logikai függvény elemzése (${LETTERS.join(", ")})`;
    frag.appendChild(subtitle);

    const sorted = [...selected].sort((a, b) => a - b);
    const meta = document.createElement("p");
    meta.className = "print-meta";
    const dateStr = new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
    meta.textContent = `F(${LETTERS.join(", ")}) = Σ(${sorted.join(", ") || "—"})  ·  Generálva: ${dateStr}`;
    frag.appendChild(meta);

    return frag;
  }

  function buildPrintDoc() {
    printDoc.innerHTML = "";

    printDoc.appendChild(buildHeader());
    printDoc.appendChild(buildSorszamSection());
    printDoc.appendChild(buildTruthTableSection());
    printDoc.appendChild(buildKmapSection());
    printDoc.appendChild(buildMinimalSection());
    printDoc.appendChild(buildNameGateSection());
    printDoc.appendChild(buildGateSection(
      "Realizálás NAND kapukkal",
      "Ugyanez a hálózat kizárólag NAND kapukkal is felépíthető, De Morgan-azonosság alapján.",
      "nand-gate-diagram", "nand-formula"
    ));
    printDoc.appendChild(buildGateSection(
      "Realizálás NOR kapukkal",
      "Ugyanez a hálózat kizárólag NOR kapukkal is felépíthető — a NAND-NAND duálisa.",
      "nor-gate-diagram", "nor-formula"
    ));
    printDoc.appendChild(buildPrintFooter(
      "Ingyenes, böngészőben futó eszköz 3–5 változós logikai függvények elemzéséhez — telepítés és regisztráció nélkül, bármikor újra elérhető."
    ));
  }

  wirePrintExport(exportBtn, buildPrintDoc);
})();
