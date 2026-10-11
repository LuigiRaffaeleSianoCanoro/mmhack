import "server-only";
import { createClient, type Base44Client } from "@base44/sdk";

/**
 * Server-only Base44 adapter for the "Landlord Inbox" companion app.
 * Credentials never reach the browser: this module is imported only by route handlers.
 * Auth precedence: BASE44_API_KEY (api_key header) > BASE44_TOKEN > BASE44_BOT_EMAIL/PASSWORD login.
 */
export const BASE44_APP_ID = process.env.BASE44_APP_ID ?? "";

export function base44Configured() {
  return Boolean(BASE44_APP_ID && (process.env.BASE44_API_KEY || process.env.BASE44_TOKEN || (process.env.BASE44_BOT_EMAIL && process.env.BASE44_BOT_PASSWORD)));
}

let cached: Promise<Base44Client> | null = null;
export function base44(): Promise<Base44Client> {
  if (!base44Configured()) return Promise.reject(new Error("Base44 not configured"));
  cached ??= (async () => {
    const client = createClient({
      appId: BASE44_APP_ID,
      ...(process.env.BASE44_SERVER_URL ? { serverUrl: process.env.BASE44_SERVER_URL } : {}),
      ...(process.env.BASE44_API_KEY ? { headers: { api_key: process.env.BASE44_API_KEY } } : {}),
      ...(process.env.BASE44_TOKEN ? { token: process.env.BASE44_TOKEN } : {}),
    });
    if (!process.env.BASE44_API_KEY && !process.env.BASE44_TOKEN) await client.auth.loginViaEmailPassword(process.env.BASE44_BOT_EMAIL!, process.env.BASE44_BOT_PASSWORD!);
    return client;
  })().catch((e) => {
    cached = null;
    throw e;
  });
  return cached;
}

export const inboxUrl = (requestId?: string) => (process.env.BASE44_APP_URL ? `${process.env.BASE44_APP_URL.replace(/\/$/, "")}${requestId ? `/RequestDetail?id=${requestId}` : ""}` : undefined);
