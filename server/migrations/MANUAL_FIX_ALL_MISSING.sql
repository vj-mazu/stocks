-- Manual fix for all missing tables related to Band Malal Book and Inventory Quality
-- Run this directly on your production database

-- ============================================
-- Migration 142: Create lorry_transit_details
-- ============================================
CREATE TABLE IF NOT EXISTS lorry_transit_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    physical_inspection_id UUID NOT NULL REFERENCES physical_inspections(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sample_entry_id UUID NOT NULL REFERENCES sample_entries(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "wbInputType" VARCHAR(50),
    "millWbId" INTEGER REFERENCES weight_bridges(id),
    "partyWbName" VARCHAR(255),
    "wbNo" VARCHAR(100),
    "grossWeight" DECIMAL(15, 2),
    "tareWeight" DECIMAL(15, 2),
    "netWeight" DECIMAL(15, 2),
    "wbStatus" VARCHAR(50) NOT NULL DEFAULT 'none',
    "wbRejectReason" TEXT,
    "placeType" VARCHAR(50),
    "placeWarehouseId" INTEGER REFERENCES warehouses(id),
    "placeKunchinittuId" INTEGER REFERENCES kunchinittus(id),
    "placeDate" DATE,
    "placeStatus" VARCHAR(50) NOT NULL DEFAULT 'none',
    "placeRejectReason" TEXT,
    "outturnId" INTEGER REFERENCES outturns(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lorry_transit_physical_inspection 
    ON lorry_transit_details(physical_inspection_id);
CREATE INDEX IF NOT EXISTS idx_lorry_transit_sample_entry 
    ON lorry_transit_details(sample_entry_id);

-- ============================================
-- Migration 143: Add place/wb approver tracking
-- ============================================
ALTER TABLE lorry_transit_details 
    ADD COLUMN IF NOT EXISTS "wbApprovedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "wbApprovedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "wbRejectedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "wbRejectedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "placeApprovedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "placeApprovedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "placeRejectedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "placeRejectedAt" TIMESTAMP;

-- ============================================
-- Migration 145: Create inventory_quality_parameters
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_quality_parameters (
    id SERIAL PRIMARY KEY,
    transit_detail_id UUID NOT NULL REFERENCES lorry_transit_details(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('lot_avg', 'full_lorry_avg')),
    moisture VARCHAR(50),
    dry_moisture VARCHAR(50),
    cutting VARCHAR(50),
    bend VARCHAR(50),
    grains VARCHAR(50),
    mix VARCHAR(50),
    s_mix VARCHAR(50),
    l_mix VARCHAR(50),
    kandu VARCHAR(50),
    oil VARCHAR(50),
    sk VARCHAR(50),
    wb_r VARCHAR(50),
    wb_bk VARCHAR(50),
    wb_t VARCHAR(50),
    smell VARCHAR(50),
    paddy_wb VARCHAR(50),
    p_color VARCHAR(50),
    remarks TEXT,
    reported_by INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMP,
    reject_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_quality_transit_detail 
    ON inventory_quality_parameters(transit_detail_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quality_status 
    ON inventory_quality_parameters(status);
CREATE INDEX IF NOT EXISTS idx_inventory_quality_type 
    ON inventory_quality_parameters(type);

-- ============================================
-- Record migrations in tracking table
-- ============================================
CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
    name VARCHAR(255) PRIMARY KEY
);

INSERT INTO "SequelizeMeta" (name) VALUES 
    ('142_create_lorry_transit_details.js'),
    ('143_add_place_wb_approver_tracking.js'),
    ('145_create_inventory_quality_parameters.js')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Verification
-- ============================================
SELECT 'All tables created successfully!' AS status;
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('lorry_transit_details', 'inventory_quality_parameters', 'SequelizeMeta')
ORDER BY table_name;
