"use client";

import { MAP_NODE_ALIASES, MAP_NODES, MAP_ROUTES, type MapPoint } from "../lib/shutokoMapLayout";

type ShutokoMapProps = {
  entryName: string | null;
  exitName?: string;
  activeSpotLabels?: string[];
  highlightedRoutes?: string[];
  title?: string;
};

function polylinePoints(points: MapPoint[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function routeStrokeWidth(routeId: string, highlighted: Set<string>) {
  return highlighted.has(routeId) ? 18 : 10;
}

function routeOpacity(routeId: string, highlighted: Set<string>) {
  return highlighted.size === 0 || highlighted.has(routeId) ? 1 : 0.18;
}

function normalizeNodeName(name: string) {
  return MAP_NODE_ALIASES[name] || name;
}

function Marker({
  point,
  label,
  tone,
}: {
  point: MapPoint;
  label: string;
  tone: "entry" | "exit" | "spot";
}) {
  const fill = tone === "entry" ? "#111827" : tone === "exit" ? "#dc2626" : "#059669";
  const stroke = tone === "entry" ? "#93c5fd" : tone === "exit" ? "#fecaca" : "#a7f3d0";
  return (
    <g>
      <circle cx={point.x} cy={point.y} r={8} fill={fill} stroke={stroke} strokeWidth={4} />
      <rect x={point.x + 10} y={point.y - 14} rx={8} ry={8} width={label.length * 13 + 14} height={26} fill="rgba(255,255,255,0.92)" />
      <text x={point.x + 18} y={point.y + 4} fontSize="14" fontWeight="700" fill="#111827">
        {label}
      </text>
    </g>
  );
}

export default function ShutokoMap({
  entryName,
  exitName,
  activeSpotLabels = [],
  highlightedRoutes = [],
  title = "Route Map",
}: ShutokoMapProps) {
  const highlighted = new Set(highlightedRoutes);
  const entryPoint = entryName ? MAP_NODES[normalizeNodeName(entryName)] : undefined;
  const exitPoint = exitName ? MAP_NODES[normalizeNodeName(exitName)] : undefined;
  const spotPoints = activeSpotLabels
    .map((name) => ({ label: normalizeNodeName(name), point: MAP_NODES[normalizeNodeName(name)] }))
    .filter((x) => !!x.point) as { label: string; point: MapPoint }[];

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 20,
        border: "1px solid #d6d3d1",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #ffffff 38%, #f5f7fb 100%)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          線は概略図。座標はあとから差し替え可能
        </div>
      </div>

      <svg viewBox="0 0 1200 900" style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="1200" height="900" fill="url(#bg-grid)" opacity="0" />

        {MAP_ROUTES.map((route) => (
          <g key={route.id}>
            <polyline
              points={polylinePoints(route.points)}
              fill="none"
              stroke="#dbe4ee"
              strokeWidth={routeStrokeWidth(route.id, highlighted) + 8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={routeOpacity(route.id, highlighted)}
            />
            <polyline
              points={polylinePoints(route.points)}
              fill="none"
              stroke={route.color}
              strokeWidth={routeStrokeWidth(route.id, highlighted)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={routeOpacity(route.id, highlighted)}
              filter={highlighted.has(route.id) ? "url(#routeGlow)" : undefined}
            />
          </g>
        ))}

        {entryPoint ? <Marker point={entryPoint} label={`入口 ${entryName}`} tone="entry" /> : null}
        {exitPoint ? <Marker point={exitPoint} label={`出口 ${exitName}`} tone="exit" /> : null}
        {spotPoints.map(({ label, point }) => (
          <Marker key={label} point={point} label={label} tone="spot" />
        ))}
      </svg>
    </div>
  );
}
