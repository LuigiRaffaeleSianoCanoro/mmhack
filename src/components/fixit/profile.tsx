"use client";
import { useState } from "react";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/fixit/mascot";
import { EMPTY_PROFILE, clearProfile, sanitize, saveProfile, type Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

// FixIt memory onboarding / editor. Skippable, device-local, brand-styled.
export function ProfileDialog({ uid, guest, initial, first, onClose }: { uid: string; guest: boolean; initial: Profile | null; first: boolean; onClose: (saved: boolean) => void }) {
  const [p, setP] = useState<Profile>(initial ?? EMPTY_PROFILE);
  const [err, setErr] = useState("");
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP((x) => ({ ...x, [k]: e.target.value }));
  const field = "h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  const label = "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground";
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (p.landlordEmail.trim() && sanitize(p).landlordEmail === "") return setErr("That landlord email doesn't look right.");
    saveProfile(uid, p);
    onClose(true);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="profile-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4">
      <div aria-hidden className="brick-bg" />
      <form onSubmit={save} className="ribbed-glass relative z-10 my-auto flex w-full max-w-lg flex-col gap-4 rounded-xl border border-mm-accent/30 bg-background/85 p-5 shadow-2xl">
        <button type="button" aria-label="Close" onClick={() => onClose(false)} className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        <div className="flex items-center gap-3">
          <Mascot state="happy" size={72} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mm-accent">FixIt memory</p>
            <h2 id="profile-title" className="font-display text-2xl font-bold uppercase leading-none tracking-tight">{first ? "Tell me about your place" : "Your profile"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Optional. I use it to address your landlord, add your address, and give local safety info.</p>
          </div>
        </div>
        <fieldset className="grid grid-cols-6 gap-2">
          <legend className={cn(label, "mb-1")}>Home</legend>
          <input className={cn(field, "col-span-6")} placeholder="Street address (optional)" value={p.street} onChange={set("street")} autoComplete="street-address" aria-label="Street address" />
          <input className={cn(field, "col-span-2")} placeholder="ZIP" inputMode="numeric" value={p.zip} onChange={set("zip")} autoComplete="postal-code" aria-label="ZIP code" />
          <input className={cn(field, "col-span-4")} placeholder="City" value={p.city} onChange={set("city")} autoComplete="address-level2" aria-label="City" />
          <div className="col-span-6 flex gap-2" role="radiogroup" aria-label="Rent or own">
            {(["rent", "own"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={p.tenure === t} onClick={() => setP((x) => ({ ...x, tenure: x.tenure === t ? "" : t }))}
                className={cn("h-9 flex-1 rounded-full border text-sm transition-colors", p.tenure === t ? "border-mm-accent bg-mm-accent-soft text-foreground" : "border-input text-muted-foreground hover:text-foreground")}>
                I {t}
              </button>
            ))}
          </div>
        </fieldset>
        {p.tenure !== "own" && (
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className={cn(label, "mb-1")}>Landlord or property manager</legend>
            <input className={cn(field, "col-span-2")} placeholder="Name" value={p.landlordName} onChange={set("landlordName")} aria-label="Landlord name" />
            <input className={field} type="email" placeholder="Email" value={p.landlordEmail} onChange={(e) => { setErr(""); set("landlordEmail")(e); }} aria-label="Landlord email" />
            <input className={field} type="tel" placeholder="Phone" value={p.landlordPhone} onChange={set("landlordPhone")} aria-label="Landlord phone" />
          </fieldset>
        )}
        <fieldset className="grid gap-2">
          <legend className={cn(label, "mb-1")}>You</legend>
          <input className={field} type="tel" placeholder="Your phone (so your landlord can reach you)" value={p.phone} onChange={set("phone")} autoComplete="tel" aria-label="Your phone" />
          <textarea className={cn(field, "h-16 resize-none py-2")} placeholder="Notes, e.g. buzzer 4B, side gate code, dog is friendly" value={p.notes} onChange={set("notes")} aria-label="Notes" />
        </fieldset>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><Lock className="mt-0.5 size-3 shrink-0" />Saved only in this browser{guest ? "" : ", under your account id"}. Not synced to a server (this deployment has no durable profile store). AI models only see your city and ZIP; your address, phone and landlord details go into the request you approve, never into a model prompt.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" className="h-10 px-5 font-semibold">Save</Button>
          <Button type="button" variant="ghost" onClick={() => onClose(false)} className="h-10">{first ? "Skip for now" : "Cancel"}</Button>
          {!first && initial && <button type="button" onClick={() => { clearProfile(uid); onClose(true); }} className="ml-auto text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Forget my profile</button>}
        </div>
      </form>
    </div>
  );
}
