const MIN_INDEX = 0;
const ALL_LETTERS = ["A", "B", "C", "D", "E"];

let NUM_VARS;
let LETTERS;
let PLACE_VALUES;
let MAX_INDEX;
// assignment[i] = which letter sits at PLACE_VALUES[i]
let assignment;

const clearFab = document.getElementById("clear-fab");
const clearConfirmOverlay = document.getElementById("clear-confirm-overlay");
const clearConfirmCancel = document.getElementById("clear-confirm-cancel");
const clearConfirmOk = document.getElementById("clear-confirm-ok");
const formulaSigmaEl = document.getElementById("formula-sigma");
const formulaPiEl = document.getElementById("formula-pi");
const indexGridEl = document.getElementById("index-grid");
const modeToggleButtons = document.querySelectorAll(".mode-toggle-btn");
const sorszamHintSigma = document.getElementById("sorszam-hint-sigma");
const sorszamHintPi = document.getElementById("sorszam-hint-pi");
const tableHeadRow = document.getElementById("table-head-row");
const tableBody = document.querySelector("#truth-table tbody");
const weightAssignEl = document.getElementById("weight-assign");
const weightPresets = document.querySelectorAll(".chip-btn[data-preset]");
const varCountButtons = document.querySelectorAll(".var-count-btn");
const kmapPlanesEl = document.getElementById("kmap-planes");
const kmapLegend = document.getElementById("kmap-legend");
const minimalFormulaEl = document.getElementById("minimal-formula");
const hazardToggle = document.getElementById("hazard-toggle");
const twoInputToggle = document.getElementById("two-input-toggle");
const conjunctiveMinimalFormulaEl = document.getElementById("conjunctive-minimal-formula");
const kmapPlanesEl2 = document.getElementById("kmap-planes2");
const kmapLegend2 = document.getElementById("kmap-legend2");
const nandGateDiagramEl = document.getElementById("nand-gate-diagram");
const nameGateDiagramEl = document.getElementById("name-gate-diagram");
const norGateDiagramEl = document.getElementById("nor-gate-diagram");
const nameConjGateDiagramEl = document.getElementById("name-conj-gate-diagram");
const nandFormulaEl = document.getElementById("nand-formula");
const norFormulaEl = document.getElementById("nor-formula");

const GROUP_COLORS = ["#e6194b", "#3b5bfd", "#3cb44b", "#f58231", "#911eb4", "#00b3b3", "#c9a227", "#f032e6", "#469990", "#9a6324"];
// overlapping group boxes (e.g. a small group's cells sitting entirely
// inside a bigger group's cell range, or two groups sharing an edge) would
// otherwise land on the exact same pixels and hide one another — staggering
// the inset (so later/smaller groups nest visibly inside earlier/bigger
// ones, since groups arrive size-sorted) keeps every box's outline visible
// even when several coincide
const GROUP_INSETS = [4, 8, 12, 16];

// Hungarian linking vowel for a group's size when spoken as a number-noun
// (egyES, kettES, négyES, nyolcAS, tizenhatOS, harminckettES) — every
// prime-implicant size that can occur is a power of two up to 2^NUM_VARS,
// so this only ever needs to cover 1..32, not every integer
const GROUP_SIZE_SUFFIX = { 1: "es", 2: "es", 4: "es", 8: "as", 16: "os", 32: "es" };
function groupSizeLabel(size) {
  return `${size}-${GROUP_SIZE_SUFFIX[size] ?? "es"} csoport`;
}

let selected = new Set();
let hazardEnabled = false;
let piMode = false;
let twoInputOnly = false;
const indexGridButtons = new Map();

// a single click on something this destructive (wipes every input with no
// undo) is one accidental tap — or one "friend" who grabbed the mouse —
// away from wiping a whole worked example, so it opens this confirm dialog
// instead of acting immediately
function openClearConfirm() {
  clearConfirmOverlay.classList.add("modal-overlay-visible");
  clearConfirmCancel.focus();
  document.addEventListener("keydown", onClearConfirmKeydown);
}

function closeClearConfirm() {
  clearConfirmOverlay.classList.remove("modal-overlay-visible");
  document.removeEventListener("keydown", onClearConfirmKeydown);
  clearFab.focus();
}

function onClearConfirmKeydown(e) {
  if (e.key === "Escape") closeClearConfirm();
}

function configureVars(n) {
  NUM_VARS = n;
  LETTERS = ALL_LETTERS.slice(0, n);
  PLACE_VALUES = LETTERS.map((_, i) => 1 << (n - 1 - i));
  MAX_INDEX = (1 << n) - 1;
  assignment = LETTERS.slice();
}

function syncVarCountButtons() {
  varCountButtons.forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.n) === NUM_VARS);
  });
}

function setVarCount(n) {
  if (n === NUM_VARS) return;
  configureVars(n);
  selected = new Set();
  syncVarCountButtons();
  buildWeightAssign();
  buildIndexGrid(indexGridEl, indexGridButtons);
  render();
}

function toggleIndex(i) {
  if (selected.has(i)) {
    selected.delete(i);
  } else {
    selected.add(i);
  }
  render();
}

// a stable, always-full-range 0..MAX_INDEX grid of toggle buttons — unlike
// the inline Σ()/Π() chips (which reflow as the selection changes), these
// don't reflow as selections change *within* a mode, so it's a more
// reliable surface for rapid multi-click editing. Each button always
// toggles the same real/natural index i no matter where it currently sits
// in the grid — only its printed number, position and active state are
// re-synced per mode (see syncIndexGrid)
function buildIndexGrid(containerEl, buttonMap) {
  containerEl.innerHTML = "";
  buttonMap.clear();
  for (let i = MIN_INDEX; i <= MAX_INDEX; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.addEventListener("click", () => toggleIndex(i));
    containerEl.appendChild(btn);
    buttonMap.set(i, btn);
  }
}

// highlightValue: which literal F value this grid emphasizes — 1 for the
// minterm/Σ view, 0 for the maxterm/Π view — same convention as the K-map
// cells, so both read consistently.
//
// complement: in Π mode, both the printed number AND the button's position
// follow the bitwise complement of the real index, not the real index
// itself — so the grid always reads 0, 1, 2, ... left to right regardless
// of mode, matching the Π(...) formula's own ascending list right above it,
// rather than running backwards the way an unreordered complement would
// (the real index driving each button never changes, only which slot it's
// moved into — see buildIndexGrid)
function syncIndexGrid(containerEl, buttonMap, highlightValue, complement) {
  const entries = [...buttonMap].map(([i, btn]) => ({
    i, btn, displayN: complement ? (MAX_INDEX ^ i) : i,
  }));
  entries.sort((a, b) => a.displayN - b.displayN);
  entries.forEach(({ i, btn, displayN }) => {
    const f = selected.has(i) ? 1 : 0;
    const isHighlighted = f === highlightValue;
    btn.textContent = displayN;
    btn.classList.toggle("active", isHighlighted);
    btn.setAttribute("aria-pressed", isHighlighted ? "true" : "false");
    containerEl.appendChild(btn);
  });
}

function superscript(n) {
  const map = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴" };
  return String(n).split("").map(c => map[c] ?? c).join("");
}

function buildWeightAssign() {
  weightAssignEl.innerHTML = "";
  weightAssignEl.style.gridTemplateColumns = `repeat(${PLACE_VALUES.length}, 1fr)`;
  PLACE_VALUES.forEach((weight, i) => {
    const slot = document.createElement("div");
    slot.className = "weight-slot";

    const label = document.createElement("div");
    label.className = "weight-label";
    label.textContent = `2${superscript(PLACE_VALUES.length - 1 - i)} = ${weight}`;
    slot.appendChild(label);

    const select = document.createElement("select");
    select.dataset.slot = i;
    LETTERS.forEach(letter => {
      const opt = document.createElement("option");
      opt.value = letter;
      opt.textContent = letter;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => setAssignment(i, select.value));
    slot.appendChild(select);

    weightAssignEl.appendChild(slot);
  });
  syncWeightSelects();
  updatePresetLabels();
}

// the exact weight breakdown (A=8 ... D=1) is already spelled out in the
// slot labels right above these buttons — repeating it here just made the
// buttons wrap to their own row each; the short form still says what each
// one does, and the full detail is still one hover away via title
function updatePresetLabels() {
  const first = LETTERS[0];
  const last = LETTERS[LETTERS.length - 1];
  weightPresets.forEach(btn => {
    if (btn.dataset.preset === "default") {
      btn.textContent = `${first}‑${last} csökkenő`;
      btn.title = `${first}=${PLACE_VALUES[0]} … ${last}=1`;
    }
    if (btn.dataset.preset === "reverse") {
      btn.textContent = `${first}‑${last} növekvő`;
      btn.title = `${first}=1 … ${last}=${PLACE_VALUES[0]}`;
    }
  });
}

function syncWeightSelects() {
  const selects = weightAssignEl.querySelectorAll("select");
  selects.forEach(sel => {
    const i = Number(sel.dataset.slot);
    sel.value = assignment[i];
  });
}

function setAssignment(slotIndex, letter) {
  const currentIndex = assignment.indexOf(letter);
  if (currentIndex === slotIndex) return;
  // swap so the mapping always stays a valid permutation
  [assignment[slotIndex], assignment[currentIndex]] = [assignment[currentIndex], assignment[slotIndex]];
  syncWeightSelects();
  render();
}

function applyPreset(name) {
  if (name === "default") assignment = LETTERS.slice();
  if (name === "reverse") assignment = LETTERS.slice().reverse();
  syncWeightSelects();
  render();
}

function bitsForIndex(n) {
  // returns { A: 0/1, B: 0/1, ... } regardless of column order
  const bits = {};
  PLACE_VALUES.forEach((weight, i) => {
    const letter = assignment[i];
    bits[letter] = (n & weight) ? 1 : 0;
  });
  return bits;
}

function renderTableHead() {
  tableHeadRow.innerHTML = "";
  const thIndex = document.createElement("th");
  thIndex.textContent = "#";
  thIndex.title = "Sorszám";
  tableHeadRow.appendChild(thIndex);

  PLACE_VALUES.forEach((weight, i) => {
    const th = document.createElement("th");
    th.className = "var-col";
    th.textContent = assignment[i];
    tableHeadRow.appendChild(th);
  });

  const thF = document.createElement("th");
  thF.textContent = "F";
  tableHeadRow.appendChild(thF);
}

function literalHtml(letter, bit) {
  return bit === 1 ? letter : `<span class="overline">${letter}</span>`;
}

// renders "F(...) = Σ(0, 2, 5)" / "F(...) = Π(1, 3, 4)" with every listed
// index as its own clickable/keyboard-toggleable chip — this is the primary
// input surface now that the separate Bemenet card is gone. Σ only ever
// lists 1s (so clicking there can only remove) and Π only ever lists 0s (so
// clicking there can only add); together the two cover every index.
// `toggleValue` maps a displayed number back to the real index to flip —
// identity by default, but Π displays complemented numbers (see
// renderMaxterm) while still needing to toggle the real one
function renderIndexFormula(el, prefix, indices, toggleValue = n => n) {
  el.innerHTML = "";
  el.appendChild(document.createTextNode(`F(${LETTERS.join(", ")}) = ${prefix}(`));

  indices.forEach((n, i) => {
    if (i > 0) el.appendChild(document.createTextNode(", "));

    const target = toggleValue(n);
    const chip = document.createElement("span");
    chip.className = "index-chip";
    chip.textContent = n;
    chip.tabIndex = 0;
    chip.setAttribute("role", "button");
    chip.title = "Kattints a váltáshoz";
    chip.addEventListener("click", () => toggleIndex(target));
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleIndex(target);
      }
    });
    el.appendChild(chip);
  });

  el.appendChild(document.createTextNode(")"));
}

// indices where F = 0 — the maxterms / the conjunctive (POS) side's targets
function complementSet() {
  const comp = new Set();
  for (let n = MIN_INDEX; n <= MAX_INDEX; n++) {
    if (!selected.has(n)) comp.add(n);
  }
  return comp;
}

// the single Sorszámos alak card is one keypad shared by both readings of
// the same underlying `selected` set. Both the Σ() and Π() index formulas
// stay visible at all times (so the conversion between them is always on
// screen and either one can be used to edit) — the Σ/Π mode toggle just
// decides which reading the keypad below follows
function renderSorszamCard() {
  modeToggleButtons.forEach(btn => {
    btn.classList.toggle("active", (btn.dataset.mode === "pi") === piMode);
  });
  formulaSigmaEl.classList.toggle("formula-active", !piMode);
  formulaPiEl.classList.toggle("formula-active", piMode);
  sorszamHintSigma.hidden = piMode;
  sorszamHintPi.hidden = !piMode;

  const sorted = [...selected].sort((a, b) => a - b);
  renderIndexFormula(formulaSigmaEl, "Σ", sorted);

  const zeros = [...complementSet()].sort((a, b) => a - b);
  // sorszámos→konjunktív átalakítás: invert every Σ number, then the
  // numbers missing from that inverted set are the Π/maxterm list — not
  // simply the raw zero indices. That's exactly the bitwise complement of
  // each zero (MAX_INDEX ^ z), independently of how many are missing
  const displayZeros = zeros.map(z => MAX_INDEX ^ z).sort((a, b) => a - b);
  renderIndexFormula(formulaPiEl, "Π", displayZeros, d => MAX_INDEX ^ d);
}

// --- Prime implicant computation (Quine-McCluskey over bit patterns) ---
// Variable-count agnostic: operates purely on N-bit index patterns, decoupled
// from any particular visual K-map grid shape. bits[i] corresponds to
// PLACE_VALUES[i] (0/1 fixed, -1 = free/"don't care within this group").

function computePrimeImplicants(targetSet) {
  if (targetSet.size === 0) return [];

  const keyOf = bits => bits.join(",");

  const baseTerms = [...targetSet].map(m => ({
    bits: PLACE_VALUES.map(w => (m & w) ? 1 : 0),
    minterms: new Set([m]),
  }));

  const allTerms = new Map();
  baseTerms.forEach(t => allTerms.set(keyOf(t.bits), t));
  const usedKeys = new Set();

  let currentLevel = baseTerms;
  let changed = true;
  while (changed) {
    changed = false;
    const nextLevelMap = new Map();

    for (let i = 0; i < currentLevel.length; i++) {
      for (let j = i + 1; j < currentLevel.length; j++) {
        const a = currentLevel[i];
        const b = currentLevel[j];
        let diffPos = -1;
        let diffCount = 0;
        let compatible = true;

        for (let p = 0; p < NUM_VARS; p++) {
          const av = a.bits[p];
          const bv = b.bits[p];
          if (av === -1 && bv === -1) continue;
          if (av === -1 || bv === -1) { compatible = false; break; }
          if (av !== bv) {
            diffCount++;
            diffPos = p;
            if (diffCount > 1) break;
          }
        }
        if (!compatible || diffCount !== 1) continue;

        const newBits = a.bits.slice();
        newBits[diffPos] = -1;
        const k = keyOf(newBits);
        usedKeys.add(keyOf(a.bits));
        usedKeys.add(keyOf(b.bits));
        changed = true;

        if (nextLevelMap.has(k)) {
          const merged = nextLevelMap.get(k);
          a.minterms.forEach(mt => merged.minterms.add(mt));
          b.minterms.forEach(mt => merged.minterms.add(mt));
        } else {
          const merged = { bits: newBits, minterms: new Set([...a.minterms, ...b.minterms]) };
          nextLevelMap.set(k, merged);
          allTerms.set(k, merged);
        }
      }
    }

    currentLevel = [...nextLevelMap.values()];
  }

  const primes = [...allTerms.values()].filter(t => !usedKeys.has(keyOf(t.bits)));

  const mapped = primes.map(t => ({
    bits: t.bits,
    cells: [...t.minterms].sort((a, b) => a - b).map(n => ({ n })),
    size: t.minterms.size,
    key: keyOf(t.bits),
  }));

  mapped.sort((a, b) => b.size - a.size || a.cells[0].n - b.cells[0].n);
  return mapped;
}

// mode "sop": product-of-literals term for a group of minterms (1-bit -> plain, 0-bit -> overline)
// mode "pos": sum-of-literals term for a group of maxterms (0-bit -> plain, 1-bit -> overline),
// parenthesized when it has more than one literal, since several such terms get AND-ed together
function groupTermHtml(cells, mode = "sop") {
  const bitsList = cells.map(({ n }) => bitsForIndex(n));
  const literals = [];
  LETTERS.forEach(letter => {
    const vals = bitsList.map(b => b[letter]);
    if (vals.every(v => v === vals[0])) {
      const bit = vals[0];
      literals.push(literalHtml(letter, mode === "sop" ? bit : 1 - bit));
    }
  });

  if (mode === "sop") return literals.length === 0 ? "1" : literals.join(" · ");

  if (literals.length === 0) return "0";
  const joined = literals.join(" + ");
  return literals.length > 1 ? `(${joined})` : joined;
}

// structured version of groupTermHtml's literal list, for the gate diagrams:
// [{ letter, negated }] for the constant variables of a group's cells
function getTermLiterals(cells, mode = "sop") {
  const bitsList = cells.map(({ n }) => bitsForIndex(n));
  const literals = [];
  LETTERS.forEach(letter => {
    const vals = bitsList.map(b => b[letter]);
    if (vals.every(v => v === vals[0])) {
      const bit = vals[0];
      literals.push({ letter, negated: mode === "sop" ? bit === 0 : bit === 1 });
    }
  });
  return literals;
}

// --- Karnaugh map: visual grid layout ---
//
// 3 vars: single 2x4 grid (1 row-bit, 2 col-bits, Gray-coded)
// 4 vars: single 4x4 grid (2 row-bits, 2 col-bits) — the classic layout
// 5 vars: two side-by-side 4x4 "planes" (2 row-bits, 2 col-bits), split on
//         the 5th variable — the standard textbook convention. A prime
//         implicant that doesn't involve that 5th variable is drawn on BOTH
//         planes; one that fixes it appears on only one.

function grayCodeSequence(bits) {
  const size = 1 << bits;
  const seq = [];
  for (let i = 0; i < size; i++) {
    const g = i ^ (i >> 1);
    const arr = [];
    for (let b = bits - 1; b >= 0; b--) arr.push((g >> b) & 1);
    seq.push(arr);
  }
  return seq;
}

function kmapLayoutConfig() {
  if (NUM_VARS === 3) return { rowSlots: [0], colSlots: [1, 2], planeSlot: null };
  if (NUM_VARS === 4) return { rowSlots: [0, 1], colSlots: [2, 3], planeSlot: null };
  return { rowSlots: [0, 1], colSlots: [2, 3], planeSlot: 4 };
}

// grid cells always hold the real/natural combination index — the same
// physical position holds the same combination on both sides, so grouping,
// hazard adjacency and click-toggling all stay simple and position-based.
// Only the *printed* label differs on the konjunktív side (see
// renderKmapPlaneBody's `complement` — a presentation-only transform)
function buildPlaneGrid(rowSlots, colSlots, fixedSlots) {
  const rowSeq = grayCodeSequence(rowSlots.length);
  const colSeq = grayCodeSequence(colSlots.length);
  const grid = [];
  for (let r = 0; r < rowSeq.length; r++) {
    const row = [];
    for (let c = 0; c < colSeq.length; c++) {
      let n = 0;
      rowSlots.forEach((slot, i) => { if (rowSeq[r][i]) n |= PLACE_VALUES[slot]; });
      colSlots.forEach((slot, i) => { if (colSeq[c][i]) n |= PLACE_VALUES[slot]; });
      Object.entries(fixedSlots).forEach(([slot, v]) => { if (v) n |= PLACE_VALUES[Number(slot)]; });
      row.push(n);
    }
    grid.push(row);
  }
  return grid;
}

// positions (0..seq.length-1) along one axis consistent with `bits` (a
// length-NUM_VARS array of 0/1/-1) at that axis's slot positions
function axisPositionsForBits(seq, axisSlots, bits) {
  const positions = [];
  seq.forEach((bitsArr, pos) => {
    const ok = axisSlots.every((slot, i) => bits[slot] === -1 || bits[slot] === bitsArr[i]);
    if (ok) positions.push(pos);
  });
  return positions;
}

// collapse a set of axis positions into contiguous linear runs (no wrap —
// a run spanning the physical edges of the grid must stay split into
// separate pieces, since the table itself doesn't wrap visually)
function toSegments(positions) {
  const sorted = [...positions].sort((a, b) => a - b);
  const segments = [];
  let start = null;
  let prev = null;
  sorted.forEach(p => {
    if (start === null) { start = p; prev = p; }
    else if (p === prev + 1) { prev = p; }
    else { segments.push([start, prev]); start = p; prev = p; }
  });
  if (start !== null) segments.push([start, prev]);
  return segments;
}

// both of an axis's letters sit on the SAME side — columns always above the
// grid, rows always to its left — stacked at two different distances so
// their brackets/labels nest without overlapping: the outer variable (the
// one whose bracket touches a physical edge of the grid, e.g. C at cols
// {2,3}) is drawn farther out, the inner variable (e.g. D at the middle
// cols {1,2}) closer in. Indexed by each slot's position in colSlots/
// rowSlots (0 = outer, 1 = inner)
const AXIS_OFFSETS = [46, 14];

// highlightValue: which literal F value this table is visually emphasizing
// — 1 for the disjunktív side (groups 1-cells), 0 for the konjunktív side
// (groups 0-cells, so that's what should stand out here instead)
//
// complement: konjunktív cells are *labeled* with the bitwise complement of
// their real index (M_n printed where m_(MAX_INDEX-n) would sit) — the
// standard sorszámos→konjunktív conversion (invert every Σ number, the
// numbers missing from that inverted set are the Π/maxterm list) — but this
// is purely a display transform. The cell still represents, is toggled by,
// and is highlighted by its real/natural index n, so grouping and hazard
// adjacency stay simple and position-based, identical to the disjunktív side
function renderKmapPlaneBody(grid, bodyEl, highlightValue, itemLabel, complement) {
  bodyEl.innerHTML = "";
  const cellEls = [];
  for (let r = 0; r < grid.length; r++) {
    const tr = document.createElement("tr");
    const rowEls = [];
    for (let c = 0; c < grid[r].length; c++) {
      const n = grid[r][c];
      const displayN = complement ? (MAX_INDEX ^ n) : n;
      const f = selected.has(n) ? 1 : 0;
      const td = document.createElement("td");
      td.className = "kmap-cell" + (f === highlightValue ? " kmap-cell-highlight" : "");
      td.tabIndex = 0;
      td.setAttribute("role", "button");
      td.setAttribute("aria-pressed", f === 1 ? "true" : "false");
      td.title = `${itemLabel}${displayN} — kattints a váltáshoz`;
      td.addEventListener("click", () => toggleIndex(n));
      td.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleIndex(n);
        }
      });

      const valueEl = document.createElement("span");
      valueEl.className = "kmap-value";
      valueEl.textContent = f;
      td.appendChild(valueEl);

      const indexEl = document.createElement("span");
      indexEl.className = "kmap-index";
      indexEl.textContent = displayN;
      td.appendChild(indexEl);

      tr.appendChild(td);
      rowEls.push(td);
    }
    bodyEl.appendChild(tr);
    cellEls.push(rowEls);
  }
  return cellEls;
}

function renderPlaneAxis(cellEls, wrapEl, axisEl, rowSlots, colSlots, markZero) {
  axisEl.innerHTML = "";
  const wrapRect = wrapEl.getBoundingClientRect();

  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left - wrapRect.left,
      right: r.right - wrapRect.left,
      top: r.top - wrapRect.top,
      bottom: r.bottom - wrapRect.top,
    };
  };

  const gridTop = rectOf(cellEls[0][0]).top;
  const gridLeft = rectOf(cellEls[0][0]).left;

  // A variable whose marked region wraps around the grid's Gray-code edge
  // (e.g. value=0 landing on the first AND last column) produces two
  // disconnected segments — each gets its own line+ticks AND its own copy
  // of the letter, right above/beside that segment, so every piece of the
  // bracket is self-explanatory on its own instead of relying on a single
  // label placed somewhere in between
  function drawColumnBracket(letter, segments, offset) {
    const y = gridTop - offset;

    segments.forEach(([startC, endC]) => {
      const x1 = rectOf(cellEls[0][startC]).left;
      const x2 = rectOf(cellEls[0][endC]).right;

      const line = document.createElement("div");
      line.className = "kmap-axis-line-h";
      line.style.left = `${x1}px`;
      line.style.top = `${y}px`;
      line.style.width = `${x2 - x1}px`;
      axisEl.appendChild(line);

      [x1, x2].forEach(x => {
        const tick = document.createElement("div");
        tick.className = "kmap-axis-tick-v";
        tick.style.left = `${x}px`;
        tick.style.top = `${y}px`;
        axisEl.appendChild(tick);
      });

      const label = document.createElement("div");
      label.className = "kmap-axis-label";
      label.style.left = `${(x1 + x2) / 2}px`;
      label.style.top = `${y - 20}px`;
      label.style.transform = "translateX(-50%)";
      label.textContent = letter;
      axisEl.appendChild(label);
    });
  }

  // see drawColumnBracket for why every segment gets its own copy of the
  // label instead of one shared label in between
  function drawRowBracket(letter, segments, offset) {
    const x = gridLeft - offset;

    segments.forEach(([startR, endR]) => {
      const y1 = rectOf(cellEls[startR][0]).top;
      const y2 = rectOf(cellEls[endR][0]).bottom;

      const line = document.createElement("div");
      line.className = "kmap-axis-line-v";
      line.style.left = `${x}px`;
      line.style.top = `${y1}px`;
      line.style.height = `${y2 - y1}px`;
      axisEl.appendChild(line);

      [y1, y2].forEach(y => {
        const tick = document.createElement("div");
        tick.className = "kmap-axis-tick-h";
        tick.style.left = `${x}px`;
        tick.style.top = `${y}px`;
        axisEl.appendChild(tick);
      });

      const label = document.createElement("div");
      label.className = "kmap-axis-label";
      label.style.left = `${x - 20}px`;
      label.style.top = `${(y1 + y2) / 2}px`;
      label.style.transform = "translateY(-50%)";
      label.textContent = letter;
      axisEl.appendChild(label);
    });
  }

  const wantBit = markZero ? 0 : 1;

  const seqCol = grayCodeSequence(colSlots.length);
  colSlots.forEach((slot, i) => {
    const bits = new Array(NUM_VARS).fill(-1);
    bits[slot] = wantBit;
    const positions = axisPositionsForBits(seqCol, colSlots, bits);
    drawColumnBracket(assignment[slot], toSegments(positions), AXIS_OFFSETS[i]);
  });

  const seqRow = grayCodeSequence(rowSlots.length);
  rowSlots.forEach((slot, i) => {
    const bits = new Array(NUM_VARS).fill(-1);
    bits[slot] = wantBit;
    const positions = axisPositionsForBits(seqRow, rowSlots, bits);
    drawRowBracket(assignment[slot], toSegments(positions), AXIS_OFFSETS[i]);
  });
}

// by default only the essential/chosen groups are worth showing (that's the
// answer); the full prime-implicant picture (redundant/hazard-relevant
// groups too) only matters once hazard analysis is switched on
function visibleGroupIndices(groups, minimalInfo) {
  return groups
    .map((_, idx) => idx)
    .filter(idx => hazardEnabled || minimalInfo.chosenIdx.has(idx));
}

function computeVisibleGroupMeta(groups, minimalInfo) {
  return visibleGroupIndices(groups, minimalInfo).map((idx, pos) => ({
    idx, pos, color: GROUP_COLORS[pos % GROUP_COLORS.length],
  }));
}

function renderKmapOverlayForPlane(groups, groupMeta, hazardFixIdx, cellEls, wrapEl, overlayEl, rowSlots, colSlots, fixedSlots) {
  overlayEl.innerHTML = "";
  const wrapRect = wrapEl.getBoundingClientRect();
  const seqRow = grayCodeSequence(rowSlots.length);
  const seqCol = grayCodeSequence(colSlots.length);

  groupMeta.forEach(({ idx, pos, color }) => {
    const group = groups[idx];

    const compatible = Object.entries(fixedSlots).every(([slot, v]) => {
      const b = group.bits[Number(slot)];
      return b === -1 || b === v;
    });
    if (!compatible) return;

    const inset = GROUP_INSETS[pos % GROUP_INSETS.length];
    // dashed circling is reserved for groups added purely to fix a hazard —
    // everything else (essential or otherwise needed for the minimal form)
    // stays a plain solid outline, no fill, so it doesn't tint the cell
    // value sitting underneath it
    const borderStyle = hazardFixIdx.has(idx) ? "dashed" : "solid";

    const rowSegs = toSegments(axisPositionsForBits(seqRow, rowSlots, group.bits));
    const colSegs = toSegments(axisPositionsForBits(seqCol, colSlots, group.bits));

    let firstPiece = true;
    rowSegs.forEach(([r0, r1]) => {
      colSegs.forEach(([c0, c1]) => {
        const topLeftEl = cellEls[r0][c0];
        const bottomRightEl = cellEls[r1][c1];
        const tlRect = topLeftEl.getBoundingClientRect();
        const brRect = bottomRightEl.getBoundingClientRect();

        const div = document.createElement("div");
        div.className = "kmap-group-piece";
        div.dataset.groupPos = pos;
        div.style.left = `${tlRect.left - wrapRect.left + inset}px`;
        div.style.top = `${tlRect.top - wrapRect.top + inset}px`;
        div.style.width = `${brRect.right - tlRect.left - inset * 2}px`;
        div.style.height = `${brRect.bottom - tlRect.top - inset * 2}px`;
        div.style.borderColor = color;
        div.style.borderStyle = borderStyle;
        overlayEl.appendChild(div);

        if (firstPiece) {
          firstPiece = false;
          const badge = document.createElement("div");
          badge.className = "kmap-group-badge";
          badge.dataset.groupPos = pos;
          badge.style.left = `${tlRect.left - wrapRect.left + inset}px`;
          badge.style.top = `${tlRect.top - wrapRect.top + inset}px`;
          badge.style.background = color;
          badge.textContent = pos + 1;
          overlayEl.appendChild(badge);
        }
      });
    });
  });
}

function renderKmapLegend(groups, groupMeta, hazardFixIdx, legendEl, opts) {
  const { targetSet, mode = "sop", itemLabel = "m", emptyMessage, complement } = opts;
  const displayN = n => complement ? (MAX_INDEX ^ n) : n;
  legendEl.innerHTML = "";

  if (targetSet.size === 0) {
    const p = document.createElement("p");
    p.className = "empty-msg";
    p.textContent = emptyMessage;
    legendEl.appendChild(p);
    return;
  }

  if (groups.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-msg";
    p.textContent = "Nem található csoportosítható mező.";
    legendEl.appendChild(p);
    return;
  }

  groupMeta.forEach(({ idx, pos, color }) => {
    const group = groups[idx];
    const row = document.createElement("div");
    row.className = "kmap-legend-row";
    row.dataset.groupPos = pos;

    const badge = document.createElement("span");
    badge.className = "kmap-legend-badge";
    badge.style.background = color;
    badge.textContent = pos + 1;
    row.appendChild(badge);

    const term = document.createElement("span");
    term.className = "kmap-legend-term";
    term.innerHTML = groupTermHtml(group.cells, mode);
    row.appendChild(term);

    const meta = document.createElement("span");
    meta.className = "kmap-legend-meta";
    const ns = group.cells.map(c => displayN(c.n)).sort((a, b) => a - b);
    meta.textContent = `${groupSizeLabel(group.size)} — ${itemLabel}(${ns.join(", ")})`;
    row.appendChild(meta);

    if (hazardFixIdx.has(idx)) {
      const tag = document.createElement("span");
      tag.className = "kmap-legend-tag kmap-legend-tag-hazard";
      tag.textContent = "hazárd-javítás";
      row.appendChild(tag);
    }

    legendEl.appendChild(row);
  });
}

// hovering a legend row fades every other group's circle(s) on the K-map so
// the hovered one stands out — same fade treatment as the Σ/Π formula
// lines. Wired once at startup: legendEl/containerEl are stable elements
// (render() only replaces their children), so a single delegated listener
// keeps working across every re-render without needing to be re-attached
function wireLegendHover(containerEl, legendEl) {
  legendEl.addEventListener("mouseover", (e) => {
    const row = e.target.closest(".kmap-legend-row");
    if (!row || row.dataset.groupPos === undefined) return;
    const pos = row.dataset.groupPos;
    containerEl.querySelectorAll(".kmap-group-piece, .kmap-group-badge").forEach(el => {
      el.classList.toggle("kmap-group-dim", el.dataset.groupPos !== pos);
    });
  });

  legendEl.addEventListener("mouseleave", () => {
    containerEl.querySelectorAll(".kmap-group-dim").forEach(el => {
      el.classList.remove("kmap-group-dim");
    });
  });
}

// among the prime implicants, pick the smallest set that still covers every
// cell in targetSet: essential PIs first, then a brute-force minimum cover
// for whatever they leave uncovered
function selectMinimalCover(groups, targetSet) {
  if (targetSet.size === 0 || groups.length === 0) {
    return { chosenIdx: new Set(), essentialIdx: new Set() };
  }

  const coverageMap = new Map();
  groups.forEach((g, idx) => {
    g.cells.forEach(({ n }) => {
      if (!coverageMap.has(n)) coverageMap.set(n, []);
      coverageMap.get(n).push(idx);
    });
  });

  const essentialIdx = new Set();
  targetSet.forEach(n => {
    const covers = coverageMap.get(n) || [];
    if (covers.length === 1) essentialIdx.add(covers[0]);
  });

  const coveredCells = new Set();
  essentialIdx.forEach(idx => groups[idx].cells.forEach(c => coveredCells.add(c.n)));
  const remaining = [...targetSet].filter(n => !coveredCells.has(n));

  const chosenIdx = new Set(essentialIdx);
  if (remaining.length > 0) {
    const candidates = groups.map((_, i) => i).filter(i => !essentialIdx.has(i));
    findSmallestCover(candidates, groups, remaining).forEach(i => chosenIdx.add(i));
  }

  return { chosenIdx, essentialIdx };
}

function findSmallestCover(candidateIdxs, groups, remainingMinterms) {
  const target = new Set(remainingMinterms);
  for (let k = 1; k <= candidateIdxs.length; k++) {
    const combo = findCoveringCombo(candidateIdxs, groups, target, k);
    if (combo) return combo;
  }
  return [];
}

function findCoveringCombo(candidateIdxs, groups, target, k) {
  const combo = [];
  function coversTarget() {
    const unionSet = new Set();
    combo.forEach(idx => groups[idx].cells.forEach(c => unionSet.add(c.n)));
    for (const t of target) if (!unionSet.has(t)) return false;
    return true;
  }
  function backtrack(start) {
    if (combo.length === k) return coversTarget();
    for (let i = start; i < candidateIdxs.length; i++) {
      combo.push(candidateIdxs[i]);
      if (backtrack(i + 1)) return true;
      combo.pop();
    }
    return false;
  }
  return backtrack(0) ? [...combo] : null;
}

// shared by both sides: the minimal-form card, the NAND/NOR verification
// line next to their gate diagrams, all four are literally the same
// "render these chosen groups as a formula" operation, just with a
// different target element/mode/group set
function renderFormula(el, chosenGroups, mode) {
  if (chosenGroups.length === 0) {
    el.innerHTML = `F(${LETTERS.join(", ")}) = ${mode === "sop" ? "0" : "1"}`;
    return;
  }
  const joiner = mode === "sop" ? " + " : " · ";
  const terms = chosenGroups.map(g => groupTermHtml(g.cells, mode));
  el.innerHTML = `F(${LETTERS.join(", ")}) = ${terms.join(joiner)}`;
}

// the formula under the NAND/NOR gate diagram should describe that exact
// network — De Morgan's 2-level NAND-NAND / NOR-NOR realization — not just
// restate the plain minimal formula. Every term becomes its own NAND/NOR
// gate (even a single-literal term, which acts as an inverter, matching
// renderGateDiagram's useBubble=true path), feeding one final NAND/NOR
// gate; algebraically that's exactly this nested-overline form:
//   NAND-NAND (sop): F = \overline{ \overline{t1} · \overline{t2} · ... }
//   NOR-NOR   (pos): F = \overline{ \overline{s1} + \overline{s2} + ... }
// — one overline per term (its own gate output) plus one more spanning
// all of them (the final gate's output), so several bars stack directly
// on top of each other wherever a term collapses to a single literal
function renderDeMorganFormula(el, chosenGroups, mode) {
  if (chosenGroups.length === 0) {
    el.innerHTML = `F(${LETTERS.join(", ")}) = ${mode === "sop" ? "0" : "1"}`;
    return;
  }
  // a lone, zero-literal group means the target set is every cell — F is
  // the constant 1 (sop) / 0 (pos), same tautology case renderGateDiagram
  // already special-cases (no gate to draw at all), not a real term
  if (chosenGroups.length === 1 && getTermLiterals(chosenGroups[0].cells, mode).length === 0) {
    el.innerHTML = `F(${LETTERS.join(", ")}) = ${mode === "sop" ? "1" : "0"}`;
    return;
  }
  const joiner = mode === "sop" ? " · " : " + ";
  const termHtmls = chosenGroups.map(g => {
    const lits = getTermLiterals(g.cells, mode);
    const inner = lits.map(l => literalHtml(l.letter, l.negated ? 0 : 1)).join(joiner);
    return `<span class="overline">${inner}</span>`;
  });
  el.innerHTML = `F(${LETTERS.join(", ")}) = <span class="overline">${termHtmls.join(joiner)}</span>`;
}

// --- Gate-level realization diagrams (SVG) ---

const GD = {
  litRowH: 26,
  termGap: 18,
  bubbleR: 4,
  invW: 18,
  invH: 20,
  gateGap: 22,
  padding: 16,
};

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// AND gate: flat left edge, flat top/bottom for the first part, semicircular
// bulge on the right. Total bounding width is exactly w (radius = h/2).
function andGatePath(x, y, w, h) {
  const flatW = w - h / 2;
  const r = h / 2;
  return `M ${x} ${y} L ${x + flatW} ${y} A ${r} ${r} 0 0 1 ${x + flatW} ${y + h} L ${x} ${y + h} Z`;
}

// OR gate: flat back edge (like the AND gate) so straight input jog lines
// always land exactly on it — a concave back curve looked authentic but let
// jog lines poke outside the silhouette wherever the curve bulged away from
// x=gateX
function orGatePath(x, y, w, h) {
  const midY = y + h / 2;
  const tipCtrlX = x + w * 0.62;
  return `M ${x} ${y} L ${x} ${y + h} Q ${tipCtrlX} ${y + h} ${x + w} ${midY} Q ${tipCtrlX} ${y} ${x} ${y} Z`;
}

// draws one literal's horizontal wire (with an inverter bubble if negated)
// from `fromX` to `toX` at height `y`; returns nothing, just appends to svg
function drawLiteralWire(svg, letter, negated, fromX, toX, y) {
  const label = svgEl("text", { x: fromX, y, class: "gd-label" });
  label.textContent = letter;
  svg.appendChild(label);

  const wireStart = fromX + 14;

  if (!negated) {
    svg.appendChild(svgEl("path", { class: "gd-wire", d: `M ${wireStart} ${y} L ${toX} ${y}` }));
    return;
  }

  const triW = GD.invW;
  const triH = GD.invH;
  const triX = wireStart + 6;
  svg.appendChild(svgEl("path", { class: "gd-wire", d: `M ${wireStart} ${y} L ${triX} ${y}` }));
  svg.appendChild(svgEl("path", {
    class: "gd-gate",
    d: `M ${triX} ${y - triH / 2} L ${triX} ${y + triH / 2} L ${triX + triW} ${y} Z`,
  }));
  const bubbleCx = triX + triW + GD.bubbleR;
  svg.appendChild(svgEl("circle", { class: "gd-bubble", cx: bubbleCx, cy: y, r: GD.bubbleR }));
  svg.appendChild(svgEl("path", { class: "gd-wire", d: `M ${bubbleCx + GD.bubbleR} ${y} L ${toX} ${y}` }));
}

// draws a multi-(or single-)input AND/OR gate (optionally with an output
// bubble for NAND/NOR) spanning inputYs, with inputs entering at x=gateX and
// output continuing to x=outX; returns the gate's vertical center
// inputPoints: array of {x, y} — the actual point each input wire arrives
// from. Each gets its own direct line straight to its designated entry
// point on the gate, spread evenly across the gate's height — never merged
// into a shared vertical bus, even when sources are far apart or bunched up
function drawGate(svg, kind, bubble, gateX, gateW, gateH, centerY, inputPoints, outX) {
  const y = centerY - gateH / 2;

  const n = inputPoints.length;
  inputPoints.forEach((pt, i) => {
    const targetY = n === 1 ? centerY : y + (gateH * (i + 0.5)) / n;
    if (Math.abs(pt.y - targetY) > 0.5 || pt.x !== gateX) {
      svg.appendChild(svgEl("path", { class: "gd-wire", d: `M ${pt.x} ${pt.y} L ${gateX} ${targetY}` }));
    }
  });

  const path = kind === "and" ? andGatePath(gateX, y, gateW, gateH) : orGatePath(gateX, y, gateW, gateH);
  svg.appendChild(svgEl("path", { class: "gd-gate", d: path }));

  let tipX = gateX + gateW;
  if (bubble) {
    const bubbleCx = tipX + GD.bubbleR;
    svg.appendChild(svgEl("circle", { class: "gd-bubble", cx: bubbleCx, cy: centerY, r: GD.bubbleR }));
    tipX = bubbleCx + GD.bubbleR;
  }
  if (outX > tipX) {
    svg.appendChild(svgEl("path", { class: "gd-wire", d: `M ${tipX} ${centerY} L ${outX} ${centerY}` }));
  }
  return centerY;
}

// combines `points` pairwise, left to right, using plain (non-bubbled)
// 2-input `kind` gates — for the NÉV (direct AND/OR/NOT) realization's
// "csak kétbemenetű kapuk" mode, where a wider AND/OR genuinely is just a
// chain of the same 2-input shape (AND/OR are associative, so this is
// exact, not an approximation).
// Returns the chain's final output point {x, y}.
function drawTwoInputChain(svg, kind, points, startX, gateW, gateGap, label) {
  let current = points[0];
  let x = startX;
  for (let i = 1; i < points.length; i++) {
    const centerY = (current.y + points[i].y) / 2;
    const gateH = 32;
    const outX = x + gateW + 10;

    drawGate(svg, kind, false, x, gateW, gateH, centerY, [current, points[i]], outX);

    const gLabel = svgEl("text", { x: x + gateW / 2, y: centerY + 1, class: "gd-gate-label" });
    gLabel.textContent = label;
    svg.appendChild(gLabel);

    current = { x: outX, y: centerY };
    x = outX + gateGap;
  }
  return current;
}

// combines `points` pairwise, left to right, using ONLY 2-input, bubbled
// `kind` gates (NAND or NOR) — the classic "universal gate" technique for
// a strict NAND-only/NOR-only realization, where even the intermediate
// combining steps must stay on real NAND/NOR chips, never a plain AND/OR.
// NAND/NOR are NOT associative (NAND(NAND(a,b),c) != NAND(a,b,c)), so a
// bubbled combine's result has to be un-inverted again before the next
// combine — done with a second bubbled gate fed the same signal on both
// inputs (NAND(x,x) = NOT(x)), since two bubbled gates in a row cancel
// back to a plain AND/OR of everything combined so far. Only the very
// LAST combine is left bare, since that final inversion is exactly the
// one the term/output stage is supposed to produce.
// Returns the chain's final output point {x, y}.
function drawNandNorChain(svg, kind, points, startX, gateW, gateGap, label) {
  let current = points[0];
  let x = startX;
  for (let i = 1; i < points.length; i++) {
    const isLast = i === points.length - 1;
    const centerY = (current.y + points[i].y) / 2;
    const gateH = 32;
    const bubbleSpan = GD.bubbleR * 2;
    const combineOutX = x + gateW + bubbleSpan + 10;

    drawGate(svg, kind, true, x, gateW, gateH, centerY, [current, points[i]], combineOutX);
    const gLabel = svgEl("text", { x: x + gateW / 2, y: centerY + 1, class: "gd-gate-label" });
    gLabel.textContent = label;
    svg.appendChild(gLabel);

    if (isLast) {
      current = { x: combineOutX, y: centerY };
      x = combineOutX + gateGap;
      continue;
    }

    const invX = combineOutX + gateGap;
    const invOutX = invX + gateW + bubbleSpan + 10;
    const combinePt = { x: combineOutX, y: centerY };
    drawGate(svg, kind, true, invX, gateW, gateH, centerY, [combinePt, combinePt], invOutX);
    const invLabel = svgEl("text", { x: invX + gateW / 2, y: centerY + 1, class: "gd-gate-label" });
    invLabel.textContent = label;
    svg.appendChild(invLabel);

    current = { x: invOutX, y: centerY };
    x = invOutX + gateGap;
  }
  return current;
}

function renderGateDiagram(container, chosenGroups, mode, useBubble) {
  container.innerHTML = "";

  const emptyGroupsValue = mode === "sop" ? "0" : "1";
  const tautologyValue = mode === "sop" ? "1" : "0";

  if (chosenGroups.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-msg";
    p.textContent = `F(${LETTERS.join(", ")}) = ${emptyGroupsValue} — nincs megvalósítandó kapu.`;
    container.appendChild(p);
    return;
  }

  const terms = chosenGroups.map(g => getTermLiterals(g.cells, mode));

  if (terms.length === 1 && terms[0].length === 0) {
    const p = document.createElement("p");
    p.className = "empty-msg";
    p.textContent = `F(${LETTERS.join(", ")}) = ${tautologyValue} — nincs megvalósítandó kapu (állandó függvény).`;
    container.appendChild(p);
    return;
  }

  const termShape = mode === "sop" ? "and" : "or";
  // plain (NÉV) realization alternates gate family per level (AND then OR,
  // or OR then AND); the NAND/NOR-only realization reuses the SAME family at
  // both levels (that's exactly what makes the De Morgan trick work)
  const plainOutShape = termShape === "and" ? "or" : "and";
  const outShape = useBubble ? termShape : plainOutShape;
  const termLabel = useBubble ? (termShape === "and" ? "NAND" : "NOR") : (termShape === "and" ? "ÉS" : "VAGY");
  const outLabelText = useBubble ? (outShape === "and" ? "NAND" : "NOR") : (outShape === "and" ? "ÉS" : "VAGY");
  // labels for the plain (non-bubbled) NÉV-mode chain — see
  // drawTwoInputChain vs. drawNandNorChain for why NAND/NOR-mode chains
  // never use these and stay on termLabel/outLabelText throughout instead
  const termPlainLabel = termShape === "and" ? "ÉS" : "VAGY";
  const outPlainLabel = outShape === "and" ? "ÉS" : "VAGY";

  const singleTerm = terms.length === 1;
  const hasAnyNegation = terms.some(lits => lits.some(l => l.negated));

  // vertical layout: one block per term, one row per literal in that term
  const blockRows = terms.map(lits => Math.max(lits.length, 1));
  const termCenterY = [];
  let y = GD.padding;
  blockRows.forEach(rows => {
    const blockH = rows * GD.litRowH;
    termCenterY.push(y + blockH / 2);
    y += blockH + GD.termGap;
  });
  const totalH = y - GD.termGap + GD.padding;

  // horizontal layout
  const labelX = GD.padding;
  const literalEntryX = labelX + 14 + (hasAnyNegation ? GD.invW + GD.bubbleR * 2 + 20 : 20);
  const termGateX = literalEntryX + GD.gateGap;
  const termGateW = 40;

  // does this term get its own drawn gate? (a single-literal term needs one
  // only for the bubble (NAND/NOR) version, where it acts as an inverter
  // feeding the final gate; for the plain version it wires straight through)
  const termHasGate = terms.map(lits => useBubble || lits.length > 1);
  const termOutX = termGateX + termGateW + (useBubble ? GD.bubbleR * 2 + 10 : 10);
  const outGateW = 44;

  const needsOutputGate = useBubble || !singleTerm;

  // width isn't known up front any more — a 2-input-only cascade can run
  // arbitrarily far right depending on how many literals/terms it has to
  // chain through — so the svg's viewBox/size is set at the very end,
  // once every gate has actually been placed
  const svg = svgEl("svg", {});

  const termOutPoints = [];

  terms.forEach((lits, i) => {
    const centerY = termCenterY[i];
    const rows = blockRows[i];
    const blockTop = centerY - (rows * GD.litRowH) / 2;
    const litYs = lits.map((_, j) => blockTop + GD.litRowH * (j + 0.5));

    if (lits.length === 0) return; // handled as a trivial case above

    if (litYs.length === 1 && !termHasGate[i]) {
      // single literal, no gate: wire straight through at its own height,
      // then jog to the term's center line for the convergence step
      drawLiteralWire(svg, lits[0].letter, lits[0].negated, labelX, termOutX, litYs[0]);
      termOutPoints.push({ x: termOutX, y: litYs[0] });
      return;
    }

    lits.forEach((lit, j) => drawLiteralWire(svg, lit.letter, lit.negated, labelX, termGateX, litYs[j]));

    if (twoInputOnly && litYs.length > 2) {
      const points = litYs.map(ly => ({ x: termGateX, y: ly }));
      const out = useBubble
        ? drawNandNorChain(svg, termShape, points, termGateX, termGateW, GD.gateGap, termLabel)
        : drawTwoInputChain(svg, termShape, points, termGateX, termGateW, GD.gateGap, termPlainLabel);
      termOutPoints.push(out);
      return;
    }

    const gateH = Math.max(30, litYs.length * 16 + 16);
    drawGate(svg, termShape, useBubble, termGateX, termGateW, gateH, centerY, litYs.map(ly => ({ x: termGateX, y: ly })), termOutX);
    termOutPoints.push({ x: termOutX, y: centerY });

    // label the gate
    const gLabel = svgEl("text", { x: termGateX + termGateW / 2, y: centerY + 1, class: "gd-gate-label" });
    gLabel.textContent = termLabel;
    svg.appendChild(gLabel);
  });

  let finalPoint;

  if (!needsOutputGate) {
    // single term, no output gate: its own output IS F
    finalPoint = termOutPoints[0];
  } else {
    const outGateX = Math.max(...termOutPoints.map(p => p.x)) + 60;

    if (twoInputOnly && termOutPoints.length > 2) {
      finalPoint = useBubble
        ? drawNandNorChain(svg, outShape, termOutPoints, outGateX, outGateW, GD.gateGap, outLabelText)
        : drawTwoInputChain(svg, outShape, termOutPoints, outGateX, outGateW, GD.gateGap, outPlainLabel);
    } else {
      const outGateH = Math.max(36, termOutPoints.length * 16 + 18);
      const outCenterY = termCenterY.reduce((a, b) => a + b, 0) / termCenterY.length;
      const outTipX = outGateX + outGateW + (useBubble ? GD.bubbleR * 2 : 0) + 40;

      drawGate(svg, outShape, useBubble, outGateX, outGateW, outGateH, outCenterY, termOutPoints, outTipX - 20);

      const outLabel = svgEl("text", { x: outGateX + outGateW / 2, y: outCenterY + 1, class: "gd-gate-label" });
      outLabel.textContent = outLabelText;
      svg.appendChild(outLabel);

      finalPoint = { x: outTipX - 20, y: outCenterY };
    }
  }

  const fLabelX = finalPoint.x + 40;
  svg.appendChild(svgEl("path", { class: "gd-wire", d: `M ${finalPoint.x} ${finalPoint.y} L ${fLabelX - 20} ${finalPoint.y}` }));
  const fLabel = svgEl("text", { x: fLabelX - 16, y: finalPoint.y, class: "gd-label-f" });
  fLabel.textContent = "F";
  svg.appendChild(fLabel);

  const totalW = fLabelX + 20;
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
  svg.setAttribute("width", totalW);
  svg.setAttribute("height", totalH);

  container.appendChild(svg);
}

// --- Hazard analysis ---
// Grid-independent: two target-set elements are hazard candidates whenever
// their indices differ by exactly one bit (any PLACE_VALUES weight), which
// works the same regardless of how the K-map happens to be drawn.

function findAdjacentPairsInSet(targetSet) {
  const pairs = [];
  [...targetSet].forEach(n1 => {
    PLACE_VALUES.forEach(w => {
      const n2 = n1 ^ w;
      if (n2 > n1 && targetSet.has(n2)) pairs.push({ n1, n2 });
    });
  });
  return pairs;
}

function findHazards(chosenGroups, targetSet) {
  const chosenCellSets = chosenGroups.map(g => new Set(g.cells.map(c => c.n)));
  const commonlyCovered = (n1, n2) => chosenCellSets.some(set => set.has(n1) && set.has(n2));
  return findAdjacentPairsInSet(targetSet).filter(({ n1, n2 }) => !commonlyCovered(n1, n2));
}

function findCoveringPI(groups, n1, n2) {
  const candidates = groups.filter(g =>
    g.cells.some(c => c.n === n1) && g.cells.some(c => c.n === n2)
  );
  candidates.sort((a, b) => a.size - b.size);
  return candidates[0] || null;
}

// which prime implicants exist purely to patch a static hazard — shown as
// dashed circling on the K-map and a "hazárd-javítás" tag in its legend
// (see renderKmapOverlayForPlane / renderKmapLegend), which is the only
// place this is surfaced now
function calcHazardInfo(groups, minimalInfo, targetSet) {
  if (!hazardEnabled || targetSet.size === 0) {
    return { hazardFixIdx: new Set() };
  }

  const chosenGroups = groups.filter((_, idx) => minimalInfo.chosenIdx.has(idx));
  const hazards = findHazards(chosenGroups, targetSet);

  const hazardFixIdx = new Set();
  hazards.forEach(({ n1, n2 }) => {
    const cover = findCoveringPI(groups, n1, n2);
    if (!cover) return;
    const idx = groups.indexOf(cover);
    if (idx !== -1 && !minimalInfo.chosenIdx.has(idx)) hazardFixIdx.add(idx);
  });

  return { hazardFixIdx };
}

// --- Top-level K-map orchestration ---

function createKmapPlaneDOM(container, label) {
  const planeDiv = document.createElement("div");
  planeDiv.className = "kmap-plane";

  if (label) {
    const labelEl = document.createElement("div");
    labelEl.className = "kmap-plane-label";
    labelEl.textContent = label;
    planeDiv.appendChild(labelEl);
  }

  const wrap = document.createElement("div");
  wrap.className = "kmap-wrap";

  const table = document.createElement("table");
  table.className = "kmap-table";
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  wrap.appendChild(table);

  const axis = document.createElement("div");
  axis.className = "kmap-axis";
  wrap.appendChild(axis);

  const overlay = document.createElement("div");
  overlay.className = "kmap-overlay";
  wrap.appendChild(overlay);

  planeDiv.appendChild(wrap);
  container.appendChild(planeDiv);

  return { wrap, tbody, axis, overlay };
}

function renderKmapSide(container, targetSet, mode, markZero) {
  const { rowSlots, colSlots, planeSlot } = kmapLayoutConfig();
  const planeValues = planeSlot === null ? [null] : [0, 1];

  container.innerHTML = "";

  const groups = computePrimeImplicants(targetSet);
  const minimalInfo = selectMinimalCover(groups, targetSet);
  const groupMeta = computeVisibleGroupMeta(groups, minimalInfo);
  const hazardInfo = calcHazardInfo(groups, minimalInfo, targetSet);

  planeValues.forEach((pv) => {
    const fixedSlots = pv === null ? {} : { [planeSlot]: pv };
    const grid = buildPlaneGrid(rowSlots, colSlots, fixedSlots);
    const label = pv === null ? null : `${assignment[planeSlot]} = ${pv}`;
    const refs = createKmapPlaneDOM(container, label);
    const cellEls = renderKmapPlaneBody(grid, refs.tbody, markZero ? 0 : 1, mode === "pos" ? "M" : "m", markZero);
    renderPlaneAxis(cellEls, refs.wrap, refs.axis, rowSlots, colSlots, markZero);
    renderKmapOverlayForPlane(groups, groupMeta, hazardInfo.hazardFixIdx, cellEls, refs.wrap, refs.overlay, rowSlots, colSlots, fixedSlots);
  });

  return { groups, minimalInfo, groupMeta, hazardInfo };
}

// the disjunktív and konjunktív sides are structurally identical pipelines
// (K-map planes -> legend -> minimal formula -> hazard analysis -> gate
// diagrams), differing only in which target-set/mode/DOM-elements they use —
// so there's exactly one implementation, driven by a per-side config
function renderKmapSideFull(cfg) {
  const { groups, minimalInfo, groupMeta, hazardInfo } =
    renderKmapSide(cfg.container, cfg.targetSet, cfg.mode, cfg.markZero);

  const chosenGroups = groups.filter((_, idx) => minimalInfo.chosenIdx.has(idx));

  renderKmapLegend(groups, groupMeta, hazardInfo.hazardFixIdx, cfg.legendEl, {
    targetSet: cfg.targetSet,
    mode: cfg.mode,
    itemLabel: cfg.itemLabel,
    emptyMessage: cfg.emptyMessage,
    complement: cfg.markZero,
  });
  renderFormula(cfg.minFormulaEl, chosenGroups, cfg.mode);

  renderGateDiagram(cfg.bubbleGateEl, chosenGroups, cfg.mode, true);
  renderDeMorganFormula(cfg.bubbleFormulaEl, chosenGroups, cfg.mode);
  renderGateDiagram(cfg.plainGateEl, chosenGroups, cfg.mode, false);
}

function renderKmap() {
  renderKmapSideFull({
    container: kmapPlanesEl,
    targetSet: selected,
    mode: "sop",
    markZero: false,
    legendEl: kmapLegend,
    minFormulaEl: minimalFormulaEl,
    itemLabel: "m",
    emptyMessage: "Nincs kiválasztott sorszám — nincs mit csoportosítani.",
    bubbleGateEl: nandGateDiagramEl,
    bubbleFormulaEl: nandFormulaEl,
    plainGateEl: nameGateDiagramEl,
  });
}

function renderConjunctiveKmap() {
  renderKmapSideFull({
    container: kmapPlanesEl2,
    targetSet: complementSet(),
    mode: "pos",
    markZero: true,
    legendEl: kmapLegend2,
    minFormulaEl: conjunctiveMinimalFormulaEl,
    itemLabel: "M",
    emptyMessage: "F mindenhol 1 — nincs 0-mező, amit csoportosítani lehetne.",
    bubbleGateEl: norGateDiagramEl,
    bubbleFormulaEl: norFormulaEl,
    plainGateEl: nameConjGateDiagramEl,
  });
}

function render() {
  clearFab.classList.toggle("clear-fab-visible", selected.size > 0);

  renderTableHead();
  renderSorszamCard();
  syncIndexGrid(indexGridEl, indexGridButtons, piMode ? 0 : 1, piMode);
  renderKmap();
  renderConjunctiveKmap();

  tableBody.innerHTML = "";
  for (let n = MIN_INDEX; n <= MAX_INDEX; n++) {
    const bits = bitsForIndex(n);
    const f = selected.has(n) ? 1 : 0;

    const tr = document.createElement("tr");
    if (f === 1) tr.classList.add("f-one");
    tr.classList.add("row-clickable");
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.setAttribute("aria-pressed", f === 1 ? "true" : "false");
    tr.title = "Kattints a sorra F váltásához";
    tr.addEventListener("click", () => toggleIndex(n));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleIndex(n);
      }
    });

    const tdIndex = document.createElement("td");
    tdIndex.textContent = n;
    tr.appendChild(tdIndex);

    PLACE_VALUES.forEach((weight, i) => {
      const letter = assignment[i];
      const td = document.createElement("td");
      td.textContent = bits[letter];
      tr.appendChild(td);
    });

    const tdF = document.createElement("td");
    tdF.textContent = f;
    tdF.className = "f-cell";
    tr.appendChild(tdF);

    tableBody.appendChild(tr);
  }
}

clearFab.addEventListener("click", openClearConfirm);

clearConfirmCancel.addEventListener("click", closeClearConfirm);

clearConfirmOverlay.addEventListener("click", (e) => {
  if (e.target === clearConfirmOverlay) closeClearConfirm();
});

clearConfirmOk.addEventListener("click", () => {
  selected = new Set();
  closeClearConfirm();
  render();
});

weightPresets.forEach(btn => {
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});

varCountButtons.forEach(btn => {
  btn.addEventListener("click", () => setVarCount(Number(btn.dataset.n)));
});

hazardToggle.addEventListener("change", () => {
  hazardEnabled = hazardToggle.checked;
  render();
});

twoInputToggle.addEventListener("change", () => {
  twoInputOnly = twoInputToggle.checked;
  render();
});

modeToggleButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const next = btn.dataset.mode === "pi";
    if (next === piMode) return;
    piMode = next;
    render();
  });
});

wireLegendHover(kmapPlanesEl, kmapLegend);
wireLegendHover(kmapPlanesEl2, kmapLegend2);

configureVars(4);
syncVarCountButtons();
buildWeightAssign();
buildIndexGrid(indexGridEl, indexGridButtons);
render();
