#!/usr/bin/env python3
"""
Script to fix webhook_events index conflict.
Drops the old index and lets Beanie recreate it with unique constraint.
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


async def fix_webhook_index():
    """Drop the old webhook_events index."""
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.MONGO_URI)
    database = client[settings.DATABASE_NAME]
    collection = database["webhook_events"]
    
    try:
        # List existing indexes
        indexes = await collection.list_indexes().to_list(length=None)
        print(f"\nExisting indexes on webhook_events:")
        for idx in indexes:
            print(f"  - {idx['name']}: {idx.get('key', {})}")
        
        # Drop the conflicting index
        if any(idx['name'] == 'event_id_1' for idx in indexes):
            print(f"\nDropping index 'event_id_1'...")
            await collection.drop_index('event_id_1')
            print("✓ Index dropped successfully")
        else:
            print("\n✓ No conflicting index found")
        
        print("\nDone! You can now restart the backend.")
        
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(fix_webhook_index())
