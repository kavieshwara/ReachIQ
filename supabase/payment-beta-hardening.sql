CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_upi_transaction_id_unique
ON public.payment_submissions ((lower(upi_transaction_id)));

INSERT INTO public.admin_settings (key, value)
VALUES ('payments_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

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
