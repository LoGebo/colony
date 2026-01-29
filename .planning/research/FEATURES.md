# Feature Landscape: Property Management Database Schemas

**Domain:** Unified Property Operations Ecosystem (Gated Communities/HOA/Condo Management)
**Researched:** 2026-01-29
**Confidence:** MEDIUM-HIGH (Multiple authoritative sources cross-referenced)

---

## 1. Core Entities and Relationships

### Primary Entity Clusters

Based on research across property management systems, HOA software, and rental management databases, the following entity structure emerges:

#### Property Hierarchy
```
Organization (Tenant)
  └── Community/Property
        └── Building/Block
              └── Unit (House, Apartment, Commercial Space)
                    └── Unit Features/Amenities
```

**Key Tables:**
| Entity | Core Fields | Relationships |
|--------|-------------|---------------|
| `organizations` | id (UUID), name, settings (JSONB), created_at | Top-level multi-tenant container |
| `communities` | id, org_id, name, address, type (gated/hoa/condo) | FK to organizations |
| `buildings` | id, community_id, name, address, floors | FK to communities |
| `units` | id, building_id, unit_number, type, bedrooms, bathrooms, sqft, pets_allowed, status | FK to buildings |

#### People & Relationships
```
Resident
  ├── Unit Occupancy (ownership/rental)
  ├── Vehicles
  ├── Pets
  ├── Family Members/Dependents
  └── KYC Documents
```

**Key Tables:**
| Entity | Core Fields | Relationships |
|--------|-------------|---------------|
| `residents` | id, name, email, phone, kyc_status, profile (JSONB) | Core person entity |
| `unit_occupancies` | id, unit_id, resident_id, type (owner/tenant), start_date, end_date, is_primary | Many-to-many junction |
| `vehicles` | id, resident_id, make, model, color, license_plate, rfid_tag | FK to residents |
| `pets` | id, resident_id, type, name, breed, registration_number | FK to residents |
| `documents` | id, resident_id, type (id_proof/lease/etc), file_url, verified_at | FK to residents |

**Source:** [GeeksforGeeks - ER Diagrams for Real Estate](https://www.geeksforgeeks.org/dbms/how-to-design-er-diagrams-for-real-estate-property-management/), [GitHub - Rental Database Project](https://github.com/ashmitan/Rental-Database-Project)

---

## 2. Financial Ledger Patterns

### Recommendation: Double-Entry Accounting

**Why Double-Entry over Simple Ledger:**
- Enforces that every transaction balances (debits = credits)
- Provides audit trail by design
- Prevents "money from nowhere" bugs
- Industry standard for any system handling real money

**Source:** [Square Engineering - Books](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/)

### Recommended Schema

```sql
-- Chart of Accounts (hierarchical)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    parent_id UUID REFERENCES accounts(id),
    code VARCHAR(20) NOT NULL,           -- e.g., "1100" for Cash
    name VARCHAR(100) NOT NULL,          -- e.g., "Cash", "Accounts Receivable"
    type VARCHAR(20) NOT NULL,           -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    normal_balance VARCHAR(10) NOT NULL, -- DEBIT or CREDIT
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions (immutable header)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    transaction_date DATE NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),          -- 'fee', 'payment', 'penalty', etc.
    reference_id UUID,                   -- Links to source (fee_id, payment_id, etc.)
    is_posted BOOLEAN DEFAULT false,     -- Can't modify after posting
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID NOT NULL
);

-- Journal Entries (immutable line items)
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(15,2) NOT NULL,       -- Always positive
    direction SMALLINT NOT NULL,         -- 1 = DEBIT, -1 = CREDIT
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Enforce balance: sum(amount * direction) must = 0 per transaction
    CONSTRAINT valid_direction CHECK (direction IN (-1, 1))
);

-- Account Balances (materialized for performance)
CREATE TABLE account_balances (
    account_id UUID PRIMARY KEY REFERENCES accounts(id),
    balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now()
);
```

**Key Principle:** Journal entries are immutable. Corrections are made via reversing entries, not updates.

**Source:** [Journalize.io - Elegant DB Schema](https://blog.journalize.io/posts/an-elegant-db-schema-for-double-entry-accounting/), [Anvil - Engineer's Guide to Double-Entry](https://anvil.works/blog/double-entry-accounting-for-engineers)

### Property Management Specific Accounts

Typical chart of accounts for HOA/property management:

| Code | Account | Type | Purpose |
|------|---------|------|---------|
| 1100 | Cash | Asset | Bank accounts |
| 1200 | Accounts Receivable | Asset | Unpaid resident fees |
| 2100 | Accounts Payable | Liability | Vendor bills |
| 2200 | Resident Deposits | Liability | Security deposits held |
| 3100 | Reserve Fund | Equity | Capital reserves |
| 4100 | Maintenance Fees | Revenue | Monthly HOA fees |
| 4200 | Penalty Income | Revenue | Late fees, violations |
| 5100 | Maintenance Expense | Expense | Repairs, upkeep |
| 5200 | Utilities | Expense | Common area utilities |

---

## 3. Access Control Data Models

### Visitor Management Schema

Based on research from gated community software (GateHouse, Proptia, EntranceIQ):

```sql
-- Visitor types
CREATE TYPE visitor_type AS ENUM ('guest', 'service_provider', 'delivery', 'contractor', 'recurring');
CREATE TYPE access_status AS ENUM ('pending', 'approved', 'checked_in', 'checked_out', 'denied', 'expired');

-- Pre-registered visitors
CREATE TABLE visitor_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id),
    host_resident_id UUID NOT NULL REFERENCES residents(id),
    host_unit_id UUID NOT NULL REFERENCES units(id),

    -- Visitor details
    visitor_name VARCHAR(100) NOT NULL,
    visitor_phone VARCHAR(20),
    visitor_email VARCHAR(100),
    visitor_type visitor_type NOT NULL,

    -- Access window
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,            -- For recurring visitors (housekeeping, etc.)

    -- Access credentials
    qr_code_token VARCHAR(100) UNIQUE,
    access_code VARCHAR(10),

    -- Status
    status access_status DEFAULT 'pending',
    approved_at TIMESTAMPTZ,
    approved_by UUID,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ               -- Soft delete
);

-- Actual visit records (immutable log)
CREATE TABLE visitor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id),
    invitation_id UUID REFERENCES visitor_invitations(id),

    -- Visitor snapshot (in case invitation changes)
    visitor_name VARCHAR(100) NOT NULL,
    visitor_phone VARCHAR(20),
    visitor_type visitor_type NOT NULL,

    -- Vehicle info (if applicable)
    vehicle_plate VARCHAR(20),
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_color VARCHAR(30),

    -- Entry/exit
    entry_time TIMESTAMPTZ NOT NULL,
    exit_time TIMESTAMPTZ,
    entry_gate VARCHAR(50),
    exit_gate VARCHAR(50),

    -- Security
    guard_id UUID,
    notes TEXT,
    photo_url VARCHAR(500),

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Blacklist
CREATE TABLE access_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id),

    -- Match criteria
    person_name VARCHAR(100),
    phone_pattern VARCHAR(20),
    vehicle_plate_pattern VARCHAR(20),
    id_number VARCHAR(50),

    -- Reason
    reason TEXT NOT NULL,
    reported_by UUID REFERENCES residents(id),

    -- Duration
    effective_from TIMESTAMPTZ DEFAULT now(),
    effective_until TIMESTAMPTZ,         -- NULL = permanent

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Features:**
- Pre-registration with QR codes and access codes
- Recurring visitor patterns (housekeepers, family)
- Vehicle tracking with LPR integration points
- Immutable visit logs for audit
- Blacklist with pattern matching

**Source:** [Proptia - Visitor Management](https://www.proptia.com/visitor-management/), [EntranceIQ - Visitor Software](https://www.entranceiq.net/blog/2025/what-is-a-gated-community-visitor-software-how-does-it-work.html)

---

## 4. Reservation/Booking Patterns

### Amenity Reservation Schema

```sql
-- Amenity definitions
CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id),
    name VARCHAR(100) NOT NULL,          -- "Pool", "Gym", "Party Room"
    type VARCHAR(50) NOT NULL,           -- "bookable", "open_access", "restricted"
    capacity INTEGER,

    -- Location
    building_id UUID REFERENCES buildings(id),
    location_description TEXT,

    -- Booking rules (JSONB for flexibility)
    booking_rules JSONB NOT NULL DEFAULT '{}',
    /*
    {
      "advance_booking_days": 30,
      "max_duration_hours": 4,
      "min_duration_hours": 1,
      "cancellation_hours": 24,
      "max_bookings_per_month": 2,
      "requires_deposit": true,
      "deposit_amount": 100.00,
      "hourly_rate": 25.00,
      "allowed_hours": {"start": "08:00", "end": "22:00"},
      "blocked_days": ["Sunday"],
      "requires_approval": false
    }
    */

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Time slots (for slot-based booking)
CREATE TABLE amenity_time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amenity_id UUID NOT NULL REFERENCES amenities(id),
    day_of_week SMALLINT,                -- 0-6 (NULL = specific date)
    specific_date DATE,                  -- For one-off slots
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER,                    -- Override amenity capacity
    price_override NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,

    CONSTRAINT slot_type CHECK (
        (day_of_week IS NOT NULL AND specific_date IS NULL) OR
        (day_of_week IS NULL AND specific_date IS NOT NULL)
    )
);

-- Reservations
CREATE TYPE reservation_status AS ENUM (
    'pending', 'approved', 'confirmed', 'checked_in',
    'completed', 'cancelled', 'no_show'
);

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amenity_id UUID NOT NULL REFERENCES amenities(id),
    resident_id UUID NOT NULL REFERENCES residents(id),
    unit_id UUID NOT NULL REFERENCES units(id),

    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,

    -- Capacity
    guest_count INTEGER DEFAULT 1,

    -- Financial
    total_amount NUMERIC(10,2),
    deposit_amount NUMERIC(10,2),
    deposit_paid BOOLEAN DEFAULT false,

    -- Status
    status reservation_status DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Notes
    special_requests TEXT,
    admin_notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,

    -- Prevent double booking
    CONSTRAINT no_overlap EXCLUDE USING gist (
        amenity_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'))
);

-- Reservation waitlist
CREATE TABLE reservation_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amenity_id UUID NOT NULL REFERENCES amenities(id),
    resident_id UUID NOT NULL REFERENCES residents(id),
    desired_date DATE NOT NULL,
    desired_start_time TIME,
    desired_end_time TIME,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Features:**
- Flexible booking rules via JSONB
- PostgreSQL exclusion constraint prevents double-booking
- Slot-based and free-form booking support
- Waitlist for high-demand amenities
- Deposit tracking

**Source:** [GeeksforGeeks - Booking Database Design](https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-booking-and-reservation-systems/), [Redgate - Hotel Room Booking](https://www.red-gate.com/blog/designing-a-data-model-for-a-hotel-room-booking-system)

---

## 5. Maintenance Ticketing with SLA

### Schema Design

```sql
-- SLA definitions
CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id),
    name VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL,       -- 'critical', 'high', 'medium', 'low'

    -- Response SLA
    response_time_hours INTEGER NOT NULL,

    -- Resolution SLA
    resolution_time_hours INTEGER NOT NULL,

    -- Business hours consideration
    business_hours_only BOOLEAN DEFAULT true,

    -- Escalation
    escalation_hours INTEGER,
    escalation_to UUID,                  -- User/role to escalate to

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ticket categories
CREATE TABLE ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id),
    name VARCHAR(100) NOT NULL,          -- 'Plumbing', 'Electrical', 'HVAC'
    default_sla_id UUID REFERENCES sla_policies(id),
    default_assignee_id UUID,
    parent_id UUID REFERENCES ticket_categories(id),
    is_active BOOLEAN DEFAULT true
);

-- Maintenance tickets
CREATE TYPE ticket_status AS ENUM (
    'open', 'acknowledged', 'in_progress', 'pending_parts',
    'pending_vendor', 'resolved', 'closed', 'cancelled'
);

CREATE TABLE maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(20) NOT NULL UNIQUE, -- Human-readable: MT-2025-0001
    community_id UUID NOT NULL REFERENCES communities(id),

    -- Reporter
    reported_by UUID NOT NULL REFERENCES residents(id),
    unit_id UUID REFERENCES units(id),

    -- Classification
    category_id UUID REFERENCES ticket_categories(id),
    priority VARCHAR(20) DEFAULT 'medium',

    -- Details
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location_details TEXT,

    -- Assignment
    assigned_to UUID,
    assigned_at TIMESTAMPTZ,

    -- SLA tracking
    sla_id UUID REFERENCES sla_policies(id),
    response_due_at TIMESTAMPTZ,
    resolution_due_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    -- SLA status
    response_sla_breached BOOLEAN DEFAULT false,
    resolution_sla_breached BOOLEAN DEFAULT false,

    -- Status
    status ticket_status DEFAULT 'open',

    -- Resolution
    resolution_notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Ticket comments/updates (immutable log)
CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES maintenance_tickets(id),
    author_id UUID NOT NULL,
    author_type VARCHAR(20) NOT NULL,    -- 'resident', 'staff', 'vendor', 'system'

    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,   -- Hidden from residents

    -- Attachments
    attachments JSONB DEFAULT '[]',      -- [{url, filename, type}]

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ticket status history (for SLA auditing)
CREATE TABLE ticket_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES maintenance_tickets(id),
    old_status ticket_status,
    new_status ticket_status NOT NULL,
    changed_by UUID NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**SLA Calculation Pattern:**

```sql
-- Trigger to calculate SLA deadlines on ticket creation
CREATE OR REPLACE FUNCTION calculate_sla_deadlines()
RETURNS TRIGGER AS $$
BEGIN
    SELECT
        now() + (response_time_hours || ' hours')::interval,
        now() + (resolution_time_hours || ' hours')::interval
    INTO NEW.response_due_at, NEW.resolution_due_at
    FROM sla_policies
    WHERE id = NEW.sla_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Source:** [Freshworks - SLA Metrics](https://www.freshworks.com/itsm/sla/metrics/), [ManageEngine - SLA Management](https://www.manageengine.com/products/service-desk/automation/sla-management.html)

---

## 6. Table Stakes vs. Differentiators

### Table Stakes (Must-Have for MVP)

Features users expect. Missing any = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Unit/Property Registry** | Core data model | Low | Foundation for everything |
| **Resident Profiles** | Users need accounts | Low | Include KYC status |
| **Ownership/Tenancy Tracking** | Who lives where | Medium | Support both owner & tenant |
| **Monthly Fee Management** | Primary revenue | Medium | Charge generation, tracking |
| **Payment Recording** | Money in | Medium | Basic receipt functionality |
| **Outstanding Balance View** | Know who owes | Low | Aging reports |
| **Basic Visitor Pre-registration** | Security baseline | Medium | Name, date, QR code |
| **Visitor Entry Logging** | Audit trail | Low | Who came when |
| **Maintenance Requests** | Common resident need | Medium | Submit, track, resolve |
| **Basic Announcements** | Community communication | Low | Broadcast messages |
| **Document Storage** | Bylaws, minutes | Low | File upload/download |
| **User Authentication** | Security | Low | Login, password reset |
| **Multi-tenant Data Isolation** | SaaS baseline | Medium | Row-level security |
| **Soft Deletes** | Data recovery | Low | deleted_at pattern |

**Source:** [Buildium - HOA Management Software](https://www.buildium.com/blog/best-hoa-management-software-platforms/), [Wild Apricot - HOA Software](https://www.wildapricot.com/blog/hoa-software)

### Differentiators (Competitive Advantage)

Features that set product apart. Not expected, but valued highly.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Double-Entry Ledger** | Financial accuracy, audit-ready | High | Most use simple ledger |
| **Offline-First with Sync** | Works without internet | High | Critical for guards at gates |
| **Real-time QR Validation** | Instant visitor verification | Medium | Better than codes |
| **Vehicle LPR Integration** | Automated entry | High | Requires hardware partnerships |
| **SLA-tracked Maintenance** | Accountability | Medium | Most just have tickets |
| **Smart Notifications** | Right message, right time | Medium | Context-aware alerts |
| **Amenity Complex Rules** | Flexible booking | Medium | Beyond simple calendars |
| **Violation Workflow** | Rule enforcement | Medium | Track, warn, penalize |
| **Recurring Visitor Patterns** | Convenience | Low | "Every Tuesday" type rules |
| **Financial Reconciliation** | Bank statement matching | High | Accounting-grade |
| **API for Integrations** | Ecosystem play | Medium | Connect to other systems |
| **Mobile-First Guard App** | Field usability | Medium | Dedicated security workflow |
| **AI-Assisted Categorization** | Efficiency | Medium | Auto-route tickets |
| **Community Marketplace** | Engagement | Medium | Buy/sell/services |

### Anti-Features (Explicitly Avoid)

Features to NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Simple audit_logs table** | Performance killer, not tamper-proof | Use pgAudit + event sourcing for sensitive ops |
| **UUID v4 primary keys** | Index fragmentation at scale | Use UUID v7 (time-ordered) |
| **Storing deleted_at as boolean** | Can't restore, no timestamp | Use TIMESTAMPTZ deleted_at |
| **Single monolithic permissions** | Inflexible | Role-based + resource-level permissions |
| **Hardcoded fee types** | Every community differs | Configurable fee structures |
| **Email as username** | People change emails | Separate email from login ID |
| **Tenant ID in every query** | Error-prone, easy to forget | Row-level security policies |
| **Mutable financial records** | Audit nightmare | Immutable transactions + reversals |
| **Generic "notes" field** | Unstructured, unsearchable | Typed metadata in JSONB |

**Source:** [LogVault - Audit Logs Anti-Pattern](https://www.logvault.app/blog/audit-logs-table-anti-pattern), [Andy Atkinson - Avoid UUID v4](https://andyatkinson.com/avoid-uuid-version-4-primary-keys)

---

## 7. Multi-Tenant & Security Patterns

### Row-Level Security Implementation

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;

-- Create policy using session variable
CREATE POLICY tenant_isolation ON units
    FOR ALL
    USING (community_id IN (
        SELECT community_id
        FROM user_community_access
        WHERE user_id = current_setting('app.current_user_id')::uuid
    ));

-- Set context at connection time
SET LOCAL app.current_user_id = 'user-uuid-here';
SET LOCAL app.current_community_id = 'community-uuid-here';
```

**Key Points:**
- RLS centralizes isolation logic at database level
- Application sets session context, not individual query filters
- Prevents accidental data leakage from missed WHERE clauses
- PostgreSQL 12+ recommended for best performance

**Source:** [AWS - Multi-tenant Data Isolation with RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/), [Crunchy Data - RLS for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)

### Audit Trail Pattern

```sql
-- Audit log for sensitive operations (append-only)
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_time TIMESTAMPTZ DEFAULT now(),

    -- Actor
    user_id UUID,
    user_type VARCHAR(20),               -- 'resident', 'staff', 'system', 'api'
    ip_address INET,
    user_agent TEXT,

    -- Action
    action VARCHAR(50) NOT NULL,         -- 'payment.created', 'visitor.approved'
    resource_type VARCHAR(50) NOT NULL,  -- 'payment', 'visitor_invitation'
    resource_id UUID,

    -- Context
    community_id UUID,

    -- Changes
    old_values JSONB,
    new_values JSONB,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Partition by month for performance
CREATE TABLE audit_events_2025_01 PARTITION OF audit_events
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

**Source:** [Severalnines - PostgreSQL Audit Logging](https://severalnines.com/blog/postgresql-audit-logging-best-practices/), [pgAudit Extension](https://github.com/pgaudit/pgaudit)

### Soft Delete Pattern

```sql
-- Add to all sync-able tables
ALTER TABLE residents ADD COLUMN deleted_at TIMESTAMPTZ;

-- Partial unique index (only enforced for non-deleted)
CREATE UNIQUE INDEX residents_email_unique
    ON residents(community_id, email)
    WHERE deleted_at IS NULL;

-- RLS policy to hide deleted by default
CREATE POLICY hide_deleted ON residents
    FOR SELECT
    USING (deleted_at IS NULL OR current_setting('app.show_deleted', true)::boolean);

-- View for active records
CREATE VIEW active_residents AS
    SELECT * FROM residents WHERE deleted_at IS NULL;
```

**Source:** [Medium - Soft Deletes with RLS](https://medium.com/@priyaranjanpatraa/soft-deletes-you-can-trust-row-level-archiving-with-spring-boot-jpa-postgresql-2c3544255e26), [DEV - PostgreSQL Soft Delete Strategies](https://dev.to/oddcoder/postgresql-soft-delete-strategies-balancing-data-retention-50lo)

---

## 8. UUID Strategy

### Recommendation: UUID v7

**Why UUID v7 over v4:**
- Time-ordered: new records append to index end
- 50-100x better insert performance at scale
- No index fragmentation
- Still globally unique
- PostgreSQL 18 native support (Fall 2025)

**Implementation for PostgreSQL < 18:**

```sql
-- Use pg_uuidv7 extension or application-generated
CREATE EXTENSION IF NOT EXISTS pg_uuidv7;

-- Or generate in application layer (recommended)
-- Most languages have uuid v7 libraries now
```

**Source:** [Maciej Walkowiak - PostgreSQL UUID](https://maciejwalkowiak.com/blog/postgres-uuid-primary-key/), [DZone - ULID and UUID Performance](https://dzone.com/articles/performance-of-ulid-and-uuid-in-postgres-database)

---

## 9. Feature Dependencies

```
Authentication
    └── User Management
          ├── Resident Profiles
          │     ├── Unit Occupancy
          │     ├── Vehicles
          │     ├── Pets
          │     └── KYC Documents
          │
          └── Staff/Admin Profiles
                └── Permissions/Roles

Property Hierarchy (Community → Building → Unit)
    │
    ├── Financial Module
    │     ├── Chart of Accounts
    │     ├── Fee Definitions
    │     ├── Charge Generation
    │     ├── Payments
    │     └── Reconciliation
    │
    ├── Access Control
    │     ├── Visitor Invitations
    │     ├── Visitor Logs
    │     ├── Blacklist
    │     └── Vehicle Registry
    │
    ├── Amenities
    │     ├── Amenity Definitions
    │     ├── Booking Rules
    │     └── Reservations
    │
    ├── Maintenance
    │     ├── Categories
    │     ├── SLA Policies
    │     ├── Tickets
    │     └── Work Orders
    │
    └── Communication
          ├── Announcements
          ├── Forums/Discussions
          └── Notifications
```

---

## 10. MVP Recommendation

### Phase 1: Core Foundation
1. Organizations, Communities, Buildings, Units
2. Residents with basic profiles
3. Unit occupancy (owner/tenant)
4. User authentication
5. Row-level security infrastructure

### Phase 2: Financial Basics
1. Chart of accounts
2. Fee definitions
3. Monthly charge generation
4. Payment recording
5. Balance inquiries

### Phase 3: Access Control
1. Visitor pre-registration
2. QR code generation
3. Entry/exit logging
4. Basic blacklist

### Phase 4: Maintenance
1. Ticket submission
2. Assignment workflow
3. Status tracking
4. Basic SLA (response time)

### Phase 5: Communication & Amenities
1. Announcements
2. Amenity definitions
3. Basic reservations

**Defer to Post-MVP:**
- Advanced SLA with escalations
- Vehicle LPR integration
- Financial reconciliation
- Marketplace
- AI features
- Complex booking rules

---

## Sources

**Database Schema Design:**
- [GeeksforGeeks - ER Diagrams for Real Estate](https://www.geeksforgeeks.org/dbms/how-to-design-er-diagrams-for-real-estate-property-management/)
- [GitHub - Rental Database Project](https://github.com/ashmitan/Rental-Database-Project)
- [Redgate - Hotel Room Booking](https://www.red-gate.com/blog/designing-a-data-model-for-a-hotel-room-booking-system)

**Financial/Accounting:**
- [Square - Books Accounting Service](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/)
- [Journalize.io - Elegant DB Schema](https://blog.journalize.io/posts/an-elegant-db-schema-for-double-entry-accounting/)
- [Anvil - Engineer's Guide to Double-Entry](https://anvil.works/blog/double-entry-accounting-for-engineers)

**Access Control:**
- [Proptia - Visitor Management](https://www.proptia.com/visitor-management/)
- [EntranceIQ - Gated Community Software](https://www.entranceiq.net/blog/2025/what-is-a-gated-community-visitor-software-how-does-it-work.html)
- [GateHouse Solutions](https://www.gatehousesolutions.com/)

**Multi-Tenant/Security:**
- [AWS - Multi-tenant Data Isolation with RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Crunchy Data - RLS for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)
- [Simplyblock - Multi-Tenancy with RLS](https://www.simplyblock.io/blog/underated-postgres-multi-tenancy-with-row-level-security/)

**Audit/Soft Delete:**
- [pgAudit Extension](https://github.com/pgaudit/pgaudit)
- [Severalnines - PostgreSQL Audit Logging](https://severalnines.com/blog/postgresql-audit-logging-best-practices/)
- [LogVault - Audit Logs Anti-Pattern](https://www.logvault.app/blog/audit-logs-table-anti-pattern)

**UUID Performance:**
- [Maciej Walkowiak - PostgreSQL UUID](https://maciejwalkowiak.com/blog/postgres-uuid-primary-key/)
- [Andy Atkinson - Avoid UUID v4](https://andyatkinson.com/avoid-uuid-version-4-primary-keys)

**HOA/Property Management Software:**
- [Buildium - HOA Management Software](https://www.buildium.com/blog/best-hoa-management-software-platforms/)
- [Wild Apricot - HOA Software](https://www.wildapricot.com/blog/hoa-software)
- [Vantaca - Community Association Software](https://www.vantaca.com/product)
