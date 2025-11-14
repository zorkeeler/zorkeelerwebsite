window.BLOG_CONFIG = {
  sheetUrl: "https://docs.google.com/spreadsheets/d/1UOzvgKyRA28wxZ7WiZ4eWSMVpSuPbPLwPhQ2c2wbHOg/gviz/tq?tqx=out:json&gid=0",
  fallbackPosts: [
    {
      slug: "welcome",
      title: "Welcome to the Journal",
      date: "2024-02-01",
      readingTime: "3 min read",
      excerpt: "Periodic notes on Seattle housing, process, and the workflows that keep clients calm and informed.",
      tags: ["Market", "Process"],
      image: "/assets/img/Seattle%20Homes.jpg",
      content_md: "Welcome to the new journal — a running log where I share what we’re seeing inside Seattle listings, how clients are navigating the process, and the systems that keep everything calm. Expect short reads, real stats, and the occasional behind-the-scenes story.",
      published: true
    }
  ]
};

window.BLOG_SHEET_URL = window.BLOG_CONFIG.sheetUrl;
window.BLOG_POSTS = window.BLOG_CONFIG.fallbackPosts;
