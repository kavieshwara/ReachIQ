import { supabaseAdmin } from "../utils/supabase.js";

function buildHospitalityTemplate({
  eyebrow,
  accent,
  glow,
  heroLabel,
  sectionLabel,
  bookingLabel,
  serviceTitle,
  storyTitle
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{BUSINESS_NAME}} | ReachIQ Preview</title>
  <style>
    :root {
      --bg: #09080d;
      --panel: rgba(18, 18, 24, 0.86);
      --panel-soft: rgba(255, 255, 255, 0.05);
      --text: #f7f4ef;
      --muted: #b7b2c7;
      --line: rgba(255, 255, 255, 0.09);
      --accent: ${accent};
      --glow: ${glow};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: radial-gradient(circle at top, rgba(255,255,255,0.06), transparent 28%), var(--bg); color: var(--text); font-family: "Segoe UI", system-ui, sans-serif; overflow-x: hidden; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.04), transparent 40%),
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 25%);
      pointer-events: none;
    }
    a { color: inherit; text-decoration: none; }
    .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
    .nav {
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(18px);
      background: rgba(7, 7, 10, 0.76);
      border-bottom: 1px solid var(--line);
    }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 18px 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent), var(--glow));
      box-shadow: 0 20px 35px rgba(0, 0, 0, 0.24);
      display: grid;
      place-items: center;
      color: #09080d;
      font-weight: 900;
    }
    .nav-links {
      display: flex;
      gap: 18px;
      color: var(--muted);
      font-size: 14px;
    }
    .nav-cta {
      padding: 12px 18px;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--accent), var(--glow));
      color: #09080d;
      font-weight: 700;
      box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
    }
    .hero {
      padding: 92px 0 72px;
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 28px;
      align-items: center;
    }
    .hero-card,
    .story-card,
    .service-card,
    .contact-card,
    .metric-card {
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    }
    .hero-card {
      border-radius: 32px;
      padding: 42px;
      position: relative;
      overflow: hidden;
    }
    .hero-card::after {
      content: "";
      position: absolute;
      inset: auto -10% -40% auto;
      width: 280px;
      height: 280px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(255,255,255,0.18), transparent 60%);
      pointer-events: none;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    h1 {
      margin: 22px 0 16px;
      font-size: clamp(42px, 6vw, 76px);
      line-height: 0.98;
      letter-spacing: -0.04em;
    }
    h1 span { color: var(--accent); }
    .hero-copy {
      max-width: 640px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.8;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 28px;
    }
    .primary-btn,
    .secondary-btn {
      padding: 15px 22px;
      border-radius: 16px;
      font-weight: 700;
      font-size: 15px;
    }
    .primary-btn {
      background: linear-gradient(135deg, var(--accent), var(--glow));
      color: #09080d;
    }
    .secondary-btn {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.04);
      color: var(--text);
    }
    .hero-side {
      display: grid;
      gap: 18px;
    }
    .story-card,
    .contact-card,
    .metric-card {
      border-radius: 26px;
      padding: 24px;
    }
    .story-card h2,
    .services h2,
    .contact-card h2 {
      margin: 0 0 12px;
      font-size: 18px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .story-card p,
    .contact-card p,
    .service-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
      font-size: 15px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-top: 20px;
    }
    .metric-card strong {
      display: block;
      font-size: 26px;
      margin-bottom: 8px;
    }
    .metric-card span {
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }
    .services {
      padding: 18px 0 86px;
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-top: 22px;
    }
    .service-card {
      border-radius: 24px;
      padding: 26px;
    }
    .service-card h3 {
      margin: 0 0 10px;
      font-size: 22px;
    }
    .service-card small {
      display: inline-block;
      margin-top: 14px;
      color: var(--accent);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: 11px;
    }
    .contact {
      padding: 0 0 90px;
    }
    .contact-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      align-items: start;
    }
    .contact-list {
      display: grid;
      gap: 14px;
      margin-top: 10px;
    }
    .contact-item {
      padding: 16px;
      border-radius: 18px;
      background: var(--panel-soft);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .contact-item span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    footer {
      border-top: 1px solid var(--line);
      padding: 26px 0 40px;
      color: var(--muted);
      font-size: 14px;
    }
    @media (max-width: 980px) {
      .hero,
      .contact-card { grid-template-columns: 1fr; }
      .services-grid,
      .metrics { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .hero-card { padding: 30px; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="shell nav-inner">
      <div class="brand">
        <div class="brand-mark">${eyebrow}</div>
        <span>{{BUSINESS_NAME}}</span>
      </div>
      <div class="nav-links">
        <a href="#experience">${sectionLabel}</a>
        <a href="#visit">Visit</a>
        <a href="#contact">Contact</a>
      </div>
      <a class="nav-cta" href="{{WHATSAPP_LINK}}">${bookingLabel}</a>
    </div>
  </nav>

  <main class="shell">
    <section class="hero">
      <article class="hero-card">
        <div class="eyebrow">${heroLabel} in {{CITY}}</div>
        <h1>${serviceTitle} at <span>{{BUSINESS_NAME}}</span></h1>
        <p class="hero-copy">{{TAGLINE}}</p>
        <div class="hero-actions">
          <a class="primary-btn" href="{{WHATSAPP_LINK}}">${bookingLabel}</a>
          <a class="secondary-btn" href="#contact">Call {{PHONE}}</a>
        </div>
        <div class="metrics">
          <div class="metric-card">
            <strong>Fresh</strong>
            <span>Experience design</span>
          </div>
          <div class="metric-card">
            <strong>Fast</strong>
            <span>WhatsApp enquiries</span>
          </div>
          <div class="metric-card">
            <strong>Local</strong>
            <span>Built for {{CITY}}</span>
          </div>
        </div>
      </article>

      <div class="hero-side">
        <article class="story-card">
          <h2>${storyTitle}</h2>
          <p>{{BUSINESS_NAME}} now has a cleaner, more confident online experience for customers in {{CITY}}. Use this page to show the brand, collect enquiries, and make it easier for people to trust the business before they ever visit.</p>
        </article>
        <article class="story-card">
          <h2>Address</h2>
          <p>{{ADDRESS}}</p>
        </article>
      </div>
    </section>

    <section class="services" id="experience">
      <h2>${sectionLabel}</h2>
      <div class="services-grid" id="services-grid"></div>
      <div id="services-data" hidden>{{SERVICES}}</div>
    </section>

    <section class="contact" id="contact">
      <article class="contact-card">
        <div>
          <h2>Plan your visit</h2>
          <p>Turn this sample into a real conversion page with booking, map directions, WhatsApp chat, and highlight sections that fit {{BUSINESS_NAME}} perfectly.</p>
          <div class="contact-list">
            <div class="contact-item">
              <span>Phone</span>
              <a href="tel:{{PHONE}}">{{PHONE}}</a>
            </div>
            <div class="contact-item">
              <span>Location</span>
              <strong>{{ADDRESS}}</strong>
            </div>
          </div>
        </div>
        <div class="story-card" id="visit">
          <h2>Why this works</h2>
          <p>This layout uses a premium hero, focused messaging, and strong call-to-action buttons so local customers can immediately understand what makes {{BUSINESS_NAME}} worth visiting.</p>
          <div class="hero-actions">
            <a class="primary-btn" href="{{WHATSAPP_LINK}}">Chat on WhatsApp</a>
            <a class="secondary-btn" href="#experience">See the experience</a>
          </div>
        </div>
      </article>
    </section>
  </main>

  <footer>
    <div class="shell">{{BUSINESS_NAME}} preview crafted for {{CITY}}. Phone: {{PHONE}}</div>
  </footer>

  <script>
    (function() {
      const fallback = [
        "Signature menu highlights|Showcase the most profitable dishes or drinks in a clean visual way.",
        "WhatsApp first enquiries|Let customers reserve, ask questions, and order quickly from mobile.",
        "Location trust signals|Add hours, address, and proof that the place is active and easy to find."
      ];
      const raw = (document.getElementById('services-data')?.textContent || '').split(',').map((item) => item.trim()).filter(Boolean);
      const items = (raw.length ? raw.map((item) => item + '|A simple section explaining why customers should care about this offering.') : fallback).slice(0, 3);
      const grid = document.getElementById('services-grid');
      grid.innerHTML = items.map((entry, index) => {
        const [title, description] = entry.split('|');
        return '<article class="service-card"><small>0' + (index + 1) + '</small><h3>' + title + '</h3><p>' + (description || 'Clear value for local customers.') + '</p></article>';
      }).join('');
    })();
  </script>
</body>
</html>`;
}

function buildDentalTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{BUSINESS_NAME}} | Dental Care</title>
  <style>
    :root {
      --bg: #eef7fb;
      --ink: #0f1f2e;
      --muted: #567086;
      --primary: #0ea5e9;
      --primary-soft: #d7f0fb;
      --panel: rgba(255,255,255,0.78);
      --line: rgba(15,31,46,0.08);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: radial-gradient(circle at top right, rgba(14,165,233,0.16), transparent 24%), var(--bg); color: var(--ink); font-family: "Segoe UI", system-ui, sans-serif; overflow-x: hidden; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background-image: linear-gradient(rgba(15,31,46,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,31,46,0.03) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
    }
    a { color: inherit; text-decoration: none; }
    .shell { width: min(1160px, calc(100% - 40px)); margin: 0 auto; }
    .nav { padding: 20px 0; }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 16px 20px;
      border-radius: 24px;
      border: 1px solid var(--line);
      backdrop-filter: blur(14px);
      background: var(--panel);
      box-shadow: 0 18px 50px rgba(15, 31, 46, 0.08);
    }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 14px;
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      color: white;
      display: grid;
      place-items: center;
      font-weight: 800;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      padding: 32px 0 76px;
      align-items: center;
    }
    .hero-panel,
    .info-panel,
    .service-panel,
    .contact-panel {
      border: 1px solid var(--line);
      background: var(--panel);
      backdrop-filter: blur(14px);
      box-shadow: 0 18px 55px rgba(15, 31, 46, 0.08);
      border-radius: 30px;
    }
    .hero-panel { padding: 38px; }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-weight: 700;
    }
    h1 { margin: 20px 0 16px; font-size: clamp(42px, 5vw, 72px); line-height: 1; letter-spacing: -0.04em; }
    h1 span { color: var(--primary); }
    .hero-panel p { margin: 0; color: var(--muted); font-size: 18px; line-height: 1.8; }
    .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 28px; }
    .primary-btn, .secondary-btn {
      padding: 15px 22px;
      border-radius: 16px;
      font-weight: 700;
      font-size: 15px;
    }
    .primary-btn { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; }
    .secondary-btn { background: white; color: var(--ink); border: 1px solid var(--line); }
    .info-panel { padding: 28px; display: grid; gap: 16px; }
    .info-panel strong { display: block; font-size: 28px; margin-bottom: 6px; }
    .info-panel span, .info-panel p { color: var(--muted); line-height: 1.7; }
    .services { padding-bottom: 76px; }
    .services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 22px; }
    .service-panel { padding: 24px; }
    .service-panel h3 { margin: 0 0 12px; font-size: 20px; }
    .service-panel p { margin: 0; color: var(--muted); line-height: 1.7; }
    .contact-panel { padding: 30px; }
    .contact-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 18px; }
    .contact-tile { padding: 18px; border-radius: 18px; background: rgba(14,165,233,0.06); border: 1px solid rgba(14,165,233,0.12); }
    .contact-tile span { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-bottom: 8px; }
    footer { padding: 28px 0 40px; color: var(--muted); font-size: 14px; }
    @media (max-width: 980px) {
      .hero, .services-grid, .contact-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="nav">
      <div class="nav-inner">
        <div class="brand"><div class="brand-mark">D</div><span>{{BUSINESS_NAME}}</span></div>
        <a class="primary-btn" href="{{WHATSAPP_LINK}}">Book Appointment</a>
      </div>
    </header>

    <section class="hero">
      <article class="hero-panel">
        <div class="eyebrow">Dental care in {{CITY}}</div>
        <h1>Confident smiles begin at <span>{{BUSINESS_NAME}}</span></h1>
        <p>{{TAGLINE}}</p>
        <div class="hero-actions">
          <a class="primary-btn" href="{{WHATSAPP_LINK}}">Chat on WhatsApp</a>
          <a class="secondary-btn" href="tel:{{PHONE}}">Call {{PHONE}}</a>
        </div>
      </article>
      <aside class="info-panel">
        <div><strong>Modern trust</strong><span>A clean first impression helps patients feel safe before they ever walk in.</span></div>
        <div><strong>Local visibility</strong><span>Show treatments, contact details, and location clearly for patients in {{CITY}}.</span></div>
        <div><strong>Quick action</strong><span>Let people book directly through WhatsApp instead of dropping off.</span></div>
      </aside>
    </section>

    <section class="services">
      <div class="eyebrow">Popular treatments</div>
      <div class="services-grid" id="services-grid"></div>
      <div id="services-data" hidden>{{SERVICES}}</div>
    </section>

    <section class="contact-panel">
      <div class="eyebrow">Visit the clinic</div>
      <div class="contact-grid">
        <div class="contact-tile"><span>Phone</span><strong>{{PHONE}}</strong></div>
        <div class="contact-tile"><span>City</span><strong>{{CITY}}</strong></div>
        <div class="contact-tile"><span>Address</span><strong>{{ADDRESS}}</strong></div>
      </div>
    </section>

    <footer>{{BUSINESS_NAME}} preview for {{CITY}}. Reach out on WhatsApp for appointments and enquiries.</footer>
  </div>
  <script>
    (function() {
      const fallback = ['Dental checkups','Cosmetic dentistry','Emergency care'];
      const values = (document.getElementById('services-data')?.textContent || '').split(',').map((item) => item.trim()).filter(Boolean);
      const items = (values.length ? values : fallback).slice(0, 3);
      document.getElementById('services-grid').innerHTML = items.map((item) => '<article class="service-panel"><h3>' + item + '</h3><p>Designed to help {{BUSINESS_NAME}} present this service clearly and make it easier for patients to enquire quickly.</p></article>').join('');
    })();
  </script>
</body>
</html>`;
}

function buildAutoShowroomTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{BUSINESS_NAME}} | Auto Showroom</title>
  <style>
    :root {
      --bg: #06070a;
      --ink: #f5f7fb;
      --muted: #9ea8b6;
      --accent: #ff5533;
      --accent-soft: rgba(255,85,51,0.12);
      --line: rgba(255,255,255,0.08);
      --panel: rgba(15,18,24,0.88);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: radial-gradient(circle at top right, rgba(255,85,51,0.14), transparent 22%), var(--bg); color: var(--ink); font-family: "Segoe UI", system-ui, sans-serif; overflow-x: hidden; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent 24%);
      pointer-events: none;
    }
    a { color: inherit; text-decoration: none; }
    .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
    .nav { padding: 18px 0; }
    .nav-inner, .hero-panel, .spec-grid article, .cta-panel {
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: 0 18px 60px rgba(0,0,0,0.28);
    }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 16px 20px;
      border-radius: 24px;
    }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; }
    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent), #ff8c42);
      color: white;
      display: grid;
      place-items: center;
      font-weight: 800;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      padding: 34px 0 74px;
      align-items: center;
    }
    .hero-panel {
      border-radius: 30px;
      padding: 40px;
      position: relative;
      overflow: hidden;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: #ff9d83;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    h1 { margin: 20px 0 16px; font-size: clamp(44px, 5vw, 78px); line-height: 0.96; letter-spacing: -0.05em; }
    h1 span { color: var(--accent); }
    .hero-panel p { margin: 0; color: var(--muted); font-size: 18px; line-height: 1.8; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 28px; }
    .primary-btn, .secondary-btn {
      padding: 15px 22px;
      border-radius: 16px;
      font-weight: 700;
      font-size: 15px;
    }
    .primary-btn { background: linear-gradient(135deg, var(--accent), #ff8c42); color: white; }
    .secondary-btn { border: 1px solid var(--line); background: rgba(255,255,255,0.04); }
    .spec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .spec-grid article {
      border-radius: 24px;
      padding: 24px;
    }
    .spec-grid h3, .cta-panel h2 { margin: 0 0 10px; font-size: 22px; }
    .spec-grid p, .cta-panel p { margin: 0; color: var(--muted); line-height: 1.7; }
    .services {
      padding-bottom: 82px;
    }
    .services h2 {
      margin: 0 0 18px;
      font-size: 30px;
      letter-spacing: -0.03em;
    }
    .service-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .service-chips span {
      padding: 12px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.09);
      background: rgba(255,255,255,0.04);
      color: var(--ink);
    }
    .cta-panel {
      border-radius: 30px;
      padding: 30px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: center;
      margin-bottom: 80px;
    }
    footer { padding: 28px 0 40px; color: var(--muted); font-size: 14px; }
    @media (max-width: 980px) {
      .hero, .spec-grid, .cta-panel { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="nav">
      <div class="nav-inner">
        <div class="brand"><div class="brand-mark">A</div><span>{{BUSINESS_NAME}}</span></div>
        <a class="primary-btn" href="{{WHATSAPP_LINK}}">Schedule Test Drive</a>
      </div>
    </header>

    <section class="hero">
      <article class="hero-panel">
        <div class="eyebrow">Auto showroom in {{CITY}}</div>
        <h1>Drive <span>attention</span> to {{BUSINESS_NAME}}</h1>
        <p>{{TAGLINE}}</p>
        <div class="hero-actions">
          <a class="primary-btn" href="{{WHATSAPP_LINK}}">WhatsApp the showroom</a>
          <a class="secondary-btn" href="tel:{{PHONE}}">Call {{PHONE}}</a>
        </div>
      </article>
      <div class="spec-grid">
        <article><h3>Inventory spotlight</h3><p>Highlight cars, finance options, and showroom trust with a stronger first impression.</p></article>
        <article><h3>Lead capture</h3><p>Use WhatsApp-first actions so shoppers can enquire, book, and ask for details instantly.</p></article>
        <article><h3>Local proof</h3><p>Showcase the showroom with location, business identity, and clean product sections.</p></article>
        <article><h3>Built for conversion</h3><p>Simple sections, stronger typography, and clearer actions designed for mobile traffic.</p></article>
      </div>
    </section>

    <section class="services">
      <h2>Featured services and buyer journeys</h2>
      <div class="service-chips" id="service-chips"></div>
      <div id="services-data" hidden>{{SERVICES}}</div>
    </section>

    <section class="cta-panel">
      <div>
        <h2>Make it easier for buyers to trust {{BUSINESS_NAME}}</h2>
        <p>{{ADDRESS}}. This sample page gives the showroom a cleaner place to send leads instead of relying only on a short chat.</p>
      </div>
      <a class="primary-btn" href="{{WHATSAPP_LINK}}">Start WhatsApp conversation</a>
    </section>

    <footer>{{BUSINESS_NAME}} preview for {{CITY}}. ReachIQ sample experience.</footer>
  </div>
  <script>
    (function() {
      const fallback = ['Premium inventory display', 'Finance and exchange enquiry', 'Test drive scheduling'];
      const values = (document.getElementById('services-data')?.textContent || '').split(',').map((item) => item.trim()).filter(Boolean);
      const items = (values.length ? values : fallback).slice(0, 5);
      document.getElementById('service-chips').innerHTML = items.map((item) => '<span>' + item + '</span>').join('');
    })();
  </script>
</body>
</html>`;
}

function buildRealEstateTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{BUSINESS_NAME}} | Real Estate</title>
  <style>
    :root {
      --bg: #f6f2eb;
      --ink: #1a1c22;
      --muted: #5f6472;
      --primary: #1f6feb;
      --panel: rgba(255,255,255,0.82);
      --line: rgba(26,28,34,0.08);
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:linear-gradient(180deg,#f9f5ef 0%,#f0ebe2 100%);color:var(--ink);font-family:"Segoe UI",system-ui,sans-serif;overflow-x:hidden}
    .shell{width:min(1160px,calc(100% - 40px));margin:0 auto}
    .nav,.hero-card,.list-card,.contact-card{border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(10px);box-shadow:0 20px 50px rgba(0,0,0,0.08)}
    .nav{margin-top:18px;border-radius:24px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
    .hero{display:grid;grid-template-columns:1.1fr 0.9fr;gap:24px;padding:34px 0 76px}
    .hero-card{border-radius:30px;padding:38px}
    .eyebrow{display:inline-flex;padding:8px 14px;border-radius:999px;background:rgba(31,111,235,0.1);color:var(--primary);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
    h1{margin:18px 0 14px;font-size:clamp(42px,5vw,74px);line-height:1;letter-spacing:-.05em}
    h1 span{color:var(--primary)}
    p{line-height:1.8}
    .hero-copy{color:var(--muted);font-size:18px}
    .actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:26px}
    .primary-btn,.secondary-btn{padding:15px 22px;border-radius:16px;font-weight:700;text-decoration:none}
    .primary-btn{background:linear-gradient(135deg,#1f6feb,#5b8cff);color:#fff}
    .secondary-btn{border:1px solid var(--line);background:#fff;color:var(--ink)}
    .list-grid{display:grid;gap:18px}
    .list-card{border-radius:24px;padding:22px}
    .list-card h3{margin:0 0 10px;font-size:20px}
    .list-card p{margin:0;color:var(--muted)}
    .contact-card{border-radius:28px;padding:28px;margin-bottom:74px}
    .contact-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:18px}
    .tile{padding:18px;border-radius:18px;background:rgba(255,255,255,0.65);border:1px solid var(--line)}
    .tile span{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin-bottom:8px}
    footer{padding:24px 0 40px;color:var(--muted)}
    @media(max-width:980px){.hero,.contact-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="shell">
    <header class="nav">
      <strong>{{BUSINESS_NAME}}</strong>
      <a class="primary-btn" href="{{WHATSAPP_LINK}}">Talk on WhatsApp</a>
    </header>
    <section class="hero">
      <article class="hero-card">
        <div class="eyebrow">Real estate in {{CITY}}</div>
        <h1>Modern property presence for <span>{{BUSINESS_NAME}}</span></h1>
        <p class="hero-copy">{{TAGLINE}}</p>
        <div class="actions">
          <a class="primary-btn" href="{{WHATSAPP_LINK}}">Get buyer enquiries</a>
          <a class="secondary-btn" href="tel:{{PHONE}}">Call {{PHONE}}</a>
        </div>
      </article>
      <div class="list-grid">
        <article class="list-card"><h3>Project trust</h3><p>Show buyers and investors a cleaner first impression before calls begin.</p></article>
        <article class="list-card"><h3>WhatsApp funnel</h3><p>Use direct mobile conversations instead of letting leads disappear after a referral.</p></article>
        <article class="list-card"><h3>Local authority</h3><p>Present listings, the team, and contact details in one reliable place.</p></article>
      </div>
    </section>
    <section class="contact-card">
      <div class="eyebrow">Contact details</div>
      <div class="contact-grid">
        <div class="tile"><span>Phone</span><strong>{{PHONE}}</strong></div>
        <div class="tile"><span>City</span><strong>{{CITY}}</strong></div>
        <div class="tile"><span>Address</span><strong>{{ADDRESS}}</strong></div>
      </div>
    </section>
    <footer>{{BUSINESS_NAME}} sample site prepared for {{CITY}}.</footer>
  </div>
</body>
</html>`;
}

export const starterWebsiteTemplates = [
  {
    id: "f3e038aa-4bf3-414c-af34-54570c8ce804",
    name: "Modern Cafe Signature",
    niche: "cafe",
    preview_image_url: null,
    is_active: true,
    html_content: buildHospitalityTemplate({
      eyebrow: "C",
      accent: "#ffb84d",
      glow: "#ff855f",
      heroLabel: "Cafe",
      sectionLabel: "Signature moments",
      bookingLabel: "Reserve on WhatsApp",
      serviceTitle: "Taste the mood",
      storyTitle: "Atmosphere first"
    })
  },
  {
    id: "7f8022f6-e5da-4729-a18d-dde4dbcb1a8b",
    name: "Modern Restaurant Studio",
    niche: "restaurant",
    preview_image_url: null,
    is_active: true,
    html_content: buildHospitalityTemplate({
      eyebrow: "R",
      accent: "#ff7d5f",
      glow: "#ffcb5f",
      heroLabel: "Restaurant",
      sectionLabel: "Dining experience",
      bookingLabel: "Book a table",
      serviceTitle: "Bring guests back to",
      storyTitle: "Premium first impression"
    })
  },
  {
    id: "be323642-9ad1-4644-8e0d-a09fd19451bf",
    name: "Modern Real Estate Presence",
    niche: "real_estate",
    preview_image_url: null,
    is_active: true,
    html_content: buildRealEstateTemplate()
  },
  {
    id: "2dc0b90e-2fd0-4fe7-9f30-b78859b8456c",
    name: "Modern Dental Studio",
    niche: "dental clinic",
    preview_image_url: null,
    is_active: true,
    html_content: buildDentalTemplate()
  },
  {
    id: "dcf9745d-9cfb-4cc4-a341-8850e723a8d3",
    name: "Modern Auto Showroom",
    niche: "car showroom",
    preview_image_url: null,
    is_active: true,
    html_content: buildAutoShowroomTemplate()
  }
];

let starterTemplatesReadyPromise = null;

export async function ensureStarterWebsiteTemplates() {
  if (!starterTemplatesReadyPromise) {
    starterTemplatesReadyPromise = (async () => {
      const { error } = await supabaseAdmin
        .from("website_templates")
        .upsert(starterWebsiteTemplates, { onConflict: "id" });

      if (error) {
        starterTemplatesReadyPromise = null;
        throw error;
      }
    })();
  }

  await starterTemplatesReadyPromise;
}
