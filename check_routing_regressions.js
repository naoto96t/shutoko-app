/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const graph = require("./public/graph.json");
const plans = require("./public/plans.json");

function readCsv(file) {
  return fs.readFileSync(path.join(root, "public", file), "utf8");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  if (header.length > 0) header[0] = header[0].replace(/^\uFEFF/, "");
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

function parseEdgeSetFromCsv(csvText) {
  const set = new Set();
  const rows = parseCsv(csvText);
  for (const row of rows) {
    const from = (row.from || "").trim();
    const to = (row.to || "").trim();
    if (from && to) set.add(`${from}=>${to}`);
  }
  return set;
}

function parseForbiddenEdgeSetFromCsv(csvText) {
  const set = new Set();
  const rows = parseCsv(csvText);
  for (const row of rows) {
    const { from, to } = normalizeForbiddenEdge(row);
    if (from && to) set.add(`${from}=>${to}`);
  }
  return set;
}

function parseRouteSequencePos(csvText) {
  const pos = new Map();
  const jcts = new Map();
  const rows = parseCsv(csvText);
  for (const row of rows) {
    const route = (row.route || "").trim();
    const dir = (row.dir || "").trim();
    const stopsRaw = (row.stops || "").trim();
    if (!route || !dir || !stopsRaw || route.startsWith("#")) continue;

    const tail = route === "BAY" ? `BAY_${dir}` : `${route}_${dir}`;
    const stops = stopsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!jcts.has(tail)) jcts.set(tail, new Set());
    stops.forEach((s, idx) => {
      if (s.startsWith("IC:")) {
        pos.set(`IC:${s.slice(3).trim()}:${tail}`, idx);
      } else {
        pos.set(`${s}:${tail}`, idx);
        jcts.get(tail).add(s);
      }
    });
  }
  return { pos, jcts };
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

function routeTailOfNode(node) {
  if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
    const parts = node.split(":");
    return parts[parts.length - 1] || "";
  }
  return tailOfPort(node);
}

function parseIcExitAllow(csvText) {
  const m = new Map();
  const rows = parseCsv(csvText);
  for (const row of rows) {
    const name = (row["IC名"] || row[Object.keys(row)[0]] || "").trim();
    const outTag = (row["出口タグ"] || row[Object.keys(row)[2]] || "").trim();
    if (!name) continue;
    if (!m.has(name)) m.set(name, new Set());
    const allow = m.get(name);
    if (outTag.includes("上り")) allow.add("UP");
    if (outTag.includes("下り")) allow.add("DOWN");
    if (outTag.includes("内回り")) allow.add("CCW");
    if (outTag.includes("外回り")) allow.add("CW");
    if (outTag.includes("東行き")) allow.add("E");
    if (outTag.includes("西行き")) allow.add("W");
  }
  return m;
}

function tailAllowedByExitTag(tail, allow) {
  if (!allow || allow.size === 0) return true;
  const m = tail.match(/_(UP|DOWN|CW|CCW|E|W)$/);
  return !!m && allow.has(m[1]);
}

function resolveStartPorts(entryName, startNodes) {
  const out = [];
  for (const n of startNodes) {
    for (const k of [`ICIN:${entryName}:${n}`, `IC:${entryName}:${n}`, `${entryName}:${n}`]) {
      if (graph[k]) {
        out.push(k);
        break;
      }
    }
  }
  return [...new Set(out)];
}

function resolveIcoutTargets(exitName, targetNodes, exitAllow) {
  let icoutTargets = [...new Set((targetNodes || []).map((t) => `ICOUT:${exitName}:${t}`))].filter((k) => !!graph[k]);
  if (icoutTargets.length === 0) icoutTargets = Object.keys(graph).filter((k) => k.startsWith(`ICOUT:${exitName}:`));
  const allow = exitAllow.get(exitName);
  if (allow && icoutTargets.length > 0) {
    const filtered = icoutTargets.filter((k) => tailAllowedByExitTag(k.split(":").at(-1), allow));
    if (filtered.length > 0) {
      icoutTargets = filtered;
    } else {
      const fallbackAll = Object.keys(graph).filter(
        (k) => k.startsWith(`ICOUT:${exitName}:`) && tailAllowedByExitTag(k.split(":").at(-1), allow)
      );
      if (fallbackAll.length > 0) icoutTargets = fallbackAll;
    }
  }
  return icoutTargets;
}

function isTurnScopedNode(node) {
  if (!node.includes(":")) return false;
  if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) return false;
  return true;
}

function isIntraJunctionTurn(from, to) {
  if (!isTurnScopedNode(from) || !isTurnScopedNode(to)) return false;
  const j1 = jctOf(from);
  const j2 = jctOf(to);
  return !!j1 && j1 === j2;
}

function bfsPathAvoid(graphObj, starts, targets, avoid, turnRules, seqInfo, maxSteps = 60000) {
  const q = [];
  const prevState = new Map();
  const stateKey = (prevNode, node) => `${prevNode || ""}=>${node}`;
  const stateNode = (key) => key.slice(key.indexOf("=>") + 2);

  for (const s of starts) {
    if (!graphObj[s]) continue;
    if (avoid(s) && !targets.has(s)) continue;
    q.push({ node: s, prevNode: null });
    prevState.set(stateKey(null, s), null);
  }
  for (const s of starts) {
    if (targets.has(s)) return [s];
  }

  let head = 0;
  let steps = 0;
  while (head < q.length && steps < maxSteps) {
    const { node: v, prevNode: pv } = q[head++];
    steps++;
    for (const nxt of graphObj[v] || []) {
      const fromTail = routeTailOfNode(v);
      const toTail = routeTailOfNode(nxt);

      if (seqInfo) {
        const fromPos = seqInfo.pos.get(v);
        const toPos = seqInfo.pos.get(nxt);
        if (fromTail && toTail && fromTail === toTail && fromPos != null && toPos != null && toPos < fromPos) continue;
        if (isIntraJunctionTurn(v, nxt)) {
          const j = jctOf(v);
          const fromHas = seqInfo.jcts.get(fromTail)?.has(j);
          const toHas = seqInfo.jcts.get(toTail)?.has(j);
          if (fromHas === false || toHas === false) continue;
        }
      }

      if (turnRules && isIntraJunctionTurn(v, nxt) && !turnRules.has(`${v}=>${nxt}`)) continue;
      if ((fromTail === "BAY_E" || fromTail === "BAY_W") && /_(DOWN)$/.test(toTail)) continue;
      if ((fromTail === "BAY_E" && toTail === "BAY_W") || (fromTail === "BAY_W" && toTail === "BAY_E")) continue;
      if (v === "DaikokuJCT:BAY_E" && nxt === "DaikokuPA") continue;
      if (
        (v === "KasaiJCT:BAY_E" && nxt === "KasaiJCT:C2_CW") ||
        (v === "KasaiJCT:BAY_W" && nxt === "KasaiJCT:C2_CCW") ||
        (v === "KasaiJCT:C2_CW" && nxt === "KasaiJCT:BAY_E") ||
        (v === "KasaiJCT:C2_CCW" && nxt === "KasaiJCT:BAY_W")
      ) continue;
      if (/^R[3-7]A_UP$/.test(fromTail) && toTail.startsWith("C2_")) continue;
      if (fromTail.startsWith("C2_") && /^R[3-7]B_UP$/.test(toTail)) continue;
      if (/^R[3-7]B_DOWN$/.test(fromTail) && toTail.startsWith("C2_")) continue;

      const radialTail = /^(R\d+(?:A|B)?|R1H|R1U|K\d|S\d)_(UP|DOWN)$/;
      const fromRad = radialTail.exec(fromTail);
      const toRad = radialTail.exec(toTail);
      if (fromRad && fromRad[2] === "DOWN" && toTail.startsWith("C1_")) continue;
      if (fromTail.startsWith("C1_") && toRad && toRad[2] === "UP") continue;

      if (
        (fromTail.startsWith("R7A_") || fromTail.startsWith("R7B_") || fromTail.startsWith("C2_")) &&
        (toTail.startsWith("R7A_") || toTail.startsWith("R7B_") || toTail.startsWith("C2_"))
      ) {
        const sameLine =
          (fromTail.startsWith("R7") && toTail.startsWith("R7")) ||
          (fromTail.startsWith("C2") && toTail.startsWith("C2"));
        const ok7c2 =
          (fromTail === "R7B_UP" && toTail === "C2_CCW") ||
          (fromTail === "C2_CW" && toTail === "R7B_DOWN");
        if (!sameLine && !ok7c2) continue;
      }

      if (
        (fromTail.startsWith("R4A_") && toTail.startsWith("C2_")) ||
        (toTail.startsWith("R4A_") && fromTail.startsWith("C2_"))
      ) continue;
      if (fromTail.startsWith("C2_") && toTail === "R4B_UP") continue;
      if (fromTail === "R4B_DOWN" && toTail.startsWith("C2_")) continue;

      if (pv) {
        const pj = jctOf(pv);
        const vj = jctOf(v);
        const nj = jctOf(nxt);
        const pt = tailOfPort(pv);
        const vt = tailOfPort(v);
        const nt = tailOfPort(nxt);
        if (pj && pj === vj && vj === nj && isRing(pt) && isRadial(vt) && isRing(nt)) continue;
        if (pj && pj === vj && vj === nj && isRing(pt) && isRing(vt) && isRing(nt) && pt !== vt && nt === pt) continue;
        if (
          pj &&
          pj === vj &&
          vj === nj &&
          isRadial(pt) &&
          isRing(vt) &&
          isRadial(nt) &&
          routeBaseOfTail(pt) === routeBaseOfTail(nt) &&
          areOppositeDirections(directionOfTail(pt), directionOfTail(nt))
        ) continue;
      }

      if (avoid(nxt) && !targets.has(nxt)) continue;
      const nextStateKey = stateKey(v, nxt);
      if (prevState.has(nextStateKey)) continue;
      prevState.set(nextStateKey, stateKey(pv, v));

      if (targets.has(nxt)) {
        const path = [];
        let curState = nextStateKey;
        while (curState !== null) {
          path.push(stateNode(curState));
          curState = prevState.get(curState) ?? null;
        }
        path.reverse();
        return path;
      }
      q.push({ node: nxt, prevNode: v });
    }
  }
  return null;
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

  const turnRules = new Set();
  for (const k of parseEdgeSetFromCsv(readCsv("allowed_turns_port.csv"))) turnRules.add(k);
  for (const k of parseEdgeSetFromCsv(readCsv("connections_port.csv"))) turnRules.add(k);
  for (const k of parseEdgeSetFromCsv(readCsv("special_switches_port.csv"))) turnRules.add(k);
  for (const k of parseForbiddenEdgeSetFromCsv(readCsv("forbidden_turns.csv"))) turnRules.delete(k);
  const seqInfo = parseRouteSequencePos(readCsv("route_sequence_v2.csv"));
  const exitAllow = parseIcExitAllow(readCsv("ic_tags.csv"));
  const avoidLoopDeadEnds = (node) => tailOfPort(node).startsWith("R10_");

  const gotandaToShibaura = bfsPathAvoid(
    graph,
    ["ICIN:五反田:C2_CW"],
    new Set(["ShibauraPA"]),
    avoidLoopDeadEnds,
    turnRules,
    seqInfo
  );
  assert(!!gotandaToShibaura, "Reachability regression: ICIN:五反田:C2_CW should reach ShibauraPA", failures);

  assert(!(graph["ShibauraJCT:R11_DOWN"] || []).includes("ShibauraJCT:R1H_UP"), "Forbidden regression: ShibauraJCT:R11_DOWN -> ShibauraJCT:R1H_UP", failures);
  assert(!(graph["HamasakibashiJCT:R11_UP"] || []).includes("HamasakibashiJCT:C1_CW"), "Forbidden regression: HamasakibashiJCT:R11_UP -> HamasakibashiJCT:C1_CW", failures);
  assert(!(graph["HamasakibashiJCT:R11_UP"] || []).includes("HamasakibashiJCT:C1_CCW"), "Forbidden regression: HamasakibashiJCT:R11_UP -> HamasakibashiJCT:C1_CCW", failures);
  assert((graph["ShibauraJCT:R11_UP"] || []).includes("ShibauraJCT:R1H_UP"), "Reachability regression: ShibauraJCT:R11_UP should connect to ShibauraJCT:R1H_UP", failures);
  assert((graph["ShibauraJCT:R1H_UP"] || []).includes("HamasakibashiJCT:R1H_UP"), "Reachability regression: ShibauraJCT:R1H_UP should continue to HamasakibashiJCT:R1H_UP", failures);
  assert((graph["HamasakibashiJCT:R1H_UP"] || []).some((n) => n === "HamasakibashiJCT:C1_CW" || n === "HamasakibashiJCT:C1_CCW"), "Reachability regression: HamasakibashiJCT:R1H_UP should connect to C1", failures);
  assert(!(graph["HakozakiRotary"] || []).includes("EdobashiJCT:C1_CW"), "Forbidden regression: HakozakiRotary should not connect directly to EdobashiJCT:C1_CW", failures);
  assert(!(graph["HakozakiRotary"] || []).includes("EdobashiJCT:C1_CCW"), "Forbidden regression: HakozakiRotary should not connect directly to EdobashiJCT:C1_CCW", failures);
  assert((graph["HakozakiJCT:R9_UP"] || []).includes("HakozakiRotary"), "Reachability regression: HakozakiJCT:R9_UP should enter HakozakiRotary", failures);
  assert((graph["HakozakiRotary"] || []).includes("HakozakiJCT:R9_DOWN"), "Reachability regression: HakozakiRotary should exit to HakozakiJCT:R9_DOWN", failures);
  assert((graph["HakozakiRotary"] || []).includes("IC:箱崎:R6A_DOWN"), "Reachability regression: HakozakiRotary should exit to IC:箱崎:R6A_DOWN", failures);
  assert((graph["HakozakiRotary"] || []).includes("IC:箱崎:R6A_UP"), "Reachability regression: HakozakiRotary should exit to IC:箱崎:R6A_UP", failures);

  assert((graph["KouhokuJCT:S1_UP"] || []).includes("KouhokuJCT:C2_CW"), "Loop regression: KouhokuJCT:S1_UP should connect to C2_CW", failures);
  assert((graph["KouhokuJCT:C2_CW"] || []).includes("KouhokuJCT:S1_DOWN"), "Loop regression: KouhokuJCT:C2_CW should connect to S1_DOWN", failures);
  assert((graph["ShowajimaJCT:K1_UP"] || []).includes("ShowajimaJCT:R1H_UP"), "Loop regression: ShowajimaJCT:K1_UP should connect to R1H_UP", failures);
  assert((graph["ShowajimaJCT:R1H_UP"] || []).includes("ShowajimaJCT:K1_UP"), "Loop regression: ShowajimaJCT:R1H_UP should connect to K1_UP", failures);
  assert((graph["ShowajimaJCT:K1_DOWN"] || []).includes("ShowajimaJCT:R1H_DOWN"), "Loop regression: ShowajimaJCT:K1_DOWN should connect to R1H_DOWN", failures);
  assert((graph["ShowajimaJCT:R1H_DOWN"] || []).includes("ShowajimaJCT:K1_DOWN"), "Loop regression: ShowajimaJCT:R1H_DOWN should connect to K1_DOWN", failures);
  assert((graph["KawasakiUkishimaJCT:BAY_E"] || []).includes("KawasakiUkishimaJCT:K6_UP"), "Loop regression: KawasakiUkishimaJCT:BAY_E should connect to K6_UP", failures);
  assert((graph["KawasakiUkishimaJCT:K6_DOWN"] || []).includes("KawasakiUkishimaJCT:BAY_W"), "Loop regression: KawasakiUkishimaJCT:K6_DOWN should connect to BAY_W", failures);

  const loopCases = [
    ["大師", "浜川崎", "DaikokuPA"],
    ["浅田", "汐入", "DaikokuPA"],
    ["新郷", "安行", "DaikokuPA"],
  ];
  for (const [entryName, exitName, spotNode] of loopCases) {
    const entry = plans.entries[entryName];
    const row = (entry?.exits || []).find((r) => r.exit === exitName);
    const starts = resolveStartPorts(entryName, entry?.start_nodes || []);
    const exits = resolveIcoutTargets(exitName, row?.target_nodes || [], exitAllow);
    const toSpot = bfsPathAvoid(graph, starts, new Set([spotNode]), avoidLoopDeadEnds, turnRules, seqInfo);
    assert(!!toSpot, `Loop regression: ${entryName} should reach ${spotNode}`, failures);
    if (toSpot) {
      const backToExit = bfsPathAvoid(graph, [toSpot[toSpot.length - 1]], new Set(exits), avoidLoopDeadEnds, turnRules, seqInfo);
      assert(!!backToExit, `Loop regression: ${spotNode} should reach exit ${exitName}`, failures);
    }
  }

  if (failures.length > 0) {
    console.error("Routing regression check failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log(`Routing regression check passed (${forbidRows.length} forbidden edges checked).`);
}

main();
