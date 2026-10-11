/**
 * FixIt memory: the renter's profile. Stored ONLY in this browser's localStorage, keyed by the
 * signed-in user id (or "guest"). There is no durable server store on this deployment (Vercel
 * functions have per-instance /tmp and no KV is configured), so we don't pretend to sync.
 *
 * Privacy split: the server receives only what each step needs (see toServer()). Models only ever
 * see city/ZIP; address, names, phone and emails go into deterministic templates, never prompts.
 */
export type Profile = {
  street: string;
  zip: string;
  city: string;
  tenure: "rent" | "own" | "";
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  phone: string;
  notes: string;
};
export const EMPTY_PROFILE: Profile = { street: "", zip: "", city: "", tenure: "", landlordName: "", landlordEmail: "", landlordPhone: "", phone: "", notes: "" };

const key = (uid: string) => `fixit.profile.v1.${uid}`;
const skipKey = (uid: string) => `fixit.profile.skipped.v1.${uid}`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : "");

export function sanitize(p: Partial<Profile> | null | undefined): Profile {
  const x = p ?? {};
  const email = s(x.landlordEmail, 120);
  return {
    street: s(x.street, 120),
    zip: s(x.zip, 10).replace(/[^0-9-]/g, ""),
    city: s(x.city, 60).replace(/[^\p{L}\p{M}\s.'-]/gu, ""), // reaches the plan prompt: letters only
    tenure: x.tenure === "rent" || x.tenure === "own" ? x.tenure : "",
    landlordName: s(x.landlordName, 80),
    landlordEmail: EMAIL.test(email) ? email : "",
    landlordPhone: s(x.landlordPhone, 30).replace(/[^0-9+()\-. ]/g, ""),
    phone: s(x.phone, 30).replace(/[^0-9+()\-. ]/g, ""),
    notes: s(x.notes, 300),
  };
}
export const isEmpty = (p: Profile) => !Object.values(p).some(Boolean);

export function loadProfile(uid: string): Profile | null {
  try { const r = localStorage.getItem(key(uid)); return r ? sanitize(JSON.parse(r)) : null; } catch { return null; }
}
export function saveProfile(uid: string, p: Profile) {
  try { localStorage.setItem(key(uid), JSON.stringify(sanitize(p))); localStorage.removeItem(skipKey(uid)); } catch {}
  window.dispatchEvent(new Event("fixit-profile"));
}
export function clearProfile(uid: string) {
  try { localStorage.removeItem(key(uid)); } catch {}
  window.dispatchEvent(new Event("fixit-profile"));
}
export const wasSkipped = (uid: string) => { try { return !!localStorage.getItem(skipKey(uid)); } catch { return false; } };
export const markSkipped = (uid: string) => { try { localStorage.setItem(skipKey(uid), "1"); } catch {} };

/** Address line used in the landlord request (deterministic template, never a model prompt). */
export const addressLine = (p: Profile) => [p.street, [p.city, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/** What the browser sends to /api/fixit. The server keeps model-bound fields to city/ZIP. */
export type ServerProfile = Pick<Profile, "zip" | "city" | "landlordName" | "landlordEmail" | "phone" | "tenure"> & { address: string; notes: string };
export function toServer(p: Profile | null): ServerProfile | undefined {
  if (!p || isEmpty(p)) return undefined;
  return { zip: p.zip, city: p.city, tenure: p.tenure, landlordName: p.landlordName, landlordEmail: p.landlordEmail, phone: p.phone, address: addressLine(p), notes: p.notes };
}

/**
 * Emergency guidance from location. US ZIPs (5 digits) => 911. Gas utility NAME only where the ZIP
 * range is unambiguous; we never invent utility phone numbers (point to the bill / utility site).
 */
export function emergencyFor(zip: string): { number: string; utility?: string /* "likely": ZIP ranges are coarse; the bill is authoritative */ } | null {
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return null;
  const z = Number(zip.slice(0, 3));
  // Coarse, conservative ranges. Unknown => no utility named.
  const utility =
    z >= 940 && z <= 954 && z !== 943 ? "PG&E" :
    (z >= 900 && z <= 906) || (z >= 910 && z <= 918) ? "SoCalGas" :
    z === 100 || z === 101 || z === 102 || z === 104 ? "Con Edison" :
    undefined;
  return { number: "911", utility };
}
