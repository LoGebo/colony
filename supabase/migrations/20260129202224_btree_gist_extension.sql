-- ============================================
-- BTREE_GIST EXTENSION FOR EXCLUSION CONSTRAINTS
-- Phase 5 Plan 02 Task 1a: Enable btree_gist
-- ============================================
-- This extension is required for exclusion constraints that combine
-- scalar types (like UUID) with range types (like tstzrange).
--
-- The GiST (Generalized Search Tree) index access method normally
-- doesn't support scalar types like UUID. btree_gist provides
-- GiST operator classes for these types, enabling:
--
--   EXCLUDE USING GIST (amenity_id WITH =, reserved_range WITH &&)
--
-- Without btree_gist, PostgreSQL cannot use GiST index for amenity_id.

CREATE EXTENSION IF NOT EXISTS btree_gist;

COMMENT ON EXTENSION btree_gist IS
  'Provides GiST index operator classes for scalar types.
   Required for exclusion constraints combining UUID and tstzrange.
   Used by reservations table to prevent double-booking.';
