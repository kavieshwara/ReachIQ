const supabaseUrl = process.env.SUPABASE_URL || "";

export const isDemoMode = process.env.DEMO_MODE === "true";

export const demoProfile = {
  id: "demo-user",
  email: "demo@reachiq.app",
  full_name: "Kavie Demo",
  avatar_url: null,
  role: "admin",
  plan: "free",
  messages_sent_today: 12,
  lead_searches_today: 1,
  messages_limit: 30,
  bonus_messages: 20,
  whatsapp_connected: true,
  whatsapp_phone_id: "demo-phone-id",
  whatsapp_token: "demo-token",
  meta_verified: false,
  referral_code: "DEMO2026"
};

let demoLeads = [
  {
    id: "lead-1",
    user_id: demoProfile.id,
    business_name: "SmileCraft Dental Studio",
    phone: "919876543210",
    address: "12 MG Road",
    city: "Bengaluru",
    niche: "dental",
    has_website: false,
    website_url: null,
    email: "hello@smilecraft.example",
    notes: "High-potential clinic with strong reviews.",
    status: "new",
    source: "google_maps",
    created_at: "2026-04-24T09:00:00.000Z"
  },
  {
    id: "lead-2",
    user_id: demoProfile.id,
    business_name: "Prime Estates Realty",
    phone: "919812341234",
    address: "42 Residency Road",
    city: "Bengaluru",
    niche: "real_estate",
    has_website: false,
    website_url: null,
    email: "sales@primeestates.example",
    notes: "Good candidate for a brochure-style site.",
    status: "contacted",
    source: "csv",
    created_at: "2026-04-23T08:00:00.000Z"
  },
  {
    id: "lead-3",
    user_id: demoProfile.id,
    business_name: "Urban Brew Cafe",
    phone: "919845678901",
    address: "88 Indiranagar 100 Feet Road",
    city: "Bengaluru",
    niche: "restaurant",
    has_website: true,
    website_url: "https://urbanbrew.example",
    email: "owners@urbanbrew.example",
    notes: "",
    status: "replied",
    source: "manual",
    created_at: "2026-04-22T10:30:00.000Z"
  }
];

let demoCampaigns = [
  {
    id: "camp-1",
    user_id: demoProfile.id,
    name: "Bengaluru Dental Outreach",
    status: "running",
    message_template: "Hi {{business}}, I built a sample website for your clinic. Want to see it?",
    total_leads: 2,
    sent_count: 2,
    delivered_count: 2,
    read_count: 1,
    replied_count: 1,
    failed_count: 0,
    delay_seconds: 10,
    created_at: "2026-04-23T09:00:00.000Z",
    updated_at: "2026-04-25T08:30:00.000Z"
  },
  {
    id: "camp-2",
    user_id: demoProfile.id,
    name: "Agency Demo Push",
    status: "paused",
    message_template: "Hi {{business}}, I can help you get more inbound leads with a modern website.",
    total_leads: 1,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    replied_count: 0,
    failed_count: 0,
    delay_seconds: 15,
    created_at: "2026-04-22T11:00:00.000Z",
    updated_at: "2026-04-24T12:00:00.000Z"
  }
];

let demoCampaignLeads = [
  {
    id: "cl-1",
    campaign_id: "camp-1",
    lead_id: "lead-1",
    status: "read",
    sent_at: "2026-04-24T09:00:00.000Z",
    delivered_at: "2026-04-24T09:01:00.000Z",
    read_at: "2026-04-24T09:15:00.000Z",
    replied_at: null,
    error_message: null
  },
  {
    id: "cl-2",
    campaign_id: "camp-1",
    lead_id: "lead-2",
    status: "sent",
    sent_at: "2026-04-24T09:05:00.000Z",
    delivered_at: "2026-04-24T09:06:00.000Z",
    read_at: null,
    replied_at: null,
    error_message: null
  },
  {
    id: "cl-3",
    campaign_id: "camp-2",
    lead_id: "lead-3",
    status: "pending",
    sent_at: null,
    delivered_at: null,
    read_at: null,
    replied_at: null,
    error_message: null
  }
];

let demoFollowUps = [
  {
    id: "fu-1",
    campaign_id: "camp-1",
    user_id: demoProfile.id,
    lead_id: "lead-1",
    message: "Following up in case you missed the website sample I built for your clinic.",
    scheduled_at: "2026-04-26T04:30:00.000Z",
    sent: false,
    sent_at: null,
    step_number: 1
  },
  {
    id: "fu-2",
    campaign_id: "camp-1",
    user_id: demoProfile.id,
    lead_id: "lead-2",
    message: "Just checking in - happy to share the live demo whenever you're ready.",
    scheduled_at: "2026-04-24T06:30:00.000Z",
    sent: true,
    sent_at: "2026-04-24T06:30:00.000Z",
    step_number: 1
  }
];

let demoTemplates = [
  {
    id: "tpl-user-1",
    user_id: demoProfile.id,
    name: "Clinic Pitch",
    content: "Hi {{business}}, I created a website preview for your clinic. Want me to send the link?",
    variables: ["{{business}}", "{{city}}"],
    niche: "dental",
    created_at: "2026-04-20T08:00:00.000Z"
  }
];

let demoWebsiteTemplates = [
  {
    id: "site-tpl-1",
    name: "Dental Aurora",
    niche: "dental",
    html_content: "<html><body><h1>{{BUSINESS_NAME}}</h1><p>{{TAGLINE}}</p></body></html>",
    preview_image_url: null,
    is_active: true,
    created_at: "2026-04-20T08:00:00.000Z"
  },
  {
    id: "site-tpl-2",
    name: "Real Estate Velocity",
    niche: "real_estate",
    html_content: "<html><body><h1>{{BUSINESS_NAME}}</h1><p>{{TAGLINE}}</p></body></html>",
    preview_image_url: null,
    is_active: true,
    created_at: "2026-04-21T08:00:00.000Z"
  }
];

let demoGeneratedWebsites = [
  {
    id: "site-1",
    user_id: demoProfile.id,
    lead_id: "lead-1",
    template_id: "site-tpl-1",
    business_name: "SmileCraft Dental Studio",
    phone: "919876543210",
    address: "12 MG Road",
    live_url: "https://reachiq-demo.github.io/smilecraft-dental-studio",
    github_repo: "reachiq-demo-smilecraft",
    html_content: "<html></html>",
    created_at: "2026-04-24T10:00:00.000Z"
  }
];

let demoSupportTickets = [
  {
    id: "ticket-1",
    user_id: demoProfile.id,
    subject: "Need help connecting WhatsApp",
    message: "I want to test the sandbox connection.",
    status: "open",
    admin_reply: null,
    created_at: "2026-04-24T12:00:00.000Z",
    updated_at: "2026-04-24T12:00:00.000Z"
  }
];

let demoNotifications = [
  {
    id: "notif-1",
    user_id: demoProfile.id,
    title: "Campaign launched",
    body: "Bengaluru Dental Outreach is now running.",
    type: "success",
    read: false,
    metadata: { campaignId: "camp-1", href: "/campaigns/camp-1" },
    created_at: "2026-04-25T08:40:00.000Z"
  },
  {
    id: "notif-2",
    user_id: demoProfile.id,
    title: "Reply received",
    body: "Urban Brew Cafe replied to your last outreach message.",
    type: "info",
    read: false,
    metadata: { leadId: "lead-3", href: "/campaigns/camp-1" },
    created_at: "2026-04-25T07:10:00.000Z"
  }
];

export function getDemoSettings() {
  return [
    { key: "demo_video_url", value: "" },
    { key: "maintenance_mode", value: "false" },
    { key: "free_messages_per_day", value: "30" },
    { key: "referral_bonus_messages", value: "10" },
    { key: "platform_announcement", value: "Local demo mode is active. Connect Supabase later to enable real auth and saved data." },
    { key: "payments_enabled", value: "false" },
    { key: "support_whatsapp_number", value: "919025929032" },
    { key: "upi_id", value: "reachiq@upi" },
    { key: "upi_qr_url", value: "" }
  ];
}

export function getDemoLeads() {
  return [...demoLeads];
}

export function deleteDemoLead(id) {
  demoLeads = demoLeads.filter((lead) => lead.id !== id);
}

export function createDemoLead(payload) {
  const lead = {
    id: `lead-${Date.now()}`,
    user_id: demoProfile.id,
    created_at: new Date().toISOString(),
    status: "new",
    source: "manual",
    has_website: false,
    website_url: null,
    email: null,
    notes: null,
    ...payload
  };
  demoLeads = [lead, ...demoLeads];
  return lead;
}

export function updateDemoLead(id, updates) {
  demoLeads = demoLeads.map((lead) => (lead.id === id ? { ...lead, ...updates } : lead));
  return demoLeads.find((lead) => lead.id === id) || null;
}

export function getDemoCampaigns() {
  return [...demoCampaigns];
}

export function getDemoCampaignById(id) {
  const campaign = demoCampaigns.find((item) => item.id === id);
  if (!campaign) return null;

  return {
    ...campaign,
    campaign_leads: demoCampaignLeads
      .filter((item) => item.campaign_id === id)
      .map((item) => ({ ...item, leads: demoLeads.find((lead) => lead.id === item.lead_id) || null })),
    follow_ups: demoFollowUps.filter((item) => item.campaign_id === id)
  };
}

export function updateDemoCampaign(id, updates) {
  demoCampaigns = demoCampaigns.map((campaign) => (campaign.id === id ? { ...campaign, ...updates, updated_at: new Date().toISOString() } : campaign));
  return demoCampaigns.find((campaign) => campaign.id === id) || null;
}

export function createDemoCampaign(payload) {
  const campaign = {
    id: `camp-${Date.now()}`,
    user_id: demoProfile.id,
    name: payload.name,
    status: "draft",
    message_template: payload.message_template,
    total_leads: (payload.lead_ids || []).length,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    replied_count: 0,
    failed_count: 0,
    delay_seconds: payload.delay_seconds || 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  demoCampaigns = [campaign, ...demoCampaigns];

  for (const leadId of payload.lead_ids || []) {
    demoCampaignLeads.push({
      id: `cl-${Date.now()}-${leadId}`,
      campaign_id: campaign.id,
      lead_id: leadId,
      status: "pending",
      sent_at: null,
      delivered_at: null,
      read_at: null,
      replied_at: null,
      error_message: null
    });
  }

  for (const step of payload.followUps || []) {
    demoFollowUps.push({
      id: `fu-${Date.now()}-${step.step_number || 1}`,
      campaign_id: campaign.id,
      user_id: demoProfile.id,
      lead_id: (payload.lead_ids || [])[0] || "lead-1",
      message: step.message,
      scheduled_at: step.scheduled_at || new Date(Date.now() + 86400000).toISOString(),
      sent: false,
      sent_at: null,
      step_number: step.step_number || 1
    });
  }

  return campaign;
}

export function launchDemoCampaign(id) {
  const campaign = updateDemoCampaign(id, { status: "running" });
  if (!campaign) return null;
  return getDemoCampaignById(id);
}

export function getDemoTemplates() {
  const systemTemplates = [
    {
      id: "system-realestate",
      name: "Real Estate Pitch",
      niche: "real_estate",
      content: "Hi {{name}}, I noticed your business in {{city}} could use a polished online presence. Want a sample site?",
      variables: ["{{name}}", "{{city}}"]
    },
    {
      id: "system-dental",
      name: "Dental Pitch",
      niche: "dental",
      content: "Hi {{business}}, I created a clean website mockup for your clinic. Want me to send the preview?",
      variables: ["{{business}}"]
    }
  ];

  return {
    userTemplates: [...demoTemplates],
    systemTemplates
  };
}

export function createDemoTemplate(payload) {
  const template = {
    id: `tpl-${Date.now()}`,
    user_id: demoProfile.id,
    created_at: new Date().toISOString(),
    ...payload
  };
  demoTemplates = [template, ...demoTemplates];
  return template;
}

export function getDemoWebsiteTemplates() {
  return [...demoWebsiteTemplates];
}

export function getDemoGeneratedWebsites() {
  return [...demoGeneratedWebsites];
}

export function createDemoGeneratedWebsite(payload) {
  const site = {
    id: `site-${Date.now()}`,
    user_id: demoProfile.id,
    github_repo: null,
    html_content: "<html></html>",
    created_at: new Date().toISOString(),
    live_url: `https://reachiq-demo.github.io/${String(payload.business_name || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    ...payload
  };
  demoGeneratedWebsites = [site, ...demoGeneratedWebsites];
  return site;
}

export function getDemoFollowUps() {
  return demoFollowUps.map((item) => ({
    ...item,
    leads: demoLeads.find((lead) => lead.id === item.lead_id) || null,
    campaigns: demoCampaigns.find((campaign) => campaign.id === item.campaign_id) || null
  }));
}

export function deleteDemoFollowUp(id) {
  demoFollowUps = demoFollowUps.filter((item) => item.id !== id);
}

export function getDemoWhatsAppStatus() {
  return {
    connected: true,
    verified: true,
    phoneNumberId: "demo-phone-id",
    display_phone_number: "+91 99999 99999",
    verified_name: "ReachIQ Demo Number",
    metaVerified: false
  };
}

export function getDemoReferral() {
  return {
    profile: {
      referral_code: demoProfile.referral_code,
      bonus_messages: demoProfile.bonus_messages,
      messages_limit: demoProfile.messages_limit
    },
    referrals: [
      {
        id: "ref-1",
        created_at: "2026-04-22T05:00:00.000Z",
        profiles: { full_name: "Demo Client", email: "client@example.com" }
      }
    ]
  };
}

export function getDemoSupportTickets() {
  return [...demoSupportTickets];
}

export function createDemoSupportTicket(payload) {
  const ticket = {
    id: `ticket-${Date.now()}`,
    user_id: demoProfile.id,
    status: "open",
    admin_reply: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...payload
  };
  demoSupportTickets = [ticket, ...demoSupportTickets];
  return ticket;
}

export function getDemoAdminStats() {
  return {
    users: 128,
    campaigns: demoCampaigns.length,
    leads: demoLeads.length,
    websites: demoGeneratedWebsites.length,
    activeCampaigns: demoCampaigns.filter((item) => item.status === "running").length,
    premiumUsers: 14
  };
}

export function getDemoAdminUsers() {
  return [
    demoProfile,
    {
      ...demoProfile,
      id: "demo-user-2",
      email: "agency@reachiq.app",
      full_name: "Agency Owner",
      role: "user",
      plan: "premium",
      messages_sent_today: 44,
      messages_limit: 200,
      bonus_messages: 30,
      whatsapp_connected: true
    }
  ];
}

export function getDemoAdminCampaigns() {
  return getDemoCampaigns();
}

export function getDemoAdminTickets() {
  return getDemoSupportTickets();
}

export function getDemoNotifications() {
  return [...demoNotifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function createDemoNotification(payload) {
  const notification = {
    id: `notif-${Date.now()}`,
    user_id: demoProfile.id,
    read: false,
    metadata: {},
    created_at: new Date().toISOString(),
    ...payload
  };
  demoNotifications = [notification, ...demoNotifications];
  return notification;
}

export function markDemoNotificationRead(id) {
  demoNotifications = demoNotifications.map((item) => (item.id === id ? { ...item, read: true } : item));
  return demoNotifications.find((item) => item.id === id) || null;
}

export function getDemoMapsResults({ niche, location }) {
  return [
    {
      business_name: `${niche} Studio One`,
      phone: "919800000001",
      address: `14 Demo Street, ${location}`,
      city: location,
      niche,
      has_website: false,
      website_url: null,
      rating: 4.6,
      source: "google_maps"
    },
    {
      business_name: `${niche} Studio Two`,
      phone: "919800000002",
      address: `28 Demo Avenue, ${location}`,
      city: location,
      niche,
      has_website: false,
      website_url: null,
      rating: 4.4,
      source: "google_maps"
    }
  ];
}
