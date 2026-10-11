// Shared (client + server) Pro types and matching helpers. No metrics, no reviews: only what a pro told us.
export const TRADES = ["HVAC", "plumbing", "electrical", "drywall", "roofing", "appliance", "general"] as const;
export type Trade = (typeof TRADES)[number];
export type Pro = { id: string; name: string; trade: Trade; zip: string; area: string; phone: string; email: string; rateNotes: string; demo: boolean; createdAt: string };
export type PublicPro = Omit<Pro, "email" | "phone"> & { phone?: string };

const RULES: [Trade, RegExp][] = [
  ["electrical", /electric|outlet|breaker|panel|wiring|spark|gfci|circuit|switch/i],
  ["plumbing", /plumb|leak|pipe|drain|toilet|faucet|water heater|clog|sewer|shut-?off/i],
  ["HVAC", /hvac|furnace|\bac\b|air condition|heat pump|thermostat|carbon monoxide|\bco\b alarm|\bvents?\b/i],
  ["roofing", /roof|shingle|gutter|skylight/i],
  ["appliance", /fridge|refrigerator|dishwasher|washer|dryer|oven|stove|\brange\b|microwave|appliance/i],
  ["drywall", /drywall|wall hole|ceiling crack|plaster|sheetrock/i],
];
/** Best-guess trade from the conversation text. Gas smell goes to HVAC (gas appliances) after the utility call. */
export function inferTrade(text: string): Trade {
  if (/gas (leak|smell)|smell(s)? gas|rotten egg/i.test(text)) return "HVAC";
  for (const [t, re] of RULES) if (re.test(text)) return t;
  return "general";
}
/** Recommend pros only when the plan actually says to call one. */
export const recommendsPro = (text: string) => /\b(licensed|professional|plumber|electrician|technician|contractor|roofer|call a pro|hire a)\b/i.test(text);

export function introMessage(pro: { name: string; trade: string }, problem: string, zip: string) {
  const brief = problem.replace(/\s+/g, " ").trim().slice(0, 400);
  return `Hi ${pro.name.replace(/\s*\(.*\)$/, "")},\n\nI found you through FixIt and I'm looking for help with a ${pro.trade} issue${zip ? ` near ZIP ${zip}` : ""}.\n\nWhat's going on: ${brief}\n\nCould you let me know your availability for a visit and roughly what a visit costs? Thanks.`;
}
