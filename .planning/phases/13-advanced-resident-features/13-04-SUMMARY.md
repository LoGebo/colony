---
phase: 13
plan: 04
subsystem: mobile-marketplace
tags: [marketplace, listings, moderation, whatsapp, photo-upload, react-native]
depends_on:
  requires: [13-01, 13-03]
  provides: [marketplace-browse, marketplace-create, marketplace-detail, marketplace-management]
  affects: [admin-moderation-queue]
tech_stack:
  added: []
  patterns: [category-filter-chips, two-column-grid, photo-upload-gallery, whatsapp-deep-link, moderation-status-badges]
key_files:
  created:
    - packages/mobile/src/hooks/useMarketplace.ts
    - packages/mobile/src/components/marketplace/ListingCard.tsx
    - packages/mobile/src/components/marketplace/CategoryFilter.tsx
    - packages/mobile/app/(resident)/more/marketplace/index.tsx
    - packages/mobile/app/(resident)/more/marketplace/create.tsx
    - packages/mobile/app/(resident)/more/marketplace/[id].tsx
  modified: []
decisions:
  - Contact seller via WhatsApp deep link with SMS fallback (no in-app messaging)
  - Moderation status badges shown only for seller's own listings (pending=yellow, approved=green, rejected=red)
  - VENDIDO overlay/banner on sold listings in both card and detail views
  - Fire-and-forget RPCs for view_count and inquiry_count (no await, no error handling)
  - Photo upload to community-assets bucket with marketplace/ category prefix
metrics:
  duration: 5.6 min
  completed: 2026-02-08
---

# Phase 13 Plan 04: Marketplace Summary

**One-liner:** Community marketplace with listing CRUD, photo upload, category filtering, WhatsApp seller contact, and moderation-aware status display.

## What Was Built

### Task 1: Marketplace hooks and components (c6d46cc)

**useMarketplace.ts** (216 lines) - Six hooks + contact helper:
1. `useMarketplaceListings(category?)` - Queries approved, not-sold, non-expired community listings with optional category filter. Joins seller info via FK hint.
2. `useMyListings()` - Queries seller's own listings (all statuses) using `sellers_view_own_listings` RLS policy.
3. `useListingDetail(listingId)` - Single listing query with seller join. Fire-and-forget `increment_listing_view_count` RPC.
4. `useCreateListing()` - Inserts with `moderation_status: 'pending' as never` (RLS enforced). Includes unit_id from occupancy.
5. `useMarkAsSold(listingId)` - Updates `is_sold = true, sold_at = now()`.
6. `useDeleteListing()` - Soft-delete via `deleted_at` timestamp.
7. `handleContactSeller()` - WhatsApp deep link with SMS fallback + `increment_listing_inquiry_count` RPC.

**ListingCard.tsx** (161 lines) - Grid card component:
- First image or placeholder, title, currency-formatted price (or "Gratis"), category badge, seller name, relative time.
- Moderation status badge for seller's own listings (pending/approved/rejected).
- VENDIDO overlay on sold listings.

**CategoryFilter.tsx** (45 lines) - Horizontal chip bar:
- Todos, Venta, Servicio, Renta, Buscado with blue active / gray inactive styling.

### Task 2: Marketplace screens (884cc57)

**marketplace/index.tsx** (134 lines) - Browse + My Listings:
- Two tabs: "Comunidad" (approved listings) and "Mis Publicaciones" (all statuses).
- CategoryFilter shown only for community tab.
- 2-column FlatList grid with RefreshControl.
- FAB button navigating to create screen.
- Empty states with contextual messages.

**marketplace/create.tsx** (259 lines) - Create listing form:
- Category picker (required chips), title (max 100), description (max 500, char counter).
- Price with "Gratis" toggle and negotiable switch.
- Photo grid (up to 5) with pickAndUploadImage to community-assets/marketplace.
- Validation: category required, title >= 3 chars, description >= 10 chars.
- Success alert: "Tu publicacion esta en revision. Sera visible cuando un administrador la apruebe."

**marketplace/[id].tsx** (329 lines) - Listing detail:
- Horizontal paging photo gallery with page indicator dots.
- Large title, prominent price, category/negotiable badges.
- Seller section with avatar and name.
- Stats: view count, inquiry count, relative time.
- "Contactar por WhatsApp" button (hidden for own listings).
- Seller actions: mark as sold, delete with confirmation alerts.
- VENDIDO banner on sold listings.
- Moderation status badge for seller's own listing.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Status |
|-------|--------|
| TypeScript compilation passes | PASS |
| Marketplace accessible from More tab | PASS (route declared in _layout.tsx + menu item in more/index.tsx) |
| Community listings in grid with category filter | PASS |
| My listings show all statuses | PASS (sellers_view_own_listings RLS policy) |
| Creation inserts with pending status | PASS (moderation_status: 'pending' as never) |
| Success message explains moderation | PASS |
| Detail shows photos, price, seller | PASS |
| WhatsApp contact with pre-filled message | PASS (whatsapp:// deep link + SMS fallback) |
| Seller can mark as sold | PASS |
| View/inquiry counts via RPCs | PASS (fire-and-forget) |

## Files Created (6)

| File | Lines | Purpose |
|------|-------|---------|
| packages/mobile/src/hooks/useMarketplace.ts | 216 | 6 hooks + contact helper |
| packages/mobile/src/components/marketplace/ListingCard.tsx | 161 | Listing card with image/price/status |
| packages/mobile/src/components/marketplace/CategoryFilter.tsx | 45 | Category chip horizontal filter |
| packages/mobile/app/(resident)/more/marketplace/index.tsx | 134 | Browse + my listings screen |
| packages/mobile/app/(resident)/more/marketplace/create.tsx | 259 | Listing creation form |
| packages/mobile/app/(resident)/more/marketplace/[id].tsx | 329 | Listing detail + contact + actions |

**Total: 1,144 lines across 6 files**
