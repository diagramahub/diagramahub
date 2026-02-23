#!/usr/bin/env python3
"""
Script to migrate existing users to the subscription system.

This script creates FREE subscriptions for all users who don't have one.
It's idempotent - can be run multiple times without creating duplicates.

Usage:
    python migrate_users_to_subscriptions.py [--dry-run] [--verbose]
"""
import asyncio
import sys
import argparse
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.core.config import settings
from app.api.v1.users.schemas import UserInDB
from app.api.v1.users.repository import UserRepository
from app.api.v1.subscriptions.schemas import PlanInDB, SubscriptionInDB
from app.api.v1.subscriptions.plan_repository import PlanRepository
from app.api.v1.subscriptions.subscription_repository import SubscriptionRepository
from app.api.v1.subscriptions.subscription_service import SubscriptionService
from app.api.v1.subscriptions.migration_service import MigrationService
from app.api.v1.subscriptions.payment_providers.stripe_provider import StripePaymentProvider


async def migrate_users(dry_run: bool = False, verbose: bool = False):
    """Migrate existing users to subscription system."""
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGO_URI)
    database = client[settings.DATABASE_NAME]
    
    # Initialize Beanie
    await init_beanie(
        database=database,
        document_models=[UserInDB, PlanInDB, SubscriptionInDB]
    )
    
    # Create services
    plan_repository = PlanRepository()
    subscription_repository = SubscriptionRepository()
    
    # Create payment provider (puede ser None si no está configurado)
    try:
        payment_provider = StripePaymentProvider.from_env()
    except ValueError:
        payment_provider = None
        if verbose:
            print("⚠ Stripe not configured, continuing without payment provider")
    
    subscription_service = SubscriptionService(
        repository=subscription_repository,
        plan_repository=plan_repository,
        payment_provider=payment_provider
    )
    
    migration_service = MigrationService(
        subscription_service=subscription_service
    )
    
    # Get statistics before migration
    users = await UserInDB.find_all().to_list()
    print(f"Found {len(users)} users in database")
    print()
    
    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
        print()
        
        # Count users without subscription
        users_without_sub = 0
        for user in users:
            existing = await subscription_repository.get_active_by_user(str(user.id))
            if not existing:
                users_without_sub += 1
                if verbose:
                    print(f"  Would migrate: {user.email}")
        
        print(f"Would migrate {users_without_sub} users")
        print(f"Already have subscription: {len(users) - users_without_sub} users")
        
    else:
        # Confirm before proceeding
        print("⚠️  This will create FREE subscriptions for all users without one.")
        response = input("Continue? (yes/no): ")
        
        if response.lower() not in ['yes', 'y']:
            print("Migration cancelled")
            client.close()
            return 1
        
        print()
        print("Starting migration...")
        print()
        
        # Run migration
        stats = await migration_service.migrate_existing_users()
        
        # Print results
        print("Migration completed!")
        print()
        print(f"  Total users: {stats['total_users']}")
        print(f"  ✓ Migrated: {stats['migrated']}")
        print(f"  ✓ Already had subscription: {stats['already_had_subscription']}")
        if stats['errors'] > 0:
            print(f"  ✗ Errors: {stats['errors']}")
    
    # Close connection
    client.close()
    
    return 0


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Migrate existing users to subscription system"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed output"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("User Subscription Migration")
    print("=" * 60)
    print(f"Database: {settings.DATABASE_NAME}")
    print()
    
    try:
        exit_code = await migrate_users(
            dry_run=args.dry_run,
            verbose=args.verbose
        )
        print()
        print("Done!")
        return exit_code
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
