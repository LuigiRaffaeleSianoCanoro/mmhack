"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, FileAudio, ImagePlus, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_FILES = 4;
const MAX_BYTES = 10 * 1024 * 1024;
const accepted = (f: File) => f.type.startsWith("image/") || f.type.startsWith("audio/");

export function Composer({
  busy,
  onSend,
  onStop,
}: {
  busy: boolean;
  onSend: (text: string, files: FileList | undefined) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [note, setNote] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  // Thumbnail previews for images; revoked when the attachment list changes.
  const previews = useMemo(() => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : "")), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  /** Same path for the file picker, paste and drag-and-drop. */
  function add(list: Iterable<File>) {
    const incoming = Array.from(list);
    const ok = incoming.filter((f) => accepted(f) && f.size <= MAX_BYTES).map((f, i) =>
      // Clipboard images often arrive as "image.png" with no unique name: give each a stable, readable one.
      !f.name || f.name === "image.png" ? new File([f], `pasted-${Date.now()}-${i}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: f.type }) : f,
    );
    const skipped = incoming.length - ok.length;
    setFiles((prev) => {
      const next = [...prev, ...ok].slice(0, MAX_FILES);
      const dropped = prev.length + ok.length - next.length;
      setNote(skipped || dropped ? `${skipped ? `${skipped} file(s) skipped (images or audio up to 10 MB). ` : ""}${dropped ? `Max ${MAX_FILES} attachments.` : ""}`.trim() : undefined);
      return next;
    });
  }
  const remove = (i: number) => setFiles((prev) => prev.filter((_, j) => j !== i));

  function submit() {
    if (busy || (!text.trim() && !files.length)) return;
    let list: FileList | undefined;
    if (files.length) {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      list = dt.files;
    }
    onSend(text, list);
    setText("");
    setFiles([]);
    setNote(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragEnter={(e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDrag(true); }}
      onDragOver={(e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={(e) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDrag(false); }}
      onDrop={(e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current = 0; setDrag(false); add(e.dataTransfer.files); }}
      aria-label="Message composer. You can paste or drop images here."
      className={cn("ribbed-glass chat-input-glass relative overflow-hidden rounded-xl border p-2 transition-colors focus-within:border-mm-accent/50", drag && "border-mm-accent border-dashed bg-mm-accent-soft/30")}
    >
      {drag && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-background/70 text-sm text-foreground">
          <span className="flex items-center gap-2"><ImagePlus className="size-4 text-mm-accent" /> Drop to attach</span>
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 p-1" data-testid="attachments">
          {files.map((f, i) =>
            previews[i] ? (
              <span key={`${f.name}-${i}`} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previews[i]} alt={f.name} className="size-16 rounded-md border object-cover" />
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(i)} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background text-foreground shadow">
                  <X className="size-3" />
                </button>
              </span>
            ) : (
              <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs">
                {f.type.startsWith("audio/") ? <FileAudio className="size-3.5" /> : <Paperclip className="size-3.5" />}
                <span className="max-w-40 truncate">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(i)}>
                  <X className="size-3" />
                </button>
              </span>
            ),
          )}
        </div>
      )}
      {note && <p className="px-1 text-[11px] text-muted-foreground" role="status">{note}</p>}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.items).filter((it) => it.kind === "file").map((it) => it.getAsFile()).filter((f): f is File => !!f);
          if (pasted.length) {
            // Keep any text in the clipboard only when there is no image (matches the file picker behaviour).
            e.preventDefault();
            add(pasted);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Describe what is broken, or attach, paste or drop a photo."
        className="max-h-48 min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between">
        <input ref={fileRef} type="file" accept="image/*,audio/*" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
        <Button type="button" variant="ghost" size="icon" aria-label="Attach image or audio" onClick={() => fileRef.current?.click()}>
          <Paperclip />
        </Button>
        {busy ? (
          <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={onStop}><Square /></Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send"><ArrowUp /></Button>
        )}
      </div>
    </form>
  );
}
