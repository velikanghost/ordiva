import { z } from "zod";
import type { AppConfig } from "../config.js";
import { requestJson } from "./http.js";
import type { AdapterDefinition } from "./types.js";
import { PreflightError } from "./types.js";

const scrapeInputSchema = z.object({
  url: z.string().url(),
  maxCharacters: z.number().int().min(1_000).max(30_000).default(12_000),
  maxAgeMs: z.number().int().min(0).max(604_800_000).default(172_800_000)
});

const scrapeOutputSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  markdown: z.string(),
  links: z.array(z.string()),
  truncated: z.boolean(),
  scrapeId: z.string().nullable()
});

const searchInputSchema = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.number().int().min(1).max(10).default(5),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default("NL")
});

const searchOutputSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    description: z.string()
  })),
  searchId: z.string().nullable(),
  creditsUsed: z.number().int().nonnegative().nullable()
});

const contactInputSchema = z.object({
  url: z.string().url(),
  maxPages: z.number().int().min(1).max(5).default(3)
});

const contactOutputSchema = z.object({
  siteUrl: z.string().url(),
  pagesScanned: z.array(z.object({
    url: z.string().url(),
    title: z.string().nullable()
  })),
  contacts: z.array(z.object({
    email: z.string().email(),
    sourceUrl: z.string().url()
  }))
});

const scrapeRawSchema = z.object({
  success: z.boolean(),
  data: z.object({
    markdown: z.string().default(""),
    links: z.array(z.string()).default([]),
    metadata: z.object({
      sourceURL: z.string().url().optional(),
      url: z.string().url().optional(),
      title: z.string().nullish(),
      description: z.string().nullish(),
      scrapeId: z.string().nullish()
    }).passthrough().default({})
  }).passthrough()
}).passthrough();

const searchRawSchema = z.object({
  success: z.boolean(),
  data: z.object({
    web: z.array(z.object({
      title: z.string().default("Untitled"),
      url: z.string().url(),
      description: z.string().default("")
    }).passthrough()).default([])
  }).passthrough(),
  id: z.string().nullish(),
  creditsUsed: z.number().int().nonnegative().nullish()
}).passthrough();

const mapRawSchema = z.object({
  success: z.boolean().optional(),
  links: z.array(z.union([
    z.string().url().transform((url) => ({ url, title: null as string | null })),
    z.object({
      url: z.string().url(),
      title: z.string().nullish()
    }).passthrough().transform((link) => ({ url: link.url, title: link.title ?? null }))
  ])).default([])
}).passthrough();

const blockedEmailTlds = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "css", "js"]);

function assertPublicUrl(value: string): void {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (!["http:", "https:"].includes(url.protocol)) throw new PreflightError("Only HTTP(S) URLs are allowed");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new PreflightError("Private and local URLs are not allowed");
  }
}

function extractEmails(markdown: string): string[] {
  const matches = markdown.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((email) => email.toLowerCase()))]
    .filter((email) => {
      const tld = email.split(".").at(-1);
      return Boolean(tld && !blockedEmailTlds.has(tld));
    })
    .sort();
}

async function scrapePage(url: string, context: { config: AppConfig; fetch: typeof fetch }) {
  const raw = await requestJson("Firecrawl", "https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      authorization: `Bearer ${context.config.FIRECRAWL_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent: true,
      maxAge: 172_800_000,
      blockAds: true,
      removeBase64Images: true
    })
  }, context.fetch, 70_000);
  return scrapeRawSchema.parse(raw).data;
}

export function firecrawlAdapters(config: AppConfig): AdapterDefinition<unknown, unknown>[] {
  const configured = Boolean(config.FIRECRAWL_API_KEY);
  return [
    {
      id: "firecrawl-search",
      operator: "ordiva",
      upstreamProvider: "Firecrawl",
      capability: "supplier_search",
      description: "Geo-targeted web search as an independent supplier-discovery path.",
      method: "POST",
      path: "/v1/suppliers/firecrawl-search",
      price: config.PRICE_FIRECRAWL_SEARCH,
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema,
      configured,
      async execute(rawInput, context) {
        const input = searchInputSchema.parse(rawInput);
        const raw = await requestJson("Firecrawl", "https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            authorization: `Bearer ${context.config.FIRECRAWL_API_KEY}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            query: input.query,
            limit: input.limit,
            sources: ["web"],
            country: input.country,
            ignoreInvalidURLs: true
          })
        }, context.fetch, 70_000);
        const parsed = searchRawSchema.parse(raw);
        return {
          results: parsed.data.web.map((result) => ({
            title: result.title,
            url: result.url,
            description: result.description
          })),
          searchId: parsed.id ?? null,
          creditsUsed: parsed.creditsUsed ?? null
        };
      }
    },
    {
      id: "firecrawl-scrape",
      operator: "ordiva",
      upstreamProvider: "Firecrawl",
      capability: "company_evidence",
      description: "Scrape a supplier website into bounded evidence for verification.",
      method: "POST",
      path: "/v1/evidence/firecrawl-scrape",
      price: config.PRICE_FIRECRAWL_SCRAPE,
      inputSchema: scrapeInputSchema,
      outputSchema: scrapeOutputSchema,
      configured,
      preflight(rawInput) {
        const input = scrapeInputSchema.parse(rawInput);
        assertPublicUrl(input.url);
      },
      async execute(rawInput, context) {
        const input = scrapeInputSchema.parse(rawInput);
        const data = await scrapePage(input.url, context);
        const markdown = data.markdown;
        return {
          url: data.metadata.sourceURL ?? data.metadata.url ?? input.url,
          title: data.metadata.title ?? null,
          description: data.metadata.description ?? null,
          markdown: markdown.slice(0, input.maxCharacters),
          links: data.links.slice(0, 100),
          truncated: markdown.length > input.maxCharacters,
          scrapeId: data.metadata.scrapeId ?? null
        };
      }
    },
    {
      id: "firecrawl-contacts",
      operator: "ordiva",
      upstreamProvider: "Firecrawl",
      capability: "contact_discovery",
      description: "Find publicly listed business emails on a supplier's contact and company pages.",
      method: "POST",
      path: "/v1/contacts/firecrawl-extract",
      price: config.PRICE_FIRECRAWL_CONTACT,
      inputSchema: contactInputSchema,
      outputSchema: contactOutputSchema,
      configured,
      preflight(rawInput) {
        const input = contactInputSchema.parse(rawInput);
        assertPublicUrl(input.url);
      },
      async execute(rawInput, context) {
        const input = contactInputSchema.parse(rawInput);
        const site = new URL(input.url);
        const rawMap = await requestJson("Firecrawl", "https://api.firecrawl.dev/v2/map", {
          method: "POST",
          headers: {
            authorization: `Bearer ${context.config.FIRECRAWL_API_KEY}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            url: input.url,
            search: "contact sales procurement team about",
            sitemap: "include",
            ignoreQueryParameters: true,
            limit: input.maxPages
          })
        }, context.fetch, 70_000);
        const mapped = mapRawSchema.parse(rawMap).links
          .filter((link) => new URL(link.url).hostname === site.hostname)
          .slice(0, input.maxPages);
        const candidates = mapped.length ? mapped : [{ url: input.url, title: null }];
        const pages = await Promise.all(candidates.map(async (candidate) => ({
          candidate,
          data: await scrapePage(candidate.url, context)
        })));
        const contacts = new Map<string, string>();
        for (const page of pages) {
          for (const email of extractEmails(page.data.markdown)) {
            if (!contacts.has(email)) contacts.set(email, page.candidate.url);
          }
        }
        return {
          siteUrl: input.url,
          pagesScanned: pages.map(({ candidate, data }) => ({
            url: candidate.url,
            title: data.metadata.title ?? candidate.title
          })),
          contacts: [...contacts].map(([email, sourceUrl]) => ({ email, sourceUrl }))
        };
      }
    }
  ];
}
