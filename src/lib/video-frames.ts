"use client";
// Video upload: the browser samples a few evenly spaced frames to JPEG and sends them
// through the existing photo path (gpt-5 vision). The video itself never leaves the device.

export const VIDEO_FRAMES = 5;
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const FRAME_PREFIX = "video-frame-";
const FRAME_MAX_BYTES = 4 * 1024 * 1024;

export const isVideo = (f: File) => VIDEO_TYPES.includes(f.type) || /\.(mp4|mov|webm)$/i.test(f.name);

function load(file: File): Promise<{ v: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadedmetadata = () => resolve({ v, url });
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This video format can't be read in your browser.")); };
    v.src = url;
  });
}

/** Returns an error string if the video is not acceptable, else null. */
export async function checkVideo(file: File): Promise<string | null> {
  if (file.size > VIDEO_MAX_BYTES) return `Video too large (max ${VIDEO_MAX_BYTES / 1048576} MB).`;
  try {
    const { v, url } = await load(file);
    const d = v.duration;
    URL.revokeObjectURL(url);
    if (Number.isFinite(d) && d > VIDEO_MAX_SECONDS + 0.5) return `Video too long (max ${VIDEO_MAX_SECONDS}s).`;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("seek timeout")), 8000);
    v.onseeked = () => { clearTimeout(to); resolve(); };
    v.currentTime = t;
  });

const toBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));

/** Extracts VIDEO_FRAMES evenly spaced JPEG frames (~1024px long edge, ~0.8 quality). */
export async function extractFrames(file: File): Promise<File[]> {
  const { v, url } = await load(file);
  try {
    let d = v.duration;
    if (!Number.isFinite(d) || d <= 0) d = 1;
    const scale = Math.min(1, 1024 / Math.max(v.videoWidth || 1024, v.videoHeight || 1024));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((v.videoWidth || 1024) * scale));
    c.height = Math.max(1, Math.round((v.videoHeight || 576) * scale));
    const ctx = c.getContext("2d")!;
    const out: File[] = [];
    for (let i = 0; i < VIDEO_FRAMES; i++) {
      await seek(v, Math.min(d - 0.05, (d * (i + 0.5)) / VIDEO_FRAMES));
      ctx.drawImage(v, 0, 0, c.width, c.height);
      let q = 0.8;
      let b = await toBlob(c, q);
      while (b && b.size > FRAME_MAX_BYTES && q > 0.3) b = await toBlob(c, (q -= 0.2));
      if (!b) throw new Error("Could not read frames from this video.");
      out.push(new File([b], `${FRAME_PREFIX}${i + 1}-of-${VIDEO_FRAMES}.jpg`, { type: "image/jpeg" }));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
