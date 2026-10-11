/** "Why this model?" link data: trace step id -> the ADR that justifies its model choice. */
// Served from the app itself (copied from docs/adr at build) so links work while the repo is private.
const REPO = "/adr";

export const ADR_LINKS: Record<string, { adr: string; href: string }> = {
  triage: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  vision: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  plan: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  confirm: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  understand: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  "plan-fallback": { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  check: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  image: { adr: "ADR-002", href: `${REPO}/ADR-002-model-routing.txt` },
  safety: { adr: "ADR-003", href: `${REPO}/ADR-003-action-boundary.txt` },
};

export const whyLink = (stepId: string) => ADR_LINKS[stepId];
