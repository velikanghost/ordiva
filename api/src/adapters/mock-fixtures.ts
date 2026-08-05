export function getMockAdapterOutput(adapterId: string, input: any): unknown {
  switch (adapterId) {
    case "tavily-search":
      return {
        query: typeof input?.query === "string" ? input.query : "industrial pump suppliers Rotterdam",
        answer: "Discovered several verified industrial pump manufacturers operating in Rotterdam port area.",
        results: [
          {
            title: "Aster Fiberworks & Pump Systems",
            url: "https://aster-fiberworks.example",
            snippet: "Leading industrial pump manufacturer specializing in chemical and marine fluid handling solutions in Rotterdam.",
            score: 0.96
          },
          {
            title: "Northline Fluid Solutions",
            url: "https://northline-pulp.example",
            snippet: "Custom industrial pump assemblies and high-pressure fluid displacement equipment.",
            score: 0.91
          },
          {
            title: "Morrow Engineering BV",
            url: "https://morrow-formed.example",
            snippet: "Rotterdam-based industrial pump distributor and certified OEM service provider.",
            score: 0.88
          }
        ],
        upstreamRequestId: "mock-tavily-req-101"
      };

    case "firecrawl-search":
      return {
        results: [
          {
            title: "Aster Fiberworks & Pump Systems",
            url: "https://aster-fiberworks.example",
            description: "Industrial pump manufacturer in Rotterdam with ISO 9001 certification."
          },
          {
            title: "Northline Fluid Solutions",
            url: "https://northline-pulp.example",
            description: "High-capacity industrial pump systems and export-ready assemblies."
          },
          {
            title: "Morrow Engineering BV",
            url: "https://morrow-formed.example",
            description: "Industrial pump supplier serving Rotterdam port and European industrial hubs."
          }
        ],
        searchId: "mock-firecrawl-search-202",
        creditsUsed: 1
      };

    case "firecrawl-scrape": {
      const targetUrl = typeof input?.url === "string" ? input.url : "https://aster-fiberworks.example";
      const markdownContent = `# Supplier Evidence & Verification\n\n` +
        `**Company**: Industrial Pump Solutions\n` +
        `**Location**: Port of Rotterdam, Netherlands\n` +
        `**Certifications**: ISO 9001:2015, CE Marking\n\n` +
        `## Capabilities\n` +
        `We manufacture heavy-duty centrifugal pumps, positive displacement pumps, and custom hydraulic power units for industrial and marine applications.\n\n` +
        `## Lead Times & Capacity\n` +
        `Standard pilot orders: 2-3 weeks. Full production runs: 6-8 weeks.\n\n` +
        `## Contact & Procurement\n` +
        `Direct sales office: sales@supplier-example.com | Phone: +31 10 555 0192`;

      const maxChars = typeof input?.maxCharacters === "number" ? input.maxCharacters : 12000;
      const truncated = markdownContent.length > maxChars;

      return {
        url: targetUrl,
        title: "Supplier Evidence — Industrial Pump Solutions",
        description: "Official product catalog and manufacturing capability verification page.",
        markdown: markdownContent.slice(0, maxChars),
        links: [`${targetUrl}/products`, `${targetUrl}/contact`, `${targetUrl}/iso-certificate`],
        truncated,
        scrapeId: "mock-firecrawl-scrape-303"
      };
    }

    case "apollo-company-enrich": {
      const domain = typeof input?.domain === "string" ? input.domain : "aster-fiberworks.example";
      const name = typeof input?.name === "string" ? input.name : "Aster Fiberworks & Pump Systems";
      return {
        id: "mock-apollo-org-404",
        name,
        website: input?.website ?? `https://${domain}`,
        industry: "Industrial Machinery & Fluid Systems",
        estimatedEmployees: 65,
        foundedYear: 2008,
        phone: "+31 10 555 0192",
        linkedinUrl: `https://linkedin.com/company/${domain.split(".")[0]}`,
        city: "Rotterdam",
        country: "Netherlands"
      };
    }

    case "firecrawl-contacts": {
      const siteUrl = typeof input?.url === "string" ? input.url : "https://aster-fiberworks.example";
      return {
        siteUrl,
        pagesScanned: [
          { url: `${siteUrl}/contact`, title: "Contact Us — Sales & Procurement" },
          { url: `${siteUrl}/about`, title: "About Our Company" }
        ],
        contacts: [
          { email: "sales@supplier-example.com", sourceUrl: `${siteUrl}/contact` },
          { email: "info@supplier-example.com", sourceUrl: `${siteUrl}/about` }
        ]
      };
    }

    case "resend-email":
      return {
        messageId: "mock-resend-msg-505",
        to: typeof input?.to === "string" ? input.to : "supplier@example.com",
        accepted: true as const
      };

    default:
      throw new Error(`No mock fixture registered for adapter: ${adapterId}`);
  }
}
