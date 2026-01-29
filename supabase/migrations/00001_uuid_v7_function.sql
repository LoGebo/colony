-- UUID v7 Generation Function
-- UUID v7 is time-ordered (first 48 bits are millisecond timestamp)
-- Better for B-tree indexes than random UUID v4

-- Helper function to extract single byte from bytea
CREATE OR REPLACE FUNCTION get_bytea_to_byte(b BYTEA, pos INT)
RETURNS BYTEA
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT set_byte(E'\\x00'::BYTEA, 0, get_byte(b, pos));
$$;

CREATE OR REPLACE FUNCTION generate_uuid_v7()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
PARALLEL SAFE
AS $$
DECLARE
  v_time BIGINT;
  v_random BYTEA;
  v_uuid_bytes BYTEA;
BEGIN
  -- Get current timestamp in milliseconds since Unix epoch
  v_time := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;

  -- Get 10 random bytes for the remaining portion
  v_random := gen_random_bytes(10);

  -- Build UUID v7 structure:
  -- Bytes 0-5: 48-bit timestamp (big-endian)
  -- Byte 6: version (7) in high nibble + 4 random bits
  -- Byte 7: random
  -- Byte 8: variant (10xx) in high 2 bits + 6 random bits
  -- Bytes 9-15: random

  v_uuid_bytes :=
    -- Timestamp bytes (48 bits = 6 bytes)
    set_byte(set_byte(set_byte(set_byte(set_byte(set_byte(
      E'\\x000000000000'::BYTEA,
      0, ((v_time >> 40) & 255)::INT),
      1, ((v_time >> 32) & 255)::INT),
      2, ((v_time >> 24) & 255)::INT),
      3, ((v_time >> 16) & 255)::INT),
      4, ((v_time >> 8) & 255)::INT),
      5, (v_time & 255)::INT)
    ||
    -- Version 7 (0111) in high nibble + 4 random bits
    set_byte(E'\\x00'::BYTEA, 0, (112 | (get_byte(v_random, 0) & 15))::INT)
    ||
    -- Next random byte
    get_bytea_to_byte(v_random, 1)
    ||
    -- Variant (10xx xxxx) + 6 random bits
    set_byte(E'\\x00'::BYTEA, 0, (128 | (get_byte(v_random, 2) & 63))::INT)
    ||
    -- Remaining 7 random bytes
    substring(v_random FROM 4 FOR 7);

  RETURN encode(v_uuid_bytes, 'hex')::UUID;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION generate_uuid_v7() IS
  'Generates a UUID v7 (time-ordered) for use as primary keys.
   First 48 bits are millisecond timestamp for better B-tree index locality.
   Used as DEFAULT for all id columns in UPOE.';

COMMENT ON FUNCTION get_bytea_to_byte(BYTEA, INT) IS
  'Helper function for generate_uuid_v7(). Extracts a single byte from bytea as bytea.';
