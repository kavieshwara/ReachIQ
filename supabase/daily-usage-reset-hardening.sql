ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_usage_date DATE DEFAULT CURRENT_DATE;

UPDATE public.profiles
SET daily_usage_date = COALESCE(daily_usage_date, CURRENT_DATE);

CREATE OR REPLACE FUNCTION public.reset_daily_message_counts()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET messages_sent_today = 0,
      lead_searches_today = 0,
      daily_usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
