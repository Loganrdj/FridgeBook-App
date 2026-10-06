# FridgeBook

## https://fridge-book.com/

This application is used to monitor and keep track of your Fridge/Pantry Inventory! 

FridgeBook takes the items in your inventory and provides a dashboard with notifications in order to alert you whether or not it has or will expire. 

The application also takes in account all of your current kitchen items and provides useful recipes, by displaying what you may need to buy or what you can already cook!

Created by Logan Moss, Gaofeng Su, Ian Hooper, Omar Abbasi.

## Technologies Used
- ReactJS
- CSS
- HTML
- JavaScript
- BootStrap
- PassportJS
- Sequelize
- PostgreSQL (Supabase in production)
- iPhone app: Expo / React Native in `mobile/` (see `mobile/README.md`)
- Umzug migrations

## Deployment
- **Frontend:** Netlify builds the React app (`netlify.toml`) and proxies `/auth/*`, `/api/*` and `/profile` to the API.
- **Backend:** Render runs `server.js`, defined in `render.yaml`, with a Supabase Postgres database. Set `DATABASE_URL` (Supabase Session pooler string, password URL-encoded), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Render dashboard; see `.env.example` for all variables.

## Local development
```
npm install
npm run dev:db         # local Postgres on :5433 (kept in .devdb/); leave it running
DATABASE_URL=postgres://postgres:postgres@localhost:5433/fridgebook \
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
npm run start:server   # API on :8080; applies pending migrations on start
npm start              # React dev server on :3000
```

## Tests
```
npm test               # everything
npm run test:server    # API, auth and migrations against a throwaway Postgres
npm run test:client    # React components, state and utils
```
GitHub Actions runs all of these plus a production build on every push and pull request (`.github/workflows/ci.yml`).

## Database changes
Schema changes are migrations in `migrations/`, applied in filename order when the server starts (tracked in the `SequelizeMeta` table).

1. Add `migrations/YYYYMMDDHHMMSS-what-it-does.js` exporting `up(queryInterface, Sequelize)` and `down(...)`.
2. Update the model in `models/` to match.
3. Add or update a test in `tests/server/`, then `npm run test:server`.
4. Push. Render applies the migration on its next start.

`npm run migrate` applies pending migrations by hand; `node migrate.js down` undoes the last one.
