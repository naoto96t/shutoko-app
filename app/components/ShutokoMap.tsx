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

function parseSvgPointMap(svgMarkup: string) {
  const map = new Map<string, { x: number; y: number }>();
  const circleRe = /<(circle|ellipse)\b[^>]*\sid="([^"]+)"[^>]*\scx="([^"]+)"[^>]*\scy="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = circleRe.exec(svgMarkup))) {
    const rawId = decodeHtmlEntities(m[2]);
    const x = Number(m[3]);
    const y = Number(m[4]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    map.set(rawId, { x, y });
    const base = rawId.replace(/_\d+$/, "");
    if (base && !map.has(base)) map.set(base, { x, y });
  }
  return map;
}

const DISPLAY_ROUTE_IDS_BY_FAMILY: Record<string, string[]> = {
  C1: ["route_C1"],
  C2: ["route_C2"],
  BAY: ["route_BAY"],
  BAYX: ["route_BAYX"],
  R1H: ["route_R1H"],
  R1U: ["route_R1U"],
  R2: ["route_R2", "route_R2_Togoshi"],
  R3: ["route_R3A", "route_R3B"],
  R4: ["route_R4A", "route_R4B"],
  R5: ["route_R5A", "route_R5B"],
  R6A: ["route_R6A"],
  R6B: ["route_R6B"],
  R7: ["route_R7A", "route_R7B"],
  R9: ["route_R9"],
  R10: ["route_R10"],
  R11: ["route_R11"],
  K1: ["route_K1"],
  K2: ["route_K2"],
  K3: ["route_K3"],
  K5: ["route_K5"],
  K6: ["route_K6"],
  K7: ["route_K7"],
  S1: ["route_S1"],
  S2: ["Route_S2", "Route_S2_2"],
  S5: ["Route_S5", "Route_S5_2"],
};

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

function displayFamilyOfTail(tail: string) {
  if (!tail) return null;
  if (tail.startsWith("C1_")) return "C1";
  if (tail.startsWith("C2_")) return "C2";
  if (tail.startsWith("BAYX_")) return "BAYX";
  if (tail.startsWith("BAY_")) return "BAY";
  if (tail.startsWith("R1H_")) return "R1H";
  if (tail.startsWith("R1U_")) return "R1U";
  if (tail.startsWith("R2")) return "R2";
  if (tail.startsWith("R3A_") || tail.startsWith("R3B_")) return "R3";
  if (tail.startsWith("R4A_") || tail.startsWith("R4B_")) return "R4";
  if (tail.startsWith("R5A_") || tail.startsWith("R5B_")) return "R5";
  if (tail.startsWith("R6A_") || tail.startsWith("R6_")) return "R6A";
  if (tail.startsWith("R6B_") || tail.startsWith("R6_MISATO_")) return "R6B";
  if (tail.startsWith("R7A_") || tail.startsWith("R7B_")) return "R7";
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
    const runs: Array<{ family: string; pointIds: string[] }> = [];
    let current: { family: string; pointIds: string[] } | null = null;

    for (const node of highlightedPath) {
      const family = displayFamilyOfTail(routeTailOfNode(node));
      const pointId = svgNodeIdFromPathNode(node);
      if (!family) continue;
      if (!current || current.family !== family) {
        if (current) runs.push(current);
        current = { family, pointIds: [] };
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

    let firstProjectedPoint: { x: number; y: number } | null = null;
    let lastProjectedPoint: { x: number; y: number } | null = null;

    for (const run of routeRuns) {
      const routeIds = DISPLAY_ROUTE_IDS_BY_FAMILY[run.family] || [];
      const routePaths = routeIds
        .map((id) => host.querySelector<SVGPathElement>(`#${id} path`))
        .filter((p): p is SVGPathElement => !!p);
      if (routePaths.length === 0 || run.pointIds.length < 2) continue;

      const nodePoints = run.pointIds
        .map((id) => ({
          id,
          point: pointMap.get(id) || centerOf(findSvgNode(host, id) as SVGGraphicsElement | null),
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

        const isRing = run.family === "C1" || run.family === "C2";
        const start = Math.min(best.aLen, best.bLen);
        const end = Math.max(best.aLen, best.bLen);
        if (!firstProjectedPoint) firstProjectedPoint = a;
        lastProjectedPoint = b;

        if (isRing && end - start > best.total / 2) {
          appendOverlay(overlayLayer, best.path, best.total, 0, start);
          appendOverlay(overlayLayer, best.path, best.total, end, best.total);
        } else {
          appendOverlay(overlayLayer, best.path, best.total, start, end);
        }
      }
    }

    const entryPoint = (entryName ? pointMap.get(entryName) : null) || centerOf(findSvgNode(host, entryName) as SVGGraphicsElement | null) || firstProjectedPoint || null;
    const exitPoint = (exitName ? pointMap.get(exitName) : null) || centerOf(findSvgNode(host, exitName || null) as SVGGraphicsElement | null) || lastProjectedPoint || null;
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
