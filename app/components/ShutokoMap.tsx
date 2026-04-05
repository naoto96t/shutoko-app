"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ShutokoMapProps = {
  entryName: string | null;
  exitName?: string;
  activeSpotLabels?: string[];
  highlightedRoutes?: string[];
  title?: string;
};

const PA_ID_BY_LABEL: Record<string, string> = {
  "箱崎PA": "pa_Hakozaki",
  "大黒PA": "pa_Daikoku",
  "辰巳PA(第1)": "pa_Tatsumi1",
  "辰巳PA(第2)": "pa_Tatsumi2",
  "芝浦PA": "pa_Shibaura",
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
    for (const group of routeGroups) {
      const isActive = activeRouteIds.size === 0 || activeRouteIds.has(group.id);
      group.style.opacity = isActive ? "1" : "0.18";
      const path = group.querySelector<SVGPathElement>("path");
      if (path) {
        path.style.strokeWidth = isActive && activeRouteIds.size > 0 ? "14" : "10";
        path.style.filter = isActive && activeRouteIds.size > 0 ? "drop-shadow(0 0 8px rgba(37,99,235,0.35))" : "";
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
  }, [activeRouteIds, activeSpotLabels, entryName, exitName, svgMarkup]);

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
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          SVG route map preview
        </div>
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
        現在は SVG に点が入っている C1 / R3 / R4 周辺から順次反映します。
      </div>
    </div>
  );
}
