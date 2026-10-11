"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, FileAudio, ImagePlus, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { checkVideo, extractFrames, isVideo, VIDEO_FRAMES, VIDEO_MAX_BYTES } from "@/lib/video-frames";

const MAX_FILES = 4;
const MAX_BYTES = 10 * 1024 * 1024;
const accepted = (f: File) => f.type.startsWith("image/") || f.type.startsWith("audio/") || isVideo(f);
const sizeOk = (f: File) => f.size <= (isVideo(f) ? VIDEO_MAX_BYTES : MAX_BYTES);

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
  const previews = useMemo(() => files.map((f) => (f.type.startsWith("image/") || isVideo(f) ? URL.createObjectURL(f) : "")), [files]);
  const [extracting, setExtracting] = useState(false);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  /** Same path for the file picker, paste and drag-and-drop. */
  async function add(list: Iterable<File>) {
    const all = Array.from(list);
    // Videos: one at a time, checked for length/size, and sent alone (its 5 frames use the whole image budget).
    const vids = all.filter((f) => isVideo(f) && accepted(f));
    if (vids.length) {
      const v = vids[0];
      const err = v.size > VIDEO_MAX_BYTES ? `Video too large (max ${VIDEO_MAX_BYTES / 1048576} MB).` : await checkVideo(v);
      if (err) { setNote(err); return; }
      setFiles((prev) => [...prev.filter((f) => f.type.startsWith("audio/")), v]);
      setNote(prev0(files) ? "A video is sent on its own (photos removed)." : undefined);
      return;
    }
    const incoming = all;
    const ok = incoming.filter((f) => accepted(f) && sizeOk(f)).map((f, i) =>
      // Clipboard images often arrive as "image.png" with no unique name: give each a stable, readable one.
      !f.name || f.name === "image.png" ? new File([f], `pasted-${Date.now()}-${i}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: f.type }) : f,
    );
    const skipped = incoming.length - ok.length;
    setFiles((prev) => {
      const next = [...prev.filter((f) => !isVideo(f)), ...ok].slice(0, MAX_FILES);
      const dropped = prev.length + ok.length - next.length;
      setNote(skipped || dropped ? `${skipped ? `${skipped} file(s) skipped (images or audio up to 10 MB, video up to 50 MB / 60s). ` : ""}${dropped ? `Max ${MAX_FILES} attachments.` : ""}`.trim() : undefined);
      return next;
    });
  }
  const prev0 = (l: File[]) => l.some((f) => f.type.startsWith("image/"));
  const remove = (i: number) => setFiles((prev) => prev.filter((_, j) => j !== i));

  async function submit() {
    if (busy || extracting || (!text.trim() && !files.length)) return;
    let list: FileList | undefined;
    if (files.length) {
      const dt = new DataTransfer();
      for (const f of files) {
        if (!isVideo(f)) { dt.items.add(f); continue; }
        setExtracting(true);
        setNote(`Reading ${VIDEO_FRAMES} frames from the video…`);
        try {
          (await extractFrames(f)).forEach((fr) => dt.items.add(fr));
        } catch (e) {
          setExtracting(false);
          setNote((e as Error).message || "Could not read this video. Try a photo instead.");
          return;
        }
        setExtracting(false);
      }
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
                {isVideo(f) ? (
                  <span className="relative block">
                    <video src={`${previews[i]}#t=0.1`} muted playsInline preload="metadata" aria-label={f.name} className="size-16 rounded-md border object-cover" />
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-white">Video</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[i]} alt={f.name} className="size-16 rounded-md border object-cover" />
                )}
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
        placeholder="Describe what is broken, or attach a photo or short video."
        className="max-h-48 min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between">
        <input ref={fileRef} type="file" accept="image/*,audio/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
        <Button type="button" variant="ghost" size="icon" aria-label="Attach image, video or audio" onClick={() => fileRef.current?.click()}>
          <Paperclip />
        </Button>
        {busy ? (
          <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={onStop}><Square /></Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={extracting}><ArrowUp /></Button>
        )}
      </div>
    </form>
  );
}
