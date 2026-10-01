# FridgeBook-App

React (CRA 3.4.1) fridge/pantry tracker with recipe suggestions, plus an Express + Sequelize + Passport (Google OAuth) API.

## History / why this repo exists
- Started fresh on 2026-10-01 as a clean copy of `Loganrdj/Fridgebook2` (which was itself a copy of `Loganrdj/FridgeBook`). The old repos carried commits from former collaborators whose accounts are no longer used, so this one has no inherited history. The old repos stay as they are; don't touch them.
- The old repos have the Google OAuth client secret and session key hardcoded in `config/keys.js`, so treat those values as leaked. In this repo they come from env vars only. Never commit secrets.

## Deployment
- **Frontend: Netlify**, project `fridgebook-app` (ID `fa66a5b4-53a8-475a-a15e-c049f950548a`), https://fridgebook-app.netlify.app
  - Config is in `netlify.toml` (there is no `public/_redirects`, since its rules would run before the proxy rules).
  - `/auth/*`, `/api/*` and `/profile` are proxied to the Render API, so session cookies stay on the Netlify domain.
  - `CI=false` is set because CRA would otherwise fail the build on old unused-variable lint warnings in `EventCalendar.js` and `Recipes.js`.
  - The build needs `NODE_OPTIONS=--openssl-legacy-provider` (already in the `build` script).
  - It was first deployed with `netlify deploy --prod --build --site <id>`. GitHub auto-deploy may not be linked yet.
- **Backend: Render**, set up by the blueprint in `render.yaml`: web service `fridgebook-api` (`node server.js`) plus a free Postgres `fridgebook-db`.
  - The expected URL is https://fridgebook-api.onrender.com. If Render assigns a different one, update the proxy targets in `netlify.toml`.
  - Env vars: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `CLIENT_URL` (see `.env.example`).
  - Free Postgres expires 30 days after creation, and the free web service sleeps when idle.

## Database
- Production uses Postgres (`config/dbconfig.json` → `DATABASE_URL`, with `pg` and `pg-hstore` installed). Local dev/test still use MySQL.
- `db.sequelize.sync()` creates the `Users` and `Foods` tables on boot.
- The frontend keeps ingredients in `localStorage` (`src/context/GlobalState.js`). The backend is only used for Google login and `/profile` (`src/components/Nav.js`).

## Local dev
```
npm install
npm run start:server   # API on :8080
npm start              # React on :3000 (Nav.js uses http://localhost:8080 for auth links outside production)
```

## Open follow-ups (as of 2026-10-01)
1. Create the Render blueprint: https://dashboard.render.com/blueprint/new?repo=https://github.com/Loganrdj/FridgeBook-App, then set the Google env vars.
2. Rotate the Google OAuth client secret, and add `https://fridgebook-app.netlify.app/auth/google/redirect` as an authorized redirect URI.
3. Optional: link the GitHub repo in Netlify for auto-deploys.
4. Optional: decide whether to keep the `Co-Authored-By: Claude` lines in the commits; amending would need a force-push.
