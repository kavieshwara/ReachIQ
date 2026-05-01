ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS google_maps_api_key,
  ADD COLUMN IF NOT EXISTS lead_searches_today INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.reset_daily_message_counts()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET messages_sent_today = 0,
      lead_searches_today = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
