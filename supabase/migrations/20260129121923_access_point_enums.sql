-- ============================================
-- ACCESS POINT ENUMS
-- ============================================
-- Phase 03-01: Access Control & Security Infrastructure
-- These enums define the types and directions of physical access points

-- ============================================
-- ACCESS POINT TYPE ENUM
-- ============================================
-- Types of physical entry/exit points in a community

CREATE TYPE access_point_type AS ENUM (
  'vehicular_gate',    -- Car entry/exit gate (portones vehiculares)
  'pedestrian_gate',   -- Walking entry gate (puertas peatonales)
  'turnstile',         -- Single-person controlled entry (torniquetes)
  'barrier',           -- Parking barrier arm (plumas/barreras)
  'door',              -- Building door with access control
  'elevator'           -- Access-controlled elevator
);

COMMENT ON TYPE access_point_type IS
  'Types of physical access points in a community.
   - vehicular_gate: Main car entry/exit gates
   - pedestrian_gate: Walking entry points
   - turnstile: Controlled single-person entry (common in Mexico for security)
   - barrier: Parking lot barrier arms
   - door: Access-controlled building doors
   - elevator: Elevators with restricted floor access';

-- ============================================
-- ACCESS POINT DIRECTION ENUM
-- ============================================
-- Whether the access point allows entry, exit, or both

CREATE TYPE access_point_direction AS ENUM (
  'entry',             -- Entry only (entrada)
  'exit',              -- Exit only (salida)
  'bidirectional'      -- Both entry and exit
);

COMMENT ON TYPE access_point_direction IS
  'Direction of access point traffic flow.
   - entry: One-way entry points (common for pedestrian access)
   - exit: One-way exit points (emergency exits, exit-only lanes)
   - bidirectional: Standard gates allowing both entry and exit';
