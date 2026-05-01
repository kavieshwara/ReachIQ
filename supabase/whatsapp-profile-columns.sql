alter table public.profiles
add column if not exists whatsapp_phone text,
add column if not exists whatsapp_method text default 'none';

comment on column public.profiles.whatsapp_method is 'none, baileys, or meta';
