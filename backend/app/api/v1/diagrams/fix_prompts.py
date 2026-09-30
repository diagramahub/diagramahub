"""
Compatibility shim for diagram fix prompts.

The fix-prompt builders moved to ``app.api.v1.ai_providers.prompts`` so the AI
clients no longer reach into the diagrams module. This module re-exports them
to keep existing importers (``diagrams.fix_service`` and tests) working.
"""

from app.api.v1.ai_providers.prompts import (  # noqa: F401
    build_mermaid_fix_prompt,
    build_plantuml_fix_prompt,
    build_d2_fix_prompt,
    build_dbml_fix_prompt,
    build_fix_prompt,
)
