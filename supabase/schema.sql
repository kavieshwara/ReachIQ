CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  plan TEXT DEFAULT 'free',
  messages_sent_today INTEGER DEFAULT 0,
  lead_searches_today INTEGER DEFAULT 0,
  daily_usage_date DATE DEFAULT CURRENT_DATE,
  messages_limit INTEGER DEFAULT 30,
  referral_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  referred_by UUID REFERENCES public.profiles(id),
  bonus_messages INTEGER DEFAULT 0,
  whatsapp_connected BOOLEAN DEFAULT false,
  whatsapp_phone_id TEXT,
  whatsapp_token TEXT,
  meta_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  niche TEXT,
  has_website BOOLEAN DEFAULT false,
  website_url TEXT,
  email TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  message_template TEXT NOT NULL,
  auto_generate_assets BOOLEAN DEFAULT false,
  require_video_assets BOOLEAN DEFAULT false,
  total_leads INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  delay_seconds INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  step_number INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[],
  niche TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.website_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  html_content TEXT NOT NULL,
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS website_template_id UUID REFERENCES public.website_templates(id);

CREATE TABLE IF NOT EXISTS public.generated_websites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id),
  template_id UUID REFERENCES public.website_templates(id),
  business_name TEXT,
  phone TEXT,
  address TEXT,
  live_url TEXT,
  github_repo TEXT,
  html_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  upi_transaction_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_upi_transaction_id_unique
ON public.payment_submissions ((lower(upi_transaction_id)));

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('qr', 'meta')),
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  session_data JSONB DEFAULT '{}'::jsonb,
  phone_number_id TEXT,
  access_token_encrypted TEXT,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider_type)
);

CREATE TABLE IF NOT EXISTS public.outreach_preparations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE CASCADE UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  website_template_id UUID REFERENCES public.website_templates(id),
  generated_website_id UUID REFERENCES public.generated_websites(id),
  website_status TEXT DEFAULT 'pending',
  message_status TEXT DEFAULT 'pending',
  video_status TEXT DEFAULT 'pending',
  send_status TEXT DEFAULT 'pending',
  personalized_message TEXT,
  website_live_url TEXT,
  video_url TEXT,
  generation_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id UUID REFERENCES public.profiles(id),
  referred_id UUID REFERENCES public.profiles(id),
  bonus_given INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admin_settings (key, value)
VALUES
  ('demo_video_url', ''),
  ('maintenance_mode', 'false'),
  ('free_messages_per_day', '30'),
  ('referral_bonus_messages', '10'),
  ('platform_announcement', ''),
  ('payments_enabled', 'false'),
  ('support_whatsapp_number', '919025929032'),
  ('upi_id', 'reachiq@upi'),
  ('upi_qr_url', '')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users see own leads" ON public.leads;
CREATE POLICY "Users see own leads" ON public.leads FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own campaigns" ON public.campaigns;
CREATE POLICY "Users see own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own campaign_leads" ON public.campaign_leads;
CREATE POLICY "Users see own campaign_leads" ON public.campaign_leads FOR ALL USING (
  campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users see own follow_ups" ON public.follow_ups;
CREATE POLICY "Users see own follow_ups" ON public.follow_ups FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own templates" ON public.templates;
CREATE POLICY "Users see own templates" ON public.templates FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own generated_websites" ON public.generated_websites;
CREATE POLICY "Users see own generated_websites" ON public.generated_websites FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own payment submissions" ON public.payment_submissions;
CREATE POLICY "Users see own payment submissions" ON public.payment_submissions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Users see own whatsapp connections" ON public.whatsapp_connections FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own outreach_preparations" ON public.outreach_preparations;
CREATE POLICY "Users see own outreach_preparations" ON public.outreach_preparations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own chat" ON public.chat_messages;
CREATE POLICY "Users see own chat" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own tickets" ON public.support_tickets;
CREATE POLICY "Users see own tickets" ON public.support_tickets FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Website templates are public read" ON public.website_templates;
CREATE POLICY "Website templates are public read" ON public.website_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin settings are public read" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins manage settings" ON public.admin_settings;
CREATE POLICY "Admins manage settings" ON public.admin_settings
FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.reset_daily_message_counts()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET messages_sent_today = 0,
      lead_searches_today = 0,
      daily_usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
