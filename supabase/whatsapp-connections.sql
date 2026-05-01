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

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Users see own whatsapp connections"
ON public.whatsapp_connections
FOR ALL
USING (auth.uid() = user_id);
