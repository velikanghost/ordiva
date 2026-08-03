import { z } from "zod";
import type { AppConfig } from "../config.js";
import { requestJson } from "./http.js";
import type { AdapterDefinition } from "./types.js";

const inputSchema = z.object({
  query: z.string().trim().min(3).max(500),
  maxResults: z.number().int().min(1).max(10).default(5),
  searchDepth: z.enum(["basic", "advanced"]).default("basic")
});

const outputSchema = z.object({
  query: z.string(),
  answer: z.string().nullable(),
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    snippet: z.string(),
    score: z.number().nullable()
  })),
  upstreamRequestId: z.string().nullable()
});

const rawSchema = z.object({
  query: z.string().optional(),
  answer: z.string().nullish(),
  request_id: z.string().nullish(),
  results: z.array(z.object({
    title: z.string().default("Untitled"),
    url: z.string().url(),
    content: z.string().default(""),
    score: z.number().nullish()
  }).passthrough()).default([])
}).passthrough();

export function tavilyAdapter(config: AppConfig): AdapterDefinition<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> {
  return {
    id: "tavily-search",
    operator: "ordiva",
    upstreamProvider: "Tavily",
    capability: "supplier_search",
    description: "Web search optimized for supplier discovery and source evidence.",
    method: "POST",
    path: "/v1/suppliers/tavily-search",
    price: config.PRICE_TAVILY_SEARCH,
    inputSchema,
    outputSchema,
    configured: Boolean(config.TAVILY_API_KEY),
    async execute(input, context) {
      const raw = await requestJson("Tavily", "https://api.tavily.com/search", {
        method: "POST",
        headers: {
          authorization: `Bearer ${context.config.TAVILY_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          query: input.query,
          max_results: input.maxResults,
          search_depth: input.searchDepth,
          include_answer: false,
          include_raw_content: false
        })
      }, context.fetch);
      const parsed = rawSchema.parse(raw);
      return {
        query: parsed.query ?? input.query,
        answer: parsed.answer ?? null,
        results: parsed.results.map((result) => ({
          title: result.title,
          url: result.url,
          snippet: result.content,
          score: result.score ?? null
        })),
        upstreamRequestId: parsed.request_id ?? null
      };
    }
  };
}
