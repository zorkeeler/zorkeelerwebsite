(() => {
  const list = document.getElementById("blog-list");
  const status = document.getElementById("blog-status");
  if (!list || !window.BlogData) return;

  const FALLBACK_IMAGE = "/assets/img/Seattle%20Homes.jpg";

  const updateStatus = message => {
    if (!status) return;
    status.textContent = message;
  };

  const createCard = post => {
    const date = BlogData.formatDate(post.date);
    const href = post.canonicalUrl || `/blog/post/?slug=${encodeURIComponent(post.slug)}`;
    const tags = (post.tags || []).map(tag => `<span class="blog-tag">${tag}</span>`).join("");
    const image =
      post.image ||
      post.heroImage ||
      post.imageUrl ||
      post.image_url ||
      FALLBACK_IMAGE;
    const imageAlt = post.imageAlt || `${post.title} featured image`;
    const excerpt = post.excerpt || "";
    const metaPieces = [];
    if (date) metaPieces.push(`<time datetime="${post.date}">${date}</time>`);
    if (post.readingTime) metaPieces.push(`<span class="readtime">${post.readingTime}</span>`);
    const metaHtml = metaPieces.join('<span class="dot">·</span>');

    return `
      <article class="blog-card">
        <div class="blog-card-media">
          <img src="${image}" alt="${imageAlt}" loading="lazy">
        </div>
        <div class="blog-card-body">
          <h2><a href="${href}">${post.title}</a></h2>
          <div class="blog-meta">${metaHtml}</div>
          ${excerpt ? `<p>${excerpt}</p>` : ""}
          ${tags ? `<div class="blog-tags">${tags}</div>` : ""}
          <a class="blog-link" href="${href}">Read article</a>
        </div>
      </article>
    `;
  };

  const render = posts => {
    if (!posts.length) {
      list.innerHTML = '<p class="blog-empty">New articles are on the way. Check back soon.</p>';
      updateStatus("");
      return;
    }
    list.innerHTML = posts.map(createCard).join("");
    updateStatus(`${posts.length} article${posts.length === 1 ? "" : "s"}`);
  };

  const hydrate = async () => {
    try {
      updateStatus("Loading articles…");
      const posts = await window.BlogData.getPosts();
      render(posts);
    } catch (error) {
      console.error("Failed to load blog posts:", error);
      list.innerHTML = '<p class="blog-empty">We couldn’t load the latest articles right now. Please try again shortly.</p>';
      updateStatus("");
    }
  };

  hydrate();
})();
