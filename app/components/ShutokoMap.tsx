"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ShutokoMapProps = {
  entryName: string | null;
  exitName?: string;
  activeSpotLabels?: string[];
  highlightedRoutes?: string[];
  highlightedPath?: string[];
  title?: string;
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

const ROUTE_IDS_BY_FAMILY: Record<string, string[]> = {
  C1: ["route_C1"],
  C2: ["route_C2"],
  BAY: ["route_BAY"],
  BAYX: ["route_BAYX"],
  R1H: ["route_R1H"],
  R1U: ["route_R1U"],
  R2: ["route_R2"],
  R2_Togoshi: ["route_R2_Togoshi"],
  R3A: ["route_R3A"],
  R3B: ["route_R3B"],
  R4A: ["route_R4A"],
  R4B: ["route_R4B"],
  R5A: ["route_R5A"],
  R5B: ["route_R5B"],
  R6A: ["route_R6A"],
  R6B: ["route_R6B"],
  R7A: ["route_R7A"],
  R7B: ["route_R7B"],
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
  S2: [],
  S5: [],
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

function setNodeHighlight(el: Element | null, tone: "entry" | "exit" | "spot") {
  if (!el) return;
  const fill = tone === "entry" ? "#111827" : tone === "exit" ? "#dc2626" : "#059669";
  const stroke = tone === "entry" ? "#93c5fd" : tone === "exit" ? "#fecaca" : "#a7f3d0";
  el.setAttribute("opacity", "1");
  el.setAttribute("fill", fill);
  el.setAttribute("stroke", stroke);
  el.setAttribute("stroke-width", "4");
  if (el.tagName.toLowerCase() === "path") {
    el.setAttribute("fill", fill);
  }
}

export default function ShutokoMap({
  entryName,
  exitName,
  activeSpotLabels = [],
  highlightedRoutes = [],
  highlightedPath = [],
  title = "Route Map",
}: ShutokoMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    fetch(publicAsset("/frame-2.svg"))
      .then((r) => r.text())
      .then(setSvgMarkup)
      .catch(() => setSvgMarkup(""));
  }, []);

  const activeRouteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const family of highlightedRoutes) {
      for (const id of ROUTE_IDS_BY_FAMILY[family] || []) ids.add(id);
    }
    return ids;
  }, [highlightedRoutes]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const rootSvg = host.querySelector<SVGSVGElement>("svg");
    if (rootSvg) {
      rootSvg.style.width = "100%";
      rootSvg.style.height = "auto";
      rootSvg.style.display = "block";
    }

    const routeGroups = Array.from(host.querySelectorAll<SVGGElement>('g[id^="route_"]'));
    host.querySelectorAll(".route-overlay-layer").forEach((el) => el.remove());

    for (const group of routeGroups) {
      const isActive = activeRouteIds.size === 0 || activeRouteIds.has(group.id);
      group.style.opacity = isActive ? "0.42" : "0.14";
      const path = group.querySelector<SVGPathElement>("path");
      if (path) {
        path.style.strokeWidth = "10";
        path.style.filter = "";
      }
    }

    if (rootSvg) {
      const overlayLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlayLayer.setAttribute("class", "route-overlay-layer");
      rootSvg.appendChild(overlayLayer);

      const usablePathPoints = highlightedPath
        .map((node) => {
          const family = routeFamilyOfTail(routeTailOfNode(node));
          const pointId = svgNodeIdFromPathNode(node);
          return family && pointId ? { family, pointId, raw: node } : null;
        })
        .filter((x): x is { family: string; pointId: string; raw: string } => !!x);

      const segmentedFamilies = new Set<string>();
      for (let i = 0; i + 1 < usablePathPoints.length; i++) {
        const from = usablePathPoints[i];
        const to = usablePathPoints[i + 1];
        if (from.family !== to.family) continue;

        const routeId = ROUTE_IDS_BY_FAMILY[from.family]?.[0];
        if (!routeId) continue;

        const routePath = host.querySelector<SVGPathElement>(`#${routeId} path`);
        const fromEl = host.querySelector<SVGGraphicsElement>(`[id="${from.pointId}"]`);
        const toEl = host.querySelector<SVGGraphicsElement>(`[id="${to.pointId}"]`);
        if (!routePath || !fromEl || !toEl) continue;

        const fromBox = fromEl.getBBox();
        const toBox = toEl.getBBox();
        const fromPos = nearestLengthOnPath(routePath, fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
        const toPos = nearestLengthOnPath(routePath, toBox.x + toBox.width / 2, toBox.y + toBox.height / 2);
        if (fromPos.dist > 28 || toPos.dist > 28) continue;

        const start = Math.min(fromPos.length, toPos.length);
        const end = Math.max(fromPos.length, toPos.length);
        const segmentLength = Math.max(end - start, 1);
        const overlay = routePath.cloneNode(true) as SVGPathElement;
        overlay.removeAttribute("filter");
        overlay.setAttribute("fill", "none");
        overlay.setAttribute("stroke", "#84cc16");
        overlay.setAttribute("stroke-width", "14");
        overlay.setAttribute("stroke-linecap", "round");
        overlay.setAttribute("stroke-linejoin", "round");
        overlay.setAttribute("opacity", "0.95");
        overlay.style.filter = "drop-shadow(0 0 8px rgba(132,204,22,0.45))";
        overlay.style.strokeDasharray = `${segmentLength} ${fromPos.total}`;
        overlay.style.strokeDashoffset = `${-start}`;
        overlayLayer.appendChild(overlay);
        segmentedFamilies.add(from.family);
      }

      for (const group of routeGroups) {
        const family = group.id.replace(/^route_/, "");
        if (segmentedFamilies.has(family)) {
          group.style.opacity = "0.22";
        }
      }
    }

    const nodeEls = Array.from(host.querySelectorAll<SVGElement>("circle, path[id^='pa_']"));
    for (const el of nodeEls) {
      if (!el.id) continue;
      if (el.id.startsWith("pa_")) {
        el.setAttribute("opacity", "0.88");
      } else {
        el.setAttribute("opacity", "0.85");
      }
      if (el.tagName.toLowerCase() === "circle") {
        el.setAttribute("fill", "#4062C5");
        el.setAttribute("stroke", "white");
        el.setAttribute("stroke-width", "2");
      }
    }

    if (entryName) {
      setNodeHighlight(host.querySelector<SVGElement>(`[id="${entryName}"]`), "entry");
    }
    if (exitName) {
      setNodeHighlight(host.querySelector<SVGElement>(`[id="${exitName}"]`), "exit");
    }
    for (const label of activeSpotLabels) {
      const id = PA_ID_BY_LABEL[label];
      if (id) setNodeHighlight(host.querySelector<SVGElement>(`[id="${id}"]`), "spot");
    }
  }, [activeRouteIds, activeSpotLabels, entryName, exitName, highlightedPath, svgMarkup]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>SVG route map preview</div>
      </div>

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

      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        今は path 上の最近点から区間ハイライトを作っています。点が入っている路線から順に精度が上がります。
      </div>
    </div>
  );
}
