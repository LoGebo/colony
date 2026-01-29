-- CRM enum types for Phase 2: Identity & CRM
-- Migration: 20260129045419_crm_enums.sql

-- onboarding_status: workflow states for resident onboarding
CREATE TYPE onboarding_status AS ENUM (
  'invited',     -- Email/SMS invitation sent
  'registered',  -- Created account, pending verification
  'verified',    -- Identity verified (INE, etc.)
  'active',      -- Full access granted
  'suspended',   -- Temporarily blocked
  'inactive'     -- Left community or deactivated
);

-- pet_species: types of pets allowed
CREATE TYPE pet_species AS ENUM (
  'dog',
  'cat',
  'bird',
  'fish',
  'reptile',
  'rodent',
  'other'
);

-- document_type: categories for resident documents
CREATE TYPE document_type AS ENUM (
  'ine_front',
  'ine_back',
  'proof_of_address',
  'lease_contract',
  'property_deed',
  'power_of_attorney',
  'vehicle_registration',
  'pet_vaccination',
  'other'
);

COMMENT ON TYPE onboarding_status IS 'Workflow states for resident onboarding process';
COMMENT ON TYPE pet_species IS 'Types of pets allowed in community - configurable per community';
COMMENT ON TYPE document_type IS 'Categories for resident identity and property documents';
