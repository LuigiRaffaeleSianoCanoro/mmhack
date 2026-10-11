// Benchmark raw Jev triage on the 5 bake TRIAGE cases. Usage: TYPESAFE_API_KEY=... npx tsx scripts/jev-bench.ts
// Writes bake/jev_raw.json. Cost is not computed (TypeSafe per-call pricing unknown).
import { writeFileSync } from "node:fs";
import { jevTriage } from "../src/lib/jev";

const CASES: [string, string, boolean][] = [
  ["My kitchen faucet keeps dripping even when the handle is fully off.", "plumbing", false],
  ["There's water pooling around the base of my water heater and the pipes on top look corroded.", "plumbing", false],
  ["I smell rotten eggs near the stove and it's getting stronger.", "gas", true],
  ["The outlet behind my TV is warm, has brown scorch marks, and I heard a crackle.", "electrical", true],
  ["My washing machine display shows 'E21' and won't drain.", "appliance", false],
];

const rows = [];
for (const [text, cat, stop] of CASES) {
  try {
    const j = await jevTriage(text, false);
    const ok = j.triage.category === cat && j.triage.hazard === stop;
    rows.push({ text, model: j.model, latencyMs: j.latencyMs, ...j.triage, confidence: j.confidence, hazardP: j.hazardP, usage: j.usage, ok });
  } catch (e) {
    rows.push({ text, error: (e as Error).message });
  }
  console.log(JSON.stringify(rows.at(-1)));
}
writeFileSync("bake/jev_raw.json", JSON.stringify(rows, null, 1));
const ok = rows.filter((r) => "ok" in r && r.ok).length;
console.log(`correct ${ok}/${CASES.length}`);
