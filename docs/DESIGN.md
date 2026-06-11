# FabricPort Design System

Visual language for the FabricPort B2B fabric marketplace. Dark editorial aesthetic with cream product cards and terracotta accent.

---

## Color Palette

Defined in `src/index.css` via Tailwind `@theme`:

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0A0A0A` | Page background |
| `surface` | `#111111` | Sections, nav |
| `elevated` | `#1A1A1A` | Modals, dropdowns |
| `card` | `#E8E4DC` | Product cards (cream) |
| `card-hover` | `#F0ECE4` | Card hover state |
| `border` | `#2A2A2A` | Subtle dividers |
| `border-strong` | `#3A3A3A` | Emphasized borders |
| `border-cream` | `#C8C4BC` | Card internal borders |
| `text-primary` | `#F5F5F5` | Headlines on dark |
| `text-secondary` | `#A0A0A0` | Body on dark |
| `text-muted` | `#606060` | Captions |
| `text-dark` | `#1A1A1A` | Text on cream cards |
| `text-dark-secondary` | `#4A4A4A` | Secondary on cream |
| `accent` | `#E8593C` | CTAs, links, badges |
| `accent-dim` | `#9B3A26` | Accent hover/pressed |
| `success` | `#22C55E` | Verified, complete |
| `warning` | `#F59E0B` | Pending states |
| `danger` | `#EF4444` | Errors, rejected |

---

## Typography

| Role | Font | Tailwind |
|------|------|----------|
| Body | Inter | `font-sans` |
| Display / headlines | DM Sans | `font-display` |
| Specs, prices, mono data | IBM Plex Mono | `font-mono` |

Scale conventions:
- Hero: `text-5xl md:text-7xl font-display font-semibold`
- Section titles: `text-3xl font-display`
- Card title: `text-sm font-mono uppercase tracking-wider`
- Spec labels: `text-[10px] font-mono uppercase tracking-widest text-text-dark-secondary`
- Body: `text-sm text-text-secondary`

---

## Layout Primitives

### Clip corners

Angular editorial cut on hero and featured blocks:

```css
.clip-corner     /* 24px cut */
.clip-corner-sm  /* 16px cut */
```

### Spacing

- Page max-width: `max-w-7xl mx-auto px-4 md:px-8`
- Section vertical rhythm: `py-16 md:py-24`
- Card grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`

---

## FabricCard

Primary catalogue component (`src/components/marketplace/FabricCard.tsx`).

### Variants

| Variant | Layout | Use |
|---------|--------|-----|
| `grid` | Vertical card, cream background, clip-corner-sm | Marketplace grid, featured row |
| `list` | Horizontal, image left | Search results, admin tables |
| `compact` | Minimal — image, title, price only | Related products, cart preview |

### Anatomy

```
┌─────────────────────────┐
│  [Product image]        │  aspect-[4/5], object-cover
│  Verified badge (opt)   │
├─────────────────────────┤
│  SUPPLIER NAME          │  font-mono, uppercase, muted
│  Product Title          │  font-display
│  ┌─────┬─────┬─────┐   │
│  │ GSM │WIDTH│COMP │   │  SpecTable (3 cols)
│  └─────┴─────┴─────┘   │
│  PRICE         STOCK   │  font-mono
│  [Add to Cart]         │  accent button
└─────────────────────────┘
```

### Props

- `product` — joined product + attributes + supplier
- `currency` — `PKR` | `USD` (uses `fxRate` for conversion)
- `unit` — `meters` | `yards`
- `onAddToCart` — optional callback

### Interaction

Uses `cardHover` from `src/lib/motion.ts`: lift `-8px`, scale `1.02` on hover (300 ms ease-out).

---

## Animation Tiers

Defined in `src/lib/motion.ts`. Applied via Framer Motion.

| Tier | Token | Duration | Use |
|------|-------|----------|-----|
| **Micro** | button/link transitions | 150–200 ms | Hover, focus |
| **Standard** | `fadeUp`, `pageTransition` | 400–500 ms | Page enter, section reveal |
| **Expressive** | `cardHover`, hero parallax | 300 ms + GSAP | Cards, hero, VizuShowcase |

### Variants

- `fadeUp` — opacity 0→1, y 24→0, ease `[0.22, 1, 0.36, 1]`
- `staggerContainer` — 80 ms stagger between children
- `pageTransition` — route-level fade + slide
- `cardHover` — rest/hover states for product cards

Scroll smoothing via Lenis (`SmoothScroll` wrapper). GSAP used for hero and 3D showcase sequences.

---

## Component Library

Built on Radix UI primitives + Tailwind:

| Component | File | Notes |
|-----------|------|-------|
| Button | `ui/button.tsx` | Variants: default, outline, ghost, accent |
| Badge | `ui/badge.tsx` | Verified, status chips |
| Card | `ui/card.tsx` | Portal dashboards |
| Dialog | `ui/dialog.tsx` | Modals |
| Input / Textarea / Select | `ui/*` | Forms |
| Skeleton | `ui/skeleton.tsx` | Loading states |
| SpecTable | `shared/SpecTable.tsx` | Mono label/value grid |

Status badge colors map to palette: warning (pending), success (published/verified), danger (rejected).

---

## Page Specs

### Public

| Page | Route | Key sections |
|------|-------|--------------|
| Home | `/` | Hero (headline + bg fabric), TrustBar, FeaturedFabrics (4), VendorsSection, VizuShowcase |
| Marketplace | `/marketplace` | FilterSidebar + FabricCard grid, unit/currency toggles |
| Fabric detail | `/fabric/:slug` | Image gallery, ColorSampler, SpecTable, supplier link, inquiry CTA |
| Vendors | `/vendors` | Verified supplier grid |
| Supplier profile | `/vendor/:slug` | Brand header + product grid |

### Auth

| Page | Route |
|------|-------|
| Login | `/login` |
| Register | `/register` (role selection) |

### Buyer portal

Dark shell (`PortalShell`). Routes: dashboard, cart, inquiries, settings.

### Supplier portal

Routes: dashboard, inventory, listing request, inquiries, invoice builder, settings. Pending suppliers see `PendingApprovalPage`.

### Admin portal

Routes: dashboard, products, suppliers, buyers, attributes, listing pipeline, inquiries, settings. Uses `AdminTable` + `AdminPageHeader` patterns.

---

## Responsive Breakpoints

Standard Tailwind defaults:

| Breakpoint | Width | Grid cols (marketplace) |
|------------|-------|-------------------------|
| default | <640px | 1 |
| `sm` | 640px | 2 |
| `lg` | 1024px | 3 |
| `xl` | 1280px | 4 |

Filter sidebar collapses to sheet/dialog on mobile.

---

## Accessibility

- Radix primitives provide focus traps, ARIA roles, keyboard nav
- Color contrast: cream cards use `text-dark` (WCAG AA on `#E8E4DC`)
- `NotificationBell` includes `aria-label`
- Form inputs paired with `Label` components

---

## Icons

Lucide React throughout. Common: `ShoppingBag` (cart), `Bell` (notifications), `Verified` (supplier badge).
