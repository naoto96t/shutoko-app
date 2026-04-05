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
  S2: ["Route_S2"],
  S5: ["Route_S5"],
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

function nearestLengthOnPath(path: SVGPathElement, x: number, y: number) {
  const total = path.getTotalLength();
  const samples = Math.max(200, Math.ceil(total / 3));
  let bestLength = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= samples; i++) {
    const length = (total * i) / samples;
    const pt = path.getPointAtLength(length);
    const dx = pt.x - x;
    const dy = pt.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestLength = length;
    }
  }

  let step = Math.max(total / samples, 1);
  while (step > 0.5) {
    const left = Math.max(0, bestLength - step);
    const right = Math.min(total, bestLength + step);
    for (const length of [left, bestLength, right]) {
      const pt = path.getPointAtLength(length);
      const dx = pt.x - x;
      const dy = pt.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestLength = length;
      }
    }
    step *= 0.5;
  }

  return { length: bestLength, dist: bestDist, total };
}

function findSvgNode(host: Element, rawId: string | null) {
  if (!rawId) return null;
  const all = Array.from(host.querySelectorAll<SVGElement>("[id]"));
  for (const el of all) {
    if (el.id === rawId) return el;
  }
  for (const el of all) {
    if (el.id.startsWith(`${rawId}_`)) return el;
  }
  return null;
}

function addMarkerLayer(rootSvg: SVGSVGElement) {
  rootSvg.querySelectorAll(".route-marker-layer").forEach((el) => el.remove());
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("class", "route-marker-layer");
  rootSvg.appendChild(layer);
  return layer;
}

function addMarker(layer: SVGGElement, el: SVGGraphicsElement | null, fill: string, radius: number) {
  if (!el) return;
  const box = el.getBBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", `${cx}`);
  circle.setAttribute("cy", `${cy}`);
  circle.setAttribute("r", `${radius}`);
  circle.setAttribute("fill", fill);
  circle.setAttribute("stroke", "white");
  circle.setAttribute("stroke-width", "3");
  layer.appendChild(circle);
}

export default function ShutokoMap({
  entryName,
  exitName,
  activeSpotLabels = [],
  highlightedRoutes = [],
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

  const activeDisplayFamilies = useMemo(() => {
    const ids = new Set<string>();
    for (const family of highlightedRoutes) {
      const display = displayFamilyOfTail(family) || family;
      ids.add(display);
    }
    return ids;
  }, [highlightedRoutes]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const rootSvg = host.querySelector<SVGSVGElement>("svg");
    if (!rootSvg) return;
    rootSvg.style.width = "100%";
    rootSvg.style.height = "auto";
    rootSvg.style.display = "block";

    const routeGroups = Array.from(host.querySelectorAll<SVGGElement>('g[id^="route_"], g[id="Route_S2"], g[id="Route_S5"]'));
    host.querySelectorAll(".route-overlay-layer").forEach((el) => el.remove());
    const markerLayer = addMarkerLayer(rootSvg);

    for (const group of routeGroups) {
      group.style.opacity = "1";
      const path = group.querySelector<SVGPathElement>("path");
      if (path) {
        path.style.strokeWidth = "10";
        path.style.filter = "";
      }
    }

    const overlayLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    overlayLayer.setAttribute("class", "route-overlay-layer");
    rootSvg.appendChild(overlayLayer);

    const routeRuns: Array<{ family: string; pointIds: string[] }> = [];
    let currentRun: { family: string; pointIds: string[] } | null = null;
    for (const node of highlightedPath) {
      const family = displayFamilyOfTail(routeTailOfNode(node));
      const pointId = svgNodeIdFromPathNode(node);
      if (!family) continue;
      if (!currentRun || currentRun.family !== family) {
        if (currentRun) routeRuns.push(currentRun);
        currentRun = { family, pointIds: [] };
      }
      if (pointId) currentRun.pointIds.push(pointId);
    }
    if (currentRun) routeRuns.push(currentRun);

    const appendOverlay = (routePath: SVGPathElement, total: number, start: number, end: number) => {
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
    };

    for (const run of routeRuns) {
      const routeIds = DISPLAY_ROUTE_IDS_BY_FAMILY[run.family] || [];
      if (routeIds.length === 0) continue;
      const isRing = run.family === "C1" || run.family === "C2";

      for (let i = 0; i + 1 < run.pointIds.length; i++) {
        const fromEl = findSvgNode(host, run.pointIds[i]) as SVGGraphicsElement | null;
        const toEl = findSvgNode(host, run.pointIds[i + 1]) as SVGGraphicsElement | null;
        if (!fromEl || !toEl) continue;

        let best: { path: SVGPathElement; a: number; b: number; total: number; score: number } | null = null;
        for (const routeId of routeIds) {
          const routePath = host.querySelector<SVGPathElement>(`#${routeId} path`);
          if (!routePath) continue;
          const fromBox = fromEl.getBBox();
          const toBox = toEl.getBBox();
          const fromPos = nearestLengthOnPath(routePath, fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
          const toPos = nearestLengthOnPath(routePath, toBox.x + toBox.width / 2, toBox.y + toBox.height / 2);
          if (fromPos.dist > 40 || toPos.dist > 40) continue;
          const score = fromPos.dist + toPos.dist;
          if (!best || score < best.score) {
            best = { path: routePath, a: fromPos.length, b: toPos.length, total: fromPos.total, score };
          }
        }
        if (!best) continue;

        const directStart = Math.min(best.a, best.b);
        const directEnd = Math.max(best.a, best.b);
        const directLen = directEnd - directStart;
        if (isRing && directLen > best.total / 2) {
          appendOverlay(best.path, best.total, 0, directStart);
          appendOverlay(best.path, best.total, directEnd, best.total);
        } else {
          appendOverlay(best.path, best.total, directStart, directEnd);
        }
      }
    }

    addMarker(markerLayer, findSvgNode(host, entryName) as SVGGraphicsElement | null, "#2563eb", 7);
    addMarker(markerLayer, findSvgNode(host, exitName || null) as SVGGraphicsElement | null, "#dc2626", 7);
    for (const label of activeSpotLabels) {
      const id = PA_ID_BY_LABEL[label];
      if (id) addMarker(markerLayer, findSvgNode(host, id) as SVGGraphicsElement | null, "#059669", 5);
    }
  }, [activeDisplayFamilies, activeSpotLabels, entryName, exitName, highlightedPath, svgMarkup]);

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
