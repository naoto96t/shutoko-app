"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ShutokoMapProps = {
  entryName: string | null;
  exitName?: string;
  activeSpotLabels?: string[];
  highlightedRoutes?: string[];
  highlightedPath?: string[];
  title?: string;
  headerAction?: ReactNode;
  toolbar?: ReactNode;
};

const PA_ID_BY_LABEL: Record<string, string> = {
  "箱崎PA": "pa_Hakozaki",
  "大黒PA": "pa_Daikoku",
  "辰巳PA(第1)": "pa_Tatsumi1",
  "辰巳PA(第2)": "pa_Tatsumi2",
  "芝浦PA": "pa_Shibaura",
};

const PA_ID_BY_NODE: Record<string, string> = {
  HakozakiRotary: "pa_Hakozaki",
  DaikokuPA: "pa_Daikoku",
  TatsumiPA1: "pa_Tatsumi1",
  TatsumiPA2: "pa_Tatsumi2",
  ShibauraPA: "pa_Shibaura",
};

const NODE_ID_ALIASES: Record<string, string> = {
  RyogokuJCT: "RyougokuJCT",
  OohashiJCT: "OhashiJCT",
  KawasakiUkishimaJCT: "KawasakiukishimaJCT",
  HonmokuJCT: "HonmakiJCT",
};

const IC_NAME_ID_OVERRIDES: Record<string, string> = {
  "堤通": "ic_tsutsumidori",
  "向島": "ic_mukoujima",
  "千住新橋": "ic_senjushinbashi",
  "加平": "ic_kahei",
  "八潮南": "ic_yashiominami",
  "八潮": "ic_yashio",
  "箱崎": "ic_hakozaki",
  "大師": "ic_daishi",
  "浜川崎": "ic_hamakawasaki",
  "浅田": "ic_asada",
  "汐入": "ic_shioiri",
  "生麦": "ic_namamugi",
};

const POLYLINE_FAMILIES = new Set(["R1H", "K1", "K2", "K3", "K5", "K6"]);

function mojibakeId(s: string) {
  // Some SVG ids were exported with UTF-8 bytes interpreted as Latin-1.
  return Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join("");
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function dedupeConsecutive<T>(arr: T[]) {
  const out: T[] = [];
  for (const item of arr) {
    if (out[out.length - 1] !== item) out.push(item);
  }
  return out;
}

function decodeHtmlEntities(text: string) {
  return text.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function demojibakeUtf8(text: string) {
  try {
    const bytes = Uint8Array.from(Array.from(text), (ch) => ch.charCodeAt(0) & 0xff);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return text;
  }
}

function parseSvgPointMap(svgMarkup: string) {
  const map = new Map<string, { x: number; y: number }>();
  const circleRe = /<(circle|ellipse)\b([^>]*)>/g;
  const attr = (chunk: string, name: string) => {
    const m = chunk.match(new RegExp(`\\b${name}="([^"]+)"`));
    return m ? m[1] : null;
  };
  const applyMatrix = (x: number, y: number, transform: string | null) => {
    if (!transform) return { x, y };
    const m = transform.match(/matrix\(([-\d.\s,]+)\)/);
    if (!m) return { x, y };
    const nums = m[1]!
      .split(/[,\s]+/)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    if (nums.length !== 6) return { x, y };
    const [a, b, c, d, e, f] = nums;
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  };
  let m: RegExpExecArray | null;
  while ((m = circleRe.exec(svgMarkup))) {
    const chunk = m[2] || "";
    const idAttr = attr(chunk, "id");
    const cxAttr = attr(chunk, "cx");
    const cyAttr = attr(chunk, "cy");
    if (!idAttr || !cxAttr || !cyAttr) continue;
    const rawId = decodeHtmlEntities(idAttr);
    const repairedId = demojibakeUtf8(rawId);
    const cx = Number(cxAttr);
    const cy = Number(cyAttr);
    const { x, y } = applyMatrix(cx, cy, attr(chunk, "transform"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    for (const id of uniq([rawId, repairedId])) {
      map.set(id, { x, y });
      const base = id.replace(/_\d+$/, "");
      if (base && !map.has(base)) map.set(base, { x, y });
    }
  }
  return map;
}

function normalizeRouteGroupId(id: string) {
  return id.replace(/^Route_/, "").replace(/^route_/, "");
}

const ROUTE_GROUP_IC_NAMES: Record<string, string[]> = {
  C1: ["代官町", "北の丸", "神田橋", "宝町", "京橋", "新富町", "銀座", "汐留", "芝公園", "飯倉", "霞が関"],
  C2: ["五反田", "富ヶ谷", "初台南", "中野長者橋", "西池袋", "高松", "新板橋", "滝野川", "王子南", "王子北", "扇大橋", "千住新橋", "小菅", "四つ木", "平井大橋", "中環小松川", "船堀橋", "清新町"],
  R1H: ["芝浦", "勝島", "鈴ヶ森", "平和島", "空港西", "羽田"],
  R1U: ["入谷", "上野", "本町"],
  R3: ["高樹町", "渋谷", "池尻", "三軒茶屋", "用賀"],
  R4: ["高井戸", "永福", "幡ヶ谷", "初台", "新宿", "代々木", "外苑"],
  R5A: ["一ツ橋", "西神田", "飯田橋", "早稲田", "護国寺", "東池袋", "北池袋"],
  R5B: ["板橋本町", "中台", "高島平", "戸田南", "戸田"],
  R6A: ["堤通", "向島", "駒形", "清洲橋", "浜町", "箱崎"],
  R6B: ["三郷", "八潮", "八潮南", "加平"],
  R7: ["錦糸町", "小松川", "一之江"],
  R9: ["福住", "木場", "塩浜", "枝川"],
  R10: ["豊洲", "晴海"],
  R11: ["台場"],
  K1: ["大師", "浜川崎", "浅田", "汐入", "生麦", "守屋町", "子安", "東神奈川", "横浜駅東口", "みなとみらい", "横浜公園"],
  K2: ["横浜駅西口", "三ツ沢"],
  K3: ["新山下", "山下町", "石川町", "阪東橋", "花之木", "永田"],
  S1: ["鹿浜橋", "東領家", "加賀", "足立入谷", "新郷", "安行", "新井宿"],
};

function buildIcNameToSvgIdMap(host: Element) {
  const out = new Map<string, string>(Object.entries(IC_NAME_ID_OVERRIDES));
  const nodesRoot = host.querySelector("#nodes_ic");
  if (!nodesRoot) return out;

  for (const nodeGroup of Array.from(nodesRoot.children)) {
    if (!(nodeGroup instanceof Element) || !nodeGroup.id) continue;
    const key = normalizeRouteGroupId(nodeGroup.id);
    const names = ROUTE_GROUP_IC_NAMES[key];
    if (!names?.length) continue;

    const ids = Array.from(nodeGroup.children)
      .filter((el): el is Element => el instanceof Element && !!el.id && el.id.startsWith("ic_"))
      .map((el) => el.id);

    for (let i = 0; i < Math.min(names.length, ids.length); i++) {
      out.set(names[i], ids[i]);
    }
  }
  return out;
}

function publicAsset(path: string) {
  return `${BASE_PATH}${path}`;
}

function routeTailOfNode(node: string) {
  if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
    const parts = node.split(":");
    return parts[parts.length - 1] || "";
  }
  const idx = node.indexOf(":");
  return idx >= 0 ? node.slice(idx + 1) : node;
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
  if (tail.startsWith("R6A_") || tail.startsWith("R6_")) return "R6A";
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
  if (tail.startsWith("K7_")) return "K7";
  if (tail.startsWith("S1_")) return "S1";
  if (tail.startsWith("S2_")) return "S2";
  if (tail.startsWith("S5_")) return "S5";
  return null;
}

function directionOfTail(tail: string) {
  const m = tail.match(/_(UP|DOWN|CW|CCW|E|W)$/);
  return m ? m[1] : null;
}

function routeBaseOfTail(tail: string) {
  return tail.replace(/_(UP|DOWN|CW|CCW|E|W)$/, "");
}

function areOppositeDirections(a: string | null, b: string | null) {
  return (
    (a === "UP" && b === "DOWN") ||
    (a === "DOWN" && b === "UP") ||
    (a === "CW" && b === "CCW") ||
    (a === "CCW" && b === "CW") ||
    (a === "E" && b === "W") ||
    (a === "W" && b === "E")
  );
}

function routeConfigOfTail(tail: string): { routeIds: string[]; ring: boolean; forward: boolean | null } | null {
  if (!tail) return null;
  if (tail.startsWith("C1_")) return { routeIds: ["route_C1"], ring: true, forward: tail.endsWith("_CW") };
  if (tail.startsWith("C2_")) return { routeIds: ["route_C2"], ring: true, forward: tail.endsWith("_CW") };
  if (tail.startsWith("BAYX_")) return { routeIds: ["route_BAYX"], ring: false, forward: tail.endsWith("_E") };
  if (tail.startsWith("BAY_")) return { routeIds: ["route_BAY"], ring: false, forward: tail.endsWith("_E") };
  if (tail.startsWith("R1H_")) return { routeIds: ["route_R1H"], ring: false, forward: null };
  if (tail.startsWith("R1U_")) return { routeIds: ["route_R1U"], ring: false, forward: null };
  if (tail.startsWith("R2")) return { routeIds: ["route_R2", "route_R2_Togoshi"], ring: false, forward: null };
  if (tail.startsWith("R3A_")) return { routeIds: ["route_R3A"], ring: false, forward: null };
  if (tail.startsWith("R3B_")) return { routeIds: ["route_R3B"], ring: false, forward: null };
  if (tail.startsWith("R4A_")) return { routeIds: ["route_R4A"], ring: false, forward: null };
  if (tail.startsWith("R4B_")) return { routeIds: ["route_R4B"], ring: false, forward: null };
  if (tail.startsWith("R5A_")) return { routeIds: ["route_R5A"], ring: false, forward: null };
  if (tail.startsWith("R5B_")) return { routeIds: ["route_R5B"], ring: false, forward: null };
  if (tail.startsWith("R6A_") || tail.startsWith("R6_")) return { routeIds: ["route_R6A"], ring: false, forward: null };
  if (tail.startsWith("R6B_") || tail.startsWith("R6_MISATO_")) return { routeIds: ["route_R6B"], ring: false, forward: null };
  if (tail.startsWith("R7A_")) return { routeIds: ["route_R7A"], ring: false, forward: null };
  if (tail.startsWith("R7B_")) return { routeIds: ["route_R7B"], ring: false, forward: null };
  if (tail.startsWith("R9_")) return { routeIds: ["route_R9"], ring: false, forward: null };
  if (tail.startsWith("R10_")) return { routeIds: ["route_R10"], ring: false, forward: null };
  if (tail.startsWith("R11_")) return { routeIds: ["route_R11"], ring: false, forward: null };
  if (tail.startsWith("K1_")) return { routeIds: ["route_K1"], ring: false, forward: null };
  if (tail.startsWith("K2_")) return { routeIds: ["route_K2"], ring: false, forward: null };
  if (tail.startsWith("K3_")) return { routeIds: ["route_K3"], ring: false, forward: null };
  if (tail.startsWith("K5_")) return { routeIds: ["route_K5"], ring: false, forward: null };
  if (tail.startsWith("K6_")) return { routeIds: ["route_K6"], ring: false, forward: null };
  if (tail.startsWith("K7_")) return { routeIds: ["route_K7"], ring: false, forward: null };
  if (tail.startsWith("S1_")) return { routeIds: ["route_S1"], ring: false, forward: null };
  if (tail.startsWith("S2_")) return { routeIds: ["Route_S2", "Route_S2_2"], ring: false, forward: null };
  if (tail.startsWith("S5_")) return { routeIds: ["Route_S5", "Route_S5_2"], ring: false, forward: null };
  return null;
}

function svgNodeIdFromPathNode(node: string) {
  if (PA_ID_BY_NODE[node]) return PA_ID_BY_NODE[node];
  if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
    return node.split(":")[1] || null;
  }
  if (node.includes(":")) {
    const base = node.split(":")[0] || "";
    return NODE_ID_ALIASES[base] || base;
  }
  return NODE_ID_ALIASES[node] || node;
}

function findSvgNode(host: Element, rawId: string | null) {
  if (!rawId) return null;
  const all = Array.from(host.querySelectorAll<SVGElement>("[id]"));
  const alias = NODE_ID_ALIASES[rawId] || rawId;
  const candidates = uniq([rawId, alias, mojibakeId(rawId), mojibakeId(alias)]);

  for (const candidate of candidates) {
    for (const el of all) {
      if (el.id === candidate) return el;
    }
  }
  for (const candidate of candidates) {
    for (const el of all) {
      if (el.id.startsWith(`${candidate}_`)) return el;
    }
  }
  return null;
}

function centerOf(el: SVGGraphicsElement | null) {
  if (!el) return null;
  const box = el.getBBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function addLayer(rootSvg: SVGSVGElement, className: string) {
  rootSvg.querySelectorAll(`.${className}`).forEach((el) => el.remove());
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("class", className);
  rootSvg.appendChild(layer);
  return layer;
}

function addMarker(layer: SVGGElement, point: { x: number; y: number } | null, fill: string, radius: number) {
  if (!point) return;
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", `${point.x}`);
  circle.setAttribute("cy", `${point.y}`);
  circle.setAttribute("r", `${radius}`);
  circle.setAttribute("fill", fill);
  circle.setAttribute("stroke", "white");
  circle.setAttribute("stroke-width", "3");
  layer.appendChild(circle);
}

function nearestLengthOnPath(path: SVGPathElement, x: number, y: number) {
  const total = path.getTotalLength();
  const samples = Math.max(240, Math.ceil(total / 2));
  let bestLength = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= samples; i++) {
    const length = (total * i) / samples;
    const pt = path.getPointAtLength(length);
    const dist = Math.hypot(pt.x - x, pt.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      bestLength = length;
    }
  }

  let step = Math.max(total / samples, 1);
  while (step > 0.5) {
    for (const length of [Math.max(0, bestLength - step), bestLength, Math.min(total, bestLength + step)]) {
      const pt = path.getPointAtLength(length);
      const dist = Math.hypot(pt.x - x, pt.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestLength = length;
      }
    }
    step *= 0.5;
  }

  return { length: bestLength, total, dist: bestDist };
}

function offsetPointAtLength(routePath: SVGPathElement, total: number, len: number, sign: number, offset: number) {
  const clamped = Math.max(0, Math.min(total, len));
  const pt = routePath.getPointAtLength(clamped);
  const tangentStep = Math.max(total / 800, 1.5);
  const probeLen = Math.max(0, Math.min(total, clamped + sign * tangentStep));
  const probe = routePath.getPointAtLength(probeLen);
  let dx = probe.x - pt.x;
  let dy = probe.y - pt.y;
  const mag = Math.hypot(dx, dy) || 1;
  dx /= mag;
  dy /= mag;
  const nx = dy;
  const ny = -dx;
  return { x: pt.x + nx * offset, y: pt.y + ny * offset };
}

function smoothedPathData(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }
  return d;
}

function offsetPolylinePoints(points: Array<{ x: number; y: number }>, offset: number) {
  if (points.length < 2) return points;
  const out = points.map((pt, i) => {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    let tx = 0;
    let ty = 0;
    if (i > 0) {
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      const mag = Math.hypot(dx, dy) || 1;
      tx += dx / mag;
      ty += dy / mag;
    }
    if (i + 1 < points.length) {
      const dx = next.x - pt.x;
      const dy = next.y - pt.y;
      const mag = Math.hypot(dx, dy) || 1;
      tx += dx / mag;
      ty += dy / mag;
    }
    const mag = Math.hypot(tx, ty) || 1;
    tx /= mag;
    ty /= mag;
    const nx = ty;
    const ny = -tx;
    return { x: pt.x + nx * offset, y: pt.y + ny * offset };
  });
  out[0] = points[0]!;
  out[out.length - 1] = points[points.length - 1]!;
  return out;
}

function drawOverlayPath(overlayLayer: SVGGElement, d: string) {
  if (!d) return;
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  overlay.setAttribute('d', d);
  overlay.setAttribute('fill', 'none');
  overlay.setAttribute('stroke', '#2FFF00');
  overlay.setAttribute('stroke-width', '5.5');
  overlay.setAttribute('stroke-linecap', 'round');
  overlay.setAttribute('stroke-linejoin', 'round');
  overlay.setAttribute('opacity', '0.98');
  overlay.style.filter = 'drop-shadow(0 0 4px rgba(47,255,0,0.42))';
  overlayLayer.appendChild(overlay);
}

function shouldCarryOverlayAnchor(
  prevRun: { tail: string; rawNodes: string[] } | null,
  run: { tail: string; rawNodes: string[] },
) {
  const prevLast = prevRun?.rawNodes[prevRun.rawNodes.length - 1] || "";
  if ((prevLast === "TatsumiPA1" || prevLast === "TatsumiPA2" || prevLast === "TatsumiR9UpAfterPA1" || prevLast === "TatsumiR9UpAfterPA2") && run.tail.startsWith("R9_")) {
    return true;
  }
  if (prevLast === "HakozakiRotary" && run.tail.startsWith("R6A_")) {
    return true;
  }
  if (prevLast === "DaikokuPA" && (run.tail.startsWith("BAY_") || run.tail.startsWith("K5_"))) {
    return true;
  }
  return false;
}

function isSequenceHelperNode(node: string) {
  return /^TatsumiR9UpAfterPA[12]$/.test(node);
}

export default function ShutokoMap({
  entryName,
  exitName,
  activeSpotLabels = [],
  highlightedPath = [],
  title = "Route Map",
  headerAction,
  toolbar,
}: ShutokoMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [seqCsv, setSeqCsv] = useState<string>("");

  useEffect(() => {
    fetch(publicAsset("/shutoko.svg"))
      .then((r) => r.text())
      .then(setSvgMarkup)
      .catch(() => setSvgMarkup(""));
    fetch(publicAsset("/route_sequence_v2.csv"))
      .then((r) => r.text())
      .then(setSeqCsv)
      .catch(() => setSeqCsv(""));
  }, []);

  const routeRuns = useMemo(() => {
    const runs: Array<{ tail: string; routeIds: string[]; ring: boolean; forward: boolean | null; pointIds: string[]; rawNodes: string[] }> = [];
    let current: { tail: string; routeIds: string[]; ring: boolean; forward: boolean | null; pointIds: string[]; rawNodes: string[] } | null = null;

    for (const node of highlightedPath) {
      const pointId = svgNodeIdFromPathNode(node);
      const tail = routeTailOfNode(node);
      const config = routeConfigOfTail(tail);

      if (!config) {
        if (current) {
          if (pointId) current.pointIds.push(pointId);
          if (PA_ID_BY_NODE[node] || isSequenceHelperNode(node)) current.rawNodes.push(node);
        }
        continue;
      }

      if (!current || current.tail !== tail) {
        if (current) runs.push(current);
        current = { tail, routeIds: config.routeIds, ring: config.ring, forward: config.forward, pointIds: [], rawNodes: [] };
      }
      current.rawNodes.push(node);
      if (pointId) {
        current.pointIds.push(pointId);
      }
    }
    if (current) runs.push(current);

    if (runs.length > 0 && entryName) runs[0].pointIds.unshift(entryName);
    if (runs.length > 0 && exitName) runs[runs.length - 1].pointIds.push(exitName);

    for (const run of runs) {
      const deduped: string[] = [];
      for (const id of run.pointIds) {
        if (!id) continue;
        if (deduped[deduped.length - 1] !== id) deduped.push(id);
      }
      run.pointIds = deduped;
    }

    return runs.filter((run) => run.pointIds.length >= 1 || run.rawNodes.length >= 1);
  }, [entryName, exitName, highlightedPath]);

  const pointMap = useMemo(() => parseSvgPointMap(svgMarkup), [svgMarkup]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const rootSvg = host.querySelector<SVGSVGElement>("svg");
    if (!rootSvg) return;
    rootSvg.style.width = "100%";
    rootSvg.style.height = "auto";
    rootSvg.style.display = "block";

    const overlayLayer = addLayer(rootSvg, "route-overlay-layer");
    const markerLayer = addLayer(rootSvg, "route-marker-layer");
    const icNameToSvgId = buildIcNameToSvgIdMap(host);

    const parseSeq = (csvText: string) => {
      const lines = csvText.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return new Map<string, string[]>();
      const header = lines[0].split(",");
      const routeIdx = header.indexOf("route");
      const dirIdx = header.indexOf("dir");
      const stopsIdx = header.indexOf("stops");
      const map = new Map<string, string[]>();
      for (const line of lines.slice(1)) {
        const cols: string[] = [];
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
            cols.push(cur);
            cur = "";
          } else {
            cur += ch;
          }
        }
        cols.push(cur);
        const route = (cols[routeIdx] || "").trim();
        const dir = (cols[dirIdx] || "").trim();
        const stopsRaw = (cols[stopsIdx] || "").trim();
        if (!route || !dir || !stopsRaw || route.startsWith("#")) continue;
        const tail = route === "BAY" ? `BAY_${dir}` : `${route}_${dir}`;
        const stops = stopsRaw.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith("IC:") ? s.slice(3).trim() : s));
        map.set(tail, stops);
      }
      return map;
    };

    const seqMap = parseSeq(seqCsv);

    const svgIdForStop = (stop: string) => {
      if (PA_ID_BY_NODE[stop]) return PA_ID_BY_NODE[stop];
      return IC_NAME_ID_OVERRIDES[stop] || icNameToSvgId.get(stop) || NODE_ID_ALIASES[stop] || stop;
    };

    const stopTokenOfNode = (node: string) => {
      if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
        const parts = node.split(":");
        return parts[1] || null;
      }
      if (node.includes(":")) return node.split(":")[0] || null;
      return node || null;
    };

    const expandRunPointIds = (
      run: { tail: string; pointIds: string[]; rawNodes: string[] }
    ) => {
      const stops = seqMap.get(run.tail) || [];
      if (stops.length === 0 || run.rawNodes.length < 2) return run.pointIds;

      const stopIndex = new Map<string, number>();
      stops.forEach((stop, idx) => {
        if (!stopIndex.has(stop)) stopIndex.set(stop, idx);
      });

      const expanded: string[] = [];
      for (let i = 0; i < run.rawNodes.length; i++) {
        const raw = run.rawNodes[i];
        const token = stopTokenOfNode(raw);
        if (!token) continue;
        const idx = stopIndex.get(token);
        if (idx == null) continue;

        const stopName = stops[idx]!.replace(/^IC:/, "");
        const svgId = svgIdForStop(stopName);
        if (expanded[expanded.length - 1] !== svgId) expanded.push(svgId);

        if (i + 1 >= run.rawNodes.length) continue;
        const nextToken = stopTokenOfNode(run.rawNodes[i + 1]);
        if (!nextToken) continue;
        const nextIdx = stopIndex.get(nextToken);
        if (nextIdx == null || nextIdx === idx) continue;

        const step = nextIdx > idx ? 1 : -1;
        for (let j = idx + step; j !== nextIdx; j += step) {
          const midStop = stops[j];
          if (!midStop) continue;
          const midSvg = svgIdForStop(midStop.replace(/^IC:/, ""));
          if (expanded[expanded.length - 1] !== midSvg) expanded.push(midSvg);
        }
      }

      if (expanded.length >= 2) {
        const firstRawPoint = run.pointIds[0];
        const lastRawPoint = run.pointIds[run.pointIds.length - 1];
        if (firstRawPoint && expanded[0] !== firstRawPoint) expanded.unshift(firstRawPoint);
        if (lastRawPoint && expanded[expanded.length - 1] !== lastRawPoint) expanded.push(lastRawPoint);
        return dedupeConsecutive(expanded);
      }
      return dedupeConsecutive(run.pointIds);
    };

    const inferIncreasingDirection = (tail: string, routePath: SVGPathElement) => {
      const stops = seqMap.get(tail) || [];
      const lengths: number[] = [];
      for (const stop of stops) {
        const svgId = svgIdForStop(stop);
        const point =
          pointMap.get(svgId) ||
          centerOf(findSvgNode(host, svgId) as SVGGraphicsElement | null);
        if (!point) continue;
        const near = nearestLengthOnPath(routePath, point.x, point.y);
        if (near.dist <= 80) lengths.push(near.length);
      }
      if (lengths.length < 2) return null;
      let inc = 0;
      let dec = 0;
      for (let i = 0; i + 1 < lengths.length; i++) {
        if (lengths[i + 1] > lengths[i]) inc++;
        if (lengths[i + 1] < lengths[i]) dec++;
      }
      if (inc === dec) return null;
      return inc > dec;
    };

    let firstProjectedPoint: { x: number; y: number } | null = null;
    let lastProjectedPoint: { x: number; y: number } | null = null;
    let previousOverlayEnd: { x: number; y: number } | null = null;
    for (let runIndex = 0; runIndex < routeRuns.length; runIndex++) {
      const run = routeRuns[runIndex]!;
      const prevRun = runIndex > 0 ? routeRuns[runIndex - 1] : null;
      const nextRun = runIndex + 1 < routeRuns.length ? routeRuns[runIndex + 1] : null;
      const routePaths = run.routeIds
        .map((id) => host.querySelector<SVGPathElement>(`#${id} path`))
        .filter((p): p is SVGPathElement => !!p);
      if (routePaths.length === 0 || run.pointIds.length < 2) continue;

      let expandedPointIds = expandRunPointIds(run);
      const prevFamily = prevRun ? routeFamilyOfTail(prevRun.tail) : null;
      const curFamily = routeFamilyOfTail(run.tail);
      const nextFamily = nextRun ? routeFamilyOfTail(nextRun.tail) : null;
      const needsHanedaSwitch =
        (curFamily === "K1" && (prevFamily === "R1H" || nextFamily === "R1H")) ||
        (curFamily === "R1H" && (prevFamily === "K1" || nextFamily === "K1"));
      if (needsHanedaSwitch && pointMap.has("haneda_switchJCT")) {
        if ((run.tail === "K1_UP" || run.tail === "R1H_DOWN") && expandedPointIds[expandedPointIds.length - 1] !== "haneda_switchJCT") {
          expandedPointIds = [...expandedPointIds, "haneda_switchJCT"];
        }
        if ((run.tail === "K1_DOWN" || run.tail === "R1H_UP") && expandedPointIds[0] !== "haneda_switchJCT") {
          expandedPointIds = ["haneda_switchJCT", ...expandedPointIds];
        }
      }
      const prevTail = prevRun?.tail || "";
      const nextTail = nextRun?.tail || "";
      const fullRingLoop =
        (run.tail.startsWith("C1_") || run.tail.startsWith("C2_")) &&
        routeBaseOfTail(prevTail) === routeBaseOfTail(nextTail) &&
        areOppositeDirections(directionOfTail(prevTail), directionOfTail(nextTail));
      if (fullRingLoop && expandedPointIds.length < 2) {
        expandedPointIds = (seqMap.get(run.tail) || [])
          .map((stop) => svgIdForStop(stop))
          .filter(Boolean);
      }

      const nodePoints = expandedPointIds
        .map((id) => ({
          id,
          point:
            pointMap.get(icNameToSvgId.get(id) || id) ||
            centerOf(findSvgNode(host, icNameToSvgId.get(id) || id) as SVGGraphicsElement | null),
        }))
        .filter((x): x is { id: string; point: { x: number; y: number } } => !!x.point);
      if (nodePoints.length < 2) continue;

      let bestPath:
        | {
            path: SVGPathElement;
            total: number;
            score: number;
            lengths: number[];
          }
        | null = null;

      for (const routePath of routePaths) {
        const projections = nodePoints.map((np) => nearestLengthOnPath(routePath, np.point.x, np.point.y));
        const score = projections.reduce((sum, p) => sum + p.dist, 0);
        if (!bestPath || score < bestPath.score) {
          bestPath = {
            path: routePath,
            total: projections[0]?.total || routePath.getTotalLength(),
            score,
            lengths: projections.map((p) => p.length),
          };
        }
      }

      const firstId = nodePoints[0]?.id || "";
      const lastId = nodePoints[nodePoints.length - 1]?.id || "";
      const inheritedStartAnchor = shouldCarryOverlayAnchor(prevRun, run) ? previousOverlayEnd : null;
      const startAnchor = inheritedStartAnchor || (firstId.startsWith("pa_") ? null : nodePoints[0]?.point || null);
      const endAnchor = lastId.startsWith("pa_") ? null : nodePoints[nodePoints.length - 1]?.point || null;
      if (!firstProjectedPoint) firstProjectedPoint = nodePoints[0].point;
      lastProjectedPoint = nodePoints[nodePoints.length - 1].point;

      const overlayEnds = (() => {
        const offset = 3.5;
        if (!run.ring) {
          if (curFamily && POLYLINE_FAMILIES.has(curFamily)) {
            let fallbackPoints = offsetPolylinePoints(nodePoints.map((np) => np.point), offset);
            if (fallbackPoints.length < 2) return null;
            if (startAnchor) fallbackPoints[0] = startAnchor;
            if (endAnchor) fallbackPoints[fallbackPoints.length - 1] = endAnchor;
            drawOverlayPath(overlayLayer, smoothedPathData(fallbackPoints));
            return { start: fallbackPoints[0], end: fallbackPoints[fallbackPoints.length - 1] };
          }
          if (bestPath && bestPath.score / Math.max(nodePoints.length, 1) <= 120) {
            let lengths = [...bestPath.lengths];
            let inc = 0;
            let dec = 0;
            for (let i = 0; i + 1 < lengths.length; i++) {
              if (lengths[i + 1] > lengths[i]) inc++;
              if (lengths[i + 1] < lengths[i]) dec++;
            }
            const increasing = inc === dec ? lengths[lengths.length - 1] >= lengths[0] : inc > dec;
            const adjusted = [lengths[0]];
            for (let i = 1; i < lengths.length; i++) {
              let cur = lengths[i];
              const prev = adjusted[i - 1];
              if (increasing) {
                while (cur < prev) cur += bestPath.total;
              } else {
                while (cur > prev) cur -= bestPath.total;
              }
              adjusted.push(cur);
            }
            lengths = adjusted;
            const segments = lengths
              .slice(0, -1)
              .map((start, i) => ({ start, end: lengths[i + 1], distance: Math.abs(lengths[i + 1] - start) }))
              .filter((seg) => seg.distance >= 1);
            if (segments.length > 0) {
              const points: Array<{ x: number; y: number }> = [];
              for (let i = 0; i < segments.length; i++) {
                const { start, end, distance } = segments[i];
                const sign = end >= start ? 1 : -1;
                const steps = Math.max(10, Math.ceil(distance / 10));
                for (let j = 0; j <= steps; j++) {
                  if (i > 0 && j === 0) continue;
                  const t = j / steps;
                  const len = start + (end - start) * t;
                  points.push(offsetPointAtLength(bestPath.path, bestPath.total, len, sign, offset));
                }
              }
              if (points.length >= 2) {
                if (startAnchor) points[0] = startAnchor;
                if (endAnchor) points[points.length - 1] = endAnchor;
                drawOverlayPath(overlayLayer, smoothedPathData(points));
                return { start: points[0], end: points[points.length - 1] };
              }
            }
          }
          let fallbackPoints = offsetPolylinePoints(nodePoints.map((np) => np.point), offset);
          if (fallbackPoints.length < 2) return null;
          if (startAnchor) fallbackPoints[0] = startAnchor;
          if (endAnchor) fallbackPoints[fallbackPoints.length - 1] = endAnchor;
          drawOverlayPath(overlayLayer, smoothedPathData(fallbackPoints));
          return { start: fallbackPoints[0], end: fallbackPoints[fallbackPoints.length - 1] };
        }
        if (!bestPath || bestPath.score / Math.max(nodePoints.length, 1) > 180) return null;

        const inferredIncreasing = inferIncreasingDirection(run.tail, bestPath.path);
        let lengths = [...bestPath.lengths];

        if (run.ring && inferredIncreasing != null && lengths.length > 1) {
          const adjusted = [lengths[0]];
          for (let i = 1; i < lengths.length; i++) {
            let cur = lengths[i];
            const prev = adjusted[i - 1];
            if (inferredIncreasing) {
              while (cur < prev) cur += bestPath.total;
            } else {
              while (cur > prev) cur -= bestPath.total;
            }
            adjusted.push(cur);
          }
          lengths = adjusted;
        }

        if (fullRingLoop && lengths.length >= 1) {
          const start = lengths[0]!;
          const delta = inferredIncreasing === false ? -bestPath.total : bestPath.total;
          lengths = [start, start + delta];
        }
        if (lengths.length < 2) return null;
        const segments = lengths
          .slice(0, -1)
          .map((start, i) => ({ start, end: lengths[i + 1], distance: Math.abs(lengths[i + 1] - start) }))
          .filter((seg) => seg.distance >= 1);
        const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
        if (totalDistance < 1) return null;
        const points: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < segments.length; i++) {
          const { start, end, distance } = segments[i];
          const sign = end >= start ? 1 : -1;
          const steps = Math.max(10, Math.ceil(distance / 10));
          for (let j = 0; j <= steps; j++) {
            if (i > 0 && j === 0) continue;
            const t = j / steps;
            const len = start + (end - start) * t;
            points.push(offsetPointAtLength(bestPath.path, bestPath.total, len, sign, offset));
          }
        }
        if (points.length < 2) return null;
        if (startAnchor) points[0] = startAnchor;
        if (endAnchor) points[points.length - 1] = endAnchor;
        drawOverlayPath(overlayLayer, smoothedPathData(points));
        return { start: points[0], end: points[points.length - 1] };
      })();
      if (!overlayEnds) continue;
      previousOverlayEnd = overlayEnds.end;
    }

    const entrySvgId = entryName ? icNameToSvgId.get(entryName) || entryName : null;
    const exitSvgId = exitName ? icNameToSvgId.get(exitName) || exitName : null;
    const entryPoint = (entrySvgId ? pointMap.get(entrySvgId) : null) || centerOf(findSvgNode(host, entrySvgId) as SVGGraphicsElement | null) || firstProjectedPoint || null;
    const exitPoint = (exitSvgId ? pointMap.get(exitSvgId) : null) || centerOf(findSvgNode(host, exitSvgId || null) as SVGGraphicsElement | null) || lastProjectedPoint || null;
    addMarker(markerLayer, entryPoint, "#2563eb", 7);
    addMarker(markerLayer, exitPoint, "#dc2626", 7);
    for (const label of activeSpotLabels) {
      const id = PA_ID_BY_LABEL[label];
      if (id) addMarker(markerLayer, pointMap.get(id) || centerOf(findSvgNode(host, id) as SVGGraphicsElement | null), "#059669", 5);
    }
  }, [activeSpotLabels, entryName, exitName, pointMap, routeRuns, seqCsv, svgMarkup]);

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 20,
        border: "1px solid #d6d3d1",
        background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 38%, #f5f7fb 100%)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {headerAction ? <div>{headerAction}</div> : null}
          <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
        </div>
      </div>

      {toolbar ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 14,
            background: "rgba(255,255,255,0.78)",
            border: "1px solid #e7e5e4",
          }}
        >
          {toolbar}
        </div>
      ) : null}

      {svgMarkup ? (
        <div
          ref={hostRef}
          style={{
            width: "100%",
            lineHeight: 0,
          }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      ) : (
        <div style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>route SVG を読み込み中です。</div>
      )}
    </div>
  );
}
