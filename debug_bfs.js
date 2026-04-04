const graph = require("./public/graph.json");

function tailOfPort(p) {
    const idx = p.indexOf(":");
    return idx >= 0 ? p.slice(idx + 1) : p;
}

function bfsPathAvoid(
    graph,
    starts,
    targets,
    avoid,
    maxSteps = 60000
) {
    const q = [];
    const prev = new Map();

    for (const s of starts) {
        if (!graph[s]) continue;
        q.push(s);
        prev.set(s, null);
    }

    let head = 0;
    let steps = 0;

    while (head < q.length && steps < maxSteps) {
        const v = q[head++];
        steps++;

        const ns = graph[v] || [];
        for (const nxt of ns) {
            const pv = prev.get(v);
            if (pv) {
                const pj = pv.includes(":") ? pv.split(":")[0] : "";
                const vj = v.includes(":") ? v.split(":")[0] : "";
                const nj = nxt.includes(":") ? nxt.split(":")[0] : "";

                const pt = tailOfPort(pv);
                const vt = tailOfPort(v);
                const nt = tailOfPort(nxt);

                const isRing = (t) => t.startsWith("C1_") || t.startsWith("C2_") || t.startsWith("BAY_");
                const isRadial = (t) => /^(R\d+|R1H|R1U|R5A|R5B|R6A|R6B|R2A|R2B|K\d|S\d)_/.test(t);

                if (pj && pj === vj && vj === nj && isRing(pt) && isRadial(vt) && isRing(nt)) {
                    continue;
                }
            }

            if (prev.has(nxt)) continue;
            prev.set(nxt, v);

            if (targets.has(nxt)) {
                const path = [];
                let cur = nxt;
                while (cur !== null) {
                    path.push(cur);
                    cur = prev.get(cur) ?? null;
                }
                path.reverse();
                return path;
            }
            q.push(nxt);
        }
    }
    return null;
}

// Test with an entry point and TatsumiPA1
const starts = ["ICIN:六本木:C1_CCW"]; // Just an example
const targets = new Set(["TatsumiPA1"]);
const path = bfsPathAvoid(graph, starts, targets, () => false);

console.log("Path:", path);
if (!path) {
    console.log("Failed to find path.");
}
