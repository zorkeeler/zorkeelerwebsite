/* /assets/js/nh-census.js — ACS tract aggregation with safe ZCTA fallback */
(() => {
  // bump this when you deploy to confirm cache-bust
  window.__nhCensusV = "tracts-only-4";
  console.info("[nh-census] boot", window.__nhCensusV);

  const DATASET = "https://api.census.gov/data/2023/acs/acs5";
  // Vars: median value, median gross rent, tenure totals, total units, median year built
  const VARS = ["B25077_001E","B25064_001E","B25003_001E","B25003_002E","B25001_001E","B25035_001E"];

  // --- utils
  const $ = (s, r=document) => r.querySelector(s);
  const money = n => Number.isFinite(+n) ? (+n).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0}) : "—";
  const num   = n => Number.isFinite(+n) ? (+n).toLocaleString() : "—";
  const pct   = (a,b)=> (Number.isFinite(+a)&&Number.isFinite(+b)&&+b>0) ? Math.round((+a/+b)*100)+"%" : "—";
  const normTract = t => String(t).replace(".","").padStart(6,"0"); // "59.01"→"005901", "60"→"006000"

  const li = (k,v)=>{ const el=document.createElement("li"); el.innerHTML=`<strong>${k}:</strong> ${v}`; return el; };

  function render(ul, result, note){
    ul.innerHTML = "";
    if (!result) { ul.innerHTML = '<li><em>Quick facts unavailable.</em></li>'; return; }
    const frag = document.createDocumentFragment();
    frag.appendChild(li("Median home value", result.value!=null ? money(result.value) : "—"));
    frag.appendChild(li("Median rent",       result.rent!=null  ? money(result.rent)  : "—"));
    frag.appendChild(li("Owner-occupied rate", pct(result.ownerOcc, result.occ)));
    frag.appendChild(li("Total housing units", num(result.units)));
    frag.appendChild(li("Median year built",  result.year!=null ? Math.round(result.year) : "—"));
    const sr=document.createElement("li"); sr.className="sr-only";
    sr.textContent = note || "Source: U.S. Census Bureau, ACS 5-year estimates.";
    frag.appendChild(sr);
    ul.appendChild(frag);
  }

  async function fetchJSON(url, signal){
    const r = await fetch(url, { cache:"no-store", signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.json();
  }

  async function fetchZcta(zcta, key, signal){
    const qs = new URLSearchParams();
    qs.set("get", ["NAME",...VARS].join(","));
    qs.set("for", `zip code tabulation area:${zcta}`);
    if (key) qs.set("key", key);
    const j = await fetchJSON(`${DATASET}?${qs.toString()}`, signal);
    const H = j[0], R = j[1]; if (!R) return null;
    const idx={}; H.forEach((h,i)=>idx[h]=i);
    const occ   = +R[idx["B25003_001E"]] || 0;
    const owner = +R[idx["B25003_002E"]] || 0;
    return {
      value: +R[idx["B25077_001E"]] || null,
      rent:  +R[idx["B25064_001E"]] || null,
      year:  (+R[idx["B25035_001E"]] || 0) || null,
      units: +R[idx["B25001_001E"]] || 0,
      occ, ownerOcc: owner
    };
  }

  async function run(){
    const ul = $("#nh-bullets");
    const slug = document.body?.getAttribute("data-slug");
    const key  = (document.body?.getAttribute("data-census-key")||"").trim();

    if (!ul) return;
    ul.innerHTML = '<li><em>Loading quick facts…</em></li>';

    if (!slug || !window.NEIGHBORHOODS || !window.NEIGHBORHOODS[slug]) {
      console.warn("[nh-census] no neighborhood match for slug", slug);
      return;
    }

    const nh = window.NEIGHBORHOODS[slug];
    const tr = nh.census?.type === "tracts" ? nh.census : null;
    const zcta = nh.zcta ? String(nh.zcta) : null;

    console.info("[nh-census] slug:", slug, "tractCfg:", tr || "(none)", "zcta:", zcta || "(none)");

    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 12000);

    try {
      if (tr && tr.state && tr.county && Array.isArray(tr.tracts) && tr.tracts.length) {
        // --- TRACTS PATH
        const wanted = new Set(tr.tracts.map(normTract));
        const qs = new URLSearchParams({
          get: ["NAME",...VARS,"state","county","tract"].join(","),
          "for":"tract:*",
          "in": `state:${tr.state}+county:${tr.county}`
        });
        if (key) qs.set("key", key);
        const url = `${DATASET}?${qs.toString()}`;
        console.info("[nh-census] fetch (county sweep)", url);

        const json = await fetchJSON(url, ctrl.signal);
        const H = json[0], rows = json.slice(1);
        console.info("[nh-census] rows returned:", rows.length, "wanted:", wanted.size);

        const idx={}; H.forEach((h,i)=>idx[h]=i);

        let units=0, occ=0, owner=0, hits=0;
        let wValN=0,wValD=0, wRentN=0,wRentD=0, wYearN=0,wYearD=0;

        for (const r of rows){
          const tract = r[idx.tract];              // e.g. "006800"
          if (!wanted.has(tract)) continue;
          hits++;

          const u  = +r[idx["B25001_001E"]] || 0;
          const o  = +r[idx["B25003_001E"]] || 0;
          const ow = +r[idx["B25003_002E"]] || 0;
          const re = Math.max(o-ow,0);
          const v  = +r[idx["B25077_001E"]] || 0;
          const R  = +r[idx["B25064_001E"]] || 0;
          const y  = +r[idx["B25035_001E"]] || 0;

          units += u; occ += o; owner += ow;
          if (v>0 && ow>0){ wValN += v*ow; wValD += ow; }
          if (R>0 && re>0){ wRentN+= R*re; wRentD+= re; }
          if (y>0 && u>0){  wYearN+= y*u;  wYearD+= u;  }
        }

        console.info("[nh-census] matched tracts:", hits);
        if (hits > 0){
          const result = {
            value: (wValD>0)? (wValN/wValD) : null,
            rent:  (wRentD>0)? (wRentN/wRentD) : null,
            year:  (wYearD>0)? (wYearN/wYearD) : null,
            units, occ, ownerOcc: owner
          };
          render(ul, result, "Source: U.S. Census Bureau, ACS 5-year (tract aggregate).");
          clearTimeout(timer);
          return;
        }

        console.warn("[nh-census] 0 tract matches. Will try ZCTA fallback if available.");
      }

      // --- ZCTA FALLBACK (only if present)
      if (zcta){
        const result = await fetchZcta(zcta, key, ctrl.signal);
        render(ul, result, "Source: U.S. Census Bureau, ACS 5-year (ZCTA fallback).");
      } else {
        render(ul, null);
      }
    } catch (e){
      console.warn("[nh-census] error", e);
      // grace: try zcta if we have one
      try {
        if (nh.zcta){
          const res = await fetchZcta(String(nh.zcta), key, ctrl.signal);
          render(ul, res, "Source: U.S. Census Bureau, ACS 5-year (ZCTA fallback).");
        } else {
          render(ul, null);
        }
      } catch {
        render(ul, null);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run, { once:true });
  } else {
    run();
  }
})();
