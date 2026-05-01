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

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own payment submissions" ON public.payment_submissions;
CREATE POLICY "Users see own payment submissions"
ON public.payment_submissions
FOR ALL
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_upi_transaction_id_unique
ON public.payment_submissions ((lower(upi_transaction_id)));

INSERT INTO public.admin_settings (key, value)
VALUES
  ('upi_id', 'reachiq@upi'),
  ('upi_qr_url', ''),
  ('payments_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
