/** "Why this model?" link data: trace step id -> the ADR that justifies its model choice. */
const REPO = "https://github.com/LuigiRaffaeleSianoCanoro/mmhack/blob/main/docs/adr";

export const ADR_LINKS: Record<string, { adr: string; href: string }> = {
  triage: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  vision: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  plan: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  confirm: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  understand: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  "plan-fallback": { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  check: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  image: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.md#decision` },
  safety: { adr: "ADR-003", href: `${REPO}/ADR-003-action-boundary.md#decision` },
};

export const whyLink = (stepId: string) => ADR_LINKS[stepId];
