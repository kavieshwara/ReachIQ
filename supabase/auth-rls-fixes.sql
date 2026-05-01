-- ReachIQ Supabase auth + RLS fixes
-- Run this entire file in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, referral_code)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    substr(md5(random()::text), 1, 8)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- LEADS
DROP POLICY IF EXISTS "Users see own leads" ON public.leads;
CREATE POLICY "Users see own leads" ON public.leads
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CAMPAIGNS
DROP POLICY IF EXISTS "Users see own campaigns" ON public.campaigns;
CREATE POLICY "Users see own campaigns" ON public.campaigns
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CAMPAIGN_LEADS
DROP POLICY IF EXISTS "Users see own campaign_leads" ON public.campaign_leads;
CREATE POLICY "Users see own campaign_leads" ON public.campaign_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- TEMPLATES
DROP POLICY IF EXISTS "Users see own templates" ON public.templates;
CREATE POLICY "Users see own templates" ON public.templates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- FOLLOW_UPS
DROP POLICY IF EXISTS "Users see own follow_ups" ON public.follow_ups;
CREATE POLICY "Users see own follow_ups" ON public.follow_ups
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CHAT_MESSAGES
DROP POLICY IF EXISTS "Users see own chat" ON public.chat_messages;
CREATE POLICY "Users see own chat" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- GENERATED_WEBSITES
DROP POLICY IF EXISTS "Users see own generated_websites" ON public.generated_websites;
CREATE POLICY "Users see own generated_websites" ON public.generated_websites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- REFERRALS
DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Insert referrals" ON public.referrals;
CREATE POLICY "Insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

-- SUPPORT_TICKETS
DROP POLICY IF EXISTS "Users see own tickets" ON public.support_tickets;
CREATE POLICY "Users see own tickets" ON public.support_tickets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- WEBSITE_TEMPLATES
DROP POLICY IF EXISTS "Website templates public read" ON public.website_templates;
CREATE POLICY "Website templates public read" ON public.website_templates
  FOR SELECT USING (true);

-- ADMIN_SETTINGS
DROP POLICY IF EXISTS "Admin settings public read" ON public.admin_settings;
CREATE POLICY "Admin settings public read" ON public.admin_settings
  FOR SELECT USING (true);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON public.follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_at ON public.follow_ups(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
