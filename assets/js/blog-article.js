(() => {
  if (!window.BlogData) return;

  const root = document.querySelector(".blog-article");
  if (!root) return;

  const FALLBACK_IMAGE = "/assets/img/Seattle%20Homes.jpg";

  const selectors = {
    title: document.getElementById("article-title"),
    excerpt: document.getElementById("article-excerpt"),
    meta: document.getElementById("article-meta"),
    body: document.getElementById("article-body"),
    tags: document.getElementById("article-tags"),
    footnote: document.getElementById("article-footnote"),
    hero: document.getElementById("article-hero") // optional <img> or <div>
  };

  // ---- helpers -------------------------------------------------------------

  const normalizeDriveUrl = (url) => {
    if (!url || typeof url !== "string") return url;
    if (!/drive\.google\.com/.test(url)) return url;

    // Extract file ID from common patterns
    const id =
      (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] ||
      (url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || [])[1];

    return id ? `https://drive.google.com/uc?export=view&id=${id}` : url;
  };

  const getImageFromPost = (p) => {
    const candidates = [
      p?.image,
      p?.imageUrl,
      p?.image_url,
      p?.imageurl,
      p?.["image url"],
      p?.["Image URL"],
      p?.ImageUrl,
      p?.ImageURL,
    ].filter((v) => typeof v === "string" && v.trim());

    let url = candidates[0] || FALLBACK_IMAGE;
    url = normalizeDriveUrl(url);

    // Make relative paths absolute for meta tags
    const origin = window.location.origin || "https://zorkeeler.com";
    if (url && !/^https?:\/\//i.test(url)) {
      url = origin + url;
    }
    return url;
  };

  const markdownToHtml = (markdown = "") => {
    if (!markdown) return "";
    const raw = markdown.replace(/\r\n/g, "\n").trim();
    if (!raw) return "";
    if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
    const lines = raw.split("\n");
    const html = [];
    let inList = false;

    const closeList = () => {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
    };

    const inline = (text) =>
      text
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/__([^_]+)__/g, "<strong>$1</strong>")
        .replace(/_([^_]+)_/g, "<em>$1</em>")
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener">$1</a>'
        );

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        return;
      }

      if (/^#{1,6}\s/.test(line)) {
        closeList();
        const level = line.match(/^#+/)[0].length;
        const content = inline(line.replace(/^#{1,6}\s*/, "").trim());
        html.push(`<h${level}>${content}</h${level}>`);
        return;
      }

      if (/^[-*]\s+/.test(line)) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        const content = inline(line.replace(/^[-*]\s+/, "").trim());
        html.push(`<li>${content}</li>`);
        return;
      }

      closeList();
      html.push(`<p>${inline(line)}</p>`);
    });

    closeList();
    return html.join("\n");
  };

  const getSlug = () => {
    const param = new URLSearchParams(window.location.search).get("slug");
    if (param) return param;

    const dataSlug = document.body.dataset.slug;
    if (dataSlug) return dataSlug;

    const segments = window.location.pathname.split("/").filter(Boolean);
    const maybeSlug = segments[segments.length - 1];
    if (maybeSlug && maybeSlug !== "post") return maybeSlug;
    return "";
  };

  const upsert = (selector, attr, value) => {
    if (!value) return;
    let el = document.head.querySelector(selector);
    const isMeta = selector.startsWith("meta");
    const isLink = selector.startsWith("link");
    if (!el) {
      el = document.createElement(isMeta ? "meta" : isLink ? "link" : "meta");
      // best effort to set identifying attributes
      if (isMeta && selector.includes('property="')) {
        const m = selector.match(/property="([^"]+)"/);
        if (m) el.setAttribute("property", m[1]);
      } else if (isMeta && selector.includes('name="')) {
        const m = selector.match(/name="([^"]+)"/);
        if (m) el.setAttribute("name", m[1]);
      } else if (isLink && selector.includes('rel="')) {
        const m = selector.match(/rel="([^"]+)"/);
        if (m) el.setAttribute("rel", m[1]);
      }
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };

  const setMetaTags = (post, url) => {
    const title = `${post.title} | Seattle Real Estate Blog | Zor Keeler`;
    const description = post.excerpt || post.metaDescription || "";
    const image = getImageFromPost(post);

    document.title = title;

    upsert('meta[name="description"]', "content", description);
    upsert('meta[property="og:title"]', "content", title);
    upsert('meta[property="og:description"]', "content", description);
    upsert('meta[property="og:url"]', "content", url);
    upsert('meta[property="og:image"]', "content", image);
    upsert('meta[name="twitter:card"]', "content", "summary_large_image");
    upsert('meta[name="twitter:title"]', "content", title);
    upsert('meta[name="twitter:description"]', "content", description);
    upsert('meta[name="twitter:image"]', "content", image);
    upsert('link[rel="canonical"]', "href", url);

    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description,
      datePublished: post.date,
      dateModified: post.date,
      author: { "@type": "Person", name: "Zor Keeler" },
      publisher: {
        "@type": "Organization",
        name: "Zor Keeler | Seattle Real Estate",
        logo: { "@type": "ImageObject", url: "/assets/img/TEC_blue_crop.png" },
      },
      image: image ? [image] : undefined,
      mainEntityOfPage: url,
    };

    let ld = document.getElementById("article-schema");
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.id = "article-schema";
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify(schema, null, 2);

    // Optional: set hero image if present
    if (selectors.hero) {
      if (selectors.hero.tagName === "IMG") {
        selectors.hero.src = image;
        selectors.hero.alt = selectors.title?.textContent || post.title || "Article image";
      } else {
        selectors.hero.style.backgroundImage = `url("${image}")`;
      }
    }
  };

  const renderArticle = (post, posts, canonicalUrl) => {
    if (selectors.title) selectors.title.textContent = post.title;
    if (selectors.excerpt) selectors.excerpt.textContent = post.excerpt || "";

    if (selectors.meta) {
      selectors.meta.setAttribute("data-slug", post.slug);
      const date = BlogData.formatDate(post.date);
      const bits = [
        '<span class="byline">By Zor Keeler</span>',
        date ? `<time datetime="${post.date}">${date}</time>` : "",
        post.readingTime ? `<span class="readtime">${post.readingTime}</span>` : "",
      ].filter(Boolean);
      selectors.meta.innerHTML = bits.join('<span class="dot">·</span>');
    }

    if (selectors.body) {
      const html = markdownToHtml(post.content_md || post.contentMd || "");
      selectors.body.innerHTML =
        html ||
        (post.excerpt
          ? `<p>${post.excerpt}</p>`
          : '<p class="article-empty">This article is being updated. Check back soon.</p>');
    }

    if (selectors.tags) {
      const hasTags = Array.isArray(post.tags) && post.tags.length;
      selectors.tags.innerHTML = hasTags
        ? post.tags.map((tag) => `<span class="article-tag">${tag}</span>`).join("")
        : "";
      selectors.tags.style.display = hasTags ? "flex" : "none";
      if (hasTags) selectors.tags.removeAttribute("hidden");
      else selectors.tags.setAttribute("hidden", "hidden");
    }

    const index = posts.findIndex((p) => p.slug === post.slug);
    const prev = index > 0 ? posts[index - 1] : null;
    const next = index < posts.length - 1 ? posts[index + 1] : null;

    if (selectors.footnote) {
      const shareUrl = canonicalUrl || window.location.href;
      const shareHtml = [
        '<span class="article-share-label">Share:</span>',
        `<a class="article-share-link" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          shareUrl
        )}" target="_blank" rel="noopener">LinkedIn</a>`,
        `<a class="article-share-link" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(
          shareUrl
        )}&text=${encodeURIComponent(post.title)}" target="_blank" rel="noopener">X</a>`,
      ].join('<span class="dot" aria-hidden="true">·</span>');

      const navLinks = [];
      if (prev) {
        navLinks.push(
          `<a class="article-footnote-link prev" rel="prev" href="/blog/post/?slug=${encodeURIComponent(
            prev.slug
          )}" aria-label="Previous article: ${prev.title}">Previous: ${prev.title}</a>`
        );
      }
      if (next) {
        navLinks.push(
          `<a class="article-footnote-link next" rel="next" href="/blog/post/?slug=${encodeURIComponent(
            next.slug
          )}" aria-label="Next article: ${next.title}">Next: ${next.title}</a>`
        );
      }

      const navHtml = navLinks.length
        ? `<span class="article-footnote-nav">${navLinks.join(
            '<span class="dot" aria-hidden="true">·</span>'
          )}</span>`
        : "";

      selectors.footnote.innerHTML = `
        <div class="article-footnote-inner">
          <span class="article-share">${shareHtml}</span>
          ${navHtml}
        </div>
      `;
    }
  };

  const showError = (message) => {
    root.innerHTML = `<p class="article-empty">${message}</p>`;
  };

  const hydrate = async () => {
    try {
      const slug = getSlug();
      if (!slug) return showError("This article could not be found.");

      const posts = await window.BlogData.getPosts();
      const post = posts.find((entry) => entry.slug === slug);
      if (!post) return showError("This article is no longer available.");

      const currentPath = window.location.pathname;
      const origin = window.location.origin || "https://zorkeeler.com";
      const prettyPath =
        currentPath.includes("/blog/") && !currentPath.endsWith("/post/")
          ? `${origin}${currentPath}`
          : `${origin}/blog/post/?slug=${encodeURIComponent(post.slug)}`;
      const canonical = post.canonicalUrl ? post.canonicalUrl : prettyPath;

      renderArticle(post, posts, canonical);
      setMetaTags(post, canonical);
    } catch (error) {
      console.error("[blog] Failed to load article", error);
      showError("We couldn’t load this article right now. Please try again shortly.");
    }
  };

  hydrate();
})();
