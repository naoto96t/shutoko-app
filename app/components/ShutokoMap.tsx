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

function mojibakeId(s: string) {
  // Some SVG ids were exported with UTF-8 bytes interpreted as Latin-1.
  return Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join("");
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
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
  const circleRe = /<(circle|ellipse)\b[^>]*\sid="([^"]+)"[^>]*\scx="([^"]+)"[^>]*\scy="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = circleRe.exec(svgMarkup))) {
    const rawId = decodeHtmlEntities(m[2]);
    const repairedId = demojibakeUtf8(rawId);
    const x = Number(m[3]);
    const y = Number(m[4]);
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

function buildIcNameToSvgIdMap(host: Element) {
  const out = new Map<string, string>();
  const nodesRoot = host.querySelector("#nodes_ic");
  const namesRoot = host.querySelector("#ic_names");
  if (!nodesRoot || !namesRoot) return out;

  const nameGroups = new Map<string, Element>();
  for (const el of Array.from(namesRoot.children)) {
    if (!(el instanceof Element) || !el.id) continue;
    nameGroups.set(normalizeRouteGroupId(el.id), el);
  }

  for (const nodeGroup of Array.from(nodesRoot.children)) {
    if (!(nodeGroup instanceof Element) || !nodeGroup.id) continue;
    const key = normalizeRouteGroupId(nodeGroup.id);
    const nameGroup = nameGroups.get(key);
    if (!nameGroup) continue;

    const nodeIds = Array.from(nodeGroup.children)
      .filter((el): el is Element => el instanceof Element && !!el.id && el.id.startsWith("ic_"))
      .map((el) => el.id);
    const nameIds = Array.from(nameGroup.children)
      .filter((el): el is Element => el instanceof Element && !!el.id)
      .map((el) => demojibakeUtf8(decodeHtmlEntities(el.id)).replace(/_\d+$/, ""));

    const count = Math.min(nodeIds.length, nameIds.length);
    for (let i = 0; i < count; i++) {
      out.set(nameIds[i], nodeIds[i]);
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

function appendOverlay(overlayLayer: SVGGElement, routePath: SVGPathElement, total: number, start: number, end: number) {
  const segmentLength = Math.max(end - start, 1);
  const overlay = routePath.cloneNode(true) as SVGPathElement;
  overlay.removeAttribute("filter");
  overlay.setAttribute("fill", "none");
  overlay.setAttribute("stroke", "#2FFF00");
  overlay.setAttribute("stroke-width", "14");
  overlay.setAttribute("stroke-linecap", "round");
  overlay.setAttribute("stroke-linejoin", "round");
  overlay.setAttribute("opacity", "0.98");
  overlay.style.filter = "drop-shadow(0 0 8px rgba(47,255,0,0.55))";
  overlay.style.strokeDasharray = `${segmentLength} ${total}`;
  overlay.style.strokeDashoffset = `${-start}`;
  overlayLayer.appendChild(overlay);
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

  useEffect(() => {
    fetch(publicAsset("/shutoko.svg"))
      .then((r) => r.text())
      .then(setSvgMarkup)
      .catch(() => setSvgMarkup(""));
  }, []);

  const routeRuns = useMemo(() => {
    const runs: Array<{ tail: string; routeIds: string[]; ring: boolean; forward: boolean | null; pointIds: string[] }> = [];
    let current: { tail: string; routeIds: string[]; ring: boolean; forward: boolean | null; pointIds: string[] } | null = null;

    for (const node of highlightedPath) {
      const tail = routeTailOfNode(node);
      const config = routeConfigOfTail(tail);
      const pointId = svgNodeIdFromPathNode(node);
      if (!config) continue;
      if (!current || current.tail !== tail) {
        if (current) runs.push(current);
        current = { tail, routeIds: config.routeIds, ring: config.ring, forward: config.forward, pointIds: [] };
      }
      if (pointId) current.pointIds.push(pointId);
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

    return runs;
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

    let firstProjectedPoint: { x: number; y: number } | null = null;
    let lastProjectedPoint: { x: number; y: number } | null = null;

    for (const run of routeRuns) {
      const routePaths = run.routeIds
        .map((id) => host.querySelector<SVGPathElement>(`#${id} path`))
        .filter((p): p is SVGPathElement => !!p);
      if (routePaths.length === 0 || run.pointIds.length < 2) continue;

      const nodePoints = run.pointIds
        .map((id) => ({
          id,
          point:
            pointMap.get(icNameToSvgId.get(id) || id) ||
            centerOf(findSvgNode(host, icNameToSvgId.get(id) || id) as SVGGraphicsElement | null),
        }))
        .filter((x): x is { id: string; point: { x: number; y: number } } => !!x.point);
      if (nodePoints.length < 2) continue;

      for (let i = 0; i + 1 < nodePoints.length; i++) {
        const a = nodePoints[i].point;
        const b = nodePoints[i + 1].point;
        let best:
          | {
              path: SVGPathElement;
              aLen: number;
              bLen: number;
              total: number;
              score: number;
            }
          | null = null;

        for (const routePath of routePaths) {
          const pa = nearestLengthOnPath(routePath, a.x, a.y);
          const pb = nearestLengthOnPath(routePath, b.x, b.y);
          const score = pa.dist + pb.dist;
          if (!best || score < best.score) {
            best = { path: routePath, aLen: pa.length, bLen: pb.length, total: pa.total, score };
          }
        }

        if (!best) continue;
        if (best.score > 160) continue;

        if (!firstProjectedPoint) firstProjectedPoint = a;
        lastProjectedPoint = b;
        const aLen = best.aLen;
        const bLen = best.bLen;
        if (run.ring && run.forward != null) {
          const wraps = run.forward ? bLen < aLen : aLen < bLen;
          if (wraps) {
            const lo = Math.min(aLen, bLen);
            const hi = Math.max(aLen, bLen);
            appendOverlay(overlayLayer, best.path, best.total, 0, lo);
            appendOverlay(overlayLayer, best.path, best.total, hi, best.total);
          } else {
            appendOverlay(overlayLayer, best.path, best.total, Math.min(aLen, bLen), Math.max(aLen, bLen));
          }
        } else {
          appendOverlay(overlayLayer, best.path, best.total, Math.min(aLen, bLen), Math.max(aLen, bLen));
        }
      }
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
  }, [activeSpotLabels, entryName, exitName, pointMap, routeRuns, svgMarkup]);

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
