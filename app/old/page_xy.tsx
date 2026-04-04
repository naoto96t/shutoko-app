"use client";
import { useEffect, useMemo, useState } from "react";

type ExitRow = {
  exit: string;
  toll: number;
  dist?: string;
  target_nodes?: string[];
  path_nodes?: string[];
  path_ports?: string[];
};

type EntryBlock = { start_nodes: string[]; exits: ExitRow[] };
type PlansJson = { meta: { note?: string }; entries: Record<string, EntryBlock> };

const LABEL: Record<string, string> = {
  C1_CW: "C1外回り",
  C1_CCW: "C1内回り",
  C2_CW: "C2外回り",
  C2_CCW: "C2内回り",
  BAY_E: "湾岸線 東行き",
  BAY_W: "湾岸線 西行き",
};

function prettyNode(n: string) {
  if (LABEL[n]) return LABEL[n];
  const m = n.match(/^(R\d+|R1H|R1U|S1)_(UP|DOWN)$/);
  if (m) {
    const rid = m[1].replace(/^R/, "");
    const dir = m[2] === "UP" ? "上り" : "下り";
    return `${rid}号 ${dir}`;
  }
  return n;
}

const SPOTS = [
  { key: "hakozaki", label: "箱崎", match: (p: string) => p.includes("Hakozaki") },
  { key: "daikoku", label: "大黒", match: (p: string) => p.includes("DaikokuJCT") },
  { key: "tatsumi", label: "辰巳", match: (p: string) => p.includes("TatsumiJCT") },
  { key: "shibaura", label: "芝浦", match: (p: string) => p.includes("ShibauraJCT") },
];

export default function Page() {
  const [data, setData] = useState<PlansJson | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [spotOn, setSpotOn] = useState<Record<string, boolean>>({
    hakozaki: false,
    daikoku: false,
    tatsumi: false,
    shibaura: false,
  });

  useEffect(() => {
    fetch("/plans.json").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);

  const entryKeys = useMemo(() => {
    if (!data) return [];
    const keys = Object.keys(data.entries);
    keys.sort((a, b) => a.localeCompare(b, "ja"));
    return keys;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const qq = q.trim();
    if (!qq) return entryKeys.slice(0, 60);
    return entryKeys.filter((k) => k.includes(qq)).slice(0, 60);
  }, [data, q, entryKeys]);

  const entry = selected && data ? data.entries[selected] : null;

  const activeSpotKeys = Object.keys(spotOn).filter((k) => spotOn[k]);
  const spotFilter = (x: ExitRow) => {
    if (activeSpotKeys.length === 0) return true;
    const ports = x.path_ports || [];
    return activeSpotKeys.every((k) => {
      const s = SPOTS.find((z) => z.key === k);
      return s ? ports.some(s.match) : true;
    });
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>首都高 最安出口（MVP）</h1>
        <button
          onClick={() => { setQ(""); setSelected(null); setSpotOn({ hakozaki:false, daikoku:false, tatsumi:false, shibaura:false }); }}
          style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 10, background: "white" }}
        >
          クリア
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="入口を検索（例：五反田 / 外苑 / 葛西）"
          style={{ width: "100%", padding: 12, fontSize: 16, border: "1px solid #bbb", borderRadius: 12 }}
        />
      </div>

      <div style={{ marginTop: 10, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>通りたいスポット（任意）</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {SPOTS.map((s) => (
            <label key={s.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!spotOn[s.key]}
                onChange={(e) => setSpotOn((p) => ({ ...p, [s.key]: e.target.checked }))}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {!data && <div style={{ marginTop: 16, color: "#666" }}>plans.json を読み込めていません。</div>}

      {data && !selected && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: "#666", fontSize: 12 }}>{data.meta?.note ?? ""}</div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {filtered.map((ic) => (
              <button key={ic} onClick={() => setSelected(ic)}
                style={{ textAlign: "left", padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
                <div style={{ fontWeight: 700 }}>{ic}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>start: {data.entries[ic].start_nodes.join(", ")}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>exits: {data.entries[ic].exits?.length ?? 0}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {data && selected && entry && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setSelected(null)}
            style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 10, background: "white" }}>
            ← 戻る
          </button>

          <div style={{ marginTop: 10, padding: 14, border: "1px solid #ddd", borderRadius: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{selected}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              start_nodes: {entry.start_nodes.map(prettyNode).join(", ")}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {(entry.exits || []).filter(spotFilter).slice(0, 40).map((x, i) => (
              <div key={i} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {x.toll}円 / 出口：{x.exit} {x.dist ? ` / ${x.dist}km` : ""}
                </div>

                {x.path_nodes?.length ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                    経路（概要）: {x.path_nodes.map(prettyNode).join(" → ")}
                  </div>
                ) : null}

                {x.path_ports?.length ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                    経路（JCT）: {x.path_ports.join(" → ")}
                  </div>
                ) : null}
              </div>
            ))}
            {(entry.exits || []).filter(spotFilter).length === 0 ? (
              <div style={{ color: "#888" }}>条件に合う出口が見つかりません。</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
