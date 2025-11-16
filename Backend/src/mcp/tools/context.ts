import { z } from "zod";
import { createTool } from "../registry";
import { PLAYBOOK, renderSection, ContextSection } from "./playbook";

/** Guard-rail so a model cannot ask for the whole corpus in one call. */
export const MAX_CONTEXT_SECTIONS = 3;

const topicSchema = z.object({
  topic: z
    .string()
    .min(2)
    .max(200)
    .describe("What the answer is about, e.g. 'headlines' or 'social proof'"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_CONTEXT_SECTIONS)
    .optional()
    .describe(`Maximum sections to return (default ${MAX_CONTEXT_SECTIONS})`),
});

/**
 * Rank sections against a query by keyword and title hits.
 *
 * Exported because the scoring, not the wrapper, is the part worth testing.
 */
export function rankSections(
  topic: string,
  sections: ReadonlyArray<ContextSection> = PLAYBOOK,
): Array<{ section: ContextSection; score: number }> {
  const words = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  return sections
    .map((section) => {
      let score = 0;
      const title = section.title.toLowerCase();
      const haystack = section.body.join(" ").toLowerCase();
      for (const word of words) {
        if (section.keywords.some((k) => k.includes(word))) score += 3;
        if (title.includes(word)) score += 2;
        if (haystack.includes(word)) score += 1;
      }
      return { section, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.section.id.localeCompare(b.section.id));
}

export const getContextTool = createTool({
  name: "get_context",
  description:
    "Search the ad-copy playbook and return the sections most relevant to a topic.",
  inputSchema: topicSchema,
  handler: ({ topic, limit }) => {
    const ranked = rankSections(topic).slice(0, limit ?? MAX_CONTEXT_SECTIONS);
    if (ranked.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No playbook section matches "${topic}". Try list_context_sections to see what is available.`,
          },
        ],
        structuredContent: { topic, matches: [] },
        isError: false,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: ranked.map((entry) => renderSection(entry.section)).join("\n\n"),
        },
      ],
      structuredContent: {
        topic,
        matches: ranked.map((entry) => ({
          id: entry.section.id,
          title: entry.section.title,
          score: entry.score,
        })),
      },
    };
  },
});

export const listContextSectionsTool = createTool({
  name: "list_context_sections",
  description:
    "List every section id and title in the ad-copy playbook, for picking a topic.",
  inputSchema: z.object({}),
  handler: () => ({
    content: [
      {
        type: "text" as const,
        text: PLAYBOOK.map((s) => `${s.id}: ${s.title}`).join("\n"),
      },
    ],
    structuredContent: {
      sections: PLAYBOOK.map((s) => ({ id: s.id, title: s.title })),
    },
  }),
});
