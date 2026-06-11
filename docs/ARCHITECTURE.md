# FabricPort Architecture

Condensed reference for the FabricPort B2B fabric marketplace. Stack: **React 19 + Vite + TypeScript**, **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions), **Tailwind CSS v4**.

---

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Public site │────▶│ Supabase (RLS)   │◀────│ Admin portal    │
│ Marketplace │     │ Postgres + Auth  │     │ Listing pipeline│
└─────────────┘     │ Storage + RT     │     └─────────────────┘
       │            └────────┬─────────┘              │
       │                     │                        │
┌──────▼──────┐     ┌────────▼─────────┐     ┌────────▼────────┐
│ Buyer portal│     │ Edge Functions   │     │ Supplier portal │
│ Cart/Inquiry│     │ notifications,   │     │ Inventory/List  │
└─────────────┘     │ fx refresh       │     └─────────────────┘
                    └──────────────────┘
```

Three actor types share one database with role-based RLS. Public pages read published products; authenticated portals enforce ownership boundaries.

---

## Database Schema (21 tables)

| Domain | Tables |
|--------|--------|
| Identity | `profiles`, `suppliers`, `buyers` |
| Catalogue | `fabric_categories`, `fabric_attributes`, `products`, `product_attributes`, `product_private_domains`, `color_families` |
| Listing ops | `listing_requests` |
| Commerce | `inquiries`, `inquiry_items`, `cart_items`, `invoices`, `messages` |
| Engagement | `notifications`, `recent_views`, `page_presence`, `supplier_page_views` |
| Integrations | `whatsapp_log`, `fx_rates` |

### Key relationships

- `profiles.id` → `auth.users.id` (1:1, cascade delete)
- `suppliers.id` / `buyers.id` → `profiles.id` (1:1 extension by role)
- `products.supplier_id` → `suppliers.id`
- `product_attributes` — EAV pattern linking products to `fabric_attributes`
- `inquiries` connect one buyer to one supplier; `inquiry_items` hold line items

### Product lifecycle

```
draft → pending_listing_request → fabric_received → scanning → ready_to_publish → published
                                                                                  ↘ archived
```

Listing requests mirror a subset: `submitted → fabric_received → scanning → complete | rejected`.

### Storage buckets

| Bucket | Access |
|--------|--------|
| `product-images` | Public read; supplier/admin upload |
| `scan-files` | Admin only |
| `message-attachments` | Inquiry parties |
| `invoice-pdfs` | Buyer + supplier |

---

## Roles & Auth

| Role | Registration | Default status | Portal |
|------|-------------|----------------|--------|
| `buyer` | Self-serve | `active` | `/buyer/*` |
| `supplier` | Self-serve | `pending` → admin approves | `/supplier/*` |
| `admin` | Manual / seed | `active` | `/admin/*` |

`handle_new_user` trigger creates `profiles` (+ `buyers` row for buyers) on signup. Supplier approval sets `profiles.status = active` and creates `suppliers` row with `is_verified`.

JWT `user_metadata.role` is informational only — authorization uses `profiles.role`, never `user_metadata` in RLS.

---

## Row Level Security

RLS is enabled on all public tables. Helper functions (security definer):

| Function | Purpose |
|----------|---------|
| `is_admin()` | Active admin profile check |
| `get_my_role()` | Current user's role |
| `get_buyer_domain()` | Email domain for private product access |
| `is_supplier_owner(uuid)` | Supplier owns resource |
| `can_view_product(uuid)` | Published + visibility rules |
| `can_access_inquiry(uuid)` | Buyer, supplier, or admin |

### Access patterns

- **Public catalogue**: anon/authenticated read `products` where `status = published` and (`visibility = public` OR buyer domain matches `product_private_domains`)
- **Suppliers**: read/write own products, listing requests, invoices; read own inquiries
- **Buyers**: cart, inquiries, messages; domain-gated private products
- **Admin**: full CRUD on catalogue, pipeline, users
- **Notifications**: user reads/updates own; insert via admin or edge function (service role)
- **FX rates**: public read; admin write (seed uses service role)

Service role bypasses RLS — used by `scripts/seed-catalogue.ts` and edge functions only.

---

## Color System

Products store color at three levels:

1. **Supplier naming** — `color_supplier_name`, `color_display_name`
2. **Computed values** — `color_hex`, `color_rgb`, `color_family` (FK → `color_families.slug`)
3. **Sample point** — `color_sample` JSON `{ image_index, x, y }` for canvas sampling

`src/lib/color/sample.ts` extracts RGB from product images via canvas. `src/lib/color/classify.ts` maps RGB → one of 12 families (black, white, gray, beige, brown, red, orange, yellow, green, blue, purple, pink) using HSL heuristics.

`ColorSampler` component lets admins pick a pixel; classification runs client-side.

---

## Listing Pipeline

1. Supplier submits **listing request** with fabric details (category, color name, rough specs)
2. Admin marks **fabric received** → **scanning** (3D scan upload to `scan-files`)
3. Admin creates/edits product, sets pricing, approves price (`price_approved`)
4. Product moves to **ready_to_publish** → **published** with `published_at`

Admin **Listing Pipeline** page (`/admin/listing-pipeline`) tracks request status. Rejected requests store `rejection_reason`.

---

## Notifications

| Channel | Implementation | Flag |
|---------|----------------|------|
| In-app | `notifications` table + Supabase Realtime | Always on |
| Email | Resend via `src/lib/email.ts` | `VITE_ENABLE_EMAIL` |
| WhatsApp | Meta Cloud API via `src/lib/whatsapp.ts` | `VITE_ENABLE_WHATSAPP` |

`createNotification()` in `src/lib/notifications.ts` inserts in-app records. `send-notification` edge function (service role) handles cross-user dispatch and future channel fan-out.

Supplier `notification_settings` JSON controls per-event channel preferences (`inquiry_received`, `message_received`).

Realtime subscriptions: `messages`, `notifications`.

---

## FX & Pricing

- Source prices stored in PKR (`price_min_pkr`, `price_max_pkr`) and USD (`price_min_usd`, `price_max_usd`)
- `fx_rates` table holds latest USD→PKR; default seed rate **278.5**
- `src/lib/fx.ts` caches rate client-side (6 h TTL)
- `refresh-fx-rates` edge function stub for cron refresh

Unit toggle (meters/yards) is client-only via `metersToYards()`.

---

## Build Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **1 — Foundation** | Schema, RLS, auth, public marketplace, seed script | Current |
| **2 — Portals** | Buyer cart/inquiries, supplier inventory, admin CRUD | In progress |
| **3 — Pipeline** | Listing requests, 3D scans, price approval | In progress |
| **4 — Comms** | Realtime chat, notifications, email/WhatsApp | Stubs ready |
| **5 — Polish** | Invoices/PDF, analytics, presence, performance | Planned |

---

## Local Development

```bash
# .env.local
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

npm run dev
npm run seed    # populate catalogue from fabricport/data/products.json
npm run build   # tsc -b && vite build
```

Seed script: 8 verified suppliers, 205 products, fabric attributes from JSON spec keys, images → `product-images` bucket, 4 featured products, default FX rate.
