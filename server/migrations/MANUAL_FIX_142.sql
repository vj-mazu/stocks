-- Manual fix for missing lorry_transit_details table
-- Run this directly on your production database if migrations aren't working

-- Create lorry_transit_details table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lorry_transit_physical_inspection 
    ON lorry_transit_details(physical_inspection_id);

CREATE INDEX IF NOT EXISTS idx_lorry_transit_sample_entry 
    ON lorry_transit_details(sample_entry_id);

-- Add to migration tracking (if SequelizeMeta exists)
INSERT INTO "SequelizeMeta" (name) 
VALUES ('142_create_lorry_transit_details.js')
ON CONFLICT (name) DO NOTHING;

-- Verify the table was created
SELECT 'lorry_transit_details table created successfully' AS status;
SELECT COUNT(*) as row_count FROM lorry_transit_details;
