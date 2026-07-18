# New Migrations to Run

## Important: Run these migrations before starting the server

The following migrations were added in the past 3 days and **MUST** be run for the server to work properly:

### Migration List (in order):

1. **130_create_weight_bridges_table.js** - Creates Weight Bridge management table
2. **138_add_transit_approval_fields_to_arrivals.js** - Adds transit approval fields to arrivals
3. **139_add_transit_approval_fields_to_sample_entries.js** - Adds transit approval fields to sample entries
4. **140_add_outturn_id_to_sample_entries.js** - Adds outturn ID reference to sample entries
5. **141_add_wb_weights_to_sample_entries.js** - Adds weight bridge weight fields to sample entries
6. **142_create_lorry_transit_details.js** - **CRITICAL**: Creates lorry_transit_details table for Band Malal Book
7. **143_add_place_wb_approver_tracking.js** - Adds approver tracking for Place and WB decisions
8. **144_update_existing_place_approved_at.js** - Data migration to backfill approval timestamps
9. **145_create_inventory_quality_parameters.js** - Creates inventory quality parameters table
10. **999_make_wb_fields_optional.js** - Makes WB fields optional (cleanup migration)

### How to Run Migrations:

```bash
cd server
npm run migrate
```

**Or manually:**

```bash
cd server
npx sequelize-cli db:migrate
```

### Verify Migrations:

Check that all migrations ran successfully:

```bash
npx sequelize-cli db:migrate:status
```

All migrations should show status "up" ✅

---

## New Features Added:

### 1. Weight Bridge Management
- New model: `WeightBridge`
- New route: `/api/weight-bridges`
- Allows managing mill weight bridges

### 2. Lorry Transit Details (Band Malal Book)
- **New model: `LorryTransitDetail`** ⭐ CRITICAL
- Links Physical Inspections to Place & WB decisions
- Tracks Place status (none/pending/approved/rejected)
- Tracks WB status (none/pending/approved/rejected)
- Approver tracking for both Place and WB

### 3. Inventory Quality Parameters
- New model: `InventoryQualityParameter`
- Stores Lot Avg and Full Lorry Avg quality checks
- Two-way approval workflow (pending → approved/rejected)
- Frontend implementation pending

### 4. In-Transit Endpoint
- New endpoint: `GET /api/arrivals/in-transit`
- Shows entries awaiting Place decision
- Optimized data fetching with associations

### 5. Band Malal Book Endpoint
- Updated endpoint: `GET /api/arrivals/band-malal-book`
- Shows entries with approved Place decisions
- Includes inventory quality parameters

---

## Important Notes:

⚠️ **Migration 142 is CRITICAL** - The `lorry_transit_details` table is required for Band Malal Book functionality. The server will fail if this table doesn't exist.

⚠️ **Run migrations in order** - Migrations have dependencies on each other. Always run them sequentially.

⚠️ **Backup database first** - Before running migrations on production, always create a backup.

---

## Troubleshooting:

### If server fails to start:

1. Check that all migrations ran: `npm run migrate`
2. Verify table exists: 
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'lorry_transit_details';
   ```
3. Check migration status: `npx sequelize-cli db:migrate:status`

### If migration fails:

1. Check the error message carefully
2. Verify database connection in `.env`
3. Ensure previous migrations completed successfully
4. Check if table/column already exists (might need to undo migration first)

---

## Migration Files Location:

```
server/migrations/
├── 130_create_weight_bridges_table.js
├── 138_add_transit_approval_fields_to_arrivals.js
├── 139_add_transit_approval_fields_to_sample_entries.js
├── 140_add_outturn_id_to_sample_entries.js
├── 141_add_wb_weights_to_sample_entries.js
├── 142_create_lorry_transit_details.js ⭐ CRITICAL
├── 143_add_place_wb_approver_tracking.js
├── 144_update_existing_place_approved_at.js
├── 145_create_inventory_quality_parameters.js
└── 999_make_wb_fields_optional.js
```
