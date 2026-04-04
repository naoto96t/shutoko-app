"use client";

import { useEffect, useMemo, useState } from "react";

type ExitItem = { exit: string; toll: number; dist?: string };
type FareMap = Record<string, ExitItem[]>;

type ICInfo = {
  route: string[];
  entry_dir: string[];
  exit_dir: string[];
  is_full: boolean;
  etc_only: boolean;
};
type ICMaster = Record<string, ICInfo>;

const MAX_SUGGESTIONS = 30;

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function normName(s: string) {
  return (s ?? "")
    .replace(/\s+/g, "")
    .replace(/（ETC専用）/g, "")
    .replace(/^※+/, "");
}

const isStarred = (s: string) => (s ?? "").trim().startsWith("※");

export default function Home() {
  const [fares, setFares] = useState<FareMap>({});
  const [ic, setIC] = useState<ICMaster>({});

  const [entry, setEntry] = useState<string>("");
  const [q, setQ] = useState<string>("");

  useEffect(() => {
    fetch("/fares_by_entry.json")
      .then((r) => r.json())
      .then((j) => setFares(j as FareMap));

    fetch("/ic_master.json")
      .then((r) => r.json())
      .then((j) => setIC(j as ICMaster));
  }, []);

  const entries = useMemo(() => Object.keys(fares).sort(), [fares]);

  const suggestions = useMemo(() => {
    const qq = q.trim();
    if (!qq) return [];
    return entries
      .filter((e) => !isStarred(e))
      .filter((e) => e.includes(qq))
      .slice(0, MAX_SUGGESTIONS);
  }, [entries, q]);

  const top3 = useMemo(() => {
    if (!entry || !fares[entry]) return null;

    // ※付き出口を除外
    const list = fares[entry].filter((x) => !isStarred(x.exit));

    const tolls = uniq(list.map((x) => x.toll)).sort((a, b) => a - b).slice(0, 3);

    return tolls.map((t) => ({
      toll: t,
      exits: list.filter((x) => x.toll === t).map((x) => x.exit).sort(),
    }));
  }, [entry, fares]);

  const onPickEntry = (name: string) => {
    setEntry(name);
    setQ("");
  };

  const clearAll = () => {
    setEntry("");
    setQ("");
  };

  const getIC = (name: string) => {
    const k = normName(name);
    return ic[k] ?? null;
  };

  const prettyExit = (x: string) => {
    const s = (x ?? "").trim();
    if (!s || s.toLowerCase() === "nan" || s === "<NA>") return "（出口名要確認）";
    return s;
  };

  const renderTags = (exitName: string) => {
    const info = getIC(exitName);
    if (!info) return null;

    const tags: string[] = [];
    if (info.is_full) tags.push("FULL");
    if (info.exit_dir?.length) tags.push(`出口:${info.exit_dir.join("・")}`);
    // MVP暫定：FULL出口は「周回で成立候補」
    if (info.is_full) tags.push("周回で成立候補");
    if (info.etc_only) tags.push("ETC専用");

    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {tags.map((t) => (
          <span
            key={t}
            style={{
              display: "inline-block",
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "#fff",
              fontSize: 12,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    );
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontSize: 18 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>首都高 最安出口</h1>
        <button
          onClick={clearAll}
          style={{
            padding: "10px 12px",
            fontSize: 16,
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
          }}
        >
          クリア
        </button>
      </header>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="入口を検索（例：五反田 / 代々木 / 外苑）"
          inputMode="search"
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            width: "100%",
            padding: "14px 14px",
            fontSize: 18,
            borderRadius: 12,
            border: "1px solid #ccc",
          }}
        />

        {suggestions.length > 0 && (
          <section style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            {suggestions.map((name) => (
              <button
                key={name}
                onClick={() => onPickEntry(name)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 14px",
                  fontSize: 18,
                  border: "none",
                  borderBottom: "1px solid #eee",
                  background: "#fff",
                }}
              >
                {name}
              </button>
            ))}
          </section>
        )}

        {entry && (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", background: "#fafafa" }}>
            入口：<b>{entry}</b>
          </div>
        )}

        {top3 && (
          <section style={{ display: "grid", gap: 10 }}>
            {top3.map((tier, idx) => (
              <div
                key={tier.toll}
                style={{ padding: 14, borderRadius: 12, border: "1px solid #ddd", background: "#fafafa" }}
              >
                <div style={{ fontSize: 20, marginBottom: 8 }}>
                  {idx === 0 ? "最安" : `${idx + 1}位`}：<b>{tier.toll} 円</b>
                </div>
                <div style={{ marginBottom: 6 }}>出口：</div>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                  {tier.exits.slice(0, 12).map((x) => (
                    <li key={x} style={{ marginBottom: 8 }}>
                      <div>{prettyExit(x)}</div>
                      {renderTags(x)}
                    </li>
                  ))}
                </ul>
                {tier.exits.length > 12 && (
                  <div style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
                    他 {tier.exits.length - 12} 件
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {!entry && !q && <div style={{ color: "#666", fontSize: 14 }}>入口名を検索して、候補をタップ。</div>}
      </div>
    </main>
  );
}