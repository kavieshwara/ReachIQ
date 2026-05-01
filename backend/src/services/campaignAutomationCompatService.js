import fs from "node:fs/promises";
import path from "node:path";

const STORE_DIR = path.resolve(process.cwd(), ".runtime");
const STORE_FILE = path.join(STORE_DIR, "campaign-automation-compat.json");

async function ensureStoreDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

async function readStore() {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { campaigns: {} };
    }
    throw error;
  }
}

async function writeStore(store) {
  await ensureStoreDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function ensureCampaign(store, campaignId) {
  if (!store.campaigns[campaignId]) {
    store.campaigns[campaignId] = {
      campaignId,
      websiteTemplateId: null,
      autoGenerateAssets: false,
      requireVideoAssets: false,
      nicheHint: null,
      leadPreparations: {}
    };
  }
  return store.campaigns[campaignId];
}

export async function getCampaignAutomationConfig(campaignId) {
  const store = await readStore();
  return store.campaigns[campaignId] || null;
}

export async function setCampaignAutomationConfig(campaignId, config) {
  const store = await readStore();
  const current = ensureCampaign(store, campaignId);
  store.campaigns[campaignId] = {
    ...current,
    ...config,
    campaignId,
    leadPreparations: {
      ...current.leadPreparations,
      ...(config.leadPreparations || {})
    }
  };
  await writeStore(store);
  return store.campaigns[campaignId];
}

export async function removeCampaignAutomationConfig(campaignId) {
  const store = await readStore();
  delete store.campaigns[campaignId];
  await writeStore(store);
}

export async function getCompatLeadPreparation(campaignId, campaignLeadId) {
  const config = await getCampaignAutomationConfig(campaignId);
  return config?.leadPreparations?.[campaignLeadId] || null;
}

export async function upsertCompatLeadPreparation(campaignId, campaignLeadId, payload) {
  const store = await readStore();
  const current = ensureCampaign(store, campaignId);
  const existing = current.leadPreparations[campaignLeadId] || {};
  current.leadPreparations[campaignLeadId] = {
    ...existing,
    ...payload,
    campaign_lead_id: campaignLeadId
  };
  await writeStore(store);
  return current.leadPreparations[campaignLeadId];
}

export async function listCompatLeadPreparations(campaignId) {
  const config = await getCampaignAutomationConfig(campaignId);
  return Object.values(config?.leadPreparations || {});
}
