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
- PostgreSQL (production) / MySQL (local dev)
- Edamam API
- Whisk

## Deployment
- **Frontend:** Netlify builds the React app (`netlify.toml`) and proxies `/auth/*`, `/api/*` and `/profile` to the API.
- **Backend:** Render runs `server.js`, defined in `render.yaml`, with a Supabase Postgres database. Set `DATABASE_URL` (Supabase Session pooler string, password URL-encoded), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Render dashboard; see `.env.example` for all variables.

## Local development
```
npm install
npm run start:server   # API on :8080 (uses local MySQL from config/dbconfig.json)
npm start              # React dev server on :3000
```
