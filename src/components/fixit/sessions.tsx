"use client";
import { useCallback, useEffect, useState } from "react";
import { LogOut, MessageSquare, PanelLeft, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/fixit/auth";
import { Chat } from "@/components/chat/chat";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { MMMessage } from "@/lib/trace";
import { cn } from "@/lib/utils";

type Session = { id: string; title: string; updatedAt: number; messages: MMMessage[] };
const BASE = "fixit.sessions.v1";
const newId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const titleOf = (m: MMMessage[]) => {
  const t = m.find((x) => x.role === "user")?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim() || "Photo report";
  return t.length > 42 ? `${t.slice(0, 40)}…` : t;
};
// Strip data: image URLs so localStorage stays small.
const slim = (m: MMMessage[]) => m.map((x) => ({ ...x, parts: x.parts.map((p) => (p.type === "file" && p.url.startsWith("data:") && p.url.length > 200_000 ? { ...p, url: "" } : p)) })) as MMMessage[];

export function FixitSessions() {
  const auth = useAuth();
  // History is per user id; guests keep the original key so existing local history survives.
  const KEY = !auth || auth.who.guest ? BASE : `${BASE}.${auth.who.id}`;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Hydrate from localStorage after mount (client-only); scheduled to avoid a synchronous setState in the effect.
    const t = setTimeout(() => {
      try { setSessions(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch {}
      // Back from Composio's Gmail consent: reopen the chat the user was in.
      const back = new URLSearchParams(location.search).has("gmail") && sessionStorage.getItem("fixit.current");
      if (back) history.replaceState(null, "", location.pathname);
      setCurrent(back || newId());
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, [KEY]);
  const persist = (s: Session[]) => {
    setSessions(s);
    try { localStorage.setItem(KEY, JSON.stringify(s.slice(0, 30))); } catch {}
  };
  const onMessages = useCallback((m: MMMessage[]) => {
    setSessions((prev) => {
      const rest = prev.filter((s) => s.id !== current);
      const old = prev.find((s) => s.id === current);
      const next = [{ id: current, title: old?.title ?? titleOf(m), updatedAt: Date.now(), messages: slim(m) }, ...rest];
      try { localStorage.setItem(KEY, JSON.stringify(next.slice(0, 30))); } catch {}
      return next;
    });
  }, [current, KEY]);
  useEffect(() => { if (current) sessionStorage.setItem("fixit.current", current); }, [current]);
  const active = sessions.find((s) => s.id === current);

  const list = (
    <nav className="flex h-full flex-col gap-2 p-3" aria-label="Chat history">
      <Button onClick={() => setCurrent(newId())} className="justify-start gap-2"><Plus className="size-4" /> New chat</Button>
      <p className="mt-2 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">History</p>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {sessions.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">No chats yet.</li>}
        {sessions.map((s) => (
          <li key={s.id} className="group flex items-center">
            <button type="button" onClick={() => setCurrent(s.id)} aria-current={s.id === current} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground", s.id === current && "bg-secondary text-foreground")}>
              <MessageSquare className="size-3.5 shrink-0" /><span className="truncate">{s.title}</span>
            </button>
            <button type="button" aria-label={`Delete ${s.title}`} onClick={() => { persist(sessions.filter((x) => x.id !== s.id)); if (s.id === current) setCurrent(newId()); }} className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
      {auth && (
        <div className="flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate" title={auth.who.email}>{auth.who.guest ? "Guest" : auth.who.name}{!auth.who.guest && (auth.gmail.connected ? " · Gmail connected" : " · Gmail not connected")}</span>
          <button type="button" onClick={auth.signOut} className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-secondary hover:text-foreground"><LogOut className="size-3.5" />{auth.who.guest ? "Sign in" : "Sign out"}</button>
        </div>
      )}
    </nav>
  );

  const toggle = (
    <>
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open chat history" />}><PanelLeft /></SheetTrigger>
        <SheetContent side="left" className="w-[82vw] bg-background p-0 sm:max-w-xs"><SheetTitle className="sr-only">Chat history</SheetTitle>{list}</SheetContent>
      </Sheet>
      <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" aria-label={collapsed ? "Show chat history" : "Hide chat history"} onClick={() => setCollapsed((c) => !c)}><PanelLeft /></Button>
    </>
  );

  return (
    <div className="flex h-dvh">
      {!collapsed && <aside className="hidden w-64 shrink-0 border-r border-border bg-background/95 lg:block">{list}</aside>}
      <div className="min-w-0 flex-1">
        {ready && <Chat key={current} slug="fixit" sessionId={current} initialMessages={active?.messages} onMessages={onMessages} headerLeft={toggle} />}
      </div>
    </div>
  );
}
