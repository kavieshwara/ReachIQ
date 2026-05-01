ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS website_template_id UUID REFERENCES public.website_templates(id),
ADD COLUMN IF NOT EXISTS auto_generate_assets BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS require_video_assets BOOLEAN DEFAULT false;

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

ALTER TABLE public.outreach_preparations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own outreach_preparations" ON public.outreach_preparations;
CREATE POLICY "Users see own outreach_preparations"
ON public.outreach_preparations
FOR ALL
USING (auth.uid() = user_id);
