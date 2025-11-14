import fs from "fs";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(".");
const NEIGHBORHOODS_ROOT = path.join(ROOT, "neighborhoods");
const DATA_FILE = path.join(ROOT, "assets/js/neighborhoods-data.js");

const COLOR_PALETTE = [
  ["#e8efff", "#c7d9ff"],
  ["#ffe7db", "#ffcfb3"],
  ["#e6f7ee", "#c8efd8"],
  ["#f7eaff", "#e0c9ff"],
  ["#fff7d9", "#ffe9a7"],
  ["#e0f4ff", "#c1e8ff"]
];

function loadNeighborhoodData(filePath){
  if (!fs.existsSync(filePath)) throw new Error(`Missing data file: ${filePath}`);
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "neighborhoods-data.js" });
  return sandbox.window?.NEIGHBORHOODS || {};
}

function slugToTitle(slug){
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Neighborhood";
}

function escapeHtml(str){
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collectPages(){
  const pages = [];
  function walk(currentDir){
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries){
      if (!entry.isDirectory()) continue;
      const subdir = path.join(currentDir, entry.name);
      const indexPath = path.join(subdir, "index.html");
      if (fs.existsSync(indexPath)){
        const relative = path.relative(NEIGHBORHOODS_ROOT, subdir).split(path.sep).filter(Boolean);
        if (!relative.length) continue;
        const slug = relative[relative.length - 1];
        const segmentParts = relative.slice(0, -1);
        pages.push({ indexPath, slug, segmentParts });
        continue;
      }
      walk(subdir);
    }
  }
  walk(NEIGHBORHOODS_ROOT);
  return pages;
}

function buildNeighborLinks(segmentKey, siblings, dataMap, options = {}){
  const {
    currentSlug = "",
    excludeCurrent = false,
    fallbackLabel = "",
    limit = Infinity
  } = options;

  const peers = (siblings.get(segmentKey) || [])
    .filter(slug => (!excludeCurrent || slug !== currentSlug))
    .filter(slug => Boolean(dataMap[slug]));

  const sortedPeers = peers
    .map(slug => ({ slug, name: dataMap[slug]?.name || slugToTitle(slug) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const limited = Number.isFinite(limit) ? sortedPeers.slice(0, limit) : sortedPeers;

  if (!limited.length) {
    return fallbackLabel
      ? `      <li><a class="neigh-link" href="/neighborhoods/">${fallbackLabel}</a></li>`
      : "";
  }

  return limited.map(({ slug, name }) => {
    const href = segmentKey
      ? `/neighborhoods/${segmentKey}/${slug}/`
      : `/neighborhoods/${slug}/`;
    return `      <li><a class="neigh-link" href="${href}">${escapeHtml(name)}</a></li>`;
  }).join("\n\n");
}

function buildHtml({ slug, segmentParts, indexPath, data, neighborHtml, altNeighborHtml, altNeighborHeading }){
  const name = data.name || slugToTitle(slug);
  const city = data.city || slugToTitle(segmentParts[0] || "Seattle");
  const subtitle = data.subtitle || "Local amenities, housing mix, and neighborhood insights.";
  const canonicalPathParts = [...segmentParts, slug].filter(Boolean).join("/");
  const canonicalUrl = `https://zorkeeler.com/neighborhoods/${canonicalPathParts}/`;
  const title = `${name}, ${city} – Homes, Housing Market & Neighborhood Guide`;
  const metaDesc = `${name} in ${city}: homes, housing mix, getting around, and local insights curated for buyers and sellers.`;
  const ogTitle = `${name}, ${city} – Homes & Neighborhood Guide`;
  const faqSchema = {
    "@context":"https://schema.org",
    "@type":"FAQPage",
    "mainEntity":[
      {
        "@type":"Question",
        "name":`Is ${name} a good place to live in ${city}?`,
        "acceptedAnswer":{
          "@type":"Answer",
          "text":`${name} in ${city} offers neighborhood retail, parks, and quick access across the city—details update automatically from the latest market data on this page.`
        }
      },
      {
        "@type":"Question",
        "name":`What types of homes are in ${name}?`,
        "acceptedAnswer":{
          "@type":"Answer",
          "text":`${name} includes a mix of single-family homes, small multifamily buildings, and condos, with specifics refreshed from current neighborhood data.`
        }
      }
    ]
  };

  const heroImage = data.heroImage || "/assets/img/Seattle%20Homes.jpg";
  const heroClass = heroImage ? " page-hero--with-image" : "";
  const heroStyle = heroImage ? ` style="--hero-image:url('${escapeHtml(heroImage)}')"` : "";
  const monthYearShort = new Date().toLocaleString("en-US", { month: "short", year: "numeric" });
  const atGlanceTitle = `${name} Snapshot`;
  const atGlanceSubhead = `Averages for ${monthYearShort}`;
  const zillowQuery = encodeURIComponent(`${name} ${city}`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- SEO: neighborhood-specific, keyword-rich -->
  <title id="meta-title">${escapeHtml(title)}</title>
  <meta id="meta-desc" name="description" content="${escapeHtml(metaDesc)}">
  <link rel="canonical" id="meta-canon" href="${escapeHtml(canonicalUrl)}">

  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/theme.css">

  <script defer src="/assets/js/site.js"></script>
  <script defer src="/assets/js/neighborhoods-data.js"></script>
  <script defer src="/assets/js/neighborhood-page.js"></script>

  <!-- Social -->
  <meta property="og:type" content="website">
  <meta property="og:title" id="og-title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" id="og-desc" content="${escapeHtml(metaDesc)}">
  <meta property="og:url" id="og-url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="/assets/img/og.jpg">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Site schema -->
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebSite","name":"Zor Keeler | Seattle Real Estate","url":"https://zorkeeler.com"}
  </script>

  <!-- FAQ schema -->
  <script type="application/ld+json">
  ${JSON.stringify(faqSchema)}
  </script>
</head>

<body data-slug="${slug}">
<header class="header" role="banner">
  <div class="inner">
    <a class="brand" href="/"><span class="brand-name">Zor Keeler</span><span class="brand-divider" aria-hidden="true"></span><img class="brand-mark mark-blue" src="/assets/img/TEC_blue_crop.png" alt="TEC Real Estate, Inc."><img class="brand-mark mark-white" src="/assets/img/TEC_white_crop.png" alt=""></a>
    <button class="menu-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="site-menu">
      <span class="line"></span><span class="line"></span><span class="line"></span>
    </button>
    <nav id="site-menu" class="nav" aria-label="Primary">
      <a href="/buy/">Buy</a>
      <a href="/sell/">Sell</a>
      <a href="/neighborhoods/">Neighborhoods</a>
      <a href="/blog/">Blog</a>
      <a href="/about/">About</a>
      <a class="cta" href="tel:2069473858">206-947-3858</a>
    </nav>
  </div>
</header>

<section class="page-hero page-hero--light neighborhood-detail-hero${heroClass}"${heroStyle}>
  <div class="wrap split">
    <div>
      <div class="kicker">Neighborhood Guide</div>
      <h1 id="nh-name">${escapeHtml(name)}</h1>
      <p class="lead" id="nh-sub">${escapeHtml(subtitle)}</p>
    </div>
    <section class="atglance card">
      <h3>${escapeHtml(atGlanceTitle)}</h3>
      <div class="atglance-subrow">
        <p class="atglance-sub">${escapeHtml(atGlanceSubhead)}</p>
        <button type="button" class="atglance-info" aria-label="Monthly market snapshot info" data-tip="Data pulled monthly from NWMLS and is a general market estimate.">i</button>
      </div>
      <ul id="nh-bullets" class="not-loaded"></ul>
    </section>
  </div>
</section>

<section class="section homes-section">
  <div class="wrap">
    <div class="kicker">What's Built Here</div>
    <h2>Home Types in <span id="nh-name-homes">${escapeHtml(name)}</span></h2>
    <p id="nh-homes">Housing mix, era, and layout notes load here.</p>

    <div class="infoparagraph">
      <div class="kicker">Why People Live Here</div>
      <h2><span id="nh-name-vibes">${escapeHtml(name)}</span> Neighborhood Vibes</h2>
      <p id="nh-vibes">Lifestyle, pace, and character notes load here.</p>
    </div>

    <div class="infoparagraph">
      <div class="kicker">How to Get Around</div>
      <h2>Getting Around <span id="nh-name-transportation">${escapeHtml(name)}</span></h2>
      <p id="nh-around">Transit, commute, and circulation notes load here.</p>
    </div>
  </div>
</section>

<section class="section insight-section">
  <div class="wrap insight">
    <img class="insight-avatar" src="/assets/img/zor-keeler.jpg" alt="Zor Keeler headshot">
    <div class="insight-bubble">
      <div class="insight-label">Zor's insights</div>
      <p id="nh-insights">Local insights load here.</p>
    </div>
  </div>
</section>

<section class="section map-section" id="nh-map-section">
  <div class="wrap map-wrap">
    <div class="map-head">
      <div>
        <div class="kicker">On the map</div>
        <h2 id="nh-map-title">Explore homes</h2>
        <p id="nh-map-blurb" class="muted">
          Browse the area on Google below or search listings on Zillow →
        </p>
      </div>
      <a id="nh-zillow" class="btn btn-primary" href="https://www.zillow.com/homes/${zillowQuery}/" target="_blank" rel="noopener">View homes</a>
    </div>

    <div class="map-embed">
      <iframe
        id="nh-map"
        src=""
        allowfullscreen
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade">
      </iframe>
    </div>
  </div>
</section>

<section class="neigh-links">
  <div class="wrap">
    <div class="kicker">Explore nearby</div>
    <ul class="neigh-list">
${neighborHtml}
    </ul>
${altNeighborHtml ? `
    <div class="neigh-alt">
      <div class="kicker">${altNeighborHeading}</div>
      <ul class="neigh-list">
${altNeighborHtml}
      </ul>
    </div>
` : ""}
  </div>
</section>

<footer class="footer">
  <div class="wrap footer-inner">
    <div class="footer-brand">
      <h3 class="footer-heading">Zor Keeler</h3>
      <p class="footer-role">Broker, TEC Real Estate, Inc.</p>
      <div class="footer-contact">
        <a href="tel:2069473858">206-947-3858</a>
        <a href="mailto:zor@zorkeeler.com">zor@zorkeeler.com</a>
      </div>
    </div>
    <div class="footer-column">
      <h4>Explore</h4>
      <ul class="footer-links inline">
        <li><a href="/">Home</a></li>
        <li><a href="/buy/">Buy</a></li>
        <li><a href="/sell/">Sell</a></li>
        <li><a href="/neighborhoods/">Neighborhoods</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/about/">About</a></li>
      </ul>
    </div>
    <div class="footer-column">
      <h4>Resources</h4>
      <ul class="footer-links">
        <li><a href="/about/#contact">Contact</a></li>
        <li><a href="/dmca/">DMCA Notice</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-copy">© <span id="y"></span> Zor Keeler · TEC Real Estate, Inc. · Seattle, WA</div>
</footer>

<!-- Mobile sticky CTA for conversions -->
<div class="sticky-cta" role="navigation" aria-label="Quick actions">
  <a href="/buy/">Buying?</a>
  <a href="/sell/">Selling?</a>
  <a href="tel:2069473858">Call Zor</a>
</div>

</body>
</html>
`;
}

function main(){
  const dataMap = loadNeighborhoodData(DATA_FILE);
  const pages = collectPages();
  const siblingMap = new Map();
  pages.forEach(({ slug, segmentParts }) => {
    const key = segmentParts.join("/");
    if (!siblingMap.has(key)) siblingMap.set(key, []);
    siblingMap.get(key).push(slug);
  });

  let updated = 0;
  for (const page of pages){
    const data = dataMap[page.slug];
    if (!data) {
      console.warn(`[build-neighborhood-pages] Skipping ${page.slug} (no data in neighborhoods-data.js)`);
      continue;
    }
    const segmentKey = page.segmentParts.join("/");
    const regionKey = page.segmentParts[0] || "";
    const neighborHtml = buildNeighborLinks(segmentKey, siblingMap, dataMap, {
      currentSlug: page.slug,
      excludeCurrent: true,
      fallbackLabel: "Browse all neighborhoods"
    });
    const altSegmentKey = regionKey === "seattle" ? "eastside" : regionKey === "eastside" ? "seattle" : "";
    const altHeading = regionKey === "seattle"
      ? "Eastside homes"
      : regionKey === "eastside"
        ? "Seattle area places"
        : "";
    const altNeighborHtml = altSegmentKey
      ? buildNeighborLinks(altSegmentKey, siblingMap, dataMap, { limit: 12 })
      : "";

    const html = buildHtml({
      ...page,
      data,
      neighborHtml,
      altNeighborHtml,
      altNeighborHeading: altHeading
    });
    fs.writeFileSync(page.indexPath, html, "utf8");
    updated++;
  }
  console.log(`[build-neighborhood-pages] Updated ${updated} neighborhood pages.`);
}

main();
