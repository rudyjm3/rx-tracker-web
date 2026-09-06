# Database Migration Required

## Migration File
`supabase/migrations/20260906_reorder_medications_function.sql`

## What it does
Creates a PostgreSQL function `reorder_medications(medication_ids UUID[])` that atomically updates the `sort_order` column for multiple medications in a single transaction.

## Why it's needed
The drag-to-reorder feature now calls this function instead of making parallel individual updates, ensuring all sort_order changes commit together (no partial success states).

## How to apply

### Option 1: Supabase CLI (recommended)
```bash
supabase db push
```

### Option 2: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20260906_reorder_medications_function.sql`
4. Click **Run**

### Option 3: Direct connection
If you have direct database access (psql, DBeaver, etc.):
```bash
psql <your-connection-string> -f supabase/migrations/20260906_reorder_medications_function.sql
```

## Testing the migration
After applying, test by:
1. Visit `/medications` in the app
2. Drag a medication card to reorder
3. Verify the new order persists after page reload
4. Check browser console for any RPC errors

## Rollback (if needed)
```sql
DROP FUNCTION IF EXISTS reorder_medications(UUID[]);
```
