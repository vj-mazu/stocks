# Quick Fix for Render Database - Missing Tables

## Problem
The `lorry_transit_details` table doesn't exist on Render, causing 500 errors.

## Solution: Run SQL Manually on Render Database

### Step 1: Access Render PostgreSQL Database

1. Go to your Render Dashboard
2. Find your PostgreSQL database service
3. Click on it
4. Look for **"Connect"** section
5. You'll see connection options:
   - **External Connection** (for tools like pgAdmin, DBeaver)
   - **Shell Access** (direct psql command)

### Step 2: Connect Using One of These Methods

#### Option A: Using Render Shell (Easiest)
1. In Render dashboard → Database → Click "Shell" tab
2. You'll get a PostgreSQL shell directly in browser
3. Copy and paste the SQL below
4. Press Enter

#### Option B: Using psql from Command Line
1. Copy the "External Database URL" from Render
2. Run: `psql [DATABASE_URL]`
3. Paste the SQL below

#### Option C: Using Database Tool (pgAdmin, DBeaver, TablePlus)
1. Copy connection details from Render:
   - Host
   - Port
   - Database name
   - Username
   - Password
2. Connect using your tool
3. Run the SQL below

### Step 3: Run This SQL

```sql
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

-- Add approver tracking columns (migration 143)
ALTER TABLE lorry_transit_details 
    ADD COLUMN IF NOT EXISTS "wbApprovedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "wbApprovedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "wbRejectedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "wbRejectedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "placeApprovedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "placeApprovedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "placeRejectedBy" INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS "placeRejectedAt" TIMESTAMP;

-- Create inventory_quality_parameters table (migration 145)
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

-- Track migrations
CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
    name VARCHAR(255) PRIMARY KEY
);

INSERT INTO "SequelizeMeta" (name) VALUES 
    ('142_create_lorry_transit_details.js'),
    ('143_add_place_wb_approver_tracking.js'),
    ('145_create_inventory_quality_parameters.js')
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT 'SUCCESS: All tables created!' AS status;
```

### Step 4: Verify
Run this to check:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('lorry_transit_details', 'inventory_quality_parameters')
ORDER BY table_name;
```

You should see both tables listed.

### Step 5: No Server Restart Needed!
The tables are now created. Your application should work immediately without restarting the server.

## Alternative: Trigger Render Redeploy
If you prefer automated approach:
1. Go to Render Dashboard → Your Service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Wait for deployment to complete
4. Check logs for migration messages

But **running SQL manually is faster** and will fix the issue immediately!
