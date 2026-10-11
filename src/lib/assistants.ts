/** Each assistant is a "book" on the shelf. Spine colors are content colors (like real book cloth),
 *  muted so the single UI accent (--mm-accent) stays the only saturated interactive color. */
export type Assistant = {
  slug: string;
  title: string;
  author: string; // the "byline" on the spine: which models it leans on
  activity: string;
  blurb: string;
  spine: string; // CSS color for the cloth
  ink: string; // text color on the spine
  type: "serif" | "sans" | "display";
  material: "linen" | "worn" | "leather";
  foil?: boolean; // metallic stamped title
  system: string;
  prefer?: "reason" | "fast";
  starters: string[];
};

export const ASSISTANTS: Assistant[] = [
  {
    slug: "router",
    title: "The Router",
    author: "every model",
    activity: "General",
    blurb: "Ask anything. Each message goes to the cheapest model that can handle it.",
    spine: "oklch(0.32 0.09 293)",
    ink: "oklch(0.93 0.03 293)",
    type: "display",
    material: "leather",
    foil: true,
    system: "You are a concise, helpful general assistant.",
    starters: ["Explain what a model router does in two sentences.", "Send an email to the judges with our demo link."],
  },
  {
    slug: "code",
    title: "Field Guide to Code",
    author: "Claude Sonnet",
    activity: "Engineering",
    blurb: "Debugging, refactors, reviews. Leans on the strongest reasoner.",
    spine: "oklch(0.34 0.05 245)",
    ink: "oklch(0.9 0.02 245)",
    type: "sans",
    material: "linen",
    system: "You are a senior software engineer. Answer with minimal, correct code and short explanations.",
    prefer: "reason",
    starters: ["Plan a 3-step refactor for a messy React component.", "Why does useEffect run twice in dev?"],
  },
  {
    slug: "research",
    title: "Notes on Research",
    author: "Claude + Gemini",
    activity: "Research",
    blurb: "Compare sources, summarize, argue both sides.",
    spine: "oklch(0.78 0.05 90)",
    ink: "oklch(0.25 0.03 90)",
    type: "serif",
    material: "worn",
    system: "You are a careful research assistant. Separate facts from claims and flag uncertainty.",
    prefer: "reason",
    starters: ["Compare RAG and long-context models for a docs bot.", "Summarize the case for and against charter cities."],
  },
  {
    slug: "writing",
    title: "The Plain Style",
    author: "Gemini Flash",
    activity: "Writing",
    blurb: "Tight drafts, rewrites, titles. Fast and cheap.",
    spine: "oklch(0.42 0.11 20)",
    ink: "oklch(0.92 0.03 20)",
    type: "serif",
    material: "leather",
    foil: true,
    system: "You are an editor. Write plainly. Short sentences. No filler. No em dashes.",
    prefer: "fast",
    starters: ["Rewrite this as one punchy sentence: our app routes prompts to models.", "Give me 5 names for a multi-model chatbot."],
  },
  {
    slug: "vision",
    title: "Ways of Seeing",
    author: "GPT-5.4 mini",
    activity: "Images",
    blurb: "Attach an image. Describe, extract, critique.",
    spine: "oklch(0.6 0.08 60)",
    ink: "oklch(0.2 0.02 60)",
    type: "sans",
    material: "linen",
    system: "You are a visual analyst. Describe what is in images precisely.",
    starters: ["Attach an image and ask: what stands out?"],
  },
  {
    slug: "voice",
    title: "Heard, Not Read",
    author: "Gemini audio",
    activity: "Audio",
    blurb: "Attach a voice memo (wav or mp3). Transcribe and act on it.",
    spine: "oklch(0.26 0.01 285)",
    ink: "oklch(0.8 0.01 285)",
    type: "display",
    material: "worn",
    foil: true,
    system: "You are an audio assistant. Transcribe first, then answer.",
    starters: ["Attach a wav voice memo and ask for action items."],
  },
  {
    slug: "ops",
    title: "Hands on the Wheel",
    author: "human in the loop",
    activity: "Actions",
    blurb: "Anything with side effects waits for your approval first.",
    spine: "oklch(0.45 0.06 160)",
    ink: "oklch(0.93 0.02 160)",
    type: "sans",
    material: "linen",
    foil: true,
    system: "You are an operations agent. Draft actions precisely; never claim you executed them.",
    starters: ["Send a follow-up email to everyone who RSVPed.", "Delete last week's staging deploys."],
  },
];

export const getAssistant = (slug: string) => ASSISTANTS.find((a) => a.slug === slug);
