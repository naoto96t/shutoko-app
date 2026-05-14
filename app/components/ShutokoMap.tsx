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
  "一ツ橋": "ic_hitotsubashi",
  "代官町": "ic_daikancho",
  "北の丸": "ic_kitanomaru",
  "神田橋": "ic_kandabashi",
  "西神田": "ic_nishikanda",
  "飯田橋": "ic_iidabashi",
  "早稲田": "ic_waseda",
  "護国寺": "ic_gokokuzi",
  "東池袋": "ic_higashiikebukuro",
  "北池袋": "ic_kitaikebukuro",
  "板橋本町": "ic_itabashihoncho",
  "中台": "ic_nakadai",
  "高島平": "ic_takashimadaira",
  "戸田南": "ic_todaminami",
  "戸田": "ic_toda",
  "鹿浜橋": "ic_shikahamabashi",
  "東領家": "ic_higashiryoke",
  "加賀": "ic_kaga",
  "足立入谷": "ic_adachiiriya",
  "新郷": "ic_shingo",
  "安行": "ic_angyo",
  "新井宿": "ic_araijuku",
  "三郷": "ic_misato",
  "五反田": "ic_gotanda",
  "大井南": "ic_ooiminami",
  "中環大井南": "ic_ooiminami",
  "富ヶ谷": "ic_tomigaya",
  "初台": "ic_hatsudai",
  "初台南": "ic_hatsudaiminami",
  "新宿": "ic_shinjuku",
  "代々木": "ic_yoyogi",
  "中野長者橋": "ic_nakanochozyabashi",
  "西池袋": "ic_nishiikebukuro",
  "高松": "ic_takamatsu",
  "新板橋": "ic_shinitabashi",
  "滝野川": "ic_takinogawa",
  "王子南": "ic_ouziminami",
  "王子北": "ic_ouzikita",
  "扇大橋": "ic_ougioohashi",
  "小菅": "ic_kosuge",
  "四つ木": "ic_yotsugi",
  "平井大橋": "ic_hiraioohashi",
  "中環小松川": "ic_cyukankomatsugawa",
  "船堀橋": "ic_funaboribashi",
  "清新町": "ic_seishincho",
  "葛西": "ic_kasai",
  "新木場": "ic_shinkiba",
  "有明": "ic_ariake",
  "臨海副都心": "ic_rinkaifukutoshin",
  "大井": "ic_ooi",
  "湾岸環八": "ic_wangankanpachi",
  "羽田": "ic_haneda",
  "平和島": "ic_heiwajima",
  "鈴ヶ森": "ic_suzugamori",
  "勝島": "ic_katsushima",
  "芝浦": "ic_shibaura",
  "台場": "ic_daiba",
  "豊洲": "ic_toyosu",
  "晴海": "ic_harumi",
  "千鳥町": "ic_chidoricho",
  "浦安": "ic_urayasu",
  "舞浜": "ic_maihama",
  "箱崎": "ic_hakozaki",
  "枝川": "ic_edagawa",
  "塩浜": "ic_shiohama",
  "木場": "ic_kiba",
  "福住": "ic_fukuzumi",
  "浜町": "ic_hamacho",
  "清洲橋": "ic_kiyosubashi",
  "駒形": "ic_komagata",
  "入谷": "ic_iriya",
  "上野": "ic_ueno",
  "本町": "ic_honmachi",
  "錦糸町": "ic_kinshicho",
  "小松川": "ic_komatsugawa",
  "一之江": "ic_ichinoe",
  "高樹町": "ic_takagicho",
  "渋谷": "ic_shibuya",
  "池尻": "ic_ikeziri",
  "三軒茶屋": "ic_sangenjaya",
  "用賀": "ic_yoga",
  "天現寺": "ic_tengenzi",
  "目黒": "ic_meguro",
  "荏原": "ic_ebara",
  "戸越": "ic_togoshi",
  "芝公園": "ic_shibakoen",
  "飯倉": "ic_iikura",
  "霞が関": "ic_kasumigaseki",
  "外苑": "ic_gaien",
  "幡ヶ谷": "ic_hatagaya",
  "永福": "ic_eifuku",
  "高井戸": "ic_takaido",
  "大師": "ic_daishi",
  "浜川崎": "ic_hamakawasaki",
  "浅田": "ic_asada",
  "汐入": "ic_shioiri",
  "生麦": "ic_namamugi",
  "岸谷生麦": "ic_kishiyanamamugi",
  "馬場": "ic_baba",
  "新横浜": "ic_shinyokohama",
  "横浜港北": "ic_yokohamakouhoku",
  "横浜青葉": "ic_yokohamaaoba",
  "殿町": "ic_Tonomachi",
  "石川町": "ic_ishikawacho",
  "阪東橋": "ic_bandoubashi",
  "花之木": "ic_hananoki",
  "永田": "ic_nagata",
  "みなとみらい": "ic_minatomirai",
  "横浜駅東口": "ic_yokohamaekihigashiguchi",
  "横浜駅西口": "ic_yokohamaekinishiguchi",
  "三ツ沢": "ic_mitsuzawa",
  "東神奈川": "ic_higashikanagawa",
  "子安": "ic_koyasu",
  "守屋町": "ic_moriyacho",
  "横浜公園": "ic_yokohamakoen",
  "山下町": "ic_yamashitacho",
  "新山下": "ic_shinyamashita",
  "南本牧ふ頭": "ic_minamihonmokufuto",
  "南本牧埠頭": "ic_minamihonmokufuto",
  "本牧ふ頭": "ic_honmokufuto",
  "三溪園": "ic_sankeien",
  "磯子": "ic_isogo",
  "杉田": "ic_sugita",
  "幸浦": "ic_sachiura",
  "大黒ふ頭": "ic_daikokufuto",
  "東扇島": "ic_higashioogishima",
  "浮島": "ic_ukishima",
  "空港西": "ic_kukounishi",
  "空港中央": "ic_kukouchuo",
  "汐留": "ic_shiodome",
  "銀座": "ic_ginza",
  "東銀座": "ic_higashiginza",
  "新富町": "ic_shintomicho",
  "京橋": "ic_kyobashi",
  "宝町": "ic_takaracho",
  "さいたま見沼": "ic_saitamaminuma",
  "新都心": "ic_shintoshin",
  "新都心西": "ic_shintoshinnishi",
  "与野": "ic_yono",
  "浦和北": "ic_urawakita",
  "浦和南": "ic_urawaminami",
};

// tail → SVGのルートグループID（複数パスを持つ場合もあり）
const TAIL_TO_ROUTE_IDS: Record<string, string[]> = {
  C1_CW: ["route_C1_CW"],
  C1_CCW: ["route_C1_CCW"],
  C2_CW: ["route_C2_CW"],
  C2_CCW: ["route_C2_CCW"],
  BAY_E: ["route_BAY_E"],
  BAY_W: ["route_BAY_W"],
  BAYX_E: ["route_BAYX_E"],
  BAYX_W: ["route_BAYX_W"],
  R1H_UP: ["route_R1H_UP"],
  R1H_DOWN: ["route_R1H_DOWN"],
  R1U_UP: ["route_R1U_UP"],
  R1U_DOWN: ["route_R1U_DOWN"],
  R2_UP: ["route_R2_UP"],
  R2_DOWN: ["route_R2_DOWN"],
  R2_Togoshi_UP: ["route_R2_Togoshi_UP", "route_R2_UP"],
  R2_Togoshi_DOWN: ["route_R2_Togoshi_DOWN", "route_R2_DOWN"],
  R3A_UP: ["route_R3A_UP"],
  R3A_DOWN: ["route_R3A_DOWN"],
  R3B_UP: ["route_R3B_UP"],
  R3B_DOWN: ["route_R3B_DOWN"],
  R4A_UP: ["route_R4A_UP"],
  R4A_DOWN: ["route_R4A_DOWN"],
  R4B_UP: ["route_R4B_UP"],
  R4B_DOWN: ["route_R4B_DOWN"],
  R5A_UP: ["route_R5A_UP"],
  R5A_DOWN: ["route_R5A_DOWN"],
  R5B_UP: ["route_R5B_UP"],
  R5B_DOWN: ["route_R5B_DOWN"],
  R6A_UP: ["route_R6A_UP"],
  R6A_DOWN: ["route_R6A_DOWN"],
  R6B_UP: ["route_R6B_UP"],
  R6B_DOWN: ["route_R6B_DOWN"],
  R7A_UP: ["route_R7A_UP"],
  R7A_DOWN: ["route_R7A_DOWN"],
  R7B_UP: ["route_R7B_UP"],
  R7B_DOWN: ["route_R7B_DOWN"],
  R9_UP: ["route_R9_UP"],
  R9_DOWN: ["route_R9_DOWN"],
  R10_UP: ["route_R10_UP"],
  R10_DOWN: ["route_R10_DOWN"],
  R11_UP: ["route_R11_UP"],
  R11_DOWN: ["route_R11_DOWN"],
  D8_DOWN: ["route_D8_DOWN", "route_D8_down"],
  K1_UP: ["route_K1_UP"],
  K1_DOWN: ["route_K1_DOWN"],
  K2_UP: ["route_K2_UP"],
  K2_DOWN: ["route_K2_DOWN"],
  K3_UP: ["route_K3_UP"],
  K3_DOWN: ["route_K3_DOWN"],
  K5_UP: ["route_K5_UP"],
  K5_DOWN: ["route_K5_DOWN"],
  K6_UP: ["route_K6_UP"],
  K6_DOWN: ["route_K6_DOWN"],
  K7_UP: ["route_K7_UP"],
  K7_DOWN: ["route_K7_DOWN"],
  S1_UP: ["route_S1_UP"],
  S1_DOWN: ["route_S1_DOWN"],
  S2_UP: ["Route_S2_UP"],
  S2_DOWN: ["Route_S2_DOWN"],
  S5_UP: ["Route_S5_UP"],
  S5_DOWN: ["Route_S5_DOWN"],
};

// リング路線かどうか
const RING_TAILS = new Set(["C1_CW", "C1_CCW", "C2_CW", "C2_CCW"]);

// --- ユーティリティ ---

function publicAsset(path: string) {
  const activeBase =
    BASE_PATH && (typeof window === "undefined" || window.location.pathname.startsWith(BASE_PATH))
      ? BASE_PATH
      : "";
  return `${activeBase}${path}`;
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

function routeBaseOfTail(tail: string) {
  return tail.replace(/_(UP|DOWN|CW|CCW|E|W)$/, "");
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
  const routeIds = TAIL_TO_ROUTE_IDS[tail];
  if (!routeIds) return null;
  const base = routeBaseOfTail(tail);
  if (base === "C1") return routeIds;
  const fallbackIds = base.startsWith("S")
    ? [`Route_${base}`, `Route_${base}_2`, `route_${base}`]
    : [`route_${base}`, `Route_${base}`];
  return uniq([...routeIds, ...fallbackIds]);
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

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\#.;:[\],>+~*^$|=()\s]/g, "\\$&");
}

function svgElementCenter(host: Element, id: string): { x: number; y: number } | null {
  const el = host.querySelector<SVGGraphicsElement>(`#${cssEscape(id)}`);
  if (!el || typeof el.getBBox !== "function") return null;
  try {
    const box = el.getBBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  } catch {
    return null;
  }
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

function routePathsById(host: Element, id: string): { id: string; path: SVGPathElement }[] {
  const escaped = CSS.escape(id);
  const paths = new Set<SVGPathElement>();
  const direct = host.querySelector<SVGPathElement>(`path#${escaped}`);
  if (direct) paths.add(direct);
  host.querySelectorAll<SVGPathElement>(`#${escaped} path`).forEach((path) => paths.add(path));
  return Array.from(paths).map((path) => ({ id, path }));
}

function addMarker(
  layer: SVGGElement,
  point: { x: number; y: number } | null,
  fill: string,
  radius: number,
  label?: string
) {
  if (!point) return;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.style.filter = "drop-shadow(0 1px 3px rgba(15,23,42,0.38))";
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", `${point.x}`);
  circle.setAttribute("cy", `${point.y}`);
  circle.setAttribute("r", `${radius}`);
  circle.setAttribute("fill", fill);
  circle.setAttribute("stroke", "white");
  circle.setAttribute("stroke-width", "3");
  group.appendChild(circle);
  if (label) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", `${point.x}`);
    text.setAttribute("y", `${point.y + 0.8}`);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "white");
    text.setAttribute("font-size", `${Math.max(7, radius * 1.15)}`);
    text.setAttribute("font-weight", "800");
    text.textContent = label;
    group.appendChild(text);
  }
  layer.appendChild(group);
}

function drawPath(layer: SVGGElement, d: string, strokeWidth = 4.8) {
  if (!d) return;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#2FFF00");
  path.setAttribute("stroke-width", `${strokeWidth}`);
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
  const RING_STROKE_WIDTH = 4.6;
  const FALLBACK_ROUTE_OFFSET = 3.5;

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

  const isK1R1HShowajimaSwitch = (node: string, tailPrefix: "K1_" | "R1H_") => (
    node.startsWith("ShowajimaJCT:") && tailOfNode(node).startsWith(tailPrefix)
  );

  const namedStopOfNode = (node: string): string | null => {
    const token = stopTokenOfNode(node);
    if (token) return token;
    const id = svgNodeIdOfPathNode(node);
    if (!id || PA_ID_BY_NODE[node]) return null;
    return id;
  };

  const transitionStopBetweenRuns = (prevRun: Run, nextRun: Run): string | null => {
    const prevNodes = prevRun.rawNodes.slice(-4).reverse();
    const nextNodes = nextRun.rawNodes.slice(0, 4);
    for (const a of prevNodes) {
      const aStop = namedStopOfNode(a);
      if (!aStop) continue;
      for (const b of nextNodes) {
        const bStop = namedStopOfNode(b);
        if (aStop && bStop && aStop === bStop) return aStop;
      }
    }
    return null;
  };

  let prevRunEndPoint: { x: number; y: number } | null = null;
  let prevRunEndStop: string | null = null;
  let prevRenderedRun: Run | null = null;

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
    if (
      run.tail === "R9_UP" &&
      nodeIndices.length === 1 &&
      run.rawNodes.some((node) => node === "EdobashiJCT:R9_UP")
    ) {
      const startIdx = stopIndexMap.get("TatsumiJCT");
      if (startIdx != null) nodeIndices.unshift({ node: "TatsumiJCT:R9_UP", idx: startIdx });
    }

    if (nodeIndices.length < 2 && !run.isRing) continue;

    // 最初と最後のCSVインデックス
    let firstIdx = nodeIndices[0]?.idx ?? 0;
    let lastIdx = nodeIndices[nodeIndices.length - 1]?.idx ?? (csvStops.length - 1);
    const hanedaSwitchIdx = stopIndexMap.get("haneda_switchJCT");
    if (hanedaSwitchIdx != null) {
      const firstNode = run.rawNodes[0] || "";
      const lastNode = run.rawNodes[run.rawNodes.length - 1] || "";
      const prevRun = runs[ri - 1];
      const nextRun = runs[ri + 1];
      if (isK1R1HShowajimaSwitch(firstNode, "K1_")) firstIdx = hanedaSwitchIdx;
      if (isK1R1HShowajimaSwitch(lastNode, "K1_")) lastIdx = hanedaSwitchIdx;
      if (prevRun?.tail.startsWith("K1_") && isK1R1HShowajimaSwitch(firstNode, "R1H_")) firstIdx = hanedaSwitchIdx;
      if (nextRun?.tail.startsWith("K1_") && isK1R1HShowajimaSwitch(lastNode, "R1H_")) lastIdx = hanedaSwitchIdx;
    }
    const startStop = csvStops[firstIdx] || null;
    const endStop = csvStops[lastIdx] || null;

    // ルートパスを取得
    const routePathOptions = run.routeIds
      .flatMap((id) => routePathsById(host, id))
      .filter(({ path }) => Boolean(path));

    if (routePathOptions.length === 0) continue;

    // 最適なルートパスを選ぶ（runの始点/終点に近いもの）。
    // shutoko4 の方向別pathは一部が短い断片なので、同じ路線の基本pathも候補に入れてここで選別する。
    let bestOption = routePathOptions[0]!;
    if (routePathOptions.length > 1) {
      const startPt = startStop ? resolveStopPoint(startStop, host, pointMap) : null;
      const endPt = endStop ? resolveStopPoint(endStop, host, pointMap) : null;
      let bestScore = Infinity;
      for (const option of routePathOptions) {
        const rp = option.path;
        let score = 0;
        let projected = 0;
        if (startPt) {
          score += nearestLengthOnPath(rp, startPt.x, startPt.y).dist;
          projected++;
        }
        if (endPt) {
          score += nearestLengthOnPath(rp, endPt.x, endPt.y).dist;
          projected++;
        }
        if (projected === 0) score = rp.getTotalLength();
        score -= Math.min(rp.getTotalLength(), 1200) * 0.001;
        if (score < bestScore) { bestScore = score; bestOption = option; }
      }
    }
    const bestPath = bestOption.path;
    const routeBase = routeBaseOfTail(run.tail);
    const usingBaseRoutePath = bestOption.id === `route_${routeBase}` || bestOption.id === `Route_${routeBase}` || bestOption.id === `Route_${routeBase}_2`;

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

    // 単調になるよう長さを補正。折り返し補正は環状線だけに限定する。
    // 放射/湾岸/K線で全stopの最近傍投影を無理に単調化すると、
    // IC点の表示位置ズレで以降の長さがpath終端へ吸われる。
    const adjustedLengths: number[] = [];
    let lastValid = -1;
    for (let i = 0; i < csvStops.length; i++) {
      let len = stopLengths[i]!;
      if (len < 0) { adjustedLengths.push(-1); continue; }
      if (run.isRing && lastValid >= 0) {
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
      const drawableLen = run.isRing ? ((len % total) + total) % total : len;
      points.push(offsetPointAt(bestPath, total, drawableLen, sign, usingBaseRoutePath ? FALLBACK_ROUTE_OFFSET : 0));
    }

    if (points.length < 2) continue;
    const startPoint = startStop ? resolveStopPoint(startStop, host, pointMap) : null;
    const endPoint = endStop ? resolveStopPoint(endStop, host, pointMap) : null;
    const startSnapLimit = ri === 0 ? 40 : 30;
    const endSnapLimit = ri === runs.length - 1 ? 40 : 30;
    if (startPoint && nearestLengthOnPath(bestPath, startPoint.x, startPoint.y).dist < startSnapLimit) {
      points[0] = startPoint;
    }
    if (endPoint && nearestLengthOnPath(bestPath, endPoint.x, endPoint.y).dist < endSnapLimit) {
      points[points.length - 1] = endPoint;
    }

    if (prevRunEndPoint) {
      const gap = Math.hypot(points[0]!.x - prevRunEndPoint.x, points[0]!.y - prevRunEndPoint.y);
      const transitionStop =
        prevRunEndStop && startStop && prevRunEndStop === startStop
          ? startStop
          : prevRenderedRun
            ? transitionStopBetweenRuns(prevRenderedRun, run)
            : null;
      const transitionPoint = transitionStop ? resolveStopPoint(transitionStop, host, pointMap) : null;
      if (gap > 1 && transitionPoint) {
        const prevLeg = Math.hypot(prevRunEndPoint.x - transitionPoint.x, prevRunEndPoint.y - transitionPoint.y);
        const nextLeg = Math.hypot(points[0]!.x - transitionPoint.x, points[0]!.y - transitionPoint.y);
        if (prevLeg < 56 && nextLeg < 56) {
          drawPath(overlayLayer, pointsToPathData([prevRunEndPoint, transitionPoint, points[0]!]));
        } else if (gap < 30) {
          drawPath(overlayLayer, pointsToPathData([prevRunEndPoint, points[0]!]));
        }
      } else if (gap > 1 && gap < 30) {
        drawPath(overlayLayer, pointsToPathData([prevRunEndPoint, points[0]!]));
      }
    }

    drawPath(
      overlayLayer,
      pointsToPathData(points),
      run.isRing ? RING_STROKE_WIDTH : undefined
    );
    prevRunEndPoint = points[points.length - 1]!;
    prevRunEndStop = endStop;
    prevRenderedRun = run;
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

  addMarker(markerLayer, resolveEntryExit(entryName), "#2563eb", 8.5, "入");
  addMarker(markerLayer, resolveEntryExit(exitName), "#dc2626", 8.5, "出");
  for (const label of activeSpotLabels) {
    const id = PA_ID_BY_LABEL[label];
    if (id) addMarker(markerLayer, pointMap.get(id) || svgElementCenter(host, id), "#2563eb", 7.5);
  }
}

// =============================================================================
// Reactコンポーネント
// =============================================================================

export default function ShutokoMap({
  entryName,
  exitName,
  activeSpotLabels = [],
  highlightedRoutes: _highlightedRoutes = [],
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
        border: "1px solid var(--border)",
        background: "var(--map-surface)",
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
            background: "var(--surface-soft)",
            border: "1px solid var(--border-soft)",
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
        <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>route SVG を読み込み中です。</div>
      )}
    </div>
  );
}
