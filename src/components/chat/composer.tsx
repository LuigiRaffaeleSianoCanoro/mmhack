"use client";
import { useRef, useState } from "react";
import { ArrowUp, FileAudio, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  const [files, setFiles] = useState<FileList | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (busy || (!text.trim() && !files?.length)) return;
    onSend(text, files);
    setText("");
    setFiles(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="ribbed-glass overflow-hidden rounded-xl border p-2 transition-colors focus-within:border-mm-accent/50"
    >
      {files && files.length > 0 && (
        <div className="flex flex-wrap gap-2 p-1">
          {Array.from(files).map((f) => (
            <span key={f.name} className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs">
              {f.type.startsWith("audio/") ? <FileAudio className="size-3.5" /> : <Paperclip className="size-3.5" />}
              <span className="max-w-40 truncate">{f.name}</span>
              <button type="button" aria-label="Remove attachments" onClick={() => { setFiles(undefined); if (fileRef.current) fileRef.current.value = ""; }}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Describe what is broken, or attach a photo."
        className="max-h-48 min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between">
        <input ref={fileRef} type="file" accept="image/*,audio/*" multiple hidden onChange={(e) => setFiles(e.target.files ?? undefined)} />
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
