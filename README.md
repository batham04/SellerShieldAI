# SellerShield AI

SellerShield AI is one project with separate npm applications for the React/Vite frontend and Node.js/Express/MongoDB backend.

## Project layout

```text
frontend/
  src/                 React app, pages, components, contexts, API client, styles
  index.html
  package.json
  .env.example         Vite API URL and PayPal Sandbox public client ID
backend/
  src/                 Express routes, controllers, models, services and config
  package.json
  .env.example         MongoDB, JWT, Groq and PayPal server configuration
  README.md            API setup, endpoints, payment and AI details
package.json           Root shortcuts for both apps
```

## Setup and run

Requirements: Node.js 20 or newer and a local MongoDB or MongoDB Atlas database.

1. Install the shared dependencies once from this project root: `npm install`.
2. Copy `frontend/.env.example` to `frontend/.env` and set the PayPal Sandbox client ID.
3. Copy `backend/.env.example` to `backend/.env`. Set `MONGODB_URI`, a 32+ character `JWT_SECRET`, `GROQ_API_KEY`, and PayPal Sandbox client ID/secret. Keep secrets in the backend environment only.
4. Start MongoDB. Optionally set `SELLER_SEED_EMAIL` and `SELLER_SEED_PASSWORD`, then run `npm run api:seed` to create a seller and sample catalog.
5. Start the API with `npm run api:dev` and the frontend with `npm run dev` in separate terminals.

The frontend calls `VITE_API_URL`, which defaults to `http://localhost:5000/api`. The API health endpoint is `http://localhost:5000/health`.

## Workspace commands

```text
npm run dev       Start the frontend
npm run build     Build the frontend
npm run preview   Preview the frontend build
npm run api:dev   Start the API with nodemon
npm run api:start Start the API in production mode
npm run api:seed  Seed the seller account and sample catalog
```

See [backend/README.md](backend/README.md) for environment variables, endpoint reference, Groq tools, and PayPal setup. No payment success is fabricated; checkout stays unavailable until the frontend PayPal client ID and backend credentials are configured.
