/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const graph = require("./public/graph.json");

function readCsv(file) {
  return fs.readFileSync(path.join(root, "public", file), "utf8");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = cols[i] || "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQ && line[i + 1] === "\"") {
        cur += "\"";
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function normalizeForbiddenEdge(row) {
  const j = (row.junction || row[Object.keys(row)[0]] || "").trim();
  let from = (row.from || row[Object.keys(row)[1]] || "").trim();
  let to = (row.to || row[Object.keys(row)[2]] || "").trim();
  if (from && !from.includes(":") && j) from = `${j}:${from}`;
  if (to && !to.includes(":") && j) to = `${j}:${to}`;
  return { from, to };
}

function assert(cond, msg, failures) {
  if (!cond) failures.push(msg);
}

function tailOfPort(p) {
  const idx = p.indexOf(":");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function routeBaseOfTail(tail) {
  return tail.replace(/_(UP|DOWN|CW|CCW|E|W)$/, "");
}

function directionOfTail(tail) {
  const m = tail.match(/_(UP|DOWN|CW|CCW|E|W)$/);
  return m ? m[1] : null;
}

function areOppositeDirections(a, b) {
  return (
    (a === "UP" && b === "DOWN") ||
    (a === "DOWN" && b === "UP") ||
    (a === "CW" && b === "CCW") ||
    (a === "CCW" && b === "CW") ||
    (a === "E" && b === "W") ||
    (a === "W" && b === "E")
  );
}

function isRing(t) {
  return t.startsWith("C1_") || t.startsWith("C2_") || t.startsWith("BAY_");
}

function isRadial(t) {
  return /^(R\d+(?:A|B)?|R1H|R1U|K\d|S\d)_/.test(t);
}

function jctOf(node) {
  const idx = node.indexOf(":");
  return idx >= 0 ? node.slice(0, idx) : "";
}

function runtimeBlocksTwoStep(a, b, c) {
  const aj = jctOf(a);
  const bj = jctOf(b);
  const cj = jctOf(c);
  const at = tailOfPort(a);
  const bt = tailOfPort(b);
  const ct = tailOfPort(c);

  if (aj && aj === bj && bj === cj && isRing(at) && isRadial(bt) && isRing(ct)) {
    return true;
  }
  if (aj && aj === bj && bj === cj && isRing(at) && isRing(bt) && isRing(ct) && at !== bt && ct === at) {
    return true;
  }
  if (
    aj &&
    aj === bj &&
    bj === cj &&
    isRadial(at) &&
    isRing(bt) &&
    isRadial(ct) &&
    routeBaseOfTail(at) === routeBaseOfTail(ct) &&
    areOppositeDirections(directionOfTail(at), directionOfTail(ct))
  ) {
    return true;
  }
  return false;
}

function main() {
  const failures = [];

  const forbidRows = parseCsv(readCsv("forbidden_turns.csv"));
  for (const row of forbidRows) {
    const { from, to } = normalizeForbiddenEdge(row);
    if (!from || !to) continue;
    assert(!(graph[from] || []).includes(to), `Forbidden edge still present: ${from} -> ${to}`, failures);
  }

  const twoStepBans = [
    ["AriakeJCT:R11_DOWN", "AriakeJCT:BAY_E", "AriakeJCT:R11_UP"],
    ["AriakeJCT:R11_DOWN", "AriakeJCT:BAY_W", "AriakeJCT:R11_UP"],
  ];
  for (const [a, b, c] of twoStepBans) {
    const hasA = (graph[a] || []).includes(b);
    const hasB = (graph[b] || []).includes(c);
    assert(!(hasA && hasB && !runtimeBlocksTwoStep(a, b, c)), `Two-step reversal still possible: ${a} -> ${b} -> ${c}`, failures);
  }

  if (failures.length > 0) {
    console.error("Routing regression check failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log(`Routing regression check passed (${forbidRows.length} forbidden edges checked).`);
}

main();
