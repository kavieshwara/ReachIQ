# ReachIQ

ReachIQ is a full-stack WhatsApp outreach and lead generation SaaS built with Next.js, Express, Supabase, BullMQ, Upstash Redis, and Gemini.

## Stack

- Frontend: Next.js 14 App Router, Tailwind CSS, Zustand, React Hook Form, Zod, Recharts, Framer Motion
- Backend: Express, BullMQ, Upstash Redis, Meta WhatsApp Cloud API, Gemini 1.5 Flash
- Database/Auth/Storage: Supabase
- Hosting: Vercel for frontend, Render for backend

## Recommended Runtime

- Node.js: 20 LTS
- npm: 10+

ReachIQ's frontend TypeScript checks pass in this workspace. The local `next build` on this Windows machine hit a Next.js `readlink` issue under Node 22. For the smoothest local experience, use Node 20 LTS or run the frontend inside WSL/Linux.

Use the included version pin:

```bash
nvm use
```

## Project Structure

```bash
reachiq/
  frontend/
  backend/
```

## Supabase Setup

1. Create a new Supabase project.
2. Open the SQL editor.
3. Run the full SQL schema from the product specification in the exact order provided.
4. Confirm the following tables exist:
   - `profiles`
   - `leads`
   - `campaigns`
   - `campaign_leads`
   - `follow_ups`
   - `templates`
   - `website_templates`
   - `generated_websites`
   - `referrals`
   - `chat_messages`
   - `admin_settings`
   - `support_tickets`
5. Confirm RLS is enabled.
6. Confirm the `handle_new_user` trigger exists and auto-creates profile rows.
7. Run [supabase/remove-user-google-maps-and-add-search-usage.sql](./supabase/remove-user-google-maps-and-add-search-usage.sql) so ReachIQ can manage shared lead-search usage centrally.

## Admin Account

1. Sign up from `/signup`.
2. Open Supabase Table Editor and find the row in `profiles`.
3. Change `role` from `user` to `admin`.
4. Log out and log back in.

Optional SQL:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## Environment Variables

### Frontend

Copy [frontend/.env.local.example](./frontend/.env.local.example) to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_URL=
```

### Backend

Copy [backend/.env.example](./backend/.env.example) to `.env` and fill:

```bash
PORT=4001
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
WHATSAPP_API_VERSION=v18.0
WHATSAPP_APP_SECRET=
GEMINI_API_KEY=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
RESEND_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
GITHUB_TOKEN=
GITHUB_USERNAME=
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
SERPER_API_KEY=
OUTSCRAPER_API_KEY=
FRONTEND_URL=
```

## Third-Party Setup

### Lead Search Providers

ReachIQ users no longer bring their own Google Maps API key. The platform searches from the backend using founder-managed providers:

1. **Overpass / OpenStreetMap**
   - No signup or API key required
   - Set `OVERPASS_API_URL=https://overpass-api.de/api/interpreter`
2. **Serper.dev**
   - Sign up at [serper.dev](https://serper.dev)
   - Copy the key into `SERPER_API_KEY`
   - Used as the Google Maps-quality fallback and website verification source
3. **Outscraper** (optional backup)
   - Sign up at [outscraper.com](https://outscraper.com)
   - Copy the key into `OUTSCRAPER_API_KEY`

ReachIQ tries Overpass first, then Serper, then Outscraper.

### Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com).
2. Create a Gemini API key.
3. Put it in `GEMINI_API_KEY`.

### GitHub Token for Website Deployment

1. Open GitHub Settings -> Developer Settings -> Personal access tokens.
2. Create a token with repository write permissions.
3. Put the token in `GITHUB_TOKEN`.
4. Put your GitHub username in `GITHUB_USERNAME`.

### Meta WhatsApp Business API

1. Go to [developer.facebook.com](https://developer.facebook.com).
2. Create a Meta app and enable WhatsApp.
3. Add a phone number in WhatsApp Manager.
4. Get the Phone Number ID and access token.
5. Put them into ReachIQ from `/connect-whatsapp`.
6. Set webhook URL to your backend:
   `https://your-render-backend.onrender.com/api/whatsapp/webhook`
7. Set the verification token to the same value you use in backend env for `WHATSAPP_APP_SECRET`.

### Upstash Redis

1. Go to [upstash.com](https://upstash.com).
2. Create a Redis database.
3. Copy the Redis URL and token.
4. Put them into `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN`.

### Resend API Key

1. Go to [resend.com](https://resend.com).
2. Create an API key.
3. Put it in `RESEND_API_KEY`.

## Local Development

### Backend

```bash
cd backend
npm install --no-audit --no-fund --legacy-peer-deps
npm run dev
```

### Frontend

```bash
cd frontend
npm install --no-audit --no-fund --legacy-peer-deps
npm run dev
```

Frontend runs on `http://localhost:3000` and backend on `http://localhost:4001`.

If you are on Windows and `next build` fails with a `readlink` error while using Node 22, switch to Node 20 first:

```bash
nvm use 20
```

## Deployment

### Frontend on Vercel

1. Push the repo to GitHub.
2. Import the `frontend` folder into Vercel.
3. Add the frontend environment variables.
4. Deploy.

### Backend on Render

1. Create a new Web Service on Render.
2. Point it at the `backend` folder.
3. Build command: `npm install --no-audit --no-fund --legacy-peer-deps`
4. Start command: `npm start`
5. Add backend environment variables.

Backend note:

```text
Backend is hosted on Render.com free tier.

IMPORTANT: Render free tier spins down after 15 minutes of inactivity.
First request after inactivity takes 30-60 seconds (cold start).

To prevent this in production, upgrade to Render Starter ($7/month)
or use a free uptime monitor like UptimeRobot to ping the backend
every 10 minutes.
```

Use the `/health` endpoint for uptime monitoring:

```bash
GET /health
```

## WhatsApp Webhook

Set Meta webhook URL to:

```text
https://your-render-backend.onrender.com/api/whatsapp/webhook
```

Verification token:

```text
Use the same value as WHATSAPP_APP_SECRET
```

## Verification Status

The following checks were run in this workspace:

- Backend syntax check passed for every `backend/src/**/*.js` file
- Frontend TypeScript check passed with `tsc --noEmit`
- Frontend `next build` still needs a rerun under Node 20 or Linux/WSL because the current Windows Node 22 environment hit a Next.js `readlink` packaging issue

## Notes

- Paid Razorpay flows are scaffolded behind `admin_settings.payments_enabled`.
- The frontend is dark-mode only by design.
- All dashboard routes expect a valid Supabase session.
- The backend enforces a 100 requests / 15 minute rate limit per IP.
- Website deployment expects a GitHub personal access token with repository write access.
- WhatsApp campaign sends are queued through BullMQ instead of being executed inline from the request handler.
