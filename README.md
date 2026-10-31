# Fatcat Ordering & POS Integration

A production web ordering system built for a real restaurant workflow. Customers can order from a mobile-friendly storefront, while confirmed orders are sent to Loyverse for POS and kitchen printing.

- Live product: [order.fatcat.stream](https://order.fatcat.stream)
- Owner and product builder: [OhmSaharath](https://github.com/OhmSaharath)

## Why this project exists

Direct customers were ordering outside delivery platforms, so staff had to answer messages, re-enter orders, and confirm payments manually. This system turns that repeated work into a guided customer flow connected to the restaurant's existing POS operations.

## Visible product capabilities

- Mobile menu, modifiers, cart, delivery details, and order confirmation
- Loyverse menu synchronization and confirmed-order submission for POS/kitchen printing
- PromptPay QR generation and payment-slip upload workflow
- Customer profiles, loyalty stamps, order history, and reorder flow
- Admin tools for order status, menu availability, modifiers, and operational settings
- LINE customer status messages plus LINE/Telegram staff notifications
- Supabase-backed persistence with a local-development fallback

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| Data | Supabase / PostgreSQL |
| Integrations | Loyverse API, LINE LIFF / Messaging API, Telegram, PromptPay |
| Deployment | Vercel frontend/serverless configuration, Render Docker backend |

## Architecture

```text
Customer / Staff
       |
React + TypeScript storefront
       |
FastAPI application
  |        |          |
Supabase  Loyverse   LINE / Telegram
```

The repository keeps integration tokens on the server side. Runtime credentials, customer records, uploaded slips, and production exports are intentionally excluded from source control.

## Run locally

### Backend

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8765
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

The Vite development server proxies `/api` calls to the local FastAPI server.

## Configuration and security

- Copy `.env.example` and fill in only the integrations needed for local development.
- `ADMIN_PASSWORD` and `ADMIN_HMAC_SECRET` have no source-code defaults.
- Production startup fails closed if either admin security setting is missing.
- Generate unique production values and keep them in the hosting provider's secret store.
- Do not commit `.env`, credentials, customer exports, slips, or local state files.

## Deployment notes

- `frontend/vercel.json` contains the frontend routing configuration.
- `render.yaml` and `backend/Dockerfile` define the backend service.
- Hosting providers must supply all values marked `sync: false` in `render.yaml`.

## Project status

The core workflow is in production and used for restaurant operations. The project remains an actively improved owner-built product, with future work focused on operational polish, test coverage, and observability.

## License

This repository is published as a portfolio project. No separate open-source license is granted at this time.
