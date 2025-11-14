(() => {
  const CONFIG = window.BLOG_CONFIG || {};
  const FALLBACK = Array.isArray(CONFIG.fallbackPosts) ? CONFIG.fallbackPosts.slice() : (Array.isArray(window.BLOG_POSTS) ? window.BLOG_POSTS.slice() : []);
  const SHEET_URL = CONFIG.sheetUrl || window.BLOG_SHEET_URL || "";

  let cache = null;
  let fetchPromise = null;

  const slugify = (value = "") =>
    value
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `post-${Date.now()}`;

  const toCamel = (label = "") =>
    label
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+([a-z0-9])/g, (_, chr) => chr.toUpperCase())
      .replace(/[^a-z0-9]/g, "");

  const parseSheetObject = payload => {
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
            const [, y, m, d] = match.map(Number);
            value = new Date(y, m, d).toISOString().slice(0, 10);
          }
        } else if (typeof value === "object" && value !== null && typeof value.year === "number") {
          value = new Date(value.year, value.month || 0, value.day || 1).toISOString().slice(0, 10);
        }

        record[key] = typeof value === "string" ? value.trim() : value;
      });
      return record;
    });
  };

  const parseSheet = input => {
    if (!input) return [];
    if (typeof input === "string") {
      const jsonStart = input.indexOf("{");
      const jsonEnd = input.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("Invalid sheet response");
      const payload = JSON.parse(input.slice(jsonStart, jsonEnd + 1));
      return parseSheetObject(payload);
    }
    return parseSheetObject(input);
  };

  const shouldPublish = status => {
    if (status === undefined || status === null || status === "") return true;
    const normalized = String(status).toLowerCase();
    return ["true", "yes", "y", "1", "publish", "published", "live"].includes(normalized);
  };

  const computeReadingTime = (content = "") => {
    const words = content.replace(/[`*_>#-]/g, " ").split(/\s+/).filter(Boolean).length;
    if (!words) return "";
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min read`;
  };

  const extractExcerpt = (post) => {
    if (post.excerpt) return post.excerpt.trim();
    const content = (post.content_md || post.contentMd || "").replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
    return content.length > 220 ? `${content.slice(0, 217).trim()}…` : content;
  };

  const normaliseImage = (url = "") => {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      if (host === "drive.google.com") {
        let id = parsed.searchParams.get("id");
        if (!id && parsed.pathname.includes("/file/d/")) {
          const parts = parsed.pathname.split("/file/d/");
          if (parts[1]) id = parts[1].split("/")[0];
        }
        if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
      }
      if (host === "lh3.googleusercontent.com" || host === "photos.app.goo.gl") {
        return url;
      }
    } catch (err) {
      // ignore malformed URLs
    }
    return url;
  };

  const normalisePost = raw => {
    if (!raw) return null;
    const post = { ...raw };

    post.published = post.published ?? post.publish ?? post.status;
    if (!shouldPublish(post.published)) return null;

    post.slug = slugify(post.slug || post.title || "");
    if (!post.slug) return null;

    post.title = (post.title || "").trim();
    if (!post.title) return null;

    if (post.date) {
      const iso = new Date(post.date);
      if (!Number.isNaN(iso.getTime())) {
        post.dateISO = iso.toISOString();
        post.date = iso.toISOString().slice(0, 10);
      }
    }

    post.tags = Array.isArray(post.tags)
      ? post.tags
      : String(post.tags || "")
          .split(/[,|]/)
          .map(tag => tag.trim())
          .filter(Boolean);

    post.content_md = post.content_md || post.contentMd || post.content || "";
    post.excerpt = extractExcerpt(post);
    post.readingTime = post.readingTime || computeReadingTime(post.content_md);
    const rawImage =
      post.image_url ||
      post.imageUrl ||
      post.heroImage ||
      post.coverImage ||
      post.featuredImage ||
      post.photo ||
      post.thumbnail ||
      post.image ||
      "";
    const normalizedImage = normaliseImage(rawImage);
    post.image = normalizedImage || rawImage;
    post.imageAlt =
      post.imageAlt ||
      post.image_alt ||
      post.imageAltText ||
      post.imageDescription ||
      (post.title ? `${post.title} featured image` : "");
    if (post.heroImage) {
      post.heroImage = normaliseImage(post.heroImage);
    }
    post.canonicalUrl = post.canonical_url || post.canonicalUrl || "";

    return post;
  };

  const mergePosts = (fallback, sheet) => {
    const merged = new Map();
    [...fallback, ...sheet].forEach(entry => {
      const normalised = normalisePost(entry);
      if (!normalised) return;
      merged.set(normalised.slug, { ...(merged.get(normalised.slug) || {}), ...normalised });
    });
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.date || b.dateISO || 0) - new Date(a.date || a.dateISO || 0)
    );
  };

  const fetchSheetViaJsonp = url =>
    new Promise((resolve, reject) => {
      const callbackNamespace = window.google || (window.google = {});
      const viz = callbackNamespace.visualization || (callbackNamespace.visualization = {});
      const query = viz.Query || (viz.Query = {});

      const previous = query.setResponse;
      const cleanup = () => {
        if (previous) {
          query.setResponse = previous;
        } else {
          delete query.setResponse;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      query.setResponse = payload => {
        cleanup();
        resolve(payload);
        if (previous && typeof previous === "function") previous(payload);
      };

      const script = document.createElement("script");
      script.src = url;
      script.onerror = err => {
        cleanup();
        reject(err);
      };
      document.head.appendChild(script);
    });

  const fetchSheetPosts = async () => {
    if (!SHEET_URL) return [];
    try {
      const response = await fetch(SHEET_URL, { mode: "cors" });
      if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
      const text = await response.text();
      return parseSheet(text);
    } catch (error) {
      // Fallback to JSONP if direct fetch fails (CORS, offline, etc.)
      const payload = await fetchSheetViaJsonp(SHEET_URL);
      return parseSheet(payload);
    }
  };

  const getPosts = async () => {
    if (cache) return cache;
    if (!fetchPromise) {
      fetchPromise = fetchSheetPosts().catch(error => {
        console.warn("Blog sheet fetch error, falling back to local posts.", error);
        return [];
      });
    }
    const sheetRows = await fetchPromise;
    cache = mergePosts(FALLBACK, sheetRows);
    window.__BLOG_POSTS = cache;
    return cache;
  };

  const formatDate = iso => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch (err) {
      return iso;
    }
  };

  window.BlogData = {
    getPosts,
    slugify,
    formatDate
  };
})();
