# FabricPort

Pakistan's premier B2B surplus fabric marketplace — lead-generation platform built with React, Vite, Tailwind, and Supabase.

## Quick Start

```bash
npm install
cp .env.example .env.local   # add Supabase keys
npm run dev
```

## Environment

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://wrbphdcgzcdesgslijuz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # seed script only
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run seed` | Import catalogue from `/Desktop/fabricport` |
| `npm run preview` | Preview production build |

## Database

```bash
supabase link --project-ref wrbphdcgzcdesgslijuz
supabase db push
npm run seed
```

## Structure

- **Public** — `/`, `/marketplace`, `/fabric/:slug`, `/supplier/:slug`, `/vendors`
- **Buyer** — `/buyer/*` (cart, inquiries, chat)
- **Supplier** — `/supplier-portal/*` (inventory, listing requests, invoices)
- **Admin** — `/admin/*` (products, pipeline, attributes, ColorSampler)

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Design System](docs/DESIGN.md)
