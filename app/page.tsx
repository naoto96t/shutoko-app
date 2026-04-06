"use client";

import { useEffect, useMemo, useState } from "react";
import ShutokoMap from "./components/ShutokoMap";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ExitRow = {
  exit: string;
  toll: number;
  dist?: string;
  target_nodes?: string[];
  path_nodes?: string[];
  path_ports?: string[];
};

type EntryBlock = { start_nodes: string[]; exits: ExitRow[] };
type PlansJson = { meta: { note?: string }; entries: Record<string, EntryBlock> };
type GraphJson = Record<string, string[]>;
type TurnRuleSet = Set<string>;
type SeqPosMap = Map<string, number>;
type SeqJctMap = Map<string, Set<string>>;
type ExitAllowMap = Map<string, Set<string>>;
type IcMasterRow = { is_full?: boolean; entry_dir?: string[]; exit_dir?: string[] };
const EMPTY_ENTRIES: Record<string, EntryBlock> = {};

const LABEL: Record<string, string> = {
  C1_CW: "C1外回り",
  C1_CCW: "C1内回り",
  C2_CW: "C2外回り",
  C2_CCW: "C2内回り",
  BAY_E: "湾岸線 東行き",
  BAY_W: "湾岸線 西行き",
  BAYX_E: "湾岸分岐線 東行き",
  BAYX_W: "湾岸分岐線 西行き",
};

function prettyNode(n: string) {
  if (LABEL[n]) return LABEL[n];
  if (n.startsWith("R1H_")) return `1号羽田線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("R1U_")) return `1号上野線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("K1_")) return `K1横羽線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("K2_")) return `K2三ツ沢線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("K3_")) return `K3狩場線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("K5_")) return `K5大黒線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("K6_")) return `K6川崎線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("S1_")) return `S1川口線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("S2_")) return `S2埼玉新都心線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("S5_")) return `S5埼玉大宮線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("R6_MISATO_")) return `6号三郷線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("R6_")) return `6号向島線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("R6A_")) return `6号向島線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  if (n.startsWith("R6B_")) return `6号三郷線 ${n.endsWith("_UP") ? "上り" : "下り"}`;
  const m = n.match(/^(R(\d+)(?:[AB])?|S1)_(UP|DOWN)$/);
  if (m) {
    const dir = m[3] === "UP" ? "上り" : "下り";
    if (m[2]) return `${m[2]}号 ${dir}`;
    return `${m[1]} ${dir}`;
  }
  return n;
}

function tailOfPort(p: string) {
  const idx = p.indexOf(":");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function routeTailOfNode(node: string) {
  if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
    const parts = node.split(":");
    return parts[parts.length - 1] || "";
  }
  return tailOfPort(node);
}

function isFacility(n: string) {
  return n === "HakozakiRotary" || n === "DaikokuPA" || n === "TatsumiPA1" || n === "TatsumiPA2" || n === "ShibauraPA";
}

function prettyFacility(n: string) {
  switch (n) {
    case "HakozakiRotary":
      return "箱崎PA";
    case "DaikokuPA":
      return "大黒PA";
    case "TatsumiPA1":
      return "辰巳PA(第1)";
    case "TatsumiPA2":
      return "辰巳PA(第2)";
    case "ShibauraPA":
      return "芝浦PA";
    default:
      return n;
  }
}

function prettyDetourPath(path: string[]) {
  const out: string[] = [];
  let prev = "";
  for (let i = 0; i < path.length; i++) {
    const raw = path[i];
    if (/AfterPA/i.test(raw)) continue;
    // 中間ICは表示しない
    if (raw.startsWith("ICIN:")) continue;
    if (raw.startsWith("IC:")) continue;

    // 出口に着いたらそこで終わる
    if (raw.startsWith("ICOUT:")) {
      const ic = raw.split(":")[1] || "";
      const label = `出口:${ic}`;
      if (label !== prev) out.push(label);
      break;
    }

    let label = "";
    if (isFacility(raw)) {
      // 箱崎PAはC1直結ではなく6号下り経由に見せる
      const prevRaw = i > 0 ? path[i - 1] : "";
      const nextRaw = i + 1 < path.length ? path[i + 1] : "";
      const prevTail = tailOfPort(prevRaw);
      const nextTail = tailOfPort(nextRaw);
      if (raw === "HakozakiRotary" && prevTail.startsWith("C1_") && nextTail.startsWith("C1_")) {
        const via = "6号 下り";
        if (via !== prev) out.push(via);
        prev = via;
      }
      label = prettyFacility(raw);
    } else {
      label = prettyNode(tailOfPort(raw));
    }

    if (label === prev) continue;
    out.push(label);
    prev = label;
  }
  return out;
}

function publicAsset(path: string) {
  return `${BASE_PATH}${path}`;
}

function routeFamilyOfTail(tail: string) {
  if (!tail) return null;
  if (tail.startsWith("C1_")) return "C1";
  if (tail.startsWith("C2_")) return "C2";
  if (tail.startsWith("BAYX_")) return "BAYX";
  if (tail.startsWith("BAY_")) return "BAY";
  if (tail.startsWith("R1H_")) return "R1H";
  if (tail.startsWith("R1U_")) return "R1U";
  if (tail.startsWith("R2")) return "R2";
  if (tail.startsWith("R3A_")) return "R3A";
  if (tail.startsWith("R3B_")) return "R3B";
  if (tail.startsWith("R4A_")) return "R4A";
  if (tail.startsWith("R4B_")) return "R4B";
  if (tail.startsWith("R5A_")) return "R5A";
  if (tail.startsWith("R5B_")) return "R5B";
  if (tail.startsWith("R6A_")) return "R6A";
  if (tail.startsWith("R6B_") || tail.startsWith("R6_MISATO_")) return "R6B";
  if (tail.startsWith("R7A_")) return "R7A";
  if (tail.startsWith("R7B_")) return "R7B";
  if (tail.startsWith("R9_")) return "R9";
  if (tail.startsWith("R10_")) return "R10";
  if (tail.startsWith("R11_")) return "R11";
  if (tail.startsWith("K1_")) return "K1";
  if (tail.startsWith("K2_")) return "K2";
  if (tail.startsWith("K3_")) return "K3";
  if (tail.startsWith("K5_")) return "K5";
  if (tail.startsWith("K6_")) return "K6";
  if (tail.startsWith("S1_")) return "S1";
  if (tail.startsWith("S2_")) return "S2";
  if (tail.startsWith("S5_")) return "S5";
  return null;
}

function highlightedRouteFamilies(path: string[]) {
  const out: string[] = [];
  for (const raw of path) {
    const family = routeFamilyOfTail(routeTailOfNode(raw));
    if (family && !out.includes(family)) out.push(family);
  }
  return out;
}

function isCoreRingTail(tail: string) {
  return tail.startsWith("C1_") || tail.startsWith("C2_") || tail.startsWith("BAY_");
}

type Spot = { key: string; label: string; node: string };
const SPOTS: Spot[] = [
  { key: "hakozaki", label: "箱崎PA", node: "HakozakiRotary" },
  { key: "daikoku", label: "大黒PA", node: "DaikokuPA" },
  { key: "tatsumi1", label: "辰巳PA(第1)", node: "TatsumiPA1" },
  { key: "tatsumi2", label: "辰巳PA(第2)", node: "TatsumiPA2" },
  { key: "shibaura", label: "芝浦PA", node: "ShibauraPA" },
];

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function edgeKey(from: string, to: string) {
  return `${from}=>${to}`;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQ && i + 1 < line.length && line[i + 1] === "\"") {
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

function parseEdgeSetFromCsv(csvText: string): TurnRuleSet {
  const set: TurnRuleSet = new Set();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return set;
  const header = parseCsvLine(lines[0]).map((x) => x.replace(/^\uFEFF/, "").trim());
  const iFrom = header.indexOf("from");
  const iTo = header.indexOf("to");
  if (iFrom < 0 || iTo < 0) return set;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const from = (cols[iFrom] || "").trim();
    const to = (cols[iTo] || "").trim();
    if (!from || !to) continue;
    set.add(edgeKey(from, to));
  }
  return set;
}


function parseForbiddenEdgeSetFromCsv(csvText: string): TurnRuleSet {
  const set: TurnRuleSet = new Set();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return set;
  const header = parseCsvLine(lines[0]).map((x) => x.replace(/^\uFEFF/, "").trim());
  const iJunction = header.indexOf("junction");
  const iFrom = header.indexOf("from");
  const iTo = header.indexOf("to");
  if (iFrom < 0 || iTo < 0) return set;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const junction = (iJunction >= 0 ? cols[iJunction] : "").trim();
    let from = (cols[iFrom] || "").trim();
    let to = (cols[iTo] || "").trim();
    if (!from || !to) continue;
    if (!from.includes(":") && junction) from = `${junction}:${from}`;
    if (!to.includes(":") && junction) to = `${junction}:${to}`;
    set.add(edgeKey(from, to));
  }
  return set;
}

function parseRouteSequencePos(csvText: string): { pos: SeqPosMap; jcts: SeqJctMap } {
  const pos: SeqPosMap = new Map();
  const jcts: SeqJctMap = new Map();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { pos, jcts };

  const header = parseCsvLine(lines[0]).map((x) => x.replace(/^\uFEFF/, "").trim());
  const iRoute = header.indexOf("route");
  const iDir = header.indexOf("dir");
  const iStops = header.indexOf("stops");
  if (iRoute < 0 || iDir < 0 || iStops < 0) return { pos, jcts };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const route = (cols[iRoute] || "").trim();
    const dir = (cols[iDir] || "").trim();
    const stopsRaw = (cols[iStops] || "").trim();
    if (!route || !dir || !stopsRaw || route.startsWith("#")) continue;

    const tail = route === "BAY" ? `BAY_${dir}` : `${route}_${dir}`;
    const stops = stopsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (stops.length === 0) continue;

    if (!jcts.has(tail)) jcts.set(tail, new Set<string>());
    for (let idx = 0; idx < stops.length; idx++) {
      const s = stops[idx];
      if (s.startsWith("IC:")) {
        const ic = s.slice(3).trim();
        pos.set(`IC:${ic}:${tail}`, idx);
      } else {
        pos.set(`${s}:${tail}`, idx);
        jcts.get(tail)!.add(s);
      }
    }
  }
  return { pos, jcts };
}

function parseIcExitAllow(csvText: string): ExitAllowMap {
  const m: ExitAllowMap = new Map();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return m;
  const header = parseCsvLine(lines[0]).map((x) => x.replace(/^\uFEFF/, "").trim());
  const iIc = header.indexOf("IC名");
  const iOut = header.indexOf("出口タグ");
  if (iIc < 0 || iOut < 0) return m;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const ic = (cols[iIc] || "").trim();
    const outTag = (cols[iOut] || "").trim();
    if (!ic || !outTag || outTag === "-") continue;

    const allow = new Set<string>();
    if (outTag.includes("上り")) allow.add("UP");
    if (outTag.includes("下り")) allow.add("DOWN");
    if (outTag.includes("内回り")) allow.add("CCW");
    if (outTag.includes("外回り")) allow.add("CW");
    if (outTag.includes("東行き")) allow.add("BAY_E");
    if (outTag.includes("西行き")) allow.add("BAY_W");
    if (allow.size > 0) m.set(ic, allow);
  }
  return m;
}

function tailAllowedByExitTag(tail: string, allow: Set<string>) {
  if (allow.has("UP") && tail.endsWith("_UP")) return true;
  if (allow.has("DOWN") && tail.endsWith("_DOWN")) return true;
  if (allow.has("CCW") && tail.endsWith("_CCW")) return true;
  if (allow.has("CW") && tail.endsWith("_CW")) return true;
  if (allow.has(tail)) return true; // BAY_E/BAY_W
  return false;
}

function isTurnScopedNode(node: string) {
  if (!node.includes(":")) return false;
  if (node.startsWith("ICIN:")) return false;
  if (node.startsWith("ICOUT:")) return false;
  if (node.startsWith("IC:")) return false;
  return true;
}

function junctionOf(node: string) {
  return node.includes(":") ? node.split(":")[0] : "";
}

function isIntraJunctionTurn(from: string, to: string) {
  if (!isTurnScopedNode(from) || !isTurnScopedNode(to)) return false;
  const j1 = junctionOf(from);
  const j2 = junctionOf(to);
  return !!j1 && j1 === j2;
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const head = arr[i];
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([head, ...p]);
  }
  return out;
}

function bfsPathAvoid(
  graph: GraphJson,
  starts: string[],
  targets: Set<string>,
  avoid: (node: string) => boolean,
  turnRules: TurnRuleSet | null,
  seqInfo: { pos: SeqPosMap; jcts: SeqJctMap } | null,
  maxSteps = 60000
): string[] | null {
  const isRing = (t: string) => t.startsWith("C1_") || t.startsWith("C2_") || t.startsWith("BAY");
  const isRadial = (t: string) => /^(R\d+|R1H|R1U|R2A|R2B|R3A|R3B|R4A|R4B|R5A|R5B|R6A|R6B|R7A|R7B|K\d|S\d)_/.test(t);
  const jctOf = (node: string) => (node.includes(":") ? node.split(":")[0] : "");

  const q: string[] = [];
  const prev = new Map<string, string | null>();

  for (const s of starts) {
    if (!graph[s]) continue;
    if (avoid(s) && !targets.has(s)) continue;
    q.push(s);
    prev.set(s, null);
  }
  for (const s of starts) {
    if (targets.has(s)) return [s];
  }

  let head = 0;
  let steps = 0;

  while (head < q.length && steps < maxSteps) {
    const v = q[head++];
    steps++;

    const ns = graph[v] || [];
    for (const nxt of ns) {
      const pv = prev.get(v);
      const fromTail = routeTailOfNode(v);
      const toTail = routeTailOfNode(nxt);

      if (seqInfo) {
        const fromPos = seqInfo.pos.get(v);
        const toPos = seqInfo.pos.get(nxt);
        if (fromTail && toTail && fromTail === toTail && fromPos != null && toPos != null && toPos < fromPos) {
          continue;
        }
        if (isIntraJunctionTurn(v, nxt)) {
          const j = junctionOf(v);
          const fromHas = seqInfo.jcts.get(fromTail)?.has(j);
          const toHas = seqInfo.jcts.get(toTail)?.has(j);
          if (fromHas === false || toHas === false) {
            continue;
          }
        }
      }

      if (turnRules && isIntraJunctionTurn(v, nxt) && !turnRules.has(edgeKey(v, nxt))) {
        continue;
      }

      // 湾岸線から放射の「下り」へは入れない
      if ((fromTail === "BAY_E" || fromTail === "BAY_W") && /_(DOWN)$/.test(toTail)) {
        continue;
      }

      // 湾岸線の行き先反転は大黒PA経由のみ許可（直結Uターンを禁止）
      if ((fromTail === "BAY_E" && toTail === "BAY_W") || (fromTail === "BAY_W" && toTail === "BAY_E")) {
        continue;
      }

      // 東側MVP制約: 大黒PAはBAY_W側からのみ進入可（有明側の方向感と整合）
      if (v === "DaikokuJCT:BAY_E" && nxt === "DaikokuPA") {
        continue;
      }

      // 葛西JCTの向き制約（指定ルール）
      // 許可: BAY_W <-> C2_CW, BAY_E <-> C2_CCW
      // 不許可: BAY_E <-> C2_CW, BAY_W <-> C2_CCW
      if (
        (v === "KasaiJCT:BAY_E" && nxt === "KasaiJCT:C2_CW") ||
        (v === "KasaiJCT:BAY_W" && nxt === "KasaiJCT:C2_CCW") ||
        (v === "KasaiJCT:C2_CW" && nxt === "KasaiJCT:BAY_E") ||
        (v === "KasaiJCT:C2_CCW" && nxt === "KasaiJCT:BAY_W")
      ) {
        continue;
      }

      // A/B側の方向制約（指定ルール）
      // R[3-7]A_UP -> C2 は不可（A_DOWN -> C2 は許可）
      if (/^R[3-7]A_UP$/.test(fromTail) && toTail.startsWith("C2_")) {
        continue;
      }
      // C2 -> R[3-7]B_UP は不可、R[3-7]B_DOWN -> C2 は不可
      // （B_UP は都心方向、B_DOWN は都心外方向という定義）
      if (fromTail.startsWith("C2_") && /^R[3-7]B_UP$/.test(toTail)) {
        continue;
      }
      if (/^R[3-7]B_DOWN$/.test(fromTail) && toTail.startsWith("C2_")) {
        continue;
      }

      // C1の向き制約:
      // Rx_DOWN -> C1 は不可、C1 -> Rx_UP は不可
      const radialTail = /^(R\d+(?:A|B)?|R1H|R1U|K\d|S\d)_(UP|DOWN)$/;
      const fromRad = radialTail.exec(fromTail);
      const toRad = radialTail.exec(toTail);
      if (fromRad && fromRad[2] === "DOWN" && toTail.startsWith("C1_")) {
        continue;
      }
      if (fromTail.startsWith("C1_") && toRad && toRad[2] === "UP") {
        continue;
      }

      // 7号とC2の接続を厳格化
      // 許可: 7B_UP -> C2_CCW, C2_CW -> 7B_DOWN
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
        if (!sameLine && !ok7c2) {
          continue;
        }
      }

      // 4AとC2の接続は禁止（4BのみC2と接続）
      if (
        (fromTail.startsWith("R4A_") && toTail.startsWith("C2_")) ||
        (toTail.startsWith("R4A_") && fromTail.startsWith("C2_"))
      ) {
        continue;
      }
      // R4の明示ルール:
      // 不可: C2 -> R4B_UP, R4B_DOWN -> C2
      // 可:   C2 -> R4B_DOWN, R4B_UP -> C2
      if (fromTail.startsWith("C2_") && toTail === "R4B_UP") {
        continue;
      }
      if (fromTail === "R4B_DOWN" && toTail.startsWith("C2_")) {
        continue;
      }

      // JCT内での不自然な折返し（Ring→Radial→Ring など）を禁止
      if (pv) {
        const pj = jctOf(pv);
        const vj = jctOf(v);
        const nj = jctOf(nxt);
        const pt = tailOfPort(pv);
        const vt = tailOfPort(v);
        const nt = tailOfPort(nxt);

        if (pj && pj === vj && vj === nj && isRing(pt) && isRadial(vt) && isRing(nt)) {
          continue;
        }
        if (pj && pj === vj && vj === nj && isRing(pt) && isRing(vt) && isRing(nt) && pt !== vt && nt === pt) {
          continue;
        }
      }

      if (avoid(nxt) && !targets.has(nxt)) continue;
      if (prev.has(nxt)) continue;
      prev.set(nxt, v);

      if (targets.has(nxt)) {
        const path: string[] = [];
        let cur: string | null = nxt;
        while (cur !== null) {
          path.push(cur);
          cur = prev.get(cur) ?? null;
        }
        path.reverse();
        return path;
      }
      q.push(nxt);
    }
  }
  return null;
}

export default function Page() {
  const [faresData, setFaresData] = useState<PlansJson | null>(null);
  const [graph, setGraph] = useState<GraphJson | null>(null);
  const [turnRules, setTurnRules] = useState<TurnRuleSet | null>(null);
  const [seqInfo, setSeqInfo] = useState<{ pos: SeqPosMap; jcts: SeqJctMap } | null>(null);
  const [exitAllow, setExitAllow] = useState<ExitAllowMap>(new Map());
  const [icMaster, setIcMaster] = useState<Record<string, IcMasterRow>>({});

  const [q, setQ] = useState("");
  const [entryName, setEntryName] = useState<string | null>(null);
  const [entryFlow, setEntryFlow] = useState<"auto" | "up" | "down">("auto");
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  const fares = faresData?.entries ?? EMPTY_ENTRIES;
  const entries = useMemo(() => Object.keys(fares).sort(), [fares]);

  const [spotOn, setSpotOn] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const s of SPOTS) o[s.key] = false;
    return o;
  });

  useEffect(() => {
    fetch(publicAsset("/plans.json")).then((r) => r.json()).then(setFaresData).catch(() => setFaresData(null));
    fetch(publicAsset("/graph.json")).then((r) => r.json()).then(setGraph).catch(() => setGraph(null));
    Promise.all([
      fetch(publicAsset("/allowed_turns_port.csv")).then((r) => r.text()),
      fetch(publicAsset("/connections_port.csv")).then((r) => r.text()),
      fetch(publicAsset("/special_switches_port.csv")).then((r) => r.text()),
      fetch(publicAsset("/forbidden_turns.csv")).then((r) => r.text()),
      fetch(publicAsset("/route_sequence_v2.csv")).then((r) => r.text()),
    ])
      .then(([allowedCsv, connCsv, specialCsv, forbiddenCsv, seqCsv]) => {
        const s = new Set<string>();
        for (const k of parseEdgeSetFromCsv(allowedCsv)) s.add(k);
        for (const k of parseEdgeSetFromCsv(connCsv)) s.add(k);
        for (const k of parseEdgeSetFromCsv(specialCsv)) s.add(k);
        for (const k of parseForbiddenEdgeSetFromCsv(forbiddenCsv)) s.delete(k);
        setTurnRules(s);
        setSeqInfo(parseRouteSequencePos(seqCsv));
      })
      .catch(() => {
        setTurnRules(new Set());
        setSeqInfo(null);
      });
    fetch(publicAsset("/ic_tags.csv"))
      .then((r) => r.text())
      .then((csv) => setExitAllow(parseIcExitAllow(csv)))
      .catch(() => setExitAllow(new Map()));
    fetch(publicAsset("/ic_master.json"))
      .then((r) => r.json())
      .then(setIcMaster)
      .catch(() => setIcMaster({}));
  }, []);

  const fullEntries = useMemo(() => {
    const names = entries.filter((name) => icMaster[name]?.is_full);
    return names.length > 0 ? names : entries;
  }, [entries, icMaster]);

  const ringTargets = useMemo(() => {
    if (!graph) return [] as string[];
    return Object.keys(graph).filter((node) => isCoreRingTail(routeTailOfNode(node)));
  }, [graph]);

  const suggestions = useMemo(() => {
    const qq = q.trim();
    if (!qq) return fullEntries.slice(0, 40);
    const lower = qq.toLowerCase();
    return entries
      .filter((x) => x.toLowerCase().includes(lower))
      .slice(0, 40);
  }, [q, entries, fullEntries]);

  const resetHome = () => {
    setQ("");
    setEntryName(null);
    const o: Record<string, boolean> = {};
    for (const s of SPOTS) o[s.key] = false;
    setSpotOn(o);
    setEntryFlow("auto");
    setSelectedRowIndex(0);
  };

  const onPickEntry = (name: string) => {
    setEntryName(name);
    setQ(name);
    setEntryFlow("auto");
    setSelectedRowIndex(0);
  };

  const entry = entryName ? fares[entryName] : null;

  const nodeToPorts = useMemo(() => {
    if (!graph) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    for (const k of Object.keys(graph)) {
      if (!k.includes(":")) continue;
      const tail = tailOfPort(k);              // 例: "渋谷:R3A_UP"
      const base = tail.split(":")[0];         // 例: "渋谷"

      for (const key of [tail, base]) {
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(k);
      }
    }
    for (const v of m.values()) v.sort();
    return m;
  }, [graph]);

  const activeSpots = useMemo(() => SPOTS.filter((s) => spotOn[s.key]), [spotOn]);

  function resolveStartPorts(startNodes: string[]) {
    if (!graph || !entryName) return [] as string[];
    const strict: string[] = [];
    for (const n of startNodes) {
      const icin = `ICIN:${entryName}:${n}`;
      const ic = `IC:${entryName}:${n}`;
      const node = `${entryName}:${n}`;
      if (graph[icin]) strict.push(icin);
      else if (graph[ic]) strict.push(ic);
      else if (graph[node]) strict.push(node);
    }
    if (strict.length > 0) return uniq(strict);

    let ports: string[] = [];
    for (const n of startNodes) {
      ports = ports.concat(nodeToPorts.get(n) || []);
      if (graph[n]) ports.push(n);
    }
    return uniq(ports).filter((p) => !!graph[p]);
  }

  const startPorts = useMemo(() => {
    if (!entry || !graph) return [];
    const selectedStartNodes =
      entryFlow === "auto"
        ? entry.start_nodes
        : entry.start_nodes.filter((n) => (entryFlow === "up" ? n.endsWith("_UP") : n.endsWith("_DOWN")));
    const effectiveStartNodes = selectedStartNodes.length > 0 ? selectedStartNodes : entry.start_nodes;
    return resolveStartPorts(effectiveStartNodes);
  }, [entry, graph, nodeToPorts, entryFlow, entryName]);

  const entryHasUpDown = useMemo(() => {
    if (!entry) return false;
    const hasUp = entry.start_nodes.some((n) => n.endsWith("_UP"));
    const hasDown = entry.start_nodes.some((n) => n.endsWith("_DOWN"));
    return hasUp && hasDown;
  }, [entry]);

  const icoutByExit = useMemo(() => {
    if (!graph) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    for (const k of Object.keys(graph)) {
      if (!k.startsWith("ICOUT:")) continue;
      const p = k.split(":");
      const exit = p[1] || "";
      if (!m.has(exit)) m.set(exit, []);
      m.get(exit)!.push(k);
    }
    for (const v of m.values()) v.sort();
    return m;
  }, [graph]);

  function resolveIcoutTargets(
    exitName: string,
    targetNodes: string[] | undefined,
    normalPathNodes: string[] | undefined
  ) {
    if (!graph) return [];
    const tnodes = targetNodes || [];
    const normalLast = (normalPathNodes && normalPathNodes.length) ? normalPathNodes[normalPathNodes.length - 1] : "";
    const preferred = normalLast && tnodes.includes(normalLast) ? [normalLast] : [];
    const candidates = uniq(preferred.concat(tnodes));
    let icoutTargets = uniq(candidates.map((t) => `ICOUT:${exitName}:${t}`)).filter((k) => !!graph[k]);
    if (icoutTargets.length === 0) {
      icoutTargets = uniq(tnodes.map((t) => `ICOUT:${exitName}:${t}`)).filter((k) => !!graph[k]);
    }
    if (icoutTargets.length === 0) {
      icoutTargets = icoutByExit.get(exitName) || [];
    }
    const allow = exitAllow.get(exitName);
    if (allow && icoutTargets.length > 0) {
      const filtered = icoutTargets.filter((k) => {
        const p = k.split(":");
        const tail = p[p.length - 1] || "";
        return tailAllowedByExitTag(tail, allow);
      });
      if (filtered.length > 0) icoutTargets = filtered;
    }
    return icoutTargets;
  }

  function computeNormalPath(
    exitName: string,
    targetNodes: string[] | undefined,
    normalPathNodes: string[] | undefined
  ): { ok: boolean; path: string[]; why?: string } {
    if (!graph) return { ok: false, path: [], why: "graph未読込" };
    if (!turnRules) return { ok: false, path: [], why: "遷移ルール読込中" };
    if (startPorts.length === 0) return { ok: false, path: [], why: "start_portsなし" };

    const icoutTargets = resolveIcoutTargets(exitName, targetNodes, normalPathNodes);
    if (icoutTargets.length === 0) return { ok: false, path: [], why: "出口ノードが見つからない" };

    const avoidLoopDeadEnds = (node: string) => {
      const t = tailOfPort(node);
      return t.startsWith("R10_");
    };
    const p = bfsPathAvoid(graph, startPorts, new Set(icoutTargets), avoidLoopDeadEnds, turnRules, seqInfo);
    if (!p) return { ok: false, path: [], why: "出口へ到達不可" };
    return { ok: true, path: p };
  }

  function computeDetour(
    exitName: string,
    targetNodes: string[] | undefined,
    normalPathNodes: string[] | undefined
  ): { ok: boolean; path: string[]; why?: string } {
    if (!graph) return { ok: false, path: [], why: "graph未読込" };
    if (!turnRules) return { ok: false, path: [], why: "遷移ルール読込中" };
    if (startPorts.length === 0) return { ok: false, path: [], why: "start_portsなし" };

    const icoutTargets = resolveIcoutTargets(exitName, targetNodes, normalPathNodes);
    if (icoutTargets.length === 0) return { ok: false, path: [], why: "出口ノードが見つからない" };

    const avoidLoopDeadEnds = (node: string) => {
      const t = tailOfPort(node);
      return t.startsWith("R10_"); // 周回では晴海線(R10)を避ける
    };

    const go = (starts: string[], targetsArr: string[]) => {
      const targets = new Set(targetsArr);
      return bfsPathAvoid(graph, starts, targets, avoidLoopDeadEnds, turnRules, seqInfo);
    };

    if (activeSpots.length === 0) return { ok: false, path: [], why: "スポット未選択" };

    const tryOrder = (order: Spot[]) => {
      let curStarts = startPorts.slice();
      let full: string[] = [];

      for (const s of order) {
        const p = go(curStarts, [s.node]);
        if (!p) return null;
        if (full.length === 0) full = p;
        else full = full.concat(p.slice(1));
        curStarts = [p[p.length - 1]];
      }

      const pe = go(curStarts, icoutTargets);
      if (!pe) return null;
      if (full.length === 0) full = pe;
      else full = full.concat(pe.slice(1));
      return full;
    };

    const orders = activeSpots.length <= 1 ? [activeSpots] : permutations(activeSpots);
    let best: string[] | null = null;
    let hitAnySpot = false;

    for (const order of orders) {
      const one = tryOrder(order);
      if (!one) continue;
      hitAnySpot = true;
      if (!best || one.length < best.length) best = one;
    }

    if (!hitAnySpot) return { ok: false, path: [], why: "スポット順序を変えても成立せず" };
    return { ok: true, path: best || [] };
  }

  function isStructurallyLoopImpossible(
    exitName: string,
    targetNodes: string[] | undefined,
    normalPathNodes: string[] | undefined,
    normalResult: { ok: boolean; path: string[]; why?: string } | undefined,
    detourResult: { ok: boolean; path: string[]; why?: string } | undefined
  ) {
    if (!graph || !turnRules || !entry) return false;
    if (detourResult?.ok) return false;
    if (ringTargets.length === 0) return false;
    if (normalResult?.ok && normalResult.path.some((node) => isCoreRingTail(routeTailOfNode(node)))) {
      return false;
    }

    const entryMeta = entryName ? icMaster[entryName] : undefined;
    const exitMeta = icMaster[exitName];

    const startCandidates = resolveStartPorts(entryMeta?.is_full ? entry.start_nodes : entry.start_nodes.filter((n) => startPorts.includes(`ICIN:${entryName}:${n}`) || startPorts.includes(`IC:${entryName}:${n}`) || startPorts.includes(`${entryName}:${n}`)));
    const exitCandidates = exitMeta?.is_full
      ? (icoutByExit.get(exitName) || [])
      : resolveIcoutTargets(exitName, targetNodes, normalPathNodes);

    if (startCandidates.length === 0 || exitCandidates.length === 0) return true;

    const avoidLoopDeadEnds = (node: string) => {
      const t = tailOfPort(node);
      return t.startsWith("R10_");
    };

    const toRing = bfsPathAvoid(graph, startCandidates, new Set(ringTargets), avoidLoopDeadEnds, turnRules, seqInfo);
    if (!toRing) return true;

    const fromRing = bfsPathAvoid(graph, ringTargets, new Set(exitCandidates), avoidLoopDeadEnds, turnRules, seqInfo);
    return !fromRing;
  }

  const fixedRows = useMemo(() => (entry?.exits || []).slice(0, 30), [entry]);
  const normalPaths = fixedRows.map((x) => computeNormalPath(x.exit, x.target_nodes, x.path_nodes));

  const evaluatedDetours =
    activeSpots.length > 0
      ? fixedRows.map((x, i) => {
          const detour = computeDetour(x.exit, x.target_nodes, x.path_nodes);
          const structurallyImpossible = isStructurallyLoopImpossible(x.exit, x.target_nodes, x.path_nodes, normalPaths[i], detour);
          return {
            row: x,
            detour,
            structurallyImpossible,
          };
        })
      : [];

  const selectedRow = fixedRows[selectedRowIndex] || null;
  const selectedNormal = selectedRow ? normalPaths[selectedRowIndex] : null;
  const selectedDetour = activeSpots.length > 0 ? evaluatedDetours[selectedRowIndex]?.detour || null : null;
  const selectedMapPath =
    activeSpots.length > 0 && selectedDetour?.ok
      ? selectedDetour.path
      : selectedNormal?.ok
        ? selectedNormal.path
        : [];
  const mapRouteFamilies = highlightedRouteFamilies(selectedMapPath);
  const activeSpotLabels = useMemo(() => activeSpots.map((s) => s.label), [activeSpots]);
  const mapTitle = entryName
    ? selectedRow
      ? `${entryName} → ${selectedRow.exit}`
      : entryName
    : "首都高 周回ドライブプランナー";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {entryName ? (
          <button
            onClick={resetHome}
            style={{ padding: "8px 12px", border: "1px solid #d6d3d1", borderRadius: 12, background: "white" }}
          >
            ホームへ戻る
          </button>
        ) : null}
        <h1 style={{ fontSize: 22, margin: 0 }}>首都高 周回ドライブプランナー</h1>
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="入口を検索（例：五反田 / 外苑 / 葛西）"
          style={{ width: "100%", padding: 12, fontSize: 16, border: "1px solid #bbb", borderRadius: 12 }}
        />
      </div>

      {!entryName ? (
        <div style={{ marginTop: 10, padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8, fontWeight: 700 }}>経由したいスポット</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {SPOTS.map((s) => (
              <label key={s.key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={!!spotOn[s.key]}
                  onChange={(e) => setSpotOn((p) => ({ ...p, [s.key]: e.target.checked }))}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {!faresData && <div style={{ marginTop: 16, color: "#666" }}>plans.json を読み込めていません。</div>}
      {!graph && <div style={{ marginTop: 8, color: "#666" }}>graph.json を読み込めていません。</div>}

      {faresData && !entryName && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {suggestions.map((ic) => (
              <button
                key={ic}
                onClick={() => onPickEntry(ic)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  border: "1px solid #e7e5e4",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)",
                  boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 15 }}>{ic}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  start: {fares[ic].start_nodes.map(prettyNode).join(", ")}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                  exits: {fares[ic].exits?.length ?? 0}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {faresData && entryName && entry && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <ShutokoMap
                title={mapTitle}
                entryName={entryName}
                exitName={selectedRow?.exit}
                activeSpotLabels={activeSpotLabels}
                highlightedRoutes={mapRouteFamilies}
                highlightedPath={selectedMapPath}
                toolbar={
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>経由したいスポット</div>
                      {SPOTS.map((s) => (
                        <label key={s.key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={!!spotOn[s.key]}
                            onChange={(e) => setSpotOn((p) => ({ ...p, [s.key]: e.target.checked }))}
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#666" }}>
                      <span>入口: {entryName}</span>
                      {entryHasUpDown ? (
                        <>
                          <span>入口方向:</span>
                          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="radio" checked={entryFlow === "auto"} onChange={() => setEntryFlow("auto")} />
                            自動
                          </label>
                          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="radio" checked={entryFlow === "up"} onChange={() => setEntryFlow("up")} />
                            上り
                          </label>
                          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="radio" checked={entryFlow === "down"} onChange={() => setEntryFlow("down")} />
                            下り
                          </label>
                        </>
                      ) : null}
                      <span>候補出口: {entry.exits?.length ?? 0}</span>
                    </div>
                  </div>
                }
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, alignContent: "start" }}>
              {activeSpots.length > 0 ? (
                <div style={{ fontSize: 12, color: "#666", padding: "4px 2px" }}>
                  成立ルート: {evaluatedDetours.filter((d) => d.detour.ok).length} / {fixedRows.length} 件
                </div>
              ) : null}

              {fixedRows.map((x, i) => {
              const detour = activeSpots.length > 0 ? evaluatedDetours[i]?.detour : null;
              const normalCalc = normalPaths[i];
              const normal = normalCalc?.ok ? prettyDetourPath(normalCalc.path).join(" → ") : "";

              return (
                <div
                  key={i}
                  onClick={() => setSelectedRowIndex(i)}
                  style={{
                    border: selectedRowIndex === i ? "2px solid #0ea5e9" : "1px solid #ddd",
                    boxShadow: selectedRowIndex === i ? "0 8px 24px rgba(14,165,233,0.12)" : "none",
                    borderRadius: 14,
                    padding: 12,
                    cursor: "pointer",
                    background: selectedRowIndex === i ? "#f8fdff" : "linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>
                    {x.toll}円 / 出口：{x.exit} {x.dist ? ` / ${x.dist}km` : ""}
                  </div>

                  {normal ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                      通常ルート: {normal}
                    </div>
                  ) : null}

                  {activeSpots.length > 0 && detour?.ok ? (
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                      <div style={{ color: "#111", fontWeight: 700 }}>周回ルート:</div>
                      <div style={{ color: "#666", marginTop: 4 }}>
                        {prettyDetourPath(detour.path).join(" → ")}
                      </div>
                    </div>
                  ) : null}

                  {activeSpots.length > 0 && detour && !detour.ok ? (
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                      <div style={{ color: "#111", fontWeight: 700 }}>
                        {evaluatedDetours[i]?.structurallyImpossible ? "周回不可能" : "周回ルートなし"}
                      </div>
                      <div style={{ color: "#666", marginTop: 4 }}>
                        {evaluatedDetours[i]?.structurallyImpossible
                          ? "環状線に到達できないため、この出入口の組み合わせでは周回できません。"
                          : detour.why || "条件に合う周回ルートが見つかりませんでした。"}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
              })}
              {activeSpots.length > 0 && evaluatedDetours.filter((d) => d.detour.ok).length === 0 ? (
                <div style={{ color: "#888" }}>条件に合う周回ルートが見つかりませんでした。</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
