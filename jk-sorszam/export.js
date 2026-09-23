// Builds a print/PDF-only document (#print-doc) out of the already-rendered
// live content, then hands off to the browser's native print dialog — same
// mechanism as the VK-tábla's export.js, and for the same reason: a
// static, dependency-free site has no other way to produce a PDF. The
// document is a single reading column, not a copy of the on-screen layout.
//
// cloneById/makeSection/buildPrintBrandHeader/buildPrintFooter/
// wirePrintExport live in ../print-export.js, shared with the VK-tábla's
// export.js — only the sections and header/footer copy below are specific
// to this page.

(function () {
  const exportBtn = document.getElementById("export-pdf-btn");
  const printDoc = document.getElementById("print-doc");

  function buildSequenceSection() {
    const svg = cloneById("sim-sequence");
    return makeSection(
      "Állapotsorozat",
      "A számláló a megadott sorrendben lépked, a ciklus végén visszatérve az első állapotra.",
      svg
    );
  }

  function buildStateTableSection() {
    const table = cloneById("state-table");
    if (table) table.id = "print-state-table";
    return makeSection(
      "Állapottábla",
      "A tervezett ciklus — az aktuális állapotból mindig a táblázat szerinti következő állapotba lép a számláló.",
      table
    );
  }

  function buildExcitationSection() {
    const table = cloneById("excitation-table");
    if (table) table.id = "print-excitation-table";
    return makeSection(
      "Gerjesztési táblázat",
      "A J-K gerjesztési táblázat alapján minden tárolóhoz meghatározható, milyen J és K bemenet szükséges az adott bitváltáshoz — „–” jelöli, ha az érték közömbös.",
      table
    );
  }

  function buildEquationsSection() {
    const eqs = cloneById("ff-equations");
    return makeSection(
      "Minimalizált gerjesztő függvények",
      "A ciklusban nem szereplő állapotok közömbösként kezelve, Karnaugh-táblával minimalizálva — ezek vezérlik a szimulációt is.",
      eqs
    );
  }

  function buildCircuitSection() {
    const diagram = cloneById("circuit-diagram");
    return makeSection(
      "Kapcsolási vázlat",
      "A J-K tárolók közös órajellel — mindegyik J és K bemenetét a fenti minimalizált függvények vezérlik.",
      diagram
    );
  }

  function buildHeader() {
    const frag = buildPrintBrandHeader();

    const subtitle = document.createElement("p");
    subtitle.className = "print-subtitle";
    subtitle.textContent = `${NUM_BITS}-bites J-K szekvenciális számláló`;
    frag.appendChild(subtitle);

    const letters = Array.from({ length: NUM_BITS }, (_, slot) => letterAt(slot));
    const meta = document.createElement("p");
    meta.className = "print-meta";
    const dateStr = new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
    meta.textContent = `Tárolók: ${letters.join(", ")}  ·  Ciklus: ${SEQUENCE.join(" → ")} → (${SEQUENCE[0]})  ·  Generálva: ${dateStr}`;
    frag.appendChild(meta);

    return frag;
  }

  function buildPrintDoc() {
    printDoc.innerHTML = "";

    printDoc.appendChild(buildHeader());
    printDoc.appendChild(buildSequenceSection());
    printDoc.appendChild(buildStateTableSection());
    printDoc.appendChild(buildExcitationSection());
    printDoc.appendChild(buildEquationsSection());
    printDoc.appendChild(buildCircuitSection());
    printDoc.appendChild(buildPrintFooter(
      "Ingyenes, böngészőben futó eszköz digitális technika tanuláshoz — telepítés és regisztráció nélkül, bármikor újra elérhető."
    ));
  }

  wirePrintExport(exportBtn, buildPrintDoc);
})();
