"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ShutokoMapProps = {
  entryName: string | null;
  exitName?: string;
  activeSpotLabels?: string[];
  highlightedPath?: string[];
  title?: string;
  headerAction?: ReactNode;
  toolbar?: ReactNode;
};

// --- 定数 ---

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

// SVG上のJCT IDとCSV上のJCT名の表記ゆれを吸収
const JCT_ID_ALIASES: Record<string, string> = {
  NishiShinjukuJCT: "NishishinjukuJCT",
  KawasakiUkishimaJCT: "KawasakiukishimaJCT",
  HonmokuJCT: "HonmakiJCT",
  RyogokuJCT: "RyougokuJCT",
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
  "みなとみらい": "ic_minatomirai",
  "横浜駅東口": "ic_yokohamaekihigashiguchi",
  "東神奈川": "ic_higashikanagawa",
  "子安": "ic_koyasu",
  "守屋町": "ic_moriyacho",
  "横浜公園": "ic_yokohamakoen",
  "山下町": "ic_yamashitacho",
  "新山下": "ic_shinyamashita",
  "南本牧ふ頭": "ic_minamihonmokufuto",
  "南本牧埠頭": "ic_minamihonmokufuto",
  "本牧ふ頭": "ic_honmokufuto",
  "大黒ふ頭": "ic_daikokufuto",
  "東扇島": "ic_higashioogishima",
  "浮島": "ic_ukishima",
  "空港中央": "ic_kukouchuo",
  "さいたま見沼": "ic_saitamaminuma",
  "新都心": "ic_shintoshin",
  "新都心西": "ic_shintoshinnishi",
  "与野": "ic_yono",
  "浦和北": "ic_urawakita",
  "浦和南": "ic_urawaminami",
};

// tail → SVGのルートグループID（複数パスを持つ場合もあり）
const TAIL_TO_ROUTE_IDS: Record<string, string[]> = {
  C1_CW: ["route_C1"],
  C1_CCW: ["route_C1"],
  C2_CW: ["route_C2"],
  C2_CCW: ["route_C2"],
  BAY_E: ["route_BAY"],
  BAY_W: ["route_BAY"],
  BAYX_E: ["route_BAYX"],
  BAYX_W: ["route_BAYX"],
  R1H_UP: ["route_R1H"],
  R1H_DOWN: ["route_R1H"],
  R1U_UP: ["route_R1U"],
  R1U_DOWN: ["route_R1U"],
  R2A_UP: ["route_R2", "route_R2_Togoshi"],
  R2A_DOWN: ["route_R2", "route_R2_Togoshi"],
  R2B_UP: ["route_R2", "route_R2_Togoshi"],
  R2B_DOWN: ["route_R2", "route_R2_Togoshi"],
  R3A_UP: ["route_R3A"],
  R3A_DOWN: ["route_R3A"],
  R3B_UP: ["route_R3B"],
  R3B_DOWN: ["route_R3B"],
  R4A_UP: ["route_R4A"],
  R4A_DOWN: ["route_R4A"],
  R4B_UP: ["route_R4B"],
  R4B_DOWN: ["route_R4B"],
  R5A_UP: ["route_R5A"],
  R5A_DOWN: ["route_R5A"],
  R5B_UP: ["route_R5B"],
  R5B_DOWN: ["route_R5B"],
  R6A_UP: ["route_R6A"],
  R6A_DOWN: ["route_R6A"],
  R6B_UP: ["route_R6B"],
  R6B_DOWN: ["route_R6B"],
  R7A_UP: ["route_R7A"],
  R7A_DOWN: ["route_R7A"],
  R7B_UP: ["route_R7B"],
  R7B_DOWN: ["route_R7B"],
  R9_UP: ["route_R9"],
  R9_DOWN: ["route_R9"],
  R10_UP: ["route_R10"],
  R10_DOWN: ["route_R10"],
  R11_UP: ["route_R11"],
  R11_DOWN: ["route_R11"],
  K1_UP: ["route_K1"],
  K1_DOWN: ["route_K1"],
  K2_UP: ["route_K2"],
  K2_DOWN: ["route_K2"],
  K3_UP: ["route_K3"],
  K3_DOWN: ["route_K3"],
  K5_UP: ["route_K5"],
  K5_DOWN: ["route_K5"],
  K6_UP: ["route_K6"],
  K6_DOWN: ["route_K6"],
  K7_UP: ["route_K7"],
  K7_DOWN: ["route_K7"],
  S1_UP: ["route_S1"],
  S1_DOWN: ["route_S1"],
  S2_UP: ["Route_S2", "Route_S2_2"],
  S2_DOWN: ["Route_S2", "Route_S2_2"],
  S5_UP: ["Route_S5", "Route_S5_2"],
  S5_DOWN: ["Route_S5", "Route_S5_2"],
};

// リング路線かどうか
const RING_TAILS = new Set(["C1_CW", "C1_CCW", "C2_CW", "C2_CCW"]);

// --- ユーティリティ ---

function publicAsset(path: string) {
  return `${BASE_PATH}${path}`;
}

function normalizeIcName(name: string) {
  return name.trim().replace(/埠頭/g, "ふ頭");
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

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

/** ルートノード文字列からtailを取り出す */
function tailOfNode(node: string) {
  if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
    const parts = node.split(":");
    return parts[parts.length - 1] || "";
  }
  const idx = node.indexOf(":");
  return idx >= 0 ? node.slice(idx + 1) : node;
}

/** tailからルートグループIDリストを返す */
function routeIdsOfTail(tail: string): string[] | null {
  return TAIL_TO_ROUTE_IDS[tail] || null;
}

/** ルートノードからSVGノードIDを返す */
function svgNodeIdOfPathNode(node: string): string | null {
  if (PA_ID_BY_NODE[node]) return PA_ID_BY_NODE[node] ?? null;
  if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
    return node.split(":")[1] || null;
  }
  if (node.includes(":")) {
    return node.split(":")[0] || null;
  }
  return node || null;
}

/** SVGノードIDのエイリアス解決 */
function resolveJctId(rawId: string): string {
  return JCT_ID_ALIASES[rawId] || rawId;
}

// --- SVGパース ---

/** SVGのcircle/ellipseから id→座標 マップを作る */
function parseSvgPointMap(svgMarkup: string): Map<string, { x: number; y: number }> {
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
    return { x: a! * x + c! * y + e!, y: b! * x + d! * y + f! };
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
    }
  }
  return map;
}

// --- CSV パース ---

function parseSeqCsv(csvText: string): Map<string, string[]> {
  const lines = csvText.split(/\r?\n/).filter((l) => l && !l.trim().startsWith("#"));
  if (lines.length === 0) return new Map();
  const header = lines[0]!.split(",");
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
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { cols.push(cur); cur = ""; }
      else cur += ch;
    }
    cols.push(cur);
    const route = (cols[routeIdx] || "").trim();
    const dir = (cols[dirIdx] || "").trim();
    const stopsRaw = (cols[stopsIdx] || "").trim();
    if (!route || !dir || !stopsRaw) continue;
    const tail = `${route}_${dir}`;
    const stops = stopsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    map.set(tail, stops);
  }
  return map;
}

// --- DOM ヘルパー ---

function findElement(host: Element, rawId: string): SVGElement | null {
  const resolved = resolveJctId(rawId);
  for (const id of uniq([rawId, resolved])) {
    const el = host.querySelector<SVGElement>(`[id="${CSS.escape(id)}"]`);
    if (el) return el;
  }
  return null;
}

function centerOf(el: SVGGraphicsElement | null): { x: number; y: number } | null {
  if (!el) return null;
  try {
    const box = el.getBBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  } catch {
    return null;
  }
}

/** IC名→SVG要素の中心座標を解決する */
function resolveIcPoint(
  icName: string,
  host: Element,
  pointMap: Map<string, { x: number; y: number }>
): { x: number; y: number } | null {
  const normalized = normalizeIcName(icName);
  // 直接オーバーライド
  const overrideId = IC_NAME_ID_OVERRIDES[icName] || IC_NAME_ID_OVERRIDES[normalized];
  if (overrideId) {
    const el = findElement(host, overrideId);
    const c = centerOf(el as SVGGraphicsElement | null);
    if (c) return c;
    const pm = pointMap.get(overrideId);
    if (pm) return pm;
  }
  // ic_ プレフィックス付きで探す
  const guessId = `ic_${icName}`;
  const el2 = findElement(host, guessId);
  const c2 = centerOf(el2 as SVGGraphicsElement | null);
  if (c2) return c2;
  // pointMap から直接
  return pointMap.get(icName) || pointMap.get(normalized) || null;
}

/** JCT名→SVG要素の中心座標を解決する */
function resolveJctPoint(
  jctId: string,
  host: Element,
  pointMap: Map<string, { x: number; y: number }>
): { x: number; y: number } | null {
  const resolved = resolveJctId(jctId);
  for (const id of uniq([jctId, resolved])) {
    const el = findElement(host, id);
    const c = centerOf(el as SVGGraphicsElement | null);
    if (c) return c;
    const pm = pointMap.get(id);
    if (pm) return pm;
  }
  return null;
}

/** stopトークン→座標 */
function resolveStopPoint(
  stop: string,
  host: Element,
  pointMap: Map<string, { x: number; y: number }>
): { x: number; y: number } | null {
  // IC:xxx 形式
  if (stop.startsWith("IC:")) {
    return resolveIcPoint(stop.slice(3).trim(), host, pointMap);
  }
  // PA
  if (PA_ID_BY_NODE[stop]) {
    const paId = PA_ID_BY_NODE[stop]!;
    return pointMap.get(paId) || null;
  }
  // helper node（辰巳ルートの補助ノード）
  if (/^TatsumiR9UpAfterPA/.test(stop)) return null;
  // JCT
  return resolveJctPoint(stop, host, pointMap);
}

function addLayer(rootSvg: SVGSVGElement, className: string): SVGGElement {
  rootSvg.querySelectorAll(`.${className}`).forEach((el) => el.remove());
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("class", className);
  rootSvg.appendChild(layer);
  return layer;
}

function addMarker(
  layer: SVGGElement,
  point: { x: number; y: number } | null,
  fill: string,
  radius: number
) {
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

function drawPath(layer: SVGGElement, d: string) {
  if (!d) return;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#2FFF00");
  path.setAttribute("stroke-width", "5.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("opacity", "0.98");
  path.style.filter = "drop-shadow(0 0 4px rgba(47,255,0,0.42))";
  layer.appendChild(path);
}

// --- パス上への投影（最近傍点の距離を返すだけ） ---

function nearestLengthOnPath(
  path: SVGPathElement,
  x: number,
  y: number
): { length: number; dist: number } {
  const total = path.getTotalLength();
  const samples = Math.max(300, Math.ceil(total / 1.5));
  let bestLen = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= samples; i++) {
    const len = (total * i) / samples;
    const pt = path.getPointAtLength(len);
    const d = Math.hypot(pt.x - x, pt.y - y);
    if (d < bestDist) { bestDist = d; bestLen = len; }
  }
  // 二分精細化
  let step = total / samples;
  while (step > 0.3) {
    for (const l of [Math.max(0, bestLen - step), bestLen, Math.min(total, bestLen + step)]) {
      const pt = path.getPointAtLength(l);
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d < bestDist) { bestDist = d; bestLen = l; }
    }
    step *= 0.5;
  }
  return { length: bestLen, dist: bestDist };
}

/** オフセット付きのパス上の点を返す（左側通行: offset>0 で進行方向左） */
function offsetPointAt(
  routePath: SVGPathElement,
  total: number,
  len: number,
  sign: number, // +1 or -1 (進行方向)
  offset: number
): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(total, len));
  const pt = routePath.getPointAtLength(clamped);
  const step = Math.max(total / 1000, 1);
  const probeLen = Math.max(0, Math.min(total, clamped + sign * step));
  const probe = routePath.getPointAtLength(probeLen);
  let dx = probe.x - pt.x;
  let dy = probe.y - pt.y;
  const mag = Math.hypot(dx, dy) || 1;
  dx /= mag; dy /= mag;
  // 左側通行: 進行方向の左 = 法線ベクトル (dy, -dx) を offset 方向に
  return { x: pt.x + dy * offset, y: pt.y + (-dx) * offset };
}

function pointsToPathData(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i]!.x.toFixed(2)} ${points[i]!.y.toFixed(2)}`;
  }
  return d;
}

// =============================================================================
// メイン描画ロジック
// =============================================================================

/**
 * CSVのstop順インデックス比率でパス長を直接決定し、ハイライトを描画する。
 * ICへの「投影距離の推定」は一切行わない。
 */
function drawHighlight(
  host: Element,
  rootSvg: SVGSVGElement,
  highlightedPath: string[],
  seqMap: Map<string, string[]>,
  pointMap: Map<string, { x: number; y: number }>,
  entryName: string | null,
  exitName: string | undefined,
  activeSpotLabels: string[],
  overlayLayer: SVGGElement,
  markerLayer: SVGGElement
) {
  const OFFSET = 3.5; // 左側通行オフセット（px）

  // --- ルートノード列をrunに分割 ---
  type Run = {
    tail: string;
    routeIds: string[];
    isRing: boolean;
    rawNodes: string[]; // 元のノード列
  };
  const runs: Run[] = [];
  let cur: Run | null = null;

  for (const node of highlightedPath) {
    const tail = tailOfNode(node);
    const routeIds = routeIdsOfTail(tail);
    if (!routeIds) {
      // JCT/PA等の無tailノード → 直前のrunに付加するだけ
      if (cur) cur.rawNodes.push(node);
      continue;
    }
    if (!cur || cur.tail !== tail) {
      if (cur) runs.push(cur);
      cur = { tail, routeIds, isRing: RING_TAILS.has(tail), rawNodes: [] };
    }
    cur.rawNodes.push(node);
  }
  if (cur) runs.push(cur);

  // --- 各runの「開始stop」「終了stop」をCSVのstopリストから特定する ---
  // CSVのstop列には IC:xxx 形式と JCT名が混在。
  // rawNodesからstopトークンを取り出してCSVで検索する。

  const stopTokenOfNode = (node: string): string | null => {
    if (node.startsWith("ICIN:") || node.startsWith("ICOUT:") || node.startsWith("IC:")) {
      const parts = node.split(":");
      return parts[1] ? `IC:${parts[1]}` : null;
    }
    if (PA_ID_BY_NODE[node]) return null; // PAはCSVで別扱い
    if (/^TatsumiR9UpAfterPA/.test(node)) return node; // helper node
    if (node.includes(":")) return node.split(":")[0] || null;
    // JCT
    return node || null;
  };

  let prevRunEndPoint: { x: number; y: number } | null = null;

  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri]!;
    const csvStops = seqMap.get(run.tail) || [];
    if (csvStops.length === 0) continue;

    // stopIndexMapを作る（CSV上の位置）
    const stopIndexMap = new Map<string, number>();
    csvStops.forEach((s, i) => { if (!stopIndexMap.has(s)) stopIndexMap.set(s, i); });

    // rawNodesからCSV上のインデックスを収集
    const nodeIndices: Array<{ node: string; idx: number }> = [];
    for (const node of run.rawNodes) {
      const token = stopTokenOfNode(node);
      if (!token) continue;
      const idx = stopIndexMap.get(token);
      if (idx != null) nodeIndices.push({ node, idx });
    }

    if (nodeIndices.length < 2 && !run.isRing) continue;

    // 最初と最後のCSVインデックス
    const firstIdx = nodeIndices[0]?.idx ?? 0;
    const lastIdx = nodeIndices[nodeIndices.length - 1]?.idx ?? (csvStops.length - 1);

    // ルートパスを取得
    const routePaths: SVGPathElement[] = run.routeIds
      .flatMap((id) => Array.from(host.querySelectorAll<SVGPathElement>(`#${CSS.escape(id)} path`)))
      .filter(Boolean);

    if (routePaths.length === 0) continue;

    // 最適なルートパスを選ぶ（既知のJCT点が最も近いもの）
    let bestPath = routePaths[0]!;
    if (routePaths.length > 1) {
      // 最初のstopの座標でスコアリング
      const firstStop = csvStops[firstIdx];
      if (firstStop) {
        const pt = resolveStopPoint(firstStop, host, pointMap);
        if (pt) {
          let bestScore = Infinity;
          for (const rp of routePaths) {
            const near = nearestLengthOnPath(rp, pt.x, pt.y);
            if (near.dist < bestScore) { bestScore = near.dist; bestPath = rp; }
          }
        }
      }
    }

    const total = bestPath.getTotalLength();

    // --- CSVのstopをパス上に投影してインデックス→長さのマップを作る ---
    // 全stopについて nearestLength を計算し、単調になるよう調整する
    const stopLengths: number[] = new Array(csvStops.length).fill(-1);
    for (let i = 0; i < csvStops.length; i++) {
      const stop = csvStops[i]!;
      const pt = resolveStopPoint(stop, host, pointMap);
      if (!pt) continue;
      stopLengths[i] = nearestLengthOnPath(bestPath, pt.x, pt.y).length;
    }

    // 有効な長さのみで単調性を推定（CW/CCW/UP/DOWN）
    const validLengths = stopLengths.filter((l) => l >= 0);
    let increasing = true;
    if (validLengths.length >= 2) {
      let inc = 0, dec = 0;
      for (let i = 0; i + 1 < validLengths.length; i++) {
        if (validLengths[i + 1]! > validLengths[i]!) inc++;
        else if (validLengths[i + 1]! < validLengths[i]!) dec++;
      }
      increasing = inc >= dec;
    }

    // 単調になるよう長さを補正（リングパスの折り返しを考慮）
    const adjustedLengths: number[] = [];
    let lastValid = -1;
    for (let i = 0; i < csvStops.length; i++) {
      let len = stopLengths[i]!;
      if (len < 0) { adjustedLengths.push(-1); continue; }
      if (lastValid >= 0) {
        if (increasing) { while (len < adjustedLengths[lastValid]!) len += total; }
        else { while (len > adjustedLengths[lastValid]!) len -= total; }
      }
      adjustedLengths.push(len);
      lastValid = i;
    }

    // firstIdx, lastIdx の長さを取得（-1なら補間で求める）
    const findLength = (idx: number): number | null => {
      if (adjustedLengths[idx] !== undefined && adjustedLengths[idx]! >= 0) {
        return adjustedLengths[idx]!;
      }
      // 前後の有効値から線形補間
      let before = -1, beforeIdx = -1, after = -1, afterIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (adjustedLengths[i]! >= 0) { before = adjustedLengths[i]!; beforeIdx = i; break; }
      }
      for (let i = idx + 1; i < adjustedLengths.length; i++) {
        if (adjustedLengths[i]! >= 0) { after = adjustedLengths[i]!; afterIdx = i; break; }
      }
      if (before >= 0 && after >= 0 && afterIdx !== beforeIdx) {
        const t = (idx - beforeIdx) / (afterIdx - beforeIdx);
        return before + (after - before) * t;
      }
      if (before >= 0) return before;
      if (after >= 0) return after;
      return null;
    };

    let startLen = findLength(firstIdx);
    let endLen = findLength(lastIdx);

    // リングで1周する場合
    if (run.isRing && firstIdx === lastIdx) {
      endLen = (startLen ?? 0) + (increasing ? total : -total);
    }

    if (startLen == null || endLen == null) continue;

    // 進行方向
    const sign = endLen >= startLen ? 1 : -1;
    const distance = Math.abs(endLen - startLen);
    if (distance < 1) continue;

    // サンプル点を生成してオフセット線を描く
    const steps = Math.max(20, Math.ceil(distance / 8));
    const points: Array<{ x: number; y: number }> = [];
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const len = startLen + (endLen - startLen) * t;
      points.push(offsetPointAt(bestPath, total, len, sign, OFFSET));
    }

    if (points.length < 2) continue;

    // run間の接続：前のrunの終点と現在の始点をつなぐ
    if (prevRunEndPoint) {
      const gap = Math.hypot(
        points[0]!.x - prevRunEndPoint.x,
        points[0]!.y - prevRunEndPoint.y
      );
      if (gap > 2 && gap < 80) {
        // 短いギャップは直線でつなぐ
        drawPath(overlayLayer, pointsToPathData([prevRunEndPoint, points[0]!]));
      }
    }

    drawPath(overlayLayer, pointsToPathData(points));
    prevRunEndPoint = points[points.length - 1]!;
  }

  // --- マーカー描画 ---
  const resolveEntryExit = (name: string | null | undefined): { x: number; y: number } | null => {
    if (!name) return null;
    return (
      resolveIcPoint(name, host, pointMap) ||
      resolveJctPoint(name, host, pointMap) ||
      null
    );
  };

  addMarker(markerLayer, resolveEntryExit(entryName), "#2563eb", 7);
  addMarker(markerLayer, resolveEntryExit(exitName), "#dc2626", 7);
  for (const label of activeSpotLabels) {
    const id = PA_ID_BY_LABEL[label];
    if (id) addMarker(markerLayer, pointMap.get(id) || null, "#059669", 5);
  }
}

// =============================================================================
// Reactコンポーネント
// =============================================================================

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

  const pointMap = useMemo(() => parseSvgPointMap(svgMarkup), [svgMarkup]);
  const seqMap = useMemo(() => parseSeqCsv(seqCsv), [seqCsv]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !svgMarkup || !seqCsv) return;

    const rootSvg = host.querySelector<SVGSVGElement>("svg");
    if (!rootSvg) return;
    rootSvg.style.width = "100%";
    rootSvg.style.height = "auto";
    rootSvg.style.display = "block";

    const overlayLayer = addLayer(rootSvg, "route-overlay-layer");
    const markerLayer = addLayer(rootSvg, "route-marker-layer");

    drawHighlight(
      host,
      rootSvg,
      highlightedPath,
      seqMap,
      pointMap,
      entryName,
      exitName,
      activeSpotLabels,
      overlayLayer,
      markerLayer
    );
  }, [svgMarkup, seqCsv, seqMap, pointMap, highlightedPath, entryName, exitName, activeSpotLabels]);

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
          style={{ width: "100%", lineHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      ) : (
        <div style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>route SVG を読み込み中です。</div>
      )}
    </div>
  );
}
