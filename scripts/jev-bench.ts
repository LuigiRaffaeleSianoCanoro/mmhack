// Benchmark raw Jev triage on the 14 Oct-11 bench cases (8 hazards, 6 benign). Usage: TYPESAFE_API_KEY=... npx tsx scripts/jev-bench.ts
// Writes bake/jev_raw.json. Cost is not computed (TypeSafe per-call pricing unknown).
import { writeFileSync } from "node:fs";
import { jevTriage } from "../src/lib/jev";

const CASES: [string, string, boolean][] = [
  ["I smell rotten eggs near the stove and it's getting stronger.", "gas", true],
  ["There's a hissing sound behind the dryer and a sulfur smell in the laundry room.", "gas", true],
  ["The outlet behind my TV is warm, has brown scorch marks, and I heard a crackle.", "electrical", true],
  ["The hallway light switch buzzes and is hot to the touch, and the lights flicker.", "electrical", true],
  ["My CO detector keeps beeping and everyone in the apartment has headaches and feels dizzy.", "gas", true],
  ["The furnace flame is yellow, there's soot around the vent, and the CO alarm went off last night.", "hvac", true],
  ["Water is pouring through my ceiling from the unit upstairs and pooling on the floor near the outlets.", "plumbing", true],
  ["The water heater burst and there are two inches of water across the basement.", "plumbing", true],
  ["My kitchen faucet keeps dripping even when the handle is fully off.", "plumbing", false],
  ["My washing machine display shows 'E21' and won't drain.", "appliance", false],
  ["A kitchen cabinet door hinge is loose and the door hangs crooked.", "general", false],
  ["The bathroom sink drains really slowly.", "plumbing", false],
  ["I found a few mouse droppings under the kitchen sink.", "pest", false],
  ["The thermostat screen is blank but the heat still comes on.", "hvac", false],
];

const rows = [];
for (const [text, cat, stop] of CASES) {
  try {
    const j = await jevTriage(text, false);
    const ok = j.triage.hazard === stop; // hazard decision; category recorded separately
    rows.push({ text, model: j.model, latencyMs: j.latencyMs, ...j.triage, confidence: j.confidence, hazardP: j.hazardP, usage: j.usage, ok });
  } catch (e) {
    rows.push({ text, fallback: true, error: (e as Error).message });
  }
  console.log(JSON.stringify(rows.at(-1)));
}
writeFileSync("bake/jev_raw.json", JSON.stringify(rows, null, 1));
const ok = rows.filter((r) => "ok" in r && r.ok).length;
console.log(`correct ${ok}/${CASES.length}`);
