// AWS-61: server-side upload limits and per-session / per-IP request quotas.
// Quotas live in this function instance's memory: best-effort (each serverless instance
// counts separately and resets on cold start). Not a substitute for a durable rate limiter.

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // decoded bytes per image
export const MAX_BODY_BYTES = 4_400_000; // just under Vercel's 4.5 MB request cap

const WINDOW_MS = 10 * 60 * 1000;
export const SESSION_LIMIT = Number(process.env.FIXIT_SESSION_LIMIT ?? 30); // requests / 10 min
export const IP_LIMIT = Number(process.env.FIXIT_IP_LIMIT ?? 60); // requests / 10 min (shared NAT at venue)

const hits = new Map<string, number[]>();

/** Records one hit for each key; returns retry-after seconds if any key is over its limit. */
export function takeQuota(keys: { key: string; limit: number }[], now = Date.now()): number | null {
  let retry: number | null = null;
  for (const { key, limit } of keys) {
    const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= limit) {
      const r = Math.ceil((arr[0] + WINDOW_MS - now) / 1000);
      retry = Math.max(retry ?? 0, r);
    }
    hits.set(key, arr);
  }
  if (retry != null) return retry;
  for (const { key } of keys) hits.get(key)!.push(now);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  return null;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf ? xf.split(",")[0] : req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Size of a data: URL's payload in bytes; remote URLs are rejected (we only accept uploads). */
export function dataUrlBytes(url: string): number | null {
  const m = /^data:[^;,]+(;base64)?,/.exec(url);
  if (!m) return null;
  const body = url.length - m[0].length;
  return m[1] ? Math.floor((body * 3) / 4) : body;
}

export function checkImages(urls: string[]): string | null {
  if (urls.length > MAX_IMAGES) return `Please send at most ${MAX_IMAGES} photos at a time.`;
  for (const u of urls) {
    const n = dataUrlBytes(u);
    if (n == null) return "Photos must be uploaded from your device.";
    if (n > MAX_IMAGE_BYTES) return `That photo is too large (${(n / 1048576).toFixed(1)} MB). Please use one under ${MAX_IMAGE_BYTES / 1048576} MB.`;
  }
  return null;
}

export function requestTooLarge(req: Request): boolean {
  const n = Number(req.headers.get("content-length") ?? 0);
  return n > MAX_BODY_BYTES;
}
