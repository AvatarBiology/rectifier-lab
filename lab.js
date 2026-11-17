"use strict";

const $ = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll("[data-mode]")];
const jumps = [...document.querySelectorAll("[data-phase]")];
const viewChoices = [...document.querySelectorAll("[data-view-choice]")];
const lessons = {
  half: ["半波整流", "一顆整流二極體選擇通過的半週。比較紅、綠 LED 在串接前後的變化。"],
  center: ["全波整流 · 中心抽頭式", "次級兩端相對中心抽頭的電壓互為反相。兩條支路輪流把電流送往同一個負載。"],
  bridge: ["橋式整流", "找出每個半週導通的二極體，再追蹤電流如何以同一方向流過負載。"],
};
const colors = { red: "#ef4d59", green: "#21b976" };
const junctionDrop = 0.7;
const peak = 6;
const hz = 60;
let mode = "half";
let bypass = false;
let phase = 0.25;
let selectedPart = "";
let playing = false;
let frame = 0;
let lastFrame = 0;

function simulate(cycles, kind = mode, before = bypass) {
  const input = peak * Math.sin(cycles * 2 * Math.PI);
  const sign = input > 1e-8 ? "pos" : input < -1e-8 ? "neg" : "";
  const drops = kind === "bridge" ? 2 : kind === "half" && before ? 0 : 1;
  const available = Math.max(0, Math.abs(input) - drops * junctionDrop);
  const passed = !!sign && (kind !== "half" || before || sign === "pos");
  const output = kind === "half" && before ? input : passed ? available : 0;
  const red = passed && !(kind === "half" && before && sign === "neg")
    ? Math.max(0, available - 1.8) / 200 : 0;
  const green = kind === "half" && before && sign === "neg"
    ? Math.max(0, available - 2.2) / 200 : 0;
  return { input, output, red, green, sign, circuit: passed && available > 0 ? sign : "",
    board: red > 0 || green > 0 ? sign : "" };
}

const svgStart = (label) => `<svg viewBox="0 0 600 340" role="group" aria-label="${label}">`;
const line = (points) => points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
const caption = (x, y, contents, attrs = "") => `<text x="${x}" y="${y}" ${attrs}>${contents}</text>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="#4a4667"/>`;
const circuitLabel = (x, y, text, extra = "") => caption(x, y, text, `class="diagram-label" ${extra}`);
const arrowMarker = (id, color) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker></defs>`;

function current(points, states, marker = "") {
  return `<path d="${line(points)}" class="flow" data-flow="${states}" ${marker ? `marker-end="url(#${marker})"` : ""}/>`;
}

function wire(points, states = "", arrow = false, reverse = false) {
  return `<path class="circuit-line" d="${line(points)}"/>` +
    (states ? current(reverse ? [...points].reverse() : points, states, arrow ? "schem-arrow" : "") : "");
}

function partGroup(id, label, change) {
  return `<g class="part" data-part="${id}" role="button" tabindex="0" aria-pressed="false" aria-label="${label}"${change}>`;
}

function componentSpan(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return { length: Math.hypot(dx, dy),
    transform: ` transform="translate(${a[0]} ${a[1]}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})"` };
}

function diode(a, b, id, state, labelAt) {
  const { length, transform } = componentSpan(a, b);
  const x = length / 2;
  return partGroup(id, `${id} 整流二極體，對照麵包板`, transform) +
    `<rect class="part-ring" x="${x - 22}" y="-17" width="44" height="34" rx="7"/>
    ${wire([[0, 0], [x - 10, 0]], state)}${wire([[x + 11, 0], [length, 0]], state, true)}
    <path class="diode-active" fill="#464262" d="M${x - 11} -11L${x + 10} 0L${x - 11} 11Z"/>
    <path class="circuit-line" d="M${x + 11} -11v22"/></g>` + circuitLabel(...labelAt, id);
}

function resistor(a, b, states, labelAt, reverse = false) {
  const { length, transform } = componentSpan(a, b);
  const x = length / 2;
  const points = [[0, 0], [x - 28, 0], [x - 24, -8], [x - 16, 8], [x - 8, -8],
    [x, 8], [x + 8, -8], [x + 16, 8], [x + 24, -8], [x + 28, 0], [length, 0]];
  return `<g${transform}>${wire(points, states, true, reverse)}
    ${mode === "half" && bypass ? current([...points].reverse(), "neg", "schem-arrow") : ""}</g>`
    + circuitLabel(...labelAt, "Rₗ");
}

function source(x, top, bottom, label) {
  const y = (top + bottom) / 2;
  return wire([[x, top], [x, y - 23]]) + wire([[x, y + 23], [x, bottom]]) +
    `<circle cx="${x}" cy="${y}" r="23" fill="#fff" class="circuit-line" style="fill:#fff"/>
    <path d="M${x - 13} ${y}q6 -12 13 0t13 0" class="circuit-line" style="stroke:#6e51bf"/>
    ${circuitLabel(x - 37, y + 5, label, 'text-anchor="end"')}`;
}

function drawSchematic() {
  const base = svgStart(lessons[mode][0] + "電路圖") + arrowMarker("schem-arrow", "#087b70");
  let body;
  if (mode === "half") {
    body = source(140, 89, 251, "AC") +
      (bypass ? wire([[140, 89], [450, 89]], "pos", true) + current([[450, 89], [147, 89]], "neg", "schem-arrow")
        : diode([140, 89], [450, 89], "D1", "pos", [287, 62])) +
      resistor([450, 89], [450, 251], "pos", [477, 176]) +
      wire([[450, 251], [140, 251]], "pos", true) +
      (bypass ? current([[140, 251], [444, 251]], "neg", "schem-arrow") : "") +
      circuitLabel(108, 78, "A") + circuitLabel(108, 273, "B") + circuitLabel(478, 111, "+") +
      circuitLabel(478, 248, "−") + dot(140, 89) + dot(140, 251) + dot(450, 89) + dot(450, 251);
  } else if (mode === "center") {
    const top = 65;
    const bottom = 275;
    const coilX = 142;
    body = `<path class="circuit-line" d="M142 65v12q30 0 0 15q30 0 0 15q30 0 0 15q30 0 0 15
      q30 0 0 15v36q30 0 0 15q30 0 0 15q30 0 0 15q30 0 0 15q30 0 0 15v12"/>
      <path d="M122 80v180M113 80v180" stroke="#817b99" stroke-width="2"/>
      ${caption(103, 321, "變壓器次級", 'fill="#625c7c" font-size="14"')}` +
      diode([coilX, top], [453, top], "D1", "pos", [284, 45]) +
      diode([coilX, bottom], [453, bottom], "D2", "neg", [284, 303]) +
      wire([[453, top], [453, 170]], "pos") +
      wire([[453, bottom], [453, 170]], "neg", true) +
      resistor([453, 170], [coilX, 170], "pos neg", [288, 144]) +
      dot(coilX, 170) + dot(453, 170) + circuitLabel(71, 70, "A") + circuitLabel(71, 273, "B") +
      circuitLabel(160, 197, "CT −") + circuitLabel(469, 175, "+");
  } else {
    const a = [307, 48], b = [307, 292], minus = [191, 170], plus = [423, 170];
    body = source(78, a[1], b[1], "AC") +
      wire([[78, a[1]], a], "pos", true) + current([a, [83, a[1]]], "neg", "schem-arrow") +
      wire([b, [78, b[1]]], "pos", true) + current([[78, b[1]], b], "neg", "schem-arrow") +
      diode(a, plus, "D1", "pos", [381, 96]) + diode(minus, a, "D2", "neg", [218, 97]) +
      diode(minus, b, "D3", "pos", [218, 255]) + diode(b, plus, "D4", "neg", [385, 255]) +
      resistor(plus, minus, "pos neg", [294, 149]) +
      circuitLabel(311, 35, "A") + circuitLabel(312, 317, "B") +
      circuitLabel(169, 175, "−") + circuitLabel(434, 175, "+") + [a, b, minus, plus].map(([x, y]) => dot(x, y)).join("");
  }
  $("schematic").innerHTML = base + body + "</svg>";
}

const rows = [103, 117, 131, 145, 159, 201, 215, 229, 243, 257];
const hole = (col, row) => [62 + 15.4 * col, rows[row]];

function breadboard() {
  const railY = [58, 73, 279, 294];
  let layout = `<rect x="43" y="41" width="510" height="267" rx="13" fill="#c3c0b5"/>
    <rect x="43" y="37" width="510" height="267" rx="13" fill="url(#board-material)" stroke="#f6f3e9"/>
    <rect x="48" y="173" width="500" height="14" rx="4" fill="#d1cfc5"/>
    <path d="M66 51h467M66 287h467" stroke="#be6a62" stroke-width="1.4" opacity=".72"/>
    <path d="M66 81h467M66 271h467" stroke="#6085b3" stroke-width="1.4" opacity=".72"/>`;
  for (let col = 1; col <= 30; col += 1) {
    const x = hole(col, 0)[0];
    for (const y of [...rows, ...railY]) {
      layout += `<rect x="${x - 2.05}" y="${y - 2.05}" width="4.1" height="4.1" rx=".8" fill="#777571"/>`;
    }
    if (col === 1 || col % 5 === 0) {
      layout += caption(x, 93, col, 'font-size="9" fill="#56534e" text-anchor="middle"');
      layout += caption(x, 267, col, 'font-size="9" fill="#56534e" text-anchor="middle"');
    }
  }
  rows.forEach((y, row) => { layout += caption(56, y + 3, "JIHGFEDCBA"[row], 'font-size="9" fill="#56534e" text-anchor="middle"'); });
  return layout;
}

function patchwire(points, color, states = "", arrow = false, reverse = false) {
  const d = line(points);
  return `<path d="${d}" stroke="#29283a2f" stroke-width="6" class="air-wire" style="stroke-width:6px"/><path d="${d}" stroke="${color}" class="air-wire"/>` +
    (states ? current(reverse ? [...points].reverse() : points, states, arrow ? "board-arrow" : "") : "");
}

function terminal(col, row, label, color, states, top = true) {
  const p = hole(col, row);
  const y = top ? 29 : 310;
  return patchwire([[p[0], y], p], color, states) +
    caption(p[0], top ? 20 : 326, label, 'text-anchor="middle" fill="#fff" font-size="14" font-weight="700"');
}

function internalStrip(col, first, last, forward, reverse = "") {
  const a = hole(col, first), b = hole(col, last);
  return `<path d="${line([a, b])}" stroke="#696b7d" stroke-opacity=".16" stroke-width="7" stroke-linecap="round"/>` +
    current([a, b], forward) + (reverse ? current([b, a], reverse) : "");
}

function boardDiode(a, b, id, states) {
  const pa = hole(...a), pb = hole(...b);
  const { length, transform } = componentSpan(pa, pb);
  const x = length / 2;
  const middleY = (pa[1] + pb[1]) / 2;
  return partGroup(id, `${id}，黑色本體，灰色環為陰極`, transform) +
    `<rect class="part-ring" x="-6" y="-12" width="${length + 12}" height="24" rx="6"/>
      <path class="lead" d="M0 0H${length}" stroke="#8c8c84" stroke-width="3"/>
      <rect x="${x - 18}" y="-7" width="36" height="14" rx="4" class="diode-active" fill="url(#diode-material)"/>
      <path d="M${x + 10} -6v12" stroke="#c9c9be" stroke-width="4"/>
      ${current([[0, 0], [x - 20, 0]], states)}
      ${current([[x + 20, 0], [length, 0]], states, "board-arrow")}</g>` +
    caption((pa[0] + pb[0]) / 2, middleY - 12, id, 'text-anchor="middle" font-size="11" font-weight="800" fill="#343343"');
}

function boardResistor(a, b, labelAt, states, reverses = "") {
  const { length, transform } = componentSpan(hole(...a), hole(...b));
  const x = length / 2;
  return `<g${transform}><path d="M0 0H${length}" stroke="#6c6a63" stroke-width="3"/>
    <rect x="${x - 18}" y="-6" width="36" height="12" fill="#d3b583" rx="6" stroke="#b2986b"/>
    <path d="M${x - 10} -5v10" stroke="#a54632" stroke-width="2.7"/>
    <path d="M${x - 2} -5v10" stroke="#322d2c" stroke-width="2.7"/>
    <path d="M${x + 5} -5v10" stroke="#795136" stroke-width="2.7"/>
    <path d="M${x + 12} -5v10" stroke="#9b762f" stroke-width="2"/>
    ${current([[0, 0], [x - 19, 0]], states)}
    ${current([[x + 19, 0], [length, 0]], states, "board-arrow")}
    ${reverses ? current([[x - 19, 0], [0, 0]], reverses, "board-arrow") + current([[length, 0], [x + 19, 0]], reverses) : ""}
    </g>${caption(...labelAt, "200 Ω", 'text-anchor="middle" font-size="10" font-weight="700" fill="#534734"')}`;
}

function boardLed(a, b, color, states) {
  const pa = hole(...a), pb = hole(...b);
  const x = (pa[0] + pb[0]) / 2;
  const y = (pa[1] + pb[1]) / 2;
  const yLamp = y - 5;
  const [positive, negative] = [pa, pb];
  return `<g data-led="${color}">
      <circle class="led-halo" cx="${x}" cy="${yLamp}" r="27" fill="url(#glow-${color})" opacity="0"/>
      <path d="${line([positive, [x, yLamp], negative])}" stroke="#6b6860" fill="none" stroke-width="2.8"/>
      ${current([positive, [x, yLamp]], states)}
      ${current([[x, yLamp], negative], states, "board-arrow")}
      <path d="M${x - 9} ${yLamp + 6}v-13a9 9 0 0 1 18 0v13z" fill="${color === "red" ? "#9b2636" : "#1e7051"}" stroke="#312937" stroke-width="1"/>
      <path class="led-light" d="M${x - 8} ${yLamp + 5}v-12a8 8 0 0 1 16 0v12z" fill="${colors[color]}" opacity="0"/>
      <path d="M${x - 5} ${yLamp - 5}v-3q0 -3 4 -4" stroke="#ffffffaa" fill="none" stroke-width="1.5" stroke-linecap="round"/>
      ${caption(positive[0], positive[1] + 11, "A", 'text-anchor="middle" font-size="9" font-weight="700" fill="#3e3b58"')}
      ${caption(negative[0], negative[1] + 11, "K", 'text-anchor="middle" font-size="9" font-weight="700" fill="#3e3b58"')}
    </g>`;
}

function drawBoard() {
  let body;
  const purple = "#7060b9", blue = "#407cac", burgundy = "#b9515b", charcoal = "#505068";
  if (mode === "half") {
    body = internalStrip(5, 0, 2, "pos", "neg") + internalStrip(12, 2, 1, "pos", "neg") +
      internalStrip(20, 1, 2, "pos") + internalStrip(20, 4, 1, "neg") +
      internalStrip(27, 2, 0, "pos") + internalStrip(27, 0, 4, "neg") +
      terminal(5, 0, "AC A", purple, "pos neg") + terminal(27, 0, "AC B", blue, "pos neg") +
      (bypass ? patchwire([hole(5, 2), hole(12, 2)], purple, "pos") +
        current([hole(12, 2), hole(5, 2)], "neg", "board-arrow") :
        boardDiode([5, 2], [12, 2], "D1", "pos")) +
      boardResistor([12, 1], [20, 1], [308, 105], "pos", bypass ? "neg" : "") +
      boardLed([20, 2], [27, 2], "red", "pos") + boardLed([27, 4], [20, 4], "green", "neg");
  } else if (mode === "center") {
    body = internalStrip(7, 0, 2, "pos") + internalStrip(23, 0, 1, "neg") +
      internalStrip(15, 2, 4, "pos") + internalStrip(15, 1, 4, "neg") +
      internalStrip(20, 4, 3, "pos neg") + internalStrip(20, 7, 8, "pos neg") +
      internalStrip(15, 8, 9, "pos neg") +
      terminal(7, 0, "AC A", purple, "pos") + terminal(23, 0, "AC B", blue, "neg") +
      terminal(15, 9, "CT", charcoal, "pos neg", false) +
      boardDiode([7, 2], [15, 2], "D1", "pos") + boardDiode([23, 1], [15, 1], "D2", "neg") +
      boardLed([15, 4], [20, 4], "red", "pos neg") +
      boardResistor([20, 3], [20, 7], [392, 198], "pos neg") +
      patchwire([hole(20, 8), hole(15, 8)], charcoal, "pos neg", true) +
      caption(150, 233, "中心抽頭是負載回路", 'font-size="13" font-weight="700" fill="#5a5375"');
  } else {
    body = internalStrip(7, 0, 2, "pos") + internalStrip(7, 4, 0, "neg") +
      internalStrip(23, 0, 1, "neg") + internalStrip(23, 4, 0, "pos") +
      internalStrip(7, 9, 5, "neg") + internalStrip(23, 8, 5, "pos") +
      internalStrip(15, 2, 4, "pos") + internalStrip(15, 1, 4, "neg") +
      internalStrip(19, 4, 3, "pos neg") + internalStrip(19, 7, 6, "pos neg") +
      internalStrip(15, 6, 8, "pos") + internalStrip(15, 6, 9, "neg") +
      terminal(7, 0, "AC A", purple, "pos neg") + terminal(23, 0, "AC B", blue, "pos neg") +
      patchwire([hole(7, 4), hole(7, 5)], purple, "neg", true, true) +
      patchwire([hole(23, 4), hole(23, 5)], blue, "pos", true, true) +
      boardDiode([7, 2], [15, 2], "D1", "pos") + boardDiode([23, 1], [15, 1], "D4", "neg") +
      boardDiode([15, 9], [7, 9], "D2", "neg") + boardDiode([15, 8], [23, 8], "D3", "pos") +
      boardLed([15, 4], [19, 4], "red", "pos neg") +
      boardResistor([19, 3], [19, 7], [392, 198], "pos neg") +
      patchwire([hole(19, 6), hole(15, 6)], charcoal, "pos neg", true) +
      caption(270, 182, "DC+", 'text-anchor="end" font-size="11" font-weight="800" fill="#9b3c4a"') +
      caption(272, 220, "DC−", 'text-anchor="end" font-size="11" font-weight="800" fill="#48415e"') +
      `<circle cx="${hole(15, 3)[0]}" cy="${hole(15, 3)[1]}" r="3.6" fill="${burgundy}"/>`;
  }
  const materials = `<defs>
    <linearGradient id="board-material" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#faf8f0"/><stop offset="1" stop-color="#eeece2"/></linearGradient>
    <linearGradient id="diode-material" x2="0" y2="1"><stop stop-color="#51515c"/><stop offset=".55" stop-color="#25252e"/><stop offset="1" stop-color="#3a3942"/></linearGradient>
    ${Object.entries(colors).map(([color, value]) => `<radialGradient id="glow-${color}"><stop stop-color="${value}" stop-opacity=".78"/><stop offset="1" stop-color="${value}" stop-opacity="0"/></radialGradient>`).join("")}
    </defs>`;
  $("board").innerHTML = svgStart(lessons[mode][0] + "麵包板") + arrowMarker("board-arrow", "#008f7a") + materials + breadboard() + body + "</svg>";
}

const plot = $("plot");
let plotWidth = 1040;
const plotHeight = 114;
const startX = 31;
const chartLeft = () => startX;
const chartRight = () => plotWidth - 17;
const timeX = (time) => chartLeft() + time * (chartRight() - chartLeft()) / 2;
const voltsY = (volts) => 46 - volts * 5.3;

function drawPlot() {
  plotWidth = Math.max(260, plot.clientWidth);
  const samples = Array.from({ length: 321 }, (_, i) => {
    const time = i / 160;
    return { x: timeX(time), ...simulate(time) };
  });
  const wave = (key) => line(samples.map((sample) => [sample.x.toFixed(2), voltsY(sample[key]).toFixed(2)]));
  let lit = "";
  let start = null;
  for (const sample of samples) {
    if (sample.board && start === null) start = sample.x;
    if (!sample.board && start !== null) {
      lit += `<rect x="${start}" y="84" width="${sample.x - start}" height="5" rx="2.5" fill="#d19c32"/>`;
      start = null;
    }
  }
  const grid = [-6, 0, 6].map((volts) => {
    const y = voltsY(volts);
    return `<path d="M${chartLeft()} ${y}H${chartRight()}" stroke="${volts ? "#e9e6f0" : "#bcb4cf"}"/>
      ${caption(2, y + 3, volts === 6 ? "+6 V" : volts === -6 ? "−6 V" : "0 V", 'fill="#625a74" font-size="9"')}`;
  }).join("") + [0, 0.5, 1, 1.5, 2].map((time) => {
    const x = timeX(time);
    let label = (time * 1000 / hz).toFixed(time === 0 ? 0 : 1);
    if (time === 2) label += " ms";
    return `<path d="M${x} 8v78" stroke="#eeebf3"/>` +
      caption(x, 106, label, `text-anchor="${time === 2 ? "end" : "middle"}" fill="#625a74" font-size="10"`);
  }).join("");
  plot.innerHTML = `<svg viewBox="0 0 ${plotWidth} ${plotHeight}" role="img" aria-label="60 Hz 輸入正弦波、電阻負載輸出與 LED 發光區間">
    <rect x="${chartLeft()}" y="8" width="${chartRight() - chartLeft()}" height="80" rx="5" fill="#faf9fd"/>
    ${grid}<path d="${wave("input")}" fill="none" stroke="#7255bf" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="${wave("output")}" fill="none" stroke="#087b70" stroke-width="2.3"/>${lit}
    <line id="cursor" y1="7" y2="91" stroke="#282044" stroke-width="1.2"/>
    <circle id="input-dot" r="4" fill="#7255bf" stroke="white" stroke-width="1.2"/>
    <circle id="output-dot" r="4" fill="#087b70" stroke="white" stroke-width="1.2"/>
    </svg>`;
}

function drawStatus(signal) {
  const currentPaths = mode === "bridge" ? { pos: "D1、D3", neg: "D2、D4" } :
    mode === "center" ? { pos: "D1", neg: "D2" } : { pos: "D1" };
  const halfLabel = signal.sign === "pos" ? "正半週" : signal.sign === "neg" ? "負半週" : "零交越";
  $("path-status").textContent = signal.circuit
    ? `${halfLabel} · ${mode === "half" && bypass ? "交流直接通過" : currentPaths[signal.circuit] + " 導通"}`
    : `${halfLabel} · 無負載電流`;
  $("pulse-rate").textContent = mode === "half" && bypass ? "未整流 · 60 Hz AC" :
    `輸出脈波 ${mode === "half" ? hz : 2 * hz} Hz`;

  const indicators = $("led-status").querySelectorAll("[data-indicator]");
  for (const indicator of indicators) {
    const color = indicator.dataset.indicator;
    const value = signal[color];
    indicator.querySelector("b").textContent = value > 0 ? `亮 ${(value * 1000).toFixed(1)} mA` : "熄滅";
  }
  for (const led of $("board").querySelectorAll("[data-led]")) {
    const brightness = Math.min(1, signal[led.dataset.led] / 0.019);
    led.querySelector(".led-halo").setAttribute("opacity", brightness.toFixed(3));
    led.querySelector(".led-light").setAttribute("opacity", brightness > 0 ? (0.15 + brightness * 0.85).toFixed(3) : 0);
  }
  for (const [id, state] of [["schematic", signal.circuit], ["board", signal.board]]) {
    const drawing = $(id);
    for (const path of drawing.querySelectorAll("[data-flow]")) {
      path.classList.toggle("on", path.dataset.flow.split(" ").includes(state));
    }
    for (const part of drawing.querySelectorAll("[data-part]")) {
      part.classList.toggle("on", !!state && currentPaths[state]?.includes(part.dataset.part));
    }
  }

  const x = timeX(phase);
  $("cursor").setAttribute("x1", x);
  $("cursor").setAttribute("x2", x);
  $("input-dot").setAttribute("cx", x);
  $("input-dot").setAttribute("cy", voltsY(signal.input));
  $("output-dot").setAttribute("cx", x);
  $("output-dot").setAttribute("cy", voltsY(signal.output));
  const ms = (phase * 1000 / hz).toFixed(2);
  $("time-readout").textContent = `${ms} ms`;
  $("timeline").setAttribute("aria-valuetext", `${ms} 毫秒，${halfLabel}`);
  $("timeline").value = Math.round(phase * 1000);
  for (const button of jumps) {
    const target = Number(button.dataset.phase);
    button.setAttribute("aria-pressed", String(Math.abs(phase - target) < 0.001 && !playing));
  }
}

function highlightPart(id) {
  selectedPart = id;
  for (const part of document.querySelectorAll("[data-part]")) {
    const active = !!id && part.dataset.part === id;
    part.classList.toggle("selected", active);
    part.setAttribute("aria-pressed", String(active));
  }
  for (const button of $("part-picker").querySelectorAll("[data-compare-part]")) {
    button.setAttribute("aria-pressed", String(button.dataset.comparePart === id));
  }
  revealSelectedPart($("schematic"));
  revealSelectedPart($("board"));
  $("part-hint").textContent = id ? `${id} · 灰色環為陰極 K` :
    mode === "half" && bypass ? "兩顆 LED 反向並聯" : "點選二極體對照位置";
}

function revealSelectedPart(art) {
  const part = art.querySelector(".part.selected .part-ring");
  if (!part || !art.classList.contains("is-zoomed") || art.clientWidth === 0) return;
  const bounds = art.getBoundingClientRect();
  const ring = part.getBoundingClientRect();
  if (ring.left < bounds.left || ring.right > bounds.right) {
    art.scrollLeft += ring.left + ring.width / 2 - bounds.left - bounds.width / 2;
  }
}

function redraw() {
  $("lesson-title").textContent = lessons[mode][0];
  $("lesson-copy").textContent = lessons[mode][1];
  $("half-controls").hidden = mode !== "half";
  $("quiz").hidden = mode !== "bridge";
  $("led-status").innerHTML = Object.entries(colors).filter(([color]) => color === "red" || mode === "half")
    .map(([color, value]) => `<span data-indicator="${color}"><i style="--led-color:${value}"></i>${color === "red" ? "紅" : "綠"} <b></b></span>`).join("");
  drawSchematic();
  drawBoard();
  drawPlot();
  const parts = [...$("schematic").querySelectorAll("[data-part]")];
  $("part-picker").innerHTML = parts.length ? '<span>對照元件</span>' + parts
    .map(({ dataset: { part } }) => `<button type="button" data-compare-part="${part}" aria-pressed="false" aria-label="對照二極體 ${part}">${part}</button>`).join("") : "";
  highlightPart("");
  drawStatus(simulate(phase));
}

function updatePlayButton() {
  $("play-symbol").textContent = playing ? "Ⅱ" : "▶";
  $("play-label").textContent = playing ? "暫停" : "慢速播放";
  $("play").setAttribute("aria-pressed", String(playing));
}

function stopPlayback() {
  playing = false;
  cancelAnimationFrame(frame);
  lastFrame = 0;
  updatePlayButton();
}

function goTo(time) {
  stopPlayback();
  phase = Math.max(0, Math.min(time, 2));
  drawStatus(simulate(phase));
}

function animate(now) {
  if (!playing) return;
  if (lastFrame) phase = (phase + Math.min(50, now - lastFrame) / (1000 * Number($("speed").value))) % 2;
  lastFrame = now;
  drawStatus(simulate(phase));
  frame = requestAnimationFrame(animate);
}

function selectMode(tab, focus = false) {
  if (focus) tab.focus();
  if (mode === tab.dataset.mode) return;
  stopPlayback();
  mode = tab.dataset.mode;
  for (const candidate of tabs) {
    const active = candidate === tab;
    candidate.setAttribute("aria-selected", String(active));
    candidate.tabIndex = active ? 0 : -1;
  }
  $("experiment").setAttribute("aria-labelledby", tab.id);
  redraw();
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectMode(tab));
  tab.addEventListener("keydown", (event) => {
    const target = { ArrowLeft: (i + 2) % 3, ArrowRight: (i + 1) % 3, Home: 0, End: 2 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectMode(tabs[target], true);
  });
});

for (const button of viewChoices) {
  button.addEventListener("click", () => {
    $("visual-grid").dataset.view = button.dataset.viewChoice;
    for (const choice of viewChoices) choice.setAttribute("aria-pressed", String(choice === button));
    revealSelectedPart($(button.dataset.viewChoice));
  });
}

$("part-picker").addEventListener("click", (event) => {
  const part = event.target.closest("[data-compare-part]")?.dataset.comparePart;
  if (part) highlightPart(selectedPart === part ? "" : part);
});

for (const button of document.querySelectorAll(".diagram-head .zoom")) {
  button.addEventListener("click", () => {
    const art = $(button.getAttribute("aria-controls"));
    const zoomed = art.classList.toggle("is-zoomed");
    const action = zoomed ? "縮小" : "放大";
    button.setAttribute("aria-pressed", String(zoomed));
    button.setAttribute("aria-label", action + (art.id === "board" ? "麵包板" : "電路圖"));
    button.textContent = action;
    if (zoomed) revealSelectedPart(art);
    else art.scrollLeft = 0;
  });
}

const controlDeck = $("control-deck");
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--dock-height", `${controlDeck.offsetHeight}px`);
}).observe(controlDeck);

$("half-controls").addEventListener("change", (event) => {
  stopPlayback();
  bypass = event.target.value === "bypass";
  redraw();
});
$("timeline").addEventListener("input", (event) => goTo(Number(event.target.value) / 1000));
jumps.forEach((button) => button.addEventListener("click", () => goTo(Number(button.dataset.phase))));
$("play").addEventListener("click", () => {
  if (playing) {
    goTo(phase);
    return;
  }
  playing = true;
  updatePlayButton();
  frame = requestAnimationFrame(animate);
});

let dragId = null;
function selectPlotPosition(event) {
  const bounds = plot.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * plotWidth / bounds.width;
  goTo((x - chartLeft()) * 2 / (chartRight() - chartLeft()));
}
plot.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || dragId !== null) return;
  dragId = event.pointerId;
  plot.setPointerCapture(dragId);
  selectPlotPosition(event);
});
plot.addEventListener("pointermove", (event) => {
  if (event.pointerId === dragId) selectPlotPosition(event);
});
plot.addEventListener("lostpointercapture", (event) => {
  if (event.pointerId === dragId) dragId = null;
});
new ResizeObserver(() => {
  if (plot.clientWidth === plotWidth) return;
  drawPlot();
  drawStatus(simulate(phase));
}).observe(plot);

for (const id of ["schematic", "board"]) {
  $(id).addEventListener("click", (event) => {
    const part = event.target.closest("[data-part]");
    if (part) highlightPart(selectedPart === part.dataset.part ? "" : part.dataset.part);
  });
  $(id).addEventListener("keydown", (event) => {
    const part = event.target.closest("[data-part]");
    if (part && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      part.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
}

$("quiz-form").addEventListener("change", () => {
  $("quiz-feedback").textContent = "";
  $("show-quiz-path").hidden = true;
});
$("quiz-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const prediction = form.getAll("diode").sort();
  if (prediction.length !== 2) {
    $("quiz-feedback").textContent = "請先選擇兩顆二極體。";
    return;
  }
  const target = Number(form.get("quiz-phase"));
  const positive = target === 0.25;
  const answer = positive ? ["D1", "D3"] : ["D2", "D4"];
  const correct = prediction.every((id, i) => id === answer[i]);
  highlightPart("");
  goTo(target);
  $("quiz-feedback").textContent = `${correct ? "答對了。" : "再追蹤一次路徑。"}${positive ? "正" : "負"}半週由 ${answer.join("、")} 導通，負載電流由 DC+ 流向 DC−。`;
  $("show-quiz-path").hidden = false;
});
$("show-quiz-path").addEventListener("click", () => {
  goTo(Number($("quiz-form").elements.namedItem("quiz-phase").value));
  const diagrams = $("view-picker").getClientRects().length ? $("view-picker") : $("visual-grid");
  diagrams.focus({ preventScroll: true });
  diagrams.scrollIntoView({ block: "start" });
});

updatePlayButton();
redraw();
