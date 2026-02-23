# User Migration Guide

This guide explains how to migrate existing users to the subscription system.

## Overview

The migration process creates FREE subscriptions for all existing users who don't have one. This ensures that all users have access to the system with the default FREE plan.

## Prerequisites

- Backend server must be running
- MongoDB must be accessible
- FREE plan must exist in database (run `create_free_plan.py` first)

## Step 1: Create FREE Plan

Before migrating users, ensure the FREE plan exists:

```bash
cd backend
python3 scripts/create_free_plan.py
```

Expected output:
```
Creating FREE plan...
Database: diagramahub

✓ FREE plan created successfully (ID: 507f1f77bcf86cd799439011)
  - Max Projects: 1
  - Max Diagrams: 10
  - Price: $0.0/month

Done!
```

If the plan already exists, you'll see:
```
✓ FREE plan already exists (ID: 507f1f77bcf86cd799439011)
```

## Step 2: Dry Run (Recommended)

Before running the actual migration, do a dry run to see what will happen:

```bash
cd backend
python3 scripts/migrate_users_to_subscriptions.py --dry-run
```

This will show:
- Total number of users
- How many users would be migrated
- How many users already have subscriptions

Example output:
```
============================================================
User Subscription Migration
============================================================
Database: diagramahub

Found 150 users in database

🔍 DRY RUN MODE - No changes will be made

Would migrate 120 users
Already have subscription: 30 users

Done!
```

## Step 3: Run Migration

Once you've verified the dry run output, run the actual migration:

```bash
cd backend
python3 scripts/migrate_users_to_subscriptions.py
```

You'll be asked to confirm:
```
⚠️  This will create FREE subscriptions for all users without one.
Continue? (yes/no):
```

Type `yes` and press Enter to proceed.

Expected output:
```
Starting migration...

Migration completed!

  Total users: 150
  ✓ Migrated: 120
  ✓ Already had subscription: 30
  ✗ Errors: 0

Done!
```

## Step 4: Verify Migration

### Check Database

Connect to MongoDB and verify subscriptions were created:

```javascript
// Count total subscriptions
db.subscriptions.countDocuments()

// Check FREE plan subscriptions
db.subscriptions.countDocuments({ status: "active" })

// View sample subscription
db.subscriptions.findOne()
```

### Check via API

Use the API to verify a user's subscription:

```bash
# Get user's subscription
curl -X GET "http://localhost:8000/api/v1/subscriptions/me" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "user_id": "507f191e810c19729de860ea",
  "plan": {
    "id": "507f1f77bcf86cd799439012",
    "name": "FREE",
    "price_usd": 0.0,
    "max_projects": 1,
    "max_diagrams": 10,
    "is_free": true
  },
  "status": "active",
  "started_at": "2024-01-15T10:30:00Z"
}
```

## Troubleshooting

### Error: FREE plan not found

**Problem:** The migration script can't find the FREE plan.

**Solution:**
```bash
python3 scripts/create_free_plan.py
```

### Error: MongoDB connection failed

**Problem:** Can't connect to MongoDB.

**Solution:**
1. Check that MongoDB is running
2. Verify `MONGO_URI` in `.env` is correct
3. Test connection: `mongosh $MONGO_URI`

### Some users not migrated

**Problem:** Migration completed but some users don't have subscriptions.

**Solution:**
1. Check error logs for specific user issues
2. Run migration again (it's idempotent)
3. Manually create subscriptions for failed users via API

### Duplicate subscriptions

**Problem:** Users have multiple active subscriptions.

**Solution:**
The migration script is idempotent and should prevent this. If it happens:

```javascript
// Find users with multiple active subscriptions
db.subscriptions.aggregate([
  { $match: { status: "active" } },
  { $group: { _id: "$user_id", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])

// Manually deactivate duplicates (keep the oldest)
```

## Advanced Options

### Verbose Mode

See detailed output for each user:

```bash
python3 scripts/migrate_users_to_subscriptions.py --verbose
```

### Combine Options

```bash
python3 scripts/migrate_users_to_subscriptions.py --dry-run --verbose
```

## Post-Migration

### Enable Auto-Assignment

After migration, new users will automatically get FREE subscriptions when they register. No additional configuration needed.

### Monitor Subscriptions

Regularly check subscription status:

```javascript
// Count subscriptions by status
db.subscriptions.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// Count subscriptions by plan
db.subscriptions.aggregate([
  { $group: { _id: "$plan_id", count: { $sum: 1 } } }
])
```

## Rollback (Emergency)

If you need to rollback the migration:

```javascript
// WARNING: This will delete all subscriptions
// Only use in emergency situations

// Backup first
mongoexport --db=diagramahub --collection=subscriptions --out=subscriptions_backup.json

// Delete all subscriptions
db.subscriptions.deleteMany({})

// Restore if needed
mongoimport --db=diagramahub --collection=subscriptions --file=subscriptions_backup.json
```

## Support

For migration issues:
1. Check backend logs for detailed error messages
2. Verify database connectivity
3. Ensure FREE plan exists
4. Run with `--verbose` flag for more details
5. Contact support if issues persist
