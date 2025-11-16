/**
 * The knowledge base the `context` tools read.
 *
 * It is a literal in source rather than a database because the point of the
 * demo is the protocol, not the storage. `ContextSection` is the shape a real
 * backing store would have to return, so swapping the array for a query is a
 * one-function change in `context.ts`.
 */
export interface ContextSection {
  id: string;
  title: string;
  keywords: string[];
  body: string[];
}

export const PLAYBOOK: ReadonlyArray<ContextSection> = [
  {
    id: "start-with-the-customer",
    title: "Start with the customer",
    keywords: ["customer", "research", "feedback", "reviews", "voice"],
    body: [
      "Review customer feedback, product reviews, and FAQs.",
      "Pull out the words your customers use most often - these are gold for headlines.",
    ],
  },
  {
    id: "lead-with-one-benefit",
    title: "Lead with one clear benefit",
    keywords: ["benefit", "headline", "copy", "message", "value"],
    body: [
      "Do not list everything at once. Pick the single most compelling benefit.",
      "Write a headline that makes the reader say: that is exactly what I need.",
    ],
  },
  {
    id: "use-simple-visuals",
    title: "Use simple visuals",
    keywords: ["visual", "image", "design", "photo", "creative"],
    body: [
      "Product in focus - clean background, high contrast.",
      "Show the transformation if possible (before/after, problem/solution).",
      "Keep text on the image short and bold.",
    ],
  },
  {
    id: "mirror-emotions",
    title: "Mirror emotions",
    keywords: ["emotion", "feeling", "tone", "empathy"],
    body: [
      "Tap into how the customer feels before and after using the product.",
      'Use emotion-driven words ("finally", "no more", "so easy").',
    ],
  },
  {
    id: "build-social-proof",
    title: "Build social proof",
    keywords: ["proof", "testimonial", "review", "rating", "trust"],
    body: [
      "Feature a short customer quote, rating, or proof point.",
      "This builds instant credibility.",
    ],
  },
  {
    id: "thumb-stop-friendly",
    title: "Keep it thumb-stop friendly",
    keywords: ["attention", "scroll", "hook", "colour", "color", "font"],
    body: [
      "Ads must grab attention fast - test bold colours, clear fonts, surprising imagery.",
      "The first second matters most.",
    ],
  },
  {
    id: "clear-cta",
    title: "End with a clear call to action",
    keywords: ["cta", "action", "click", "convert", "button"],
    body: [
      "Tell the user exactly what to do next: Shop Now, Try Today, Learn More.",
      "Place the CTA where it is obvious and easy to click.",
    ],
  },
];

export function renderSection(section: ContextSection): string {
  return [`## ${section.title}`, ...section.body.map((l) => `- ${l}`)].join("\n");
}
