/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const https = require("https");

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1UOzvgKyRA28wxZ7WiZ4eWSMVpSuPbPLwPhQ2c2wbHOg/gviz/tq?tqx=out:json&gid=0";
const FALLBACK = [
  {
    slug: "welcome",
    date: "2024-02-01",
    published: true
  }
];

const BASE_URL = "https://zorkeeler.com";
const STATIC_URLS = [
  { loc: `${BASE_URL}/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/buy/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/sell/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/neighborhoods/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/about/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/services/local-expertise/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/services/trusted-guidance/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/services/negotiation-marketing/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/dmca/`, lastmod: "2024-11-05" },
  { loc: `${BASE_URL}/blog/`, lastmod: "2024-11-05" }
];

const fetchSheet = url =>
  new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Sheet request failed: ${res.statusCode}`));
          return;
        }
        let body = "";
        res.on("data", chunk => {
          body += chunk;
        });
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });

const toCamel = label =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, chr) => chr.toUpperCase())
    .replace(/[^a-z0-9]/g, "");

const parseSheet = text => {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Invalid sheet response");
  }
  const payload = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  const cols = (payload.table?.cols || []).map(col => toCamel(col.label || col.id || ""));
  const rows = payload.table?.rows || [];
  return rows.map(row => {
    const record = {};
    (row.c || []).forEach((cell, index) => {
      const key = cols[index];
      if (!key || !cell) return;
      let value = cell.f ?? cell.v;
      if (value === null || value === undefined || value === "") return;
      if (typeof value === "string" && /^Date\(/.test(value)) {
        const match = value.match(/^Date\((\d+),(\d+),(\d+)\)/);
        if (match) {
          const [, year, month, day] = match.map(Number);
          value = new Date(year, month, day).toISOString().slice(0, 10);
        }
      } else if (typeof value === "object" && typeof value.year === "number") {
        value = new Date(value.year, value.month || 0, value.day || 1).toISOString().slice(0, 10);
      }
      record[key] = typeof value === "string" ? value.trim() : value;
    });
    return record;
  });
};

const slugify = (value = "") =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `post-${Date.now()}`;

const shouldPublish = status => {
  if (status === undefined || status === null || status === "") return true;
  const flag = String(status).toLowerCase();
  return ["true", "yes", "y", "1", "publish", "published", "live"].includes(flag);
};

const loadPosts = async () => {
  try {
    const text = await fetchSheet(SHEET_URL);
    const rows = parseSheet(text);
    const merged = new Map();
    [...FALLBACK, ...rows].forEach(entry => {
      const slug = slugify(entry.slug || entry.title || "");
      if (!slug) return;
      if (!shouldPublish(entry.published || entry.publish || entry.status)) return;
      const date = entry.date || entry.published || entry.publishDate;
      merged.set(slug, {
        slug,
        date: date || null
      });
    });
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
  } catch (error) {
    console.warn("Unable to fetch sheet. Using fallback posts only.", error);
    return FALLBACK;
  }
};

const formatUrlEntry = ({ loc, lastmod }) => {
  const mod = lastmod || new Date().toISOString().slice(0, 10);
  return `  <url><loc>${loc}</loc><lastmod>${mod}</lastmod></url>`;
};

const buildSitemap = async () => {
  const posts = await loadPosts();
  const postEntries = posts.map(post => ({
    loc: `${BASE_URL}/blog/post/?slug=${encodeURIComponent(post.slug)}`,
    lastmod: post.date || new Date().toISOString().slice(0, 10)
  }));

  const urls = [...STATIC_URLS, ...postEntries]
    .map(formatUrlEntry)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  const target = path.join(process.cwd(), "sitemap.xml");
  fs.writeFileSync(target, xml);
  console.log(`Sitemap updated with ${postEntries.length} blog entries.`);
};

buildSitemap().catch(error => {
  console.error("Failed to update sitemap:", error);
  process.exitCode = 1;
});
