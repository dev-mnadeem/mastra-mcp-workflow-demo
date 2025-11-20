import { describe, expect, it } from "vitest";
import {
  MAX_CONTEXT_SECTIONS,
  getContextTool,
  listContextSectionsTool,
  rankSections,
} from "../src/mcp/tools/context";
import { PLAYBOOK } from "../src/mcp/tools/playbook";
import { getWeatherTool, hashSeed, readingFor } from "../src/mcp/tools/weather";
import { buildToolRegistry } from "../src/mcp/tools";

describe("context ranking", () => {
  it("puts a keyword match above a body-only match", () => {
    const ranked = rankSections("social proof rating");
    expect(ranked[0].section.id).toBe("build-social-proof");
    expect(ranked[0].score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("returns nothing when no word matches", () => {
    expect(rankSections("zzzz qqqq")).toEqual([]);
  });

  it("is stable for ties by section id", () => {
    const first = rankSections("customer");
    const second = rankSections("customer");
    expect(first.map((r) => r.section.id)).toEqual(second.map((r) => r.section.id));
  });
});

describe("get_context", () => {
  it("returns at most the section cap", async () => {
    const result = await getContextTool.handler({
      topic: "customer benefit visual cta proof",
    });
    const matches = (result.structuredContent as { matches: unknown[] }).matches;
    expect(matches.length).toBeLessThanOrEqual(MAX_CONTEXT_SECTIONS);
  });

  it("honours an explicit limit", async () => {
    const result = await getContextTool.handler({
      topic: "customer benefit visual",
      limit: 1,
    });
    expect((result.structuredContent as { matches: unknown[] }).matches).toHaveLength(1);
  });

  it("guides the caller when nothing matches", async () => {
    const result = await getContextTool.handler({ topic: "zzzz" });
    expect(result.content[0].text).toContain("list_context_sections");
  });
});

describe("list_context_sections", () => {
  it("lists every playbook section", async () => {
    const result = await listContextSectionsTool.handler({});
    const sections = (result.structuredContent as { sections: unknown[] }).sections;
    expect(sections).toHaveLength(PLAYBOOK.length);
  });
});

describe("synthetic weather", () => {
  it("hashes deterministically", () => {
    expect(hashSeed("london|2026-01-01")).toBe(hashSeed("london|2026-01-01"));
  });

  it("ignores case and surrounding space when seeding", () => {
    const { city: _a, ...plain } = readingFor("London", "2026-01-01");
    const { city: _b, ...padded } = readingFor("  london ", "2026-01-01");
    expect(plain).toEqual(padded);
  });

  it("echoes the city back as the caller wrote it, trimmed", () => {
    expect(readingFor("  London ", "2026-01-01").city).toBe("London");
  });

  it("gives different readings for different cities", () => {
    const london = readingFor("London", "2026-01-01");
    const tokyo = readingFor("Tokyo", "2026-01-01");
    expect(london).not.toEqual(tokyo);
  });

  it("keeps values inside their documented ranges", () => {
    for (const city of ["London", "Tokyo", "Lagos", "Quito", "Oslo", "Lima"]) {
      const reading = readingFor(city, "2026-01-01");
      expect(reading.temperatureC).toBeGreaterThanOrEqual(-8);
      expect(reading.temperatureC).toBeLessThan(28);
      expect(reading.windKph).toBeGreaterThanOrEqual(0);
      expect(reading.windKph).toBeLessThan(45);
      expect(reading.humidityPct).toBeGreaterThanOrEqual(30);
      expect(reading.humidityPct).toBeLessThan(90);
    }
  });

  it("labels the output as synthetic", async () => {
    const result = await getWeatherTool.handler({ city: "London", date: "2026-01-01" });
    expect(result.content[0].text).toContain("Synthetic reading");
    expect(result.structuredContent).toMatchObject({ synthetic: true });
  });
});

describe("registry wiring", () => {
  it("registers the three tools the API advertises", () => {
    expect(buildToolRegistry().names()).toEqual([
      "get_context",
      "get_weather",
      "list_context_sections",
    ]);
  });
});
