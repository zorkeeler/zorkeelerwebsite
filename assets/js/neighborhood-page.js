(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const NEIGHBORHOODS = window.NEIGHBORHOODS || {};
    const slug = document.body?.getAttribute('data-slug');
    if (!slug || !NEIGHBORHOODS[slug]) {
      if (slug) console.warn('[nh] No neighborhood data for slug:', slug);
      return;
    }

    const data = NEIGHBORHOODS[slug];
    const $ = (s, r=document) => r.querySelector(s);

    // ---------- text helpers ----------
    const normalize = (str = '') =>
      String(str)
        .replace(/single-family/gi, 'single family')
        .replace(/multi-family/gi, 'multifamily')
        .replace(/mid-rise/gi, 'midrise')
        .replace(/\s+/g, ' ')
        .trim();

    const sentence = (str = '') => {
      const t = normalize(str).replace(/[.!?]+$/, '');
      if (!t) return '';
      return t.charAt(0).toUpperCase() + t.slice(1) + '.';
    };
    const lowerFirst = (value = '') => {
      const t = normalize(value);
      return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
    };
    const findByKeywords = (items = [], regex) => items.find(item => regex.test(item));
    const setText = (sel, val) => { const n = $(sel); if (n && val) n.textContent = normalize(val); };
    const toSlug = (s='') => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

    // ---------- copy builders ----------
    const buildHomes = () => {
      if (data.homes) return normalize(data.homes);
      const housingBullet = findByKeywords(
        data.bullets || [],
        /(single family|townhome|condo|condominiums|apartments|multifamily|mix|midrise|duplex|triplex)/i
      );
      const lines = [];
      if (housingBullet) {
        lines.push(sentence(`${data.name} homes offer ${lowerFirst(housingBullet.replace(/^mix of/i, 'a mix of'))}`));
      }
      if (data.subtitle) lines.push(sentence(`Expect a setting that matches ${lowerFirst(data.subtitle)}`));
      if (!lines.length && data.localNotes) lines.push(sentence(data.localNotes));
      if (!lines.length) lines.push(`${data.name} combines established single family streets with newer attached homes and small multifamily buildings.`);
      return normalize(lines.join(' '));
    };

    const buildInsights = () => {
      if (data.insights) return normalize(data.insights);
      const notes = data.localNotes ? sentence(data.localNotes) : '';
      const accessBullet = findByKeywords(data.bullets || [], /(transit|link|rail|bus|access|arterial|commute)/i);
      const parksBullet = findByKeywords(data.bullets || [], /(park|trail|beach|shore|green)/i);
      const extras = [];
      if (accessBullet) extras.push(sentence(`${data.name} stays connected via ${lowerFirst(accessBullet)}`));
      if (parksBullet) extras.push(sentence(`${data.name} locals spend time around ${lowerFirst(parksBullet.replace(/^mix of/i, 'a mix of'))}`));
      const out = [notes, ...extras].filter(Boolean);
      if (!out.length) out.push(`${data.name} keeps errands close with daily services near the main corridors and calmer residential pockets a few blocks away.`);
      return normalize(out.join(' '));
    };

    const buildFunFacts = () => {
      if (Array.isArray(data.funFacts) && data.funFacts.length) return data.funFacts.map(item => sentence(item));
      const list = [];
      (data.bullets || []).forEach(b => { const c = sentence(b); if (c && !list.includes(c)) list.push(c); });
      if (!list.length && data.subtitle) list.push(sentence(data.subtitle));
      if (!list.length) list.push(`${data.name} sits within ${data.city || 'Seattle'}, placing groceries, parks, and commuting routes within a short drive.`);
      return list.slice(0, 4).map(item => normalize(item));
    };

    const buildAtGlanceBullets = () => {
      const special = [];
      const bulletPrefixes = [
        'Sale Price',
        'Homes for Sale',
        'Days on Market'
      ];
      const bulletCandidates = [
        data.bullet1 || data.medianValue,
        data.bullet2 || data.medianRent,
        data.bullet3
      ];
      bulletCandidates.forEach((value, index) => {
        if (value) special.push({ text: value, raw: true, prefix: bulletPrefixes[index] || '' });
      });
      if (special.length) return special;
      return (data.bullets || []).map(item => ({ text: item, raw: false }));
    };

    const buildVibes = () => {
      if (data.vibes) return sentence(data.vibes);
      if (data.subtitle) return sentence(data.subtitle);
      const vibeBullet = findByKeywords(data.bullets || [], /(park|retail|vibe|energy|streets|community|viewpoint)/i);
      if (vibeBullet) return sentence(vibeBullet);
      return `${data.name} blends everyday retail streets with established residential blocks and park overlooks.`;
    };

    const buildAround = () => {
      if (data.around) return sentence(data.around);
      const accessBullet = findByKeywords(data.bullets || [], /(transit|link|rail|bus|access|arterial|commute|connections|freeway)/i);
      if (accessBullet) return sentence(accessBullet);
      return `${data.name} residents rely on nearby arterials and transit lines for commutes around ${data.city || 'Seattle'}.`;
    };

    // ---------- SEO/meta ----------
    const name = data.name;
    const city = data.city || 'Seattle';
    const metaTitle = `${name} ${city} Neighborhood Guide | Zor Keeler`;
    const metaDescription = `${name} in ${city}: access, housing mix, local insights, and everyday amenities curated for buyers and sellers.`;

    document.title = metaTitle;
    $('#meta-desc')?.setAttribute('content', metaDescription);

    const canonical = `https://zorkeeler.com/neighborhoods/${data.citySlug || city.toLowerCase()}/${slug}/`;
    $('#meta-canon')?.setAttribute('href', canonical);
    $('#og-title')?.setAttribute('content', `${name} Neighborhood Guide`);
    $('#og-desc')?.setAttribute('content', metaDescription);
    $('#og-url')?.setAttribute('content', canonical);

    // ---------- headings & copy ----------
    setText('#nh-name', name);
    setText('#nh-name-homes', name);
    setText('#nh-name-vibes', name);
    setText('#nh-name-transportation', name);
    setText('#nh-sub', data.subtitle);

    // bullets
    const bulletsContainer = $('#nh-bullets');
    if (bulletsContainer) {
      bulletsContainer.innerHTML = '';
      const bullets = buildAtGlanceBullets();
      bullets.forEach(({ text, raw, prefix }) => {
        const li = document.createElement('li');
        const content = raw ? normalize(text) : sentence(text);
        if (prefix && raw) {
          const strong = document.createElement('strong');
          strong.textContent = content;
          li.appendChild(document.createTextNode(`${prefix}: `));
          li.appendChild(strong);
        } else {
          li.textContent = content;
        }
        bulletsContainer.appendChild(li);
      });
      bulletsContainer.classList.remove('not-loaded');
    }
    setText('#nh-homes', buildHomes());
    setText('#nh-vibes', buildVibes());
    setText('#nh-around', buildAround());
    setText('#nh-insights', buildInsights());

    const factsList = $('#nh-facts');
    if (factsList) {
      factsList.innerHTML = '';
      buildFunFacts().forEach(f => {
        const li = document.createElement('li');
        li.textContent = f;
        factsList.appendChild(li);
      });
    }

    // ---------- post-load overrides (wins races) ----------
    const preferredMapEmbed = (data.mapEmbed || '').trim();
    window.addEventListener('load', () => {
      (function initMap(){
        const frame = document.querySelector('#nh-map');
        const section = document.querySelector('#nh-map-section');
        if (!frame || !section) return;

        const mapName  = document.querySelector('#nh-name')?.textContent?.trim() || data.name || 'Neighborhood';
        const mapCity  = data.city || 'Seattle';
        const encoded  = encodeURIComponent(`${mapName}, ${mapCity} WA`);
        const embed    = preferredMapEmbed || `https://maps.google.com/maps?q=${encoded}&z=14&hl=en&output=embed&iwloc=near`;

        const currentSrcAttr = frame.getAttribute('src') || '';

        // Always ensure the iframe points at the current embed
        if (!currentSrcAttr || preferredMapEmbed) {
          frame.src = embed;
        }

        frame.addEventListener('load', () => frame.classList.add('is-ready'), { once:true });

        setTimeout(() => {
          const hasSrc = !!(frame.getAttribute('src') || '').trim();
          if (!frame.classList.contains('is-ready') && !hasSrc) {
            const openUrl = preferredMapEmbed || `https://www.google.com/maps/search/?api=1&query=${encoded}`;
            frame.srcdoc = `<div style="display:flex;height:100%;align-items:center;justify-content:center;font:14px system-ui">
        Map couldn't load. <a style="margin-left:.5rem" href="${openUrl}" target="_blank" rel="noopener">Open in Google Maps</a>
      </div>`;
          }
        }, 8000);
      })();
    });
  });
})();
