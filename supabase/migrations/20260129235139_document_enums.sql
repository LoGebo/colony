-- ============================================
-- DOCUMENT ENUMS FOR UPOE
-- ============================================
-- Document management system categorization
-- Phase 6: Documents & Notifications

-- ============================================
-- DOCUMENT CATEGORY ENUM
-- ============================================
-- Categories for community documents

CREATE TYPE document_category AS ENUM (
  'legal',          -- Reglamento, acta constitutiva, escrituras
  'assembly',       -- Actas de asamblea, minutas, acuerdos
  'financial',      -- Estados financieros, presupuestos, auditorias
  'operational',    -- Manuales, procedimientos, instructivos
  'communication'   -- Circulares, avisos, boletines
);

COMMENT ON TYPE document_category IS
  'Document categories for community document management.
   legal: Governing documents (reglamento, acta constitutiva, escrituras)
   assembly: Meeting records (actas de asamblea, minutas, acuerdos)
   financial: Financial reports (estados financieros, presupuestos, auditorias)
   operational: Operating procedures (manuales, procedimientos, instructivos)
   communication: Communications (circulares, avisos, boletines)';
