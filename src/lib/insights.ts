import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

/*
  Insights articles live as Markdown files in src/content/insights with a small frontmatter block:

  ---
  title: ...
  description: ...        (meta description, ~150 chars)
  category: taxes | payroll | getting-paid | bookkeeping | running
  summary: ...            (the 40–60 word direct answer shown at the top)
  keywords: a, b, c
  published: 2026-09-27
  updated: 2026-09-27
  reviewer: ...           (optional: name and credentials of the professional reviewer)
  featured: true          (optional)
  ---

  "## Frequently asked questions" with "### Question?" subheadings becomes FAQPage structured data.
*/

export const CATEGORIES = {
  taxes: { name: "Taxes", blurb: "VAT, WHT, PAYE and company tax under the 2026 rules, explained for companies." },
  payroll: { name: "Payroll & people", blurb: "Paying staff and contractors correctly: PAYE, pension and everything in between." },
  "getting-paid": { name: "Getting paid & cash flow", blurb: "Invoices, deposits and collections that keep cash coming in." },
  bookkeeping: { name: "Bookkeeping & reports", blurb: "The routines and reports that tell you how the company is really doing." },
  running: { name: "Running a company", blurb: "Tools, terms and decisions every Nigerian company owner faces." },
} as const;
export type Category = keyof typeof CATEGORIES;

export type Faq = { q: string; a: string };
export type Article = {
  slug: string; title: string; description: string; category: Category; summary: string; keywords: string[];
  published: string; updated: string; reviewer?: string; featured: boolean;
  html: string; toc: { id: string; text: string }[]; faqs: Faq[]; readingMinutes: number; words: number;
};

const DIR = join(process.cwd(), "src", "content", "insights");

const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parse(file: string): Article {
  const raw = readFileSync(join(DIR, file), "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`Missing frontmatter in ${file}`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = m[2];

  // FAQs from the "Frequently asked questions" section, for FAQPage schema.
  const faqs: Faq[] = [];
  const faqBlock = /## Frequently asked questions\n([\s\S]*?)(?=\n## |\s*$)/.exec(body)?.[1] ?? "";
  for (const part of faqBlock.split(/\n### /).slice(1)) {
    const [q, ...rest] = part.split("\n");
    const a = rest.join(" ").replace(/\*\*|__|\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
    if (q && a) faqs.push({ q: q.trim(), a });
  }

  // H2s get ids for the table of contents; external links open in a new tab.
  const toc: { id: string; text: string }[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = marked.Parser.parseInline(tokens);
    const id = slugify(text);
    if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  renderer.link = ({ href, tokens }) => {
    const text = marked.Parser.parseInline(tokens);
    const external = /^https?:\/\//.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
  };
  renderer.table = (token) => {
    const head = token.header.map((c) => `<th scope="col">${marked.Parser.parseInline(c.tokens)}</th>`).join("");
    const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td>${marked.Parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("");
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const html = marked.parse(body, { renderer, async: false }) as string;
  const words = body.split(/\s+/).length;

  return {
    slug: file.replace(/\.md$/, ""),
    title: meta.title,
    description: meta.description,
    category: (meta.category as Category) in CATEGORIES ? (meta.category as Category) : "running",
    summary: meta.summary,
    keywords: (meta.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean),
    published: meta.published,
    updated: meta.updated ?? meta.published,
    reviewer: meta.reviewer || undefined,
    featured: meta.featured === "true",
    html, toc, faqs, words,
    readingMinutes: Math.max(2, Math.round(words / 220)),
  };
}

let cache: Article[] | null = null;
export function allArticles(): Article[] {
  if (!cache || process.env.NODE_ENV !== "production") {
    cache = readdirSync(DIR).filter((f) => f.endsWith(".md")).map(parse).sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title));
  }
  return cache;
}

export function getArticle(slug: string) {
  return allArticles().find((a) => a.slug === slug);
}

export function related(article: Article, n = 3) {
  const same = allArticles().filter((a) => a.slug !== article.slug && a.category === article.category);
  const others = allArticles().filter((a) => a.slug !== article.slug && a.category !== article.category);
  return [...same, ...others].slice(0, n);
}
