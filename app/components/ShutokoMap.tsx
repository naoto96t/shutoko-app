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

function publicAsset(path: string) {
  return `${BASE_PATH}${path}`;
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
  for (const el of all) {
    if (el.id === rawId) return el;
  }
  for (const el of all) {
    if (el.id.startsWith(`${rawId}_`)) return el;
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

  const routePointIds = useMemo(() => {
    const out: string[] = [];
    for (const node of highlightedPath) {
      const id = svgNodeIdFromPathNode(node);
      if (id) out.push(id);
    }
    return out;
  }, [highlightedPath]);

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

    const points: Array<{ x: number; y: number }> = [];
    for (const id of routePointIds) {
      const point = centerOf(findSvgNode(host, id) as SVGGraphicsElement | null);
      if (!point) continue;
      const prev = points[points.length - 1];
      if (prev && Math.hypot(prev.x - point.x, prev.y - point.y) < 1) continue;
      points.push(point);
    }

    if (points.length >= 2) {
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      polyline.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke", "#2FFF00");
      polyline.setAttribute("stroke-width", "14");
      polyline.setAttribute("stroke-linecap", "round");
      polyline.setAttribute("stroke-linejoin", "round");
      polyline.setAttribute("opacity", "0.98");
      polyline.style.filter = "drop-shadow(0 0 8px rgba(47,255,0,0.55))";
      overlayLayer.appendChild(polyline);
    }

    const entryPoint = centerOf(findSvgNode(host, entryName) as SVGGraphicsElement | null) || points[0] || null;
    const exitPoint = centerOf(findSvgNode(host, exitName || null) as SVGGraphicsElement | null) || points[points.length - 1] || null;
    addMarker(markerLayer, entryPoint, "#2563eb", 7);
    addMarker(markerLayer, exitPoint, "#dc2626", 7);
    for (const label of activeSpotLabels) {
      const id = PA_ID_BY_LABEL[label];
      if (id) addMarker(markerLayer, centerOf(findSvgNode(host, id) as SVGGraphicsElement | null), "#059669", 5);
    }
  }, [activeSpotLabels, entryName, exitName, routePointIds, svgMarkup]);

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
