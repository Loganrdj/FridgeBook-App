# FridgeBook-App

FridgeBook (https://fridge-book.com) is a kitchen inventory app. It tracks fridge and pantry items with expiry dates, a shopping list, recipe search, meal planning, receipt scanning, and Celiac Mode. It's meant to be a long-term product and eventually an iPhone app.

## Stack
- **Frontend:** React (CRA 5 / react-scripts 5.0.1), React Router v5. Deployed on Netlify.
- **Backend:** Express, Passport (Google OAuth), Sequelize 6, sessions in Postgres (`connect-pg-simple`, cookies last 30 days). Deployed on Render.
- **Database:** Supabase Postgres in production. Dev and tests use embedded Postgres (`npm run dev:db` on :5433).
- **Migrations:** Umzug migrations in `migrations/` run on server start (`migrate.js`). Add a new migration for every schema change, never edit an old one.
- **AI:** Gemini through `lib/gemini.js` (`generateJson`, `@google/genai` with `responseJsonSchema`; models `gemini-3.5-flash-lite` with `gemini-3.8-flash` as fallback). Spoonacular and OpenAI web search are used for recipes.

## History / rules
- The repo started fresh on 2026-10-01 as a clean copy of `Loganrdj/Fridgebook2` / `Loganrdj/FridgeBook`. Those old repos hardcoded the Google OAuth secret and session key, so treat those values as leaked, and leave the old repos alone.
- **Never commit secrets.** They come only from env vars (see `.env.example`). Mask secrets when printing env vars.
- Commits made with Claude end with a `Co-Authored-By: Claude ...` line.

## Deployment
- **Netlify** project `fridgebook-app` (ID `fa66a5b4-53a8-475a-a15e-c049f950548a`):
  - GitHub is linked, so pushes to `master` auto-deploy.
  - Config is in `netlify.toml`. `fridgebook-app.netlify.app` redirects 301 to fridge-book.com.
  - `/auth/*`, `/api/*` and `/profile` are proxied to Render, so cookies stay on fridge-book.com.
  - `CI=false` because of old lint warnings.
  - The domain is registered at GoDaddy, with DNS on Netlify.
- **Render** web service `fridgebook-api` (`srv-dav963u7bikc73f8grj0`), https://fridgebook-api.onrender.com, from `render.yaml`:
  - It's on the free plan and sleeps when idle. A daily cron-job.org ping to `/api/health` (runs `SELECT 1`) keeps Supabase from pausing, so don't make that endpoint skip the database.
  - The same Render workspace has other projects (credeeto, homebound). Don't touch them.
  - **Check the deploy status for the pushed commit through the Render API.** A failed build leaves the old version live, so a passing health check proves nothing.
- **Lock file:** Render builds with Node 22 / npm 10, but the local machine has npm 11. After changing dependencies, run `npx -y npm@10 install --package-lock-only` and check with `npm@10 ci`.
- **Env vars (Render):**
  - always: `DATABASE_URL` (the Supabase **Session pooler** string with the password URL-encoded), `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL=https://fridge-book.com/auth/google/redirect`, `CLIENT_URL=https://fridge-book.com/`;
  - Gemini: `GEMINI_RECIPES_API_KEY`, `GEMINI_RECEIPTS_API_KEY` (separate AI Studio projects, so each gets its own free quota), optional `GEMINI_GLUTEN_API_KEY` (falls back to the receipts key);
  - not set yet: `SPOONACULAR_API_KEY`, `OPENAI_API_KEY`;
  - optional caps: `WEB_SEARCH_DAILY_LIMIT` (5), `WEB_SEARCH_MONTHLY_LIMIT` (300).

## Local dev and tests
```
npm install
npm run dev:db         # embedded Postgres on :5433
npm run start:server   # API on :8080
npm start              # React on :3000
npm run test:server    # node:test + embedded Postgres (tests/server/helpers.js: startApp, t.login, t.request)
npm run test:client    # Jest + React Testing Library
```
GitHub Actions CI runs both test suites and the build on Node 22 / npm 10.

## Features and where they live
- **Kitchen** (`/api/ingredient`, `Foods` table): items belong to each user, and users can only see their own. Login is required, and `/` is the landing page for logged-out visitors.
- **Shopping list** (`routes/shoppingRoutes.js`):
  - The "For planned meals" section holds ingredients that planned meals need. They join the real list only when the user chooses (Add / Add all / "I have it").
- **Recipes** (`routes/recipeRoutes.js`, `lib/providers/`):
  - Search order: Spoonacular `complexSearch` → OpenAI Responses `web_search` (Gemini structures the results and only cited URLs are kept; costs are capped by `lib/webBudget.js`) → recipes written by Gemini, labelled "AI-suggested".
  - Spoonacular's terms allow caching for only 1 hour except id, title and image. That's why history and meal plans store references only, and why the "powered by spoonacular" link is required.
  - Recipe history is kept in localStorage per user and resets daily.
- **Meal planning** (`routes/mealRoutes.js`, `MealPlans`): `/api/meals/needs` flags ingredients that are missing or expire before the meal day.
- **Receipt scanner** (`/scan`, `src/utils/receiptText.js`, `lib/receiptGuard.js`, `routes/receiptRoutes.js`):
  - Tesseract.js reads the photo **in the browser. The photo is never uploaded.**
  - Payment, card and contact lines are removed on the device and again on the server. Only the item text lines go to Gemini.
- **Daily AI limits:** stored in the `AiUsages` table (user, kind, day), using the user's local date. Kinds and limits: `recipes` 20, `receipts` 10, `web`, `gluten` 30.
- **Celiac Mode** (Part A shipped 2026-10-05, commit 3032881):
  - An account setting (`Users.celiac_mode`, `celiac_strict`; `/api/me/settings`; `src/components/Settings.js`), off by default.
  - `lib/gluten.js`: rules first, then one batched Gemini call. A failed AI check isn't saved, so it's tried again later.
  - `POST /api/gluten/classify-kitchen` labels kitchen items (`Foods.gluten_status`/`gluten_reason`). Risky rows are highlighted, and gluten-free items get no badge (`GlutenBadge.js`).
  - Receipt review shows gluten alerts. Strict mode treats "may contain" as unsafe.
  - The `ProductChecks` table (barcode cache) exists but isn't used yet.

## Product decisions (from Logan)
- **$0 hosting** where possible. The suggested upgrade, if reliability ever matters more than cost, is Render Basic Postgres at about $6/month.
- **Receipt photos never go to an external API.** Only the filtered item text lines are sent.
- **Google Calendar sync must be opt-in** (a "Sync" button), never automatic. The plan is a private .ics feed, including a daily "what's expiring" calendar.
- Celiac Mode: "may contain" or a shared facility shows as an amber warning, and Strict turns it red. Show it as guidance, not medical advice.

## Roadmap (plan written 2026-10-05)
1. ~~Real recipe search~~: done (2e53c4b).
2. **Celiac Mode Part B (next):** a "Gluten check" page, shown in the nav only in Celiac Mode:
   - `GET /api/gluten/barcode/:code`: the `ProductChecks` cache → Open Food Facts (free, 15 requests/minute, User-Agent `FridgeBook/1.0 (email)`, ODbL credit) → `scanIngredientsText` and the rules → Gemini → OpenAI web research when the answer is unclear;
   - `POST /api/gluten/product-photo` and `/menu` via Gemini vision (needs image support in `lib/gemini.js` and a route-level JSON limit of about 6mb). The menu check gives a verdict per dish plus questions to ask the server;
   - `POST /api/gluten/restaurant`: OpenAI web search, keeping cited links only;
   - a dining card with a checklist to show staff;
   - gluten-free recipe search (`intolerances=gluten`) and flagging gluten ingredients in recipes.
3. **iPhone app:** Expo / React Native in `mobile/`, sharing the backend:
   - Google and Apple sign-in through Bearer-token middleware (Sign in with Apple is required by guideline 4.8);
   - a live barcode scanner and on-device ML Kit receipt OCR;
   - `DELETE /api/me` for in-app account deletion, and a privacy policy;
   - the Apple Developer Program costs $99/year.
4. Pinned for later: the opt-in Google Calendar sync / .ics feed, and "Send to Instacart".

## Open follow-ups
- Add `SPOONACULAR_API_KEY` and `OPENAI_API_KEY` on Render, set a spending limit on the OpenAI dashboard, then test those providers live.
- Rotate the Google OAuth client secret if that hasn't been done. The old netlify.app redirect URI can be removed from Google.
- The GitHub secret alert for the old Firebase key (project `fridgebook-f648a`, removed in ddfdacd) should be closed as "Won't fix".
- Known quirk: `Nav.js` logs users out after 30 idle minutes, even though sessions last 30 days.
- 19 npm audit findings remain inside CRA's dev tooling. Fixing them would mean moving to Vite.
