-- Assembly enum types for Mexican condominium law (Ley de Propiedad en Condominio)
-- Plan 08-03: Assembly management with convocatoria progression

-- ============================================================================
-- MEXICAN CONVOCATORIA SYSTEM (QUORUM RULES)
-- ============================================================================
-- Primera Convocatoria (1st call): 75% of total coefficient required
-- Segunda Convocatoria (2nd call): 50%+1 of total coefficient required (30 min after first)
-- Tercera Convocatoria (3rd call): Any attendance valid (30 min after second)
--
-- This is mandated by Mexican condominium law to ensure fair representation
-- while allowing assemblies to proceed if initial quorum isn't met.
-- ============================================================================

-- Assembly types per Mexican law
CREATE TYPE assembly_type AS ENUM (
  'ordinary',       -- Regular (yearly) assembly - Asamblea Ordinaria
  'extraordinary'   -- Special assembly for specific matters - Asamblea Extraordinaria
);

COMMENT ON TYPE assembly_type IS 'Types of HOA assemblies per Mexican condominium law';

-- Assembly status with convocatoria progression
CREATE TYPE assembly_status AS ENUM (
  'scheduled',       -- Assembly scheduled (fecha de asamblea programada)
  'convocatoria_1',  -- First call - 75% quorum required (primera convocatoria)
  'convocatoria_2',  -- Second call - 50%+1 quorum required (segunda convocatoria)
  'convocatoria_3',  -- Third call - any attendance valid (tercera convocatoria)
  'in_progress',     -- Assembly in session (asamblea en sesion)
  'concluded',       -- Assembly finished (asamblea concluida)
  'cancelled'        -- Assembly cancelled (asamblea cancelada)
);

COMMENT ON TYPE assembly_status IS 'Assembly lifecycle status with Mexican convocatoria progression for quorum requirements';

-- Attendance type for tracking who represents the unit
CREATE TYPE attendance_type AS ENUM (
  'owner',           -- Unit owner attending in person (propietario presente)
  'representative',  -- Authorized representative (representante legal)
  'proxy'            -- Proxy holder with power of attorney (apoderado/carta poder)
);

COMMENT ON TYPE attendance_type IS 'Who is representing the unit at the assembly';
