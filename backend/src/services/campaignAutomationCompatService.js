import { nowIso } from "../utils/helpers.js";
import { supabaseAdmin } from "../utils/supabase.js";

const STORE_KEY_PREFIX = "campaign_automation_compat:";

function buildStoreKey(campaignId) {
  return `${STORE_KEY_PREFIX}${campaignId}`;
}

function buildDefaultCampaignConfig(campaignId) {
  return {
    campaignId,
    websiteTemplateId: null,
    autoGenerateAssets: false,
    requireVideoAssets: false,
    nicheHint: null,
    leadPreparations: {}
  };
}

function normalizeCampaignConfig(campaignId, config) {
  const base = buildDefaultCampaignConfig(campaignId);
  return {
    ...base,
    ...(config || {}),
    campaignId,
    leadPreparations: {
      ...base.leadPreparations,
      ...(config?.leadPreparations || {})
    }
  };
}

async function readCampaignConfig(campaignId) {
  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", buildStoreKey(campaignId))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.value) {
    return null;
  }

  try {
    return normalizeCampaignConfig(campaignId, JSON.parse(data.value));
  } catch {
    return null;
  }
}

async function writeCampaignConfig(campaignId, config) {
  const normalized = normalizeCampaignConfig(campaignId, config);
  const { error } = await supabaseAdmin
    .from("admin_settings")
    .upsert(
      {
        key: buildStoreKey(campaignId),
        value: JSON.stringify(normalized),
        updated_at: nowIso()
      },
      { onConflict: "key" }
    );

  if (error) {
    throw error;
  }

  return normalized;
}

export async function getCampaignAutomationConfig(campaignId) {
  return readCampaignConfig(campaignId);
}

export async function setCampaignAutomationConfig(campaignId, config) {
  const current = (await readCampaignConfig(campaignId)) || buildDefaultCampaignConfig(campaignId);
  return writeCampaignConfig(campaignId, {
    ...current,
    ...config,
    leadPreparations: {
      ...current.leadPreparations,
      ...(config?.leadPreparations || {})
    }
  });
}

export async function removeCampaignAutomationConfig(campaignId) {
  const { error } = await supabaseAdmin
    .from("admin_settings")
    .delete()
    .eq("key", buildStoreKey(campaignId));

  if (error) {
    throw error;
  }
}

export async function getCompatLeadPreparation(campaignId, campaignLeadId) {
  const config = await readCampaignConfig(campaignId);
  return config?.leadPreparations?.[campaignLeadId] || null;
}

export async function upsertCompatLeadPreparation(campaignId, campaignLeadId, payload) {
  const current = (await readCampaignConfig(campaignId)) || buildDefaultCampaignConfig(campaignId);
  const existing = current.leadPreparations[campaignLeadId] || {};

  const nextConfig = {
    ...current,
    leadPreparations: {
      ...current.leadPreparations,
      [campaignLeadId]: {
        ...existing,
        ...payload,
        campaign_lead_id: campaignLeadId
      }
    }
  };

  const saved = await writeCampaignConfig(campaignId, nextConfig);
  return saved.leadPreparations[campaignLeadId];
}

export async function listCompatLeadPreparations(campaignId) {
  const config = await readCampaignConfig(campaignId);
  return Object.values(config?.leadPreparations || {});
}

export async function findCompatLeadPreparationByCampaignLeadId(campaignLeadId) {
  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("key, value")
    .like("key", `${STORE_KEY_PREFIX}%`);

  if (error) {
    throw error;
  }

  for (const row of data || []) {
    if (!row?.value) {
      continue;
    }

    try {
      const campaignId = String(row.key || "").replace(STORE_KEY_PREFIX, "");
      const config = normalizeCampaignConfig(campaignId, JSON.parse(row.value));
      const preparation = config?.leadPreparations?.[campaignLeadId];
      if (preparation) {
        return preparation;
      }
    } catch {
      // Ignore malformed compatibility payloads.
    }
  }

  return null;
}
