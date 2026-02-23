#!/usr/bin/env python3
"""
Script to create the FREE plan in the database.

This script is idempotent - it can be run multiple times without creating duplicates.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.core.config import settings
from app.api.v1.subscriptions.schemas import PlanInDB
from app.api.v1.subscriptions.constants import (
    FREE_PLAN_NAME,
    FREE_PLAN_DESCRIPTION,
    FREE_PLAN_PRICE,
    FREE_PLAN_MAX_PROJECTS,
    FREE_PLAN_MAX_DIAGRAMS
)


async def create_free_plan():
    """Create FREE plan if it doesn't exist."""
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGO_URI)
    database = client[settings.DATABASE_NAME]
    
    # Initialize Beanie
    await init_beanie(
        database=database,
        document_models=[PlanInDB]
    )
    
    # Check if FREE plan already exists
    existing_plan = await PlanInDB.find_one(PlanInDB.name == FREE_PLAN_NAME)
    
    if existing_plan:
        print(f"✓ FREE plan already exists (ID: {existing_plan.id})")
        print(f"  - Max Projects: {existing_plan.max_projects}")
        print(f"  - Max Diagrams: {existing_plan.max_diagrams}")
        print(f"  - Price: ${existing_plan.price_usd}/month")
        return existing_plan
    
    # Create FREE plan
    free_plan = PlanInDB(
        name=FREE_PLAN_NAME,
        description=FREE_PLAN_DESCRIPTION,
        price_usd=FREE_PLAN_PRICE,
        max_projects=FREE_PLAN_MAX_PROJECTS,
        max_diagrams=FREE_PLAN_MAX_DIAGRAMS,
        is_active=True,
        is_free=True
    )
    
    await free_plan.insert()
    
    print(f"✓ FREE plan created successfully (ID: {free_plan.id})")
    print(f"  - Max Projects: {free_plan.max_projects}")
    print(f"  - Max Diagrams: {free_plan.max_diagrams}")
    print(f"  - Price: ${free_plan.price_usd}/month")
    
    # Close connection
    client.close()
    
    return free_plan


async def main():
    """Main entry point."""
    print("Creating FREE plan...")
    print(f"Database: {settings.DATABASE_NAME}")
    print()
    
    try:
        await create_free_plan()
        print()
        print("Done!")
        return 0
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
