import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { enforceLeadSearchLimit, incrementLeadSearchUsage } from "../middleware/planLimiter.js";
import { checkWebsite, searchBusinesses } from "../services/mapsService.js";
import { getDemoMapsResults, isDemoMode } from "../utils/demo.js";

const router = express.Router();

const nonRealWebsiteHosts = [
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

function sanitizeWebsite(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return { website: "", has_website: false };
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const blocked = nonRealWebsiteHosts.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (blocked) {
      return { website: "", has_website: false };
    }

    return { website: parsed.toString(), has_website: true };
  } catch {
    return { website: "", has_website: false };
  }
}

function sanitizeResult(entry) {
  const website = sanitizeWebsite(entry.website);
  return {
    ...entry,
    website: website.website,
    has_website: website.has_website
  };
}

function hasContactablePhone(value) {
  return String(value || "").replace(/\D/g, "").length >= 10;
}

const supportedNiches = [
  "Dental Clinic",
  "Doctor / Clinic",
  "Pharmacy",
  "Hospital",
  "Restaurant",
  "Cafe",
  "Gym",
  "Salon",
  "Beauty Parlour",
  "Real Estate Agent",
  "Lawyer",
  "School",
  "Coaching Center",
  "Hotel",
  "Hardware Store",
  "Grocery Store",
  "Clothing Store",
  "Electronics Store",
  "Travel Agent",
  "Insurance Agent",
  "Chartered Accountant"
];

router.get("/niches", (req, res) => {
  res.json({ niches: supportedNiches });
});

router.post("/search", requireAuth, enforceLeadSearchLimit, async (req, res, next) => {
  try {
    const niche = String(req.body.niche || "").trim();
    const city = String(req.body.city || "").trim();
    const requestedLimit = Math.min(Math.max(Number(req.body.limit) || 30, 1), 50);
    const searchLimit = Math.max(requestedLimit, 30);

    if (!niche || !city) {
      return res.status(400).json({ error: "Please provide both niche and city" });
    }

    if (niche.length < 2 || city.length < 2) {
      return res.status(400).json({ error: "Niche and city must be at least 2 characters" });
    }

    console.log(`[Maps Search] User: ${req.user.id} | ${niche} in ${city}`);
    console.log(`[Maps Route] requestedLimit=${requestedLimit} searchLimit=${searchLimit}`);

    if (isDemoMode) {
      const demoResults = getDemoMapsResults({ niche, location: city }).map((entry) => ({
        name: entry.business_name,
        phone: entry.phone,
        address: entry.address,
        city: entry.city,
        niche: entry.niche,
        website: entry.website_url || "",
        has_website: entry.has_website,
        rating: entry.rating || null,
        reviews: null,
        source: "openstreetmap",
        lat: null,
        lng: null
      }));

      return res.json({
        success: true,
        total: demoResults.length,
        no_website_count: demoResults.filter((item) => !item.has_website).length,
        has_website_count: demoResults.filter((item) => item.has_website).length,
        results: demoResults,
        source: "openstreetmap",
        message: `Found ${demoResults.length} ${niche} businesses in ${city}. ${demoResults.filter((item) => !item.has_website).length} have no website - these are your leads!`
      });
    }

    const { results, source } = await searchBusinesses({
      niche,
      city,
      limit: searchLimit
    });

    await incrementLeadSearchUsage(req.profile);

    const sanitizedResults = results.map(sanitizeResult);
    const contactReadyNoWebsite = sanitizedResults.filter(
      (item) => !item.has_website && hasContactablePhone(item.phone)
    );
    const missingPhoneNoWebsite = sanitizedResults.filter(
      (item) => !item.has_website && !hasContactablePhone(item.phone)
    );
    const hasWebsite = sanitizedResults.filter((item) => item.has_website);
    const orderedResults = [...contactReadyNoWebsite, ...missingPhoneNoWebsite, ...hasWebsite].slice(0, requestedLimit);
    console.log(
      `[Maps Route] source=${source} total=${orderedResults.length} contactReadyNoWebsite=${orderedResults.filter((item) => !item.has_website && hasContactablePhone(item.phone)).length}`
    );

    res.json({
      success: true,
      total: orderedResults.length,
      no_website_count: orderedResults.filter((item) => !item.has_website && hasContactablePhone(item.phone)).length,
      has_website_count: orderedResults.filter((item) => item.has_website).length,
      missing_phone_count: orderedResults.filter((item) => !item.has_website && !hasContactablePhone(item.phone)).length,
      results: orderedResults,
      source,
      message: `Found ${orderedResults.length} ${niche} businesses in ${city}. ${orderedResults.filter((item) => !item.has_website && hasContactablePhone(item.phone)).length} are ready-to-contact leads with no website.`
    });
  } catch (error) {
    console.error(`[Maps Error] ${new Date().toISOString()}:`, error.message);
    res.status(500).json({
      error: "Search failed. Please try a different city name or niche.",
      details: error.message
    });
  }
});

router.post("/check-website", requireAuth, async (req, res) => {
  try {
    const { business_name, city } = req.body;
    const result = await checkWebsite(String(business_name || "").trim(), String(city || "").trim());
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
