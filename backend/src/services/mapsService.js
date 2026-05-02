const DEFAULT_OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter"
];

const CONFIGURED_OVERPASS_API_URLS = (process.env.OVERPASS_API_URLS || process.env.OVERPASS_API_URL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const OVERPASS_API_URLS = Array.from(
  new Set([
    "https://overpass.kumi.systems/api/interpreter",
    ...CONFIGURED_OVERPASS_API_URLS,
    ...DEFAULT_OVERPASS_URLS
  ].filter(Boolean))
);
const NOMINATIM_SEARCH_URL =
  process.env.NOMINATIM_SEARCH_URL || "https://nominatim.openstreetmap.org/search";
const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.MAPS_FETCH_TIMEOUT_MS || 12000);
const NOMINATIM_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS || 8000);
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS || 18000);
const SERPER_TIMEOUT_MS = Number(process.env.SERPER_TIMEOUT_MS || 12000);
const OUTSCRAPER_TIMEOUT_MS = Number(process.env.OUTSCRAPER_TIMEOUT_MS || 15000);
const WEBSITE_CHECK_TIMEOUT_MS = Number(process.env.WEBSITE_CHECK_TIMEOUT_MS || 9000);
const SERPER_EARLY_RETURN_TIMEOUT_MS = Number(process.env.SERPER_EARLY_RETURN_TIMEOUT_MS || 9000);
const OVERPASS_EARLY_RETURN_TIMEOUT_MS = Number(process.env.OVERPASS_EARLY_RETURN_TIMEOUT_MS || 12000);

const nicheToOSMTag = {
  "dental clinic": { key: "amenity", value: "dentist" },
  doctor: { key: "amenity", value: "doctors" },
  hospital: { key: "amenity", value: "hospital" },
  pharmacy: { key: "amenity", value: "pharmacy" },
  restaurant: { key: "amenity", value: "restaurant" },
  cafe: { key: "amenity", value: "cafe" },
  gym: { key: "leisure", value: "fitness_centre" },
  salon: { key: "shop", value: "hairdresser" },
  "beauty parlour": { key: "shop", value: "beauty" },
  "real estate": { key: "office", value: "estate_agent" },
  "real estate agent": { key: "office", value: "estate_agent" },
  lawyer: { key: "office", value: "lawyer" },
  school: { key: "amenity", value: "school" },
  "coaching center": { key: "amenity", value: "college" },
  hotel: { key: "tourism", value: "hotel" },
  "hardware store": { key: "shop", value: "hardware" },
  "grocery store": { key: "shop", value: "supermarket" },
  "clothing store": { key: "shop", value: "clothes" },
  "electronics store": { key: "shop", value: "electronics" },
  "travel agent": { key: "shop", value: "travel_agency" },
  insurance: { key: "office", value: "insurance" },
  "insurance agent": { key: "office", value: "insurance" },
  bank: { key: "amenity", value: "bank" },
  "chartered accountant": { key: "office", value: "accountant" }
};

const nicheAliases = {
  "dentel clenic": "dental clinic",
  "dental clenic": "dental clinic",
  "dentel clinic": "dental clinic",
  dental: "dental clinic",
  "dentist": "dental clinic",
  "dental clinics": "dental clinic",
  "doctor clinic": "doctor",
  "clinic": "doctor",
  "cafeteria": "cafe",
  "cafe shop": "cafe",
  "coffee shop": "cafe",
  "car showroom": "car showroom",
  "car shorum": "car showroom",
  "showroom": "car showroom",
  "realestate": "real estate",
  "real estate office": "real estate",
  "insurance office": "insurance",
  "beauty parlour shop": "beauty parlour"
};

const nicheQueryOverrides = {
  "car showroom": "car showroom"
};

const nonBusinessWebsiteHosts = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
  "t.me",
  "telegram.me",
  "wa.me",
  "whatsapp.com",
  "justdial.com",
  "indiamart.com",
  "sulekha.com",
  "wikipedia.org",
  "agoda.com",
  "tripadvisor.com",
  "zomato.com",
  "swiggy.com",
  "magicpin.in"
];

const genericBusinessTokens = new Set([
  "the",
  "and",
  "in",
  "of",
  "for",
  "at",
  "by",
  "restaurant",
  "restaurants",
  "cafe",
  "cafes",
  "clinic",
  "clinics",
  "dental",
  "hospital",
  "showroom",
  "motors",
  "auto",
  "car",
  "cars",
  "hotel",
  "salon",
  "store",
  "shop",
  "lounge"
]);

function normalizeWebsite(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { website: "", hasWebsite: false };
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const blocked = nonBusinessWebsiteHosts.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (blocked) {
      return { website: "", hasWebsite: false };
    }

    return { website: parsed.toString(), hasWebsite: true };
  } catch {
    return { website: "", hasWebsite: false };
  }
}

function normalizeWhitespace(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function toTitleCase(value) {
  return normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeNiche(value) {
  const raw = normalizeWhitespace(value);
  const lowered = raw.toLowerCase();
  const aliased = nicheAliases[lowered] || lowered;
  return aliased;
}

function normalizeCity(value) {
  const raw = normalizeWhitespace(value);
  return toTitleCase(raw.replace(/\s*,\s*india$/i, ""));
}

function escapeOverpassRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBusiness(place, fallback = {}) {
  const websiteInfo = normalizeWebsite(place.website || fallback.website || "");
  return {
    name: place.name || fallback.name || "Unknown Business",
    phone: place.phone || fallback.phone || "",
    address: place.address || fallback.address || "",
    city: place.city || fallback.city || "",
    niche: place.niche || fallback.niche || "",
    website: websiteInfo.website,
    has_website: websiteInfo.hasWebsite,
    rating: place.rating ?? fallback.rating ?? null,
    reviews: place.reviews ?? fallback.reviews ?? null,
    source: place.source || fallback.source || "unknown",
    lat: place.lat ?? fallback.lat ?? null,
    lng: place.lng ?? fallback.lng ?? null
  };
}

function tokenizeBusinessName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !genericBusinessTokens.has(token));
}

function extractDomainTokens(website) {
  try {
    const hostname = new URL(website).hostname.replace(/^www\./i, "").toLowerCase();
    const primary = hostname.split(".").slice(0, -1).join(".");
    return primary
      .replace(/[^a-z0-9]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function looksLikeOfficialWebsite(businessName, website, title = "", snippet = "") {
  const normalized = normalizeWebsite(website);
  if (!normalized.hasWebsite) {
    return false;
  }

  const businessTokens = tokenizeBusinessName(businessName);
  if (!businessTokens.length) {
    return false;
  }

  const domainTokens = extractDomainTokens(normalized.website);
  const pageText = `${title} ${snippet}`.toLowerCase();
  const matchedDomainTokens = businessTokens.filter((token) => domainTokens.some((domainToken) => domainToken.includes(token) || token.includes(domainToken)));
  const matchedPageTokens = businessTokens.filter((token) => pageText.includes(token));

  if (matchedDomainTokens.length >= 2) {
    return true;
  }

  if (matchedDomainTokens.length >= 1 && matchedPageTokens.length >= 2) {
    return true;
  }

  return matchedPageTokens.length >= 3;
}

function sanitizeBusinesses(results, city, niche) {
  return results.map((entry) => normalizeBusiness(entry, { city, niche }));
}

function dedupeBusinesses(results) {
  const seen = new Set();
  const merged = [];

  for (const entry of results) {
    const key = `${String(entry.name || "").trim().toLowerCase()}|${String(entry.address || "").trim().toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(entry);
  }

  return merged;
}

function hasContactablePhone(value) {
  return String(value || "").replace(/\D/g, "").length >= 10;
}

function prioritizeLeadResults(results) {
  const contactReadyNoWebsite = [];
  const missingPhoneNoWebsite = [];
  const websiteOwners = [];

  for (const entry of results) {
    if (!entry.has_website && hasContactablePhone(entry.phone)) {
      contactReadyNoWebsite.push(entry);
      continue;
    }

    if (!entry.has_website) {
      missingPhoneNoWebsite.push(entry);
      continue;
    }

    websiteOwners.push(entry);
  }

  return {
    contactReadyNoWebsite,
    missingPhoneNoWebsite,
    websiteOwners,
    ordered: [...contactReadyNoWebsite, ...missingPhoneNoWebsite, ...websiteOwners]
  };
}

function formatOSMAddress(tags) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"]
  ].filter(Boolean);

  return parts.join(", ") || "";
}

async function geocodeCityBounds(city) {
  const query = new URL(NOMINATIM_SEARCH_URL);
  query.searchParams.set("city", city);
  query.searchParams.set("country", "India");
  query.searchParams.set("format", "jsonv2");
  query.searchParams.set("limit", "1");

  const results = await fetchJson(
    query,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "ReachIQ/1.0"
      }
    },
    NOMINATIM_TIMEOUT_MS
  );
  const boundingbox = results?.[0]?.boundingbox;
  if (!boundingbox || boundingbox.length !== 4) {
    return null;
  }

  const [south, north, west, east] = boundingbox.map(Number);
  if ([south, north, west, east].some((value) => Number.isNaN(value))) {
    return null;
  }

  return { south, north, west, east };
}

function normalizeOverpassEntry(entry, city, niche) {
  return normalizeBusiness({
    name: entry.tags?.name || "Unknown Business",
    phone: entry.tags?.phone || entry.tags?.["contact:phone"] || "",
    address: formatOSMAddress(entry.tags || {}),
    city,
    niche,
    website: entry.tags?.website || entry.tags?.["contact:website"] || "",
    has_website: Boolean(entry.tags?.website || entry.tags?.["contact:website"]),
    source: "openstreetmap",
    lat: entry.lat || entry.center?.lat || null,
    lng: entry.lon || entry.center?.lon || null
  });
}

function normalizeSerperEntry(entry, city, niche) {
  return normalizeBusiness({
    name: entry.title || "",
    phone: entry.phoneNumber || "",
    address: entry.address || "",
    city,
    niche,
    website: entry.website || "",
    has_website: Boolean(entry.website),
    rating: entry.rating ?? null,
    reviews: entry.ratingCount ?? null,
    source: "google_maps_via_serper",
    lat: entry.latitude ?? null,
    lng: entry.longitude ?? null
  });
}

function normalizeOutscraperEntry(entry, city, niche) {
  return normalizeBusiness({
    name: entry.name || "",
    phone: entry.phone || "",
    address: entry.full_address || entry.address || "",
    city,
    niche,
    website: entry.site || "",
    has_website: Boolean(entry.site),
    rating: entry.rating ?? null,
    reviews: entry.reviews ?? null,
    source: "outscraper",
    lat: entry.latitude ?? null,
    lng: entry.longitude ?? null
  });
}

async function fetchJson(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let json = {};

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const message = json?.error?.message || json?.message || text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return json;
}

async function settleWithin(promise, timeoutMs, label) {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function searchOverpass(niche, city, limit = 20) {
  const normalizedNiche = normalizeNiche(niche);
  const normalizedCity = normalizeCity(city);
  const osmTag = nicheToOSMTag[normalizedNiche];
  const escapedCity = escapeOverpassRegex(normalizedCity);
  const keyword = nicheQueryOverrides[normalizedNiche] || normalizedNiche;
  const escapedKeyword = escapeOverpassRegex(keyword);
  const bbox = await geocodeCityBounds(normalizedCity).catch((error) => {
    console.warn(`[Maps] Nominatim geocode failed for ${normalizedCity}:`, error.message);
    return null;
  });

  const bboxQuery = bbox
    ? osmTag
      ? `
      [out:json][timeout:25];
      (
        node["${osmTag.key}"="${osmTag.value}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["${osmTag.key}"="${osmTag.value}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        relation["${osmTag.key}"="${osmTag.value}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      out center tags;
    `
      : `
      [out:json][timeout:25];
      (
        node["name"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["name"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        relation["name"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        node["shop"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["shop"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        relation["shop"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        node["amenity"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["amenity"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        relation["amenity"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        node["office"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["office"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        relation["office"~"${escapedKeyword}", i](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      out center tags;
    `
    : null;

  const areaQuery = osmTag
    ? `
    [out:json][timeout:25];
    area["name"~"^${escapedCity}$", i]->.searchArea;
    (
      node["${osmTag.key}"="${osmTag.value}"](area.searchArea);
      way["${osmTag.key}"="${osmTag.value}"](area.searchArea);
      relation["${osmTag.key}"="${osmTag.value}"](area.searchArea);
    );
    out center tags;
  `
    : `
    [out:json][timeout:25];
    area["name"~"^${escapedCity}$", i]->.searchArea;
    (
      node["name"~"${escapedKeyword}", i](area.searchArea);
      way["name"~"${escapedKeyword}", i](area.searchArea);
      relation["name"~"${escapedKeyword}", i](area.searchArea);
      node["shop"~"${escapedKeyword}", i](area.searchArea);
      way["shop"~"${escapedKeyword}", i](area.searchArea);
      relation["shop"~"${escapedKeyword}", i](area.searchArea);
      node["amenity"~"${escapedKeyword}", i](area.searchArea);
      way["amenity"~"${escapedKeyword}", i](area.searchArea);
      relation["amenity"~"${escapedKeyword}", i](area.searchArea);
      node["office"~"${escapedKeyword}", i](area.searchArea);
      way["office"~"${escapedKeyword}", i](area.searchArea);
      relation["office"~"${escapedKeyword}", i](area.searchArea);
    );
    out center tags;
  `;
  const queries = [bboxQuery, areaQuery].filter(Boolean);

  const endpoints = OVERPASS_API_URLS.length > 0 ? OVERPASS_API_URLS : DEFAULT_OVERPASS_URLS;
  let lastError = null;

  for (const query of queries) {
    for (const endpoint of endpoints) {
      try {
        const data = await fetchJson(
          endpoint,
          {
            method: "POST",
            body: `data=${encodeURIComponent(query)}`,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              Accept: "application/json,text/plain,*/*",
              "User-Agent": "ReachIQ/1.0"
            }
          },
          OVERPASS_TIMEOUT_MS
        );

        const normalizedResults = (data.elements || [])
          .filter((entry) => entry.tags?.name)
          .map((entry) => normalizeOverpassEntry(entry, normalizedCity, normalizedNiche));

        if (normalizedResults.length) {
          return prioritizeLeadResults(normalizedResults).ordered.slice(0, limit);
        }
      } catch (error) {
        lastError = error;
        console.warn(`[Maps] Overpass endpoint failed (${endpoint}):`, error.message);
      }
    }
  }

  throw lastError || new Error("Overpass API error");
}

export async function searchSerper(niche, city, limit = 20) {
  const normalizedNiche = normalizeNiche(niche);
  const normalizedCity = normalizeCity(city);
  if (!process.env.SERPER_API_KEY) {
    throw new Error("Serper key not configured");
  }

  const data = await fetchJson(
    "https://google.serper.dev/maps",
    {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: `${normalizedNiche} in ${normalizedCity}, India`,
        gl: "in",
        hl: "en",
        num: Math.max(limit, 20)
      })
    },
    SERPER_TIMEOUT_MS
  );

  return (data.places || []).slice(0, limit).map((entry) => normalizeSerperEntry(entry, normalizedCity, normalizedNiche));
}

export async function searchOutscraper(niche, city, limit = 20) {
  const normalizedNiche = normalizeNiche(niche);
  const normalizedCity = normalizeCity(city);
  if (!process.env.OUTSCRAPER_API_KEY) {
    throw new Error("Outscraper key not configured");
  }

  const query = `${normalizedNiche} in ${normalizedCity}, India`;
  const url = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(query)}&limit=${limit}&async=false`;
  const data = await fetchJson(
    url,
    {
      headers: {
        "X-API-KEY": process.env.OUTSCRAPER_API_KEY
      }
    },
    OUTSCRAPER_TIMEOUT_MS
  );

  return (data.data?.[0] || []).slice(0, limit).map((entry) => normalizeOutscraperEntry(entry, normalizedCity, normalizedNiche));
}

export async function checkWebsite(businessName, city) {
  const normalizedCity = normalizeCity(city);
  if (!process.env.SERPER_API_KEY) {
    return { has_website: false, website_url: "" };
  }

  try {
    const data = await fetchJson(
      "https://google.serper.dev/search",
      {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: `"${businessName}" ${normalizedCity} India website`,
          gl: "in",
          hl: "en",
          num: 3
        })
      },
      WEBSITE_CHECK_TIMEOUT_MS
    );

    const organicResults = data.organic || [];
    for (const result of organicResults) {
      if (!result?.link) {
        continue;
      }

      const normalized = normalizeWebsite(result.link);
      if (!normalized.hasWebsite) {
        continue;
      }

      if (looksLikeOfficialWebsite(businessName, normalized.website, result.title, result.snippet)) {
        return { has_website: true, website_url: normalized.website };
      }
    }

    return { has_website: false, website_url: "" };
  } catch {
    return { has_website: false, website_url: "" };
  }
}

async function bestEffortWebsiteVerification(results, niche, city, maxChecks = 4) {
  const candidates = results.filter((entry) => !entry.has_website).slice(0, maxChecks);
  if (!candidates.length || !process.env.SERPER_API_KEY) {
    return results;
  }

  const checked = await Promise.all(
    candidates.map(async (entry) => {
      const website = await checkWebsite(entry.name, city);
      return {
        ...entry,
        website: website.website_url,
        has_website: website.has_website
      };
    })
  );

  const checkedMap = new Map(checked.map((entry) => [entry.name, entry]));
  return sanitizeBusinesses(results.map((entry) => checkedMap.get(entry.name) || entry), city, niche);
}

export async function searchBusinesses({ niche, city, limit = 20 }) {
  const normalizedNiche = normalizeNiche(niche);
  const normalizedCity = normalizeCity(city);
  const errors = [];
  const targetNoWebsiteLeads = Math.min(Math.max(Math.ceil(limit * 0.6), 15), limit);
  const overpassLimit = Math.max(limit * 4, 80);

  console.log(`[Maps] Trying hybrid search for: ${normalizedNiche} in ${normalizedCity}`);

  let serperResults = [];
  let overpassResults = [];

  try {
    serperResults = await settleWithin(
      searchSerper(normalizedNiche, normalizedCity, Math.max(limit * 2, 40)),
      SERPER_EARLY_RETURN_TIMEOUT_MS,
      "Serper"
    );
  } catch (error) {
    console.warn("[Maps] Serper failed:", error.message || error);
    errors.push(`Serper: ${error.message || error}`);
  }

  if (serperResults.length) {
    const prioritizedSerper = prioritizeLeadResults(serperResults);
    const enoughFastResults =
      serperResults.length >= Math.min(Math.max(limit, 5), 12) ||
      prioritizedSerper.contactReadyNoWebsite.length >= Math.min(Math.max(Math.ceil(limit / 2), 2), 8);

    if (enoughFastResults) {
      const trimmedResults = sanitizeBusinesses(
        prioritizedSerper.ordered.slice(0, limit),
        normalizedCity,
        normalizedNiche
      );
      console.log(
        `[Maps] Returning fast Serper results for ${normalizedNiche} in ${normalizedCity}: total=${trimmedResults.length}, contactReadyNoWebsite=${prioritizedSerper.contactReadyNoWebsite.length}`
      );
      return {
        results: trimmedResults,
        source: "google_maps_via_serper"
      };
    }
  }

  try {
    overpassResults = await settleWithin(
      searchOverpass(normalizedNiche, normalizedCity, overpassLimit),
      OVERPASS_EARLY_RETURN_TIMEOUT_MS,
      "Overpass"
    );
  } catch (error) {
    console.warn("[Maps] Overpass failed:", error.message || error);
    errors.push(`Overpass: ${error.message || error}`);
  }

  console.log(
    `[Maps] Hybrid source counts for ${normalizedNiche} in ${normalizedCity}: serper=${serperResults.length}, overpass=${overpassResults.length}`
  );

  if (serperResults.length || overpassResults.length) {
    const verifiedOverpassResults =
      overpassResults.length && serperResults.filter((entry) => !entry.has_website && hasContactablePhone(entry.phone)).length < targetNoWebsiteLeads
        ? await bestEffortWebsiteVerification(overpassResults, normalizedNiche, normalizedCity, 3)
        : overpassResults;

    const serperReady = prioritizeLeadResults(serperResults).contactReadyNoWebsite;
    const overpassReady = prioritizeLeadResults(verifiedOverpassResults).contactReadyNoWebsite;
    const prioritizedLeadPool = dedupeBusinesses([
      ...overpassReady,
      ...serperReady
    ]);
    const prioritizedLeadCap = prioritizedLeadPool.slice(0, targetNoWebsiteLeads);
    const mergedLeadFirst = dedupeBusinesses([
      ...prioritizedLeadCap,
      ...verifiedOverpassResults,
      ...serperResults
    ]);
    const prioritized = prioritizeLeadResults(mergedLeadFirst);
    const combinedResults = prioritized.ordered.slice(0, limit);
    const source =
      serperResults.length && overpassResults.length
        ? "google_maps_plus_openstreetmap"
        : serperResults.length
          ? "google_maps_via_serper"
          : "openstreetmap";

    console.log(
      `[Maps] Hybrid returned ${combinedResults.length} results (${prioritized.contactReadyNoWebsite.length} contact-ready no-website leads)`
    );
    return {
      results: sanitizeBusinesses(combinedResults, normalizedCity, normalizedNiche),
      source
    };
  }

  try {
    console.log(`[Maps] Trying Outscraper for: ${normalizedNiche} in ${normalizedCity}`);
    const outscraperResults = await searchOutscraper(normalizedNiche, normalizedCity, limit);
    if (outscraperResults.length > 0) {
      const sanitizedResults = sanitizeBusinesses(
        prioritizeLeadResults(outscraperResults).ordered.slice(0, limit),
        normalizedCity,
        normalizedNiche
      );
      console.log(`[Maps] Outscraper returned ${sanitizedResults.length} results`);
      return { results: sanitizedResults, source: "outscraper" };
    }
    errors.push("Outscraper: 0 results");
  } catch (error) {
    console.warn("[Maps] Outscraper failed:", error.message);
    errors.push(`Outscraper: ${error.message}`);
  }

  throw new Error(`All search sources failed: ${errors.join(" | ")}`);
}
