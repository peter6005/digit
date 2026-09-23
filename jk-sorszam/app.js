// J-K sequential counter with a user-defined state cycle. Given any
// duplicate-free sequence of states, this derives the full design the same
// way a textbook exercise would: build the state table, read off the J-K
// excitation table per flip-flop (states outside the cycle are
// don't-cares), minimize each J/K signal with a Quine-McCluskey-style
// prime-implicant search (adapted from the VK-tábla's K-map minimizer to
// also support don't-cares), then simulate the counter by literally
// evaluating those minimized equations — so the live simulation is a real
// check that the derivation is self-consistent, not just a replay of the
// typed-in list.

const ALL_LETTERS = ["A", "B", "C", "D", "E"];

let NUM_BITS = 4;
let assignment; // assignment[slot] = letter at weight 2^(NUM_BITS-1-slot), slot 0 = MSB
let SEQUENCE = []; // empty until the user enters a valid sequence — see applySequenceInput
let signals = []; // [{ label, letter, weightIndex, groups }] in MSB..LSB, J then K order

// --- DOM refs ---
const bitCountButtons = document.querySelectorAll(".var-count-btn");
const weightAssignEl = document.getElementById("weight-assign");
const sequenceInput = document.getElementById("sequence-input");
const sequenceErrorEl = document.getElementById("sequence-error");
const seqEl = document.getElementById("sim-sequence");
const stateNumEl = document.getElementById("sim-state-num");
const bitsEl = document.getElementById("sim-bits");
const clockBtn = document.getElementById("clock-btn");
const autoToggle = document.getElementById("auto-toggle");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const stateTableEl = document.getElementById("state-table");
const excitationTableEl = document.getElementById("excitation-table");
const ffEquationsEl = document.getElementById("ff-equations");
const circuitEl = document.getElementById("circuit-diagram");

let current = SEQUENCE[0];
let autoTimer = null;

// --- bit helpers (MSB-first arrays, matching how the VK-tábla orders
// PLACE_VALUES from largest weight to smallest) ---
function bitsArrayOf(n) {
  return Array.from({ length: NUM_BITS }, (_, slot) => (n >> (NUM_BITS - 1 - slot)) & 1);
}

function valueFromBits(arr) {
  return arr.reduce((acc, b, slot) => acc | (b << (NUM_BITS - 1 - slot)), 0);
}

function letterAt(slot) {
  return assignment[slot];
}

// --- settings: bit count + letter assignment (same swap-on-conflict
// pattern as the VK-tábla's weight assignment) ---
function configureBits(n) {
  NUM_BITS = n;
  assignment = ALL_LETTERS.slice(0, n);
}

function syncBitCountButtons() {
  bitCountButtons.forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.n) === NUM_BITS);
  });
}

function buildWeightAssign() {
  weightAssignEl.innerHTML = "";
  weightAssignEl.style.gridTemplateColumns = `repeat(${NUM_BITS}, 1fr)`;
  for (let slot = 0; slot < NUM_BITS; slot++) {
    const weight = 1 << (NUM_BITS - 1 - slot);
    const wrap = document.createElement("div");
    wrap.className = "weight-slot";

    const label = document.createElement("div");
    label.className = "weight-label";
    label.textContent = `2${superscript(NUM_BITS - 1 - slot)} = ${weight}`;
    wrap.appendChild(label);

    const select = document.createElement("select");
    select.dataset.slot = slot;
    ALL_LETTERS.slice(0, NUM_BITS).forEach(letter => {
      const opt = document.createElement("option");
      opt.value = letter;
      opt.textContent = letter;
      select.appendChild(opt);
    });
    select.value = assignment[slot];
    select.addEventListener("change", () => setAssignment(slot, select.value));
    wrap.appendChild(select);

    weightAssignEl.appendChild(wrap);
  }
}

function superscript(n) {
  const map = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴" };
  return String(n).split("").map(c => map[c] ?? c).join("");
}

function setAssignment(slotIndex, letter) {
  const currentIndex = assignment.indexOf(letter);
  if (currentIndex === slotIndex) return;
  [assignment[slotIndex], assignment[currentIndex]] = [assignment[currentIndex], assignment[slotIndex]];
  buildWeightAssign();
  rebuild();
}

// --- sequence input parsing ---
function parseSequenceInput(text) {
  const normalized = text.replace(/->/g, ",").replace(/→/g, ",");
  const tokens = normalized.split(/[,\s]+/).filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false, error: "Add meg az állapotsorozatot a fenti mezőben a megjelenítéshez." };
  }
  if (tokens.length < 2) {
    return { ok: false, error: "Legalább 2 állapot szükséges a ciklushoz." };
  }
  const maxVal = (1 << NUM_BITS) - 1;
  const seq = [];
  for (const tok of tokens) {
    if (!/^\d+$/.test(tok)) {
      return { ok: false, error: `Érvénytelen érték: „${tok}” — csak egész számokat adj meg.` };
    }
    const n = Number(tok);
    if (n > maxVal) {
      return { ok: false, error: `A(z) ${n} érték nem fér el ${NUM_BITS} biten (0–${maxVal} a tartomány).` };
    }
    seq.push(n);
  }
  const seen = new Set();
  for (const n of seq) {
    if (seen.has(n)) {
      return { ok: false, error: `A(z) ${n} állapot többször szerepel — minden állapot csak egyszer fordulhat elő a ciklusban.` };
    }
    seen.add(n);
  }
  return { ok: true, sequence: seq };
}

// --- J-K excitation table: Q(t) -> Q(t+1) => { j, k }, null = don't care ---
function jkFor(q, qNext) {
  if (q === 0 && qNext === 0) return { j: 0, k: null };
  if (q === 0 && qNext === 1) return { j: 1, k: null };
  if (q === 1 && qNext === 0) return { j: null, k: 1 };
  return { j: null, k: 0 };
}

function applyJK(j, k, q) {
  if (j === 0 && k === 0) return q;
  if (j === 0 && k === 1) return 0;
  if (j === 1 && k === 0) return 1;
  return 1 - q;
}

function transitionsOf(sequence) {
  return sequence.map((s, i) => ({ present: s, next: sequence[(i + 1) % sequence.length] }));
}

// computePrimeImplicants(careSet, numBits, bitsOf) — the Quine-McCluskey
// combine-adjacent-terms search itself now lives in ../utils.js, shared
// with the VK-tábla's K-map minimizer; this page just supplies its own
// bit width and index-to-bits expansion (bitsArrayOf) and, unlike VK-tábla,
// treats the result as (groups, onSet) rather than assuming a single "the
// 1s" set, since some cared-about states here are don't-cares

// minimal cover selecting only enough prime implicants to cover `onSet`
// (don't-cares in a chosen implicant's cover are free, not required)
function selectMinimalCover(groups, onSet) {
  if (onSet.size === 0) return [];

  const coverageMap = new Map();
  groups.forEach((g, idx) => {
    g.cover.forEach(n => {
      if (!onSet.has(n)) return;
      if (!coverageMap.has(n)) coverageMap.set(n, []);
      coverageMap.get(n).push(idx);
    });
  });

  const essentialIdx = new Set();
  onSet.forEach(n => {
    const covers = coverageMap.get(n) || [];
    if (covers.length === 1) essentialIdx.add(covers[0]);
  });

  const coveredCells = new Set();
  essentialIdx.forEach(idx => groups[idx].cover.forEach(n => { if (onSet.has(n)) coveredCells.add(n); }));
  const remaining = [...onSet].filter(n => !coveredCells.has(n));

  const chosenIdx = new Set(essentialIdx);
  if (remaining.length > 0) {
    const candidates = groups.map((_, i) => i).filter(i => !essentialIdx.has(i));
    findSmallestCover(candidates, groups, remaining, onSet).forEach(i => chosenIdx.add(i));
  }

  return [...chosenIdx].map(i => groups[i]);
}

function findSmallestCover(candidateIdxs, groups, remaining, onSet) {
  const target = new Set(remaining);
  for (let k = 1; k <= candidateIdxs.length; k++) {
    const combo = findCoveringCombo(candidateIdxs, groups, target, onSet, k);
    if (combo) return combo;
  }
  return [];
}

function findCoveringCombo(candidateIdxs, groups, target, onSet, k) {
  const combo = [];
  function coversTarget() {
    const union = new Set();
    combo.forEach(idx => groups[idx].cover.forEach(n => { if (onSet.has(n)) union.add(n); }));
    for (const t of target) if (!union.has(t)) return false;
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

function evalGroups(groups, bitsArr) {
  if (groups.length === 0) return 0;
  return groups.some(g => g.bits.every((b, i) => b === -1 || b === bitsArr[i])) ? 1 : 0;
}

function formulaHtml(groups, sliceLetters) {
  if (groups.length === 0) return "0";
  const terms = groups.map(g => {
    const lits = [];
    g.bits.forEach((b, i) => {
      if (b === -1) return;
      const letter = sliceLetters[i];
      lits.push(b === 1 ? letter : `<span class="overline">${letter}</span>`);
    });
    return lits.length ? lits.join(" · ") : "1";
  });
  return terms.join(" + ");
}

// --- build the full design from the current NUM_BITS / SEQUENCE ---
function buildSignals() {
  const totalStates = 1 << NUM_BITS;
  const transitions = transitionsOf(SEQUENCE);
  const sliceLetters = Array.from({ length: NUM_BITS }, (_, slot) => letterAt(slot));

  const result = [];
  for (let slot = 0; slot < NUM_BITS; slot++) {
    ["J", "K"].forEach(kind => {
      const onSet = new Set();
      const offSet = new Set();
      transitions.forEach(({ present, next }) => {
        const q = bitsArrayOf(present)[slot];
        const qNext = bitsArrayOf(next)[slot];
        const { j, k } = jkFor(q, qNext);
        const val = kind === "J" ? j : k;
        if (val === 0) offSet.add(present);
        else if (val === 1) onSet.add(present);
      });
      const dcSet = new Set();
      for (let i = 0; i < totalStates; i++) {
        if (!onSet.has(i) && !offSet.has(i)) dcSet.add(i);
      }
      const careSet = new Set([...onSet, ...dcSet]);
      const primes = computePrimeImplicants(careSet, NUM_BITS, bitsArrayOf);
      const groups = selectMinimalCover(primes, onSet);
      result.push({
        kind, slot,
        letter: sliceLetters[slot],
        label: `${kind}<sub>${sliceLetters[slot]}</sub>`,
        groups,
        html: formulaHtml(groups, sliceLetters),
      });
    });
  }
  return result;
}

function nextValue(n) {
  const bits = bitsArrayOf(n);
  const nextBits = bits.map((q, slot) => {
    const jSig = signals.find(s => s.slot === slot && s.kind === "J");
    const kSig = signals.find(s => s.slot === slot && s.kind === "K");
    const j = evalGroups(jSig.groups, bits);
    const k = evalGroups(kSig.groups, bits);
    return applyJK(j, k, q);
  });
  return valueFromBits(nextBits);
}

// --- rendering ---
// drawn as one SVG: a row of state bubbles connected by straight arrows,
// plus a single dashed arrow curving from the last bubble back down and
// into the first one — shows the cycle closes without repeating the first
// state's number a second time at the end of the row
function buildSequenceStrip() {
  seqEl.innerHTML = "";

  const n = SEQUENCE.length;
  const r = 22;
  const spacing = 78;
  const padding = 30;
  const rowY = 50;
  const loopDrop = 34;
  // the current-state bubble scales up 1.15x (see .sim-seq-circle.is-current)
  // — stopping a connector at the plain radius r would merge into that
  // enlarged circle whenever the connector's endpoint bubble is current,
  // so every connector clears this larger radius instead
  const bubbleGap = r + 10;
  const width = padding * 2 + (n - 1) * spacing;
  const height = rowY + bubbleGap + loopDrop + 20;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width, height, class: "sim-seq-svg" });

  const defs = svgEl("defs", {});
  const marker = svgEl("marker", {
    id: "sim-seq-arrowhead", markerWidth: 8, markerHeight: 8,
    refX: 6, refY: 3, orient: "auto", markerUnits: "strokeWidth",
  });
  marker.appendChild(svgEl("path", { d: "M0,0 L6,3 L0,6 Z", class: "sim-seq-arrowhead-fill" }));
  defs.appendChild(marker);
  const loopMarker = svgEl("marker", {
    id: "sim-seq-loop-arrowhead", markerWidth: 9, markerHeight: 9,
    refX: 6.5, refY: 3.5, orient: "auto", markerUnits: "strokeWidth",
  });
  loopMarker.appendChild(svgEl("path", { d: "M0,0 L7,3.5 L0,7 Z", class: "sim-seq-loop-arrowhead-fill" }));
  defs.appendChild(loopMarker);
  svg.appendChild(defs);

  const centers = SEQUENCE.map((_, i) => padding + i * spacing);

  // straight connectors between consecutive bubbles
  for (let i = 0; i < n - 1; i++) {
    svg.appendChild(svgEl("line", {
      x1: centers[i] + r, y1: rowY, x2: centers[i + 1] - r, y2: rowY,
      class: "sim-seq-line", "marker-end": "url(#sim-seq-arrowhead)",
    }));
  }

  // return connector: a plain rectilinear elbow — straight down from the
  // last bubble, straight across below the row, straight up into the
  // first — rather than a curved swoop, so it reads as a deliberately
  // routed connector (like the straight forward connectors above) instead
  // of a decorative flourish
  if (n > 1) {
    const lastX = centers[n - 1], firstX = centers[0];
    const dropY = rowY + bubbleGap + loopDrop;
    const d = `M ${lastX} ${rowY + bubbleGap} L ${lastX} ${dropY} L ${firstX} ${dropY} L ${firstX} ${rowY + bubbleGap}`;
    svg.appendChild(svgEl("path", { d, class: "sim-seq-loop", "marker-end": "url(#sim-seq-loop-arrowhead)" }));
  }

  // bubbles (drawn last so they sit on top of the connector lines)
  SEQUENCE.forEach((s, i) => {
    const cx = centers[i];
    svg.appendChild(svgEl("circle", { cx, cy: rowY, r, class: "sim-seq-circle", "data-state": s }));
    const text = svgEl("text", {
      x: cx, y: rowY, class: "sim-seq-text", "data-state": s,
      "text-anchor": "middle", "dominant-baseline": "central",
    });
    text.textContent = s;
    svg.appendChild(text);
  });

  seqEl.appendChild(svg);
}

function renderSim() {
  const bits = bitsArrayOf(current);
  stateNumEl.textContent = current;

  bitsEl.innerHTML = "";
  bits.forEach((val, slot) => {
    const wrap = document.createElement("div");
    wrap.className = "sim-bit";

    const label = document.createElement("div");
    label.className = "sim-bit-name";
    label.textContent = letterAt(slot);
    wrap.appendChild(label);

    const box = document.createElement("div");
    box.className = "sim-bit-value" + (val ? " is-one" : "");
    box.textContent = val;
    wrap.appendChild(box);

    bitsEl.appendChild(wrap);
  });

  seqEl.querySelectorAll(".sim-seq-circle, .sim-seq-text").forEach(el => {
    el.classList.toggle("is-current", Number(el.dataset.state) === current);
  });
}

function pulse() {
  current = nextValue(current);
  renderSim();
  stateNumEl.classList.remove("is-pulsing");
  void stateNumEl.offsetWidth;
  stateNumEl.classList.add("is-pulsing");
}

function startAuto() {
  stopAuto();
  autoTimer = setInterval(pulse, 1000);
}

function stopAuto() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

function binLabel() {
  return Array.from({ length: NUM_BITS }, (_, slot) => letterAt(slot)).join(" ");
}

function renderStateTable() {
  const head = binLabel();
  stateTableEl.querySelector("thead").innerHTML = `
    <tr><th>Jelenlegi állapot</th><th>${head}</th><th>Következő állapot</th><th>${head}</th></tr>
  `;
  const body = stateTableEl.querySelector("tbody");
  body.innerHTML = "";
  transitionsOf(SEQUENCE).forEach(({ present, next }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${present}</td>
      <td>${bitsArrayOf(present).join(" ")}</td>
      <td>${next}</td>
      <td>${bitsArrayOf(next).join(" ")}</td>
    `;
    body.appendChild(tr);
  });
}

function cellText(v) {
  return v === null ? '<span class="dc">–</span>' : String(v);
}

function renderExcitationTable() {
  const thead = excitationTableEl.querySelector("thead");
  const groupHeaders = Array.from({ length: NUM_BITS }, (_, slot) =>
    `<th colspan="2">Tároló ${letterAt(slot)}</th>`
  ).join("");
  const subHeaders = Array.from({ length: NUM_BITS }, (_, slot) =>
    `<th>J<sub>${letterAt(slot)}</sub></th><th>K<sub>${letterAt(slot)}</sub></th>`
  ).join("");
  thead.innerHTML = `
    <tr><th rowspan="2">Állapot</th>${groupHeaders}</tr>
    <tr>${subHeaders}</tr>
  `;

  const body = excitationTableEl.querySelector("tbody");
  body.innerHTML = "";
  transitionsOf(SEQUENCE).forEach(({ present, next }) => {
    const b = bitsArrayOf(present);
    const nb = bitsArrayOf(next);
    const cells = b.map((q, slot) => jkFor(q, nb[slot]))
      .map(({ j, k }) => `<td>${cellText(j)}</td><td>${cellText(k)}</td>`)
      .join("");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${present} → ${next}</td>${cells}`;
    body.appendChild(tr);
  });
}

function renderEquations() {
  ffEquationsEl.innerHTML = "";
  signals.forEach(sig => {
    const card = document.createElement("div");
    card.className = "ff-eq-card";
    card.innerHTML = `
      <div class="ff-eq-formula">${sig.label} = ${sig.html}</div>
    `;
    ffEquationsEl.appendChild(card);
  });
}

// svgEl / andGatePath / orGatePath now live in ../utils.js, shared with
// the VK-tábla — both pages drew the exact same shapes from the exact
// same code, just copy-pasted

// --- circuit diagram: classic textbook J-K flip-flop schematic (J/C/K
// pins on the left, Q/Q̄ on the right, small connection dots, one shared
// Clock bus underneath every flip-flop — there's no Törlés/clear line
// since this design never derives a reset input, so drawing one would
// just be decoration with nothing behind it) rather than plain text
// formulas. Every literal a J or K input needs gets its own direct,
// point-to-point wire straight from the flip-flop that actually produces
// it to the exact gate input that consumes it — not a shared rail every
// box taps blindly, so a glance at any wire shows exactly where it goes
// and nothing is drawn that isn't actually needed. Real AND gates combine
// multiple literals, real OR gates combine multiple product terms, and
// inverter bubbles handle negated literals, exactly like the VK-tábla's
// gate diagrams (this reuses the same AND/OR silhouette shapes).

function literalsOf(group) {
  const lits = [];
  group.bits.forEach((b, slot) => {
    if (b !== -1) lits.push({ slot, negated: b === 0 });
  });
  return lits;
}

// one color per source flip-flop so every wire in the "sky" area reads as
// belonging to a specific, identifiable signal instead of all looking like
// the same undifferentiated line. Q̄ (the inverted output) gets a lighter,
// less saturated variant of that same color — same identity, but visibly
// a different signal from the plain Q it's the complement of
const WIRE_COLOR_CLASSES = ["cd-wire-0", "cd-wire-1", "cd-wire-2", "cd-wire-3", "cd-wire-4"];
function wireColorClass(slot) {
  return WIRE_COLOR_CLASSES[slot % WIRE_COLOR_CLASSES.length];
}
function wireClassFor(slot, negated) {
  return negated ? `${wireColorClass(slot)} cd-wire-inv` : wireColorClass(slot);
}

function renderCircuit() {
  circuitEl.innerHTML = "";

  // gutterW directly sets the SVG's total width (5 gutters + 4 boxes for a
  // 4-bit counter) — at 240 that came out to 1700px, wider than most real
  // browser windows offer even at full bleed, so no amount of shaving the
  // card's own padding could ever make it fit without scrolling. 170 still
  // leaves enough room for a two-term OR of 2-literal ANDs (the row-stagger
  // fix needs roughly 130-150px of that), but brings the 4-bit default
  // down to 1350px, comfortably inside a typical laptop window
  const boxW = 120, boxH = 170, gutterW = 170, padding = gutterW;
  const laneSpacing = 20;

  // lanes are shared per unique (source flip-flop, polarity) pair, not per
  // individual usage — if both JA and KB need QC, they ride the same riser
  // and bus lane and only split into separate downlines at the very end,
  // instead of each getting a whole separate top line for the same signal
  const laneOrder = [];
  const laneIndexOf = new Map();
  const laneKeyInfo = new Map();
  for (const sig of signals) {
    for (const g of sig.groups) {
      if (g.bits.every(b => b === -1)) continue;
      for (const lit of literalsOf(g)) {
        const key = lit.slot + (lit.negated ? "n" : "p");
        if (!laneIndexOf.has(key)) {
          laneIndexOf.set(key, laneOrder.length);
          laneOrder.push(key);
          laneKeyInfo.set(key, { srcSlot: lit.slot, negated: lit.negated });
        }
      }
    }
  }

  const skyTop = 30;
  const boxTop = skyTop + laneOrder.length * laneSpacing + 30;
  const clkY = boxTop + boxH + 60;
  const boxSpacing = boxW + gutterW;
  const totalW = padding + NUM_BITS * boxSpacing + 20;
  const totalH = clkY + 30;

  const svg = svgEl("svg", { viewBox: `0 0 ${totalW} ${totalH}`, width: totalW, height: totalH });

  const boxX = slot => padding + slot * boxSpacing;
  // pins sit a bit clear of the box border rather than exactly on it —
  // otherwise an incoming wire's final vertical run lands right on top of
  // the box's own outline and disappears into it. J/Q and K/Q̄ each get a
  // different lead depth (NEAR vs FAR) so their final approach runs on a
  // genuinely different x-track — with equal depth, a plain direct wire to
  // J and one to K would drop at the exact same x, just stopping at
  // different heights, and read as one line instead of two
  const LEAD_NEAR = 14, LEAD_FAR = 44;
  const pinJ = slot => ({ x: boxX(slot) - LEAD_NEAR, y: boxTop + boxH * 0.22 });
  const pinC = slot => ({ x: boxX(slot) - LEAD_NEAR, y: boxTop + boxH * 0.5 });
  const pinK = slot => ({ x: boxX(slot) - LEAD_FAR, y: boxTop + boxH * 0.78 });
  const pinQ = slot => ({ x: boxX(slot) + boxW + LEAD_NEAR, y: boxTop + boxH * 0.22 });
  const pinQbar = slot => ({ x: boxX(slot) + boxW + LEAD_FAR, y: boxTop + boxH * 0.78 });

  function dot(x, y, colorClass) {
    svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 3, class: colorClass ? `cd-dot ${colorClass}` : "cd-dot" }));
  }

  // literal taps are queued instead of drawn immediately: gate/pin layout
  // still happens inline as before (nothing downstream depends on a tap's
  // own drawing), but the actual riser+bus+downline wires are resolved
  // together afterwards in flushTaps(), once every use of a given source
  // is known — that's what lets repeat uses of the same signal share one
  // lane instead of each claiming a full one of their own.
  // a negated literal is sourced straight from that flip-flop's own Q̄ pin
  // instead of tapping Q and inverting it mid-wire — a real J-K flip-flop
  // already provides the complement, so this is both simpler to draw and
  // matches how the box itself is labeled
  const tapQueue = [];
  function drawTap(srcSlot, negated, endX, endY) {
    tapQueue.push({ key: srcSlot + (negated ? "n" : "p"), endX, endY });
  }

  function flushTaps() {
    const byKey = new Map();
    for (const req of tapQueue) {
      if (!byKey.has(req.key)) byKey.set(req.key, []);
      byKey.get(req.key).push(req);
    }
    for (const [key, reqs] of byKey) {
      const { srcSlot, negated } = laneKeyInfo.get(key);
      const colorClass = wireClassFor(srcSlot, negated);
      const laneY = skyTop + laneIndexOf.get(key) * laneSpacing;
      const src = negated ? pinQbar(srcSlot) : pinQ(srcSlot);

      svg.appendChild(svgEl("path", { class: `cd-line ${colorClass}`, d: `M ${src.x} ${src.y} L ${src.x} ${laneY}` }));

      const xs = reqs.map(r => r.endX);
      const allX = [src.x, ...xs];
      const minX = Math.min(...allX), maxX = Math.max(...allX);
      if (maxX > minX) {
        svg.appendChild(svgEl("path", { class: `cd-line ${colorClass}`, d: `M ${minX} ${laneY} L ${maxX} ${laneY}` }));
      }

      // a dot belongs only where 3+ segments actually meet (a real branch)
      // — not at a point where the path just turns a corner. src.x or a
      // request's endX only earns one when the bus genuinely passes
      // through it (not merely ends there) or more than one wire lands on
      // that exact spot
      function degreeAt(px) {
        const verticals = allX.filter(vx => vx === px).length;
        const busDeg = maxX > minX ? (px > minX && px < maxX ? 2 : 1) : 0;
        return verticals + busDeg;
      }
      if (degreeAt(src.x) >= 3) dot(src.x, laneY, colorClass);

      for (const req of reqs) {
        if (degreeAt(req.endX) >= 3) dot(req.endX, laneY, colorClass);
        svg.appendChild(svgEl("path", { class: `cd-line ${colorClass}`, d: `M ${req.endX} ${laneY} L ${req.endX} ${req.endY}` }));
      }
    }
  }

  // draws whatever logic (constant / wire / AND / OR-of-ANDs) a J or K pin
  // needs, entirely within the gutter to the left of `slot`'s own box,
  // ending exactly at the pin
  function drawPinLogic(groups, slot, pin) {
    if (groups.length === 0) {
      const label = svgEl("text", { x: pin.x - 10, y: pin.y, class: "cd-label-small", "text-anchor": "end" });
      label.textContent = "0";
      svg.appendChild(label);
      return;
    }
    if (groups.length === 1 && groups[0].bits.every(b => b === -1)) {
      const label = svgEl("text", { x: pin.x - 10, y: pin.y, class: "cd-label-small", "text-anchor": "end" });
      label.textContent = "1";
      svg.appendChild(label);
      return;
    }

    const gutterRight = pin.x - 10;
    const termTapStep = 16;

    // one product term (single literal, or an AND of several), returns
    // which source literal it's a "pure" passthrough of (so the caller can
    // color its own connector the same way), or null once it's been
    // combined by a gate and is no longer any one signal
    function drawTerm(group, endX, endY) {
      const lits = literalsOf(group);
      if (lits.length === 1) {
        drawTap(lits[0].slot, lits[0].negated, endX, endY);
        return lits[0];
      }
      const gateW = 22, gateH = Math.max(16, lits.length * 11);
      const gateX = endX - gateW;
      lits.forEach((lit, idx) => {
        const tapX = gateX - (lits.length - idx) * termTapStep;
        const y = endY - gateH / 2 + (gateH * (idx + 0.5)) / lits.length;
        drawTap(lit.slot, lit.negated, tapX, y);
        svg.appendChild(svgEl("path", { class: `cd-line ${wireClassFor(lit.slot, lit.negated)}`, d: `M ${tapX} ${y} L ${gateX} ${y}` }));
      });
      svg.appendChild(svgEl("path", { class: "cd-shape", d: andGatePath(gateX, endY - gateH / 2, gateW, gateH) }));
      svg.appendChild(svgEl("path", { class: "cd-line", d: `M ${gateX + gateW} ${endY} L ${endX} ${endY}` }));
      return null;
    }

    if (groups.length === 1) {
      drawTerm(groups[0], pin.x, pin.y);
      return;
    }

    // several product terms OR-ed together
    const orW = 26, orH = Math.max(20, groups.length * 16);
    const orX = gutterRight - orW;
    const termEndX = orX - Math.max(...groups.map(g => (literalsOf(g).length > 1 ? 30 : 6)));
    // every term shares the same nominal termEndX, so without a per-row
    // offset, two sibling AND gates (or two single-literal terms) can end
    // up with their tap x-coordinates landing exactly on top of each
    // other — a small stagger per row keeps each term's gate and taps on
    // their own x-track
    const rowStagger = 11;
    groups.forEach((g, idx) => {
      const y = pin.y - orH / 2 + (orH * (idx + 0.5)) / groups.length;
      const rowEndX = termEndX - idx * rowStagger;
      const pureLit = drawTerm(g, rowEndX, y);
      const connClass = pureLit === null ? "cd-line" : `cd-line ${wireClassFor(pureLit.slot, pureLit.negated)}`;
      svg.appendChild(svgEl("path", { class: connClass, d: `M ${rowEndX} ${y} L ${orX} ${y}` }));
    });
    svg.appendChild(svgEl("path", { class: "cd-shape", d: orGatePath(orX, pin.y - orH / 2, orW, orH) }));
    svg.appendChild(svgEl("path", { class: "cd-line", d: `M ${orX + orW} ${pin.y} L ${pin.x} ${pin.y}` }));
  }

  for (let slot = 0; slot < NUM_BITS; slot++) {
    const letter = letterAt(slot);
    const x = boxX(slot);

    // J / K input logic, drawn before the box (order doesn't matter for
    // overlap now that pins sit clear of the border, but the box still
    // needs to be on top of the gutter's crossing wires visually)
    const jSig = signals.find(s => s.slot === slot && s.kind === "J");
    const kSig = signals.find(s => s.slot === slot && s.kind === "K");
    drawPinLogic(jSig.groups, slot, pinJ(slot));
    drawPinLogic(kSig.groups, slot, pinK(slot));

    // this flip-flop's whole identity — box outline, title, and Q/Q̄ pin
    // labels — carries its own color too, not just the wires leaving it,
    // so it's immediately obvious which colored wire belongs to which box
    const slotColor = wireColorClass(slot);

    // the box itself
    svg.appendChild(svgEl("rect", { x, y: boxTop, width: boxW, height: boxH, rx: 4, class: `cd-shape ${slotColor}` }));
    const title = svgEl("text", { x: x + boxW / 2, y: boxTop + boxH * 0.36, class: `cd-ff-title ${slotColor}`, "text-anchor": "middle" });
    title.textContent = `T${letter}`;
    svg.appendChild(title);

    // pin labels, just inside the box border (independent of the external
    // pin position, which now sits some distance away from that border).
    // J/K stay neutral (an input may carry a combined signal); C stays
    // neutral (shared clock, not this box's own signal); Q/Q̄ are colored
    // since they're always this one flip-flop's own raw output
    const jP = pinJ(slot), cP = pinC(slot), kP = pinK(slot), q = pinQ(slot), qbP = pinQbar(slot);
    const edgeL = x, edgeR = x + boxW;
    svg.appendChild(Object.assign(svgEl("text", { x: edgeL + 10, y: jP.y, class: "cd-pin-label" }), { textContent: "J" }));
    svg.appendChild(Object.assign(svgEl("text", { x: edgeL + 10, y: kP.y, class: "cd-pin-label" }), { textContent: "K" }));
    svg.appendChild(Object.assign(svgEl("text", { x: edgeL + 20, y: cP.y, class: "cd-pin-label" }), { textContent: "C" }));
    svg.appendChild(Object.assign(svgEl("text", { x: edgeR - 10, y: q.y, class: `cd-pin-label ${slotColor}`, "text-anchor": "end" }), { textContent: "Q" }));
    const qbText = svgEl("text", { x: edgeR - 10, y: qbP.y, class: `cd-pin-label overline-svg ${slotColor} cd-wire-inv`, "text-anchor": "end" });
    qbText.textContent = "Q";
    svg.appendChild(qbText);

    // small clock-triangle marker right at the C pin's border crossing
    svg.appendChild(svgEl("path", {
      class: "cd-shape",
      d: `M ${edgeL} ${cP.y - 7} L ${edgeL} ${cP.y + 7} L ${edgeL + 10} ${cP.y} Z`,
    }));

    // short stub wires connecting each external pin to the box border it
    // actually belongs to — this gap is what keeps the incoming/outgoing
    // wires visible instead of blending into the box outline. the J/K
    // (input) stubs stay neutral since whatever arrives there may already
    // be a combined signal; the Q/Q̄ (output) stubs are colored since
    // they're always this one flip-flop's own raw signal
    svg.appendChild(svgEl("path", { class: "cd-line", d: `M ${edgeL} ${jP.y} L ${jP.x} ${jP.y}` }));
    svg.appendChild(svgEl("path", { class: "cd-line", d: `M ${edgeL} ${kP.y} L ${kP.x} ${kP.y}` }));
    svg.appendChild(svgEl("path", { class: `cd-line ${slotColor}`, d: `M ${edgeR} ${q.y} L ${q.x} ${q.y}` }));
    svg.appendChild(svgEl("path", { class: `cd-line ${slotColor} cd-wire-inv`, d: `M ${edgeR} ${qbP.y} L ${qbP.x} ${qbP.y}` }));

    // no dots at jP/kP/q/qbP: each is just the incoming/outgoing wire
    // bending into its stub, two segments meeting — a corner, not a
    // junction, so a dot there would be misleading

    // Clock is the one genuinely shared signal here — every flip-flop
    // needs the literal same pulse — so unlike Q values above, it's drawn
    // as one real bus the whole row taps into. the triangle sits right at
    // the box border (edgeL) while the drop down to the bus starts at the
    // external pin point (cP.x) — same LEAD_NEAR gap as J/K/Q/Q̄ — so it
    // needs its own stub bridging the two, or the wire never actually
    // touches the triangle at all
    svg.appendChild(svgEl("path", { class: "cd-line", d: `M ${edgeL} ${cP.y} L ${cP.x} ${cP.y}` }));
    // the stub-to-drop bend at (cP.x, cP.y) is just a corner (no dot), but
    // where the drop meets the shared bus below IS a real junction — the
    // bus continues in both directions past every tap — so that one keeps
    // its dot
    svg.appendChild(svgEl("path", { class: "cd-line", d: `M ${cP.x} ${cP.y} L ${cP.x} ${clkY}` }));
    dot(cP.x, clkY);
  }

  // all the signal wires (deferred above) are drawn last, on top of every
  // box/gate — they never overlap any shape's interior since the "sky"
  // they travel through is empty space strictly above the boxes
  flushTaps();

  // the bus only needs to reach the last flip-flop's actual clock tap —
  // running it on to that box's far edge left a stretch of line with
  // nothing connected to it, underneath the last box for no reason
  const lastX = pinC(NUM_BITS - 1).x;
  svg.appendChild(svgEl("line", { x1: padding - 60, y1: clkY, x2: lastX, y2: clkY, class: "cd-bus" }));
  const clkLabel = svgEl("text", { x: padding - 70, y: clkY, class: "cd-label", "text-anchor": "end" });
  clkLabel.textContent = "Órajel";
  svg.appendChild(clkLabel);

  circuitEl.appendChild(svg);
}

// --- master rebuild, called on any settings change ---
function rebuild() {
  signals = buildSignals();
  current = SEQUENCE[0];
  stopAuto();
  autoToggle.checked = false;
  buildSequenceStrip();
  renderSim();
  renderStateTable();
  renderExcitationTable();
  renderEquations();
  renderCircuit();
}

function applySequenceInput() {
  const result = parseSequenceInput(sequenceInput.value);
  if (!result.ok) {
    sequenceErrorEl.textContent = result.error;
    sequenceErrorEl.hidden = false;
    // a plain empty field (nothing typed yet) shouldn't look like a
    // rejected value — the red border only kicks in once the field
    // actually holds something invalid
    sequenceInput.classList.toggle("is-invalid", sequenceInput.value.trim() !== "");
    // no valid SEQUENCE to simulate or export yet — disable the controls
    // that would otherwise crash (or export a blank document) trying to
    // work with a sequence that doesn't exist
    stopAuto();
    autoToggle.checked = false;
    autoToggle.disabled = true;
    clockBtn.disabled = true;
    exportPdfBtn.disabled = true;
    return;
  }
  sequenceErrorEl.hidden = true;
  sequenceInput.classList.remove("is-invalid");
  autoToggle.disabled = false;
  clockBtn.disabled = false;
  exportPdfBtn.disabled = false;
  SEQUENCE = result.sequence;
  rebuild();
}

// --- event wiring ---
bitCountButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const n = Number(btn.dataset.n);
    if (n === NUM_BITS) return;
    configureBits(n);
    syncBitCountButtons();
    buildWeightAssign();
    // re-validate the current sequence text against the new bit range
    applySequenceInput();
  });
});

sequenceInput.addEventListener("input", applySequenceInput);

clockBtn.addEventListener("click", () => {
  pulse();
  if (autoToggle.checked) startAuto();
});

autoToggle.addEventListener("change", () => {
  if (autoToggle.checked) startAuto();
  else stopAuto();
});

// --- init ---
configureBits(4);
syncBitCountButtons();
buildWeightAssign();
applySequenceInput();
