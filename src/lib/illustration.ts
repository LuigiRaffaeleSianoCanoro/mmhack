// Shared types + config for the optional repair illustration (AWS-60).
export const ILLUSTRATION_CATEGORIES = ["plumbing", "electrical", "gas", "appliance", "hvac", "pest", "structural", "general"] as const;
export type IllustrationCategory = (typeof ILLUSTRATION_CATEGORIES)[number];

export function normalizeCategory(c: string | undefined): IllustrationCategory {
  return (ILLUSTRATION_CATEGORIES as readonly string[]).includes(c ?? "") ? (c as IllustrationCategory) : "general";
}

/** Pre-generated, cached JPEG per category. Labeled as sample, never as live output. */
export const fallbackSrc = (c: string) => `/illustrations/${normalizeCategory(c)}.jpg`;

/** Emitted by /api/fixit once the plan is done; the client then fetches /api/fixit/illustrate. */
export type IllustrationRequest = {
  id: string;
  category: IllustrationCategory;
  summary: string;
  /** "live" = eligible upload, "sample" = bundled sample photo (no API call). */
  mode: "live" | "sample";
};

export type IllustrationResult =
  | { status: "live"; src: string; model: string; latencyMs: number; attempts: number }
  | { status: "fallback"; src: string; reason: string; latencyMs: number; attempts: number }
  | { status: "unavailable"; reason: string; latencyMs: number; attempts: number };

export const IMAGE_MODEL = "gpt-6-astra";
