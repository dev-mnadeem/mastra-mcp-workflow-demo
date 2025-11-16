import { z } from "zod";
import { createTool } from "../registry";

/**
 * Synthetic weather.
 *
 * The original tool in this project returned the constant string "The weather
 * is sunny", which makes a tool-calling demo untestable: every argument gives
 * the same answer, so you cannot tell whether the arguments arrived. This
 * version derives a reading from a hash of the city and date, so it is varied,
 * reproducible, and needs no API key or network. It is not real weather and the
 * tool description says so, because a model reads that description.
 */

const CONDITIONS = [
  "clear",
  "light cloud",
  "overcast",
  "light rain",
  "heavy rain",
  "thunderstorms",
  "fog",
  "snow",
] as const;

const MIN_TEMP_C = -8;
const TEMP_RANGE_C = 36;
const MAX_WIND_KPH = 45;
const MIN_HUMIDITY_PCT = 30;
const HUMIDITY_RANGE_PCT = 60;

/** FNV-1a: small, stable across processes, and good enough to spread inputs. */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export interface WeatherReading {
  city: string;
  date: string;
  condition: string;
  temperatureC: number;
  windKph: number;
  humidityPct: number;
  synthetic: true;
}

export function readingFor(city: string, date: string): WeatherReading {
  const normalised = city.trim().toLowerCase();
  const seed = hashSeed(`${normalised}|${date}`);
  return {
    city: city.trim(),
    date,
    condition: CONDITIONS[seed % CONDITIONS.length],
    temperatureC: MIN_TEMP_C + ((seed >>> 3) % TEMP_RANGE_C),
    windKph: (seed >>> 7) % MAX_WIND_KPH,
    humidityPct: MIN_HUMIDITY_PCT + ((seed >>> 11) % HUMIDITY_RANGE_PCT),
    synthetic: true,
  };
}

export function describeReading(reading: WeatherReading): string {
  return [
    `${reading.city} on ${reading.date}: ${reading.condition}.`,
    `Temperature ${reading.temperatureC} C, wind ${reading.windKph} kph, humidity ${reading.humidityPct}%.`,
    "(Synthetic reading - deterministic from city and date, not a live forecast.)",
  ].join(" ");
}

export const getWeatherTool = createTool({
  name: "get_weather",
  description:
    "Get a synthetic, deterministic weather reading for a city. Not a live forecast.",
  inputSchema: z.object({
    city: z.string().min(1).max(100).describe("City name, e.g. 'London'"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("ISO date (YYYY-MM-DD). Defaults to today."),
  }),
  handler: ({ city, date }) => {
    const day = date ?? new Date().toISOString().slice(0, 10);
    const reading = readingFor(city, day);
    return {
      content: [{ type: "text" as const, text: describeReading(reading) }],
      structuredContent: { ...reading },
    };
  },
});
