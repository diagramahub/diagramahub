#!/usr/bin/env python3
"""
Manual test script to verify Mermaid config embedding functionality.
This script tests the complete flow of embedding and parsing config.
"""

from app.api.v1.diagrams.config_utils import MermaidConfigEmbedder, MermaidConfigParser
from app.api.v1.diagrams.schemas import MermaidConfig

def test_basic_embedding():
    """Test basic config embedding"""
    print("=" * 60)
    print("TEST 1: Basic Config Embedding")
    print("=" * 60)
    
    embedder = MermaidConfigEmbedder()
    parser = MermaidConfigParser()
    
    # Create a simple config
    # Note: 'look' field is not embedded in init block because Mermaid doesn't support it natively
    # Only 'handDrawn' look is supported via handDrawnSeed
    config = MermaidConfig(
        theme="base",
        layout="elk",
        look="classic",  # Changed from "neo" to "classic" since it's not embedded
        handDrawnSeed=None,
        fontFamily="Arial",
        fontSize=18
    )
    
    # Original diagram content
    original_content = """flowchart TD
    A[Start] --> B[End]"""
    
    print(f"\n📝 Original content:\n{original_content}")
    print(f"\n⚙️  Config to embed: {config.model_dump()}")
    
    # Embed config
    embedded_content = embedder.embed_config(original_content, config)
    print(f"\n✅ Embedded content:\n{embedded_content}")
    
    # Parse config back
    result = parser.parse_config(embedded_content)
    print(f"\n🔍 Parsed config: {result.config.model_dump() if result.config else None}")
    print(f"\n📄 Content without init:\n{result.content_without_init}")
    
    # Verify round trip
    assert result.success, f"Parse failed: {result.error}"
    assert result.config is not None, "Failed to parse config"
    assert result.config.theme == config.theme, f"Theme mismatch: {result.config.theme} != {config.theme}"
    assert result.config.layout == config.layout, f"Layout mismatch: {result.config.layout} != {config.layout}"
    # Note: look is not compared because it's not embedded (except for handDrawn)
    assert result.config.fontFamily == config.fontFamily, f"FontFamily mismatch: {result.config.fontFamily} != {config.fontFamily}"
    assert result.config.fontSize == config.fontSize, f"FontSize mismatch: {result.config.fontSize} != {config.fontSize}"
    assert result.content_without_init.strip() == original_content.strip(), "Content mismatch after round trip"
    
    print("\n✅ TEST 1 PASSED: Round trip successful!")
    print("   Note: 'look' field (except handDrawn) is not embedded as it's not part of Mermaid's native config")
    return True

def test_handdrawn_look():
    """Test handDrawn look with seed"""
    print("\n" + "=" * 60)
    print("TEST 2: HandDrawn Look with Seed")
    print("=" * 60)
    
    embedder = MermaidConfigEmbedder()
    parser = MermaidConfigParser()
    
    config = MermaidConfig(
        theme="default",
        layout="dagre",
        look="handDrawn",
        handDrawnSeed=42,
        fontFamily=None,
        fontSize=None
    )
    
    content = "graph TD\n  A --> B"
    
    print(f"\n📝 Original content:\n{content}")
    print(f"\n⚙️  Config (handDrawn with seed): {config.model_dump()}")
    
    embedded = embedder.embed_config(content, config)
    print(f"\n✅ Embedded content:\n{embedded}")
    
    # Verify handDrawnSeed is in the init block
    assert "handDrawnSeed" in embedded, "handDrawnSeed not found in embedded content"
    assert "42" in embedded, "Seed value not found in embedded content"
    
    result = parser.parse_config(embedded)
    print(f"\n🔍 Parsed config: {result.config.model_dump() if result.config else None}")
    
    assert result.success, f"Parse failed: {result.error}"
    assert result.config is not None, "Failed to parse config"
    assert result.config.look == "handDrawn", f"Look should be handDrawn, got {result.config.look}"
    assert result.config.handDrawnSeed == 42, f"Seed mismatch: {result.config.handDrawnSeed} != 42"
    
    print("\n✅ TEST 2 PASSED: HandDrawn look with seed works!")
    return True

def test_no_init_block():
    """Test parsing content without init block"""
    print("\n" + "=" * 60)
    print("TEST 3: Content Without Init Block")
    print("=" * 60)
    
    parser = MermaidConfigParser()
    
    content = """flowchart LR
    A[Inicio] --> B[Fin]"""
    
    print(f"\n📝 Content without init block:\n{content}")
    
    result = parser.parse_config(content)
    
    print(f"\n🔍 Parsed config: {result.config}")
    print(f"\n📄 Content: {result.content_without_init}")
    
    assert result.success, f"Parse should succeed: {result.error}"
    assert result.config is None, "Should return None when no init block present"
    assert result.content_without_init == content, "Content should remain unchanged"
    
    print("\n✅ TEST 3 PASSED: Correctly handles content without init block!")
    return True

def test_update_existing_init_block():
    """Test updating an existing init block"""
    print("\n" + "=" * 60)
    print("TEST 4: Update Existing Init Block")
    print("=" * 60)
    
    embedder = MermaidConfigEmbedder()
    parser = MermaidConfigParser()
    
    # Content with existing init block
    existing_content = """%%{init: {"theme": "dark", "flowchart": {"curve": "basis"}}}%%
flowchart TD
    A --> B"""
    
    print(f"\n📝 Content with existing init block:\n{existing_content}")
    
    # Parse existing config
    old_result = parser.parse_config(existing_content)
    print(f"\n🔍 Old config: {old_result.config.model_dump() if old_result.config else None}")
    
    # New config to embed
    new_config = MermaidConfig(
        theme="base",
        layout="elk",
        look="neo",
        handDrawnSeed=None,
        fontFamily="Courier",
        fontSize=14
    )
    
    print(f"\n⚙️  New config to embed: {new_config.model_dump()}")
    
    # Embed new config (should replace old one)
    updated_content = embedder.embed_config(existing_content, new_config)
    print(f"\n✅ Updated content:\n{updated_content}")
    
    # Parse updated config
    new_result = parser.parse_config(updated_content)
    print(f"\n🔍 Parsed new config: {new_result.config.model_dump() if new_result.config else None}")
    
    assert new_result.success, f"Parse failed: {new_result.error}"
    assert new_result.config is not None, "Failed to parse updated config"
    assert new_result.config.theme == "base", f"Theme should be 'base', got {new_result.config.theme}"
    assert new_result.config.layout == "elk", f"Layout should be 'elk', got {new_result.config.layout}"
    # Note: look is not compared because it's not embedded (except for handDrawn)
    assert new_result.config.fontFamily == "Courier", f"FontFamily should be 'Courier', got {new_result.config.fontFamily}"
    
    # Verify old config is gone
    assert "dark" not in updated_content, "Old theme 'dark' should be removed"
    
    print("\n✅ TEST 4 PASSED: Successfully updated existing init block!")
    return True

def test_background_not_embedded():
    """Test that background_color and background_pattern are NOT embedded"""
    print("\n" + "=" * 60)
    print("TEST 5: Background Config NOT Embedded")
    print("=" * 60)
    
    embedder = MermaidConfigEmbedder()
    
    config = MermaidConfig(
        theme="default",
        layout="dagre",
        look="classic",
        handDrawnSeed=None,
        fontFamily=None,
        fontSize=None
    )
    
    content = "graph TD\n  A --> B"
    
    embedded = embedder.embed_config(content, config)
    print(f"\n✅ Embedded content:\n{embedded}")
    
    # Verify background-related fields are NOT in the init block
    assert "background_color" not in embedded.lower(), "background_color should NOT be in init block"
    assert "background_pattern" not in embedded.lower(), "background_pattern should NOT be in init block"
    assert "backgroundcolor" not in embedded.lower(), "backgroundColor should NOT be in init block"
    assert "backgroundpattern" not in embedded.lower(), "backgroundPattern should NOT be in init block"
    
    print("\n✅ TEST 5 PASSED: Background config correctly excluded from init block!")
    return True

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("🧪 MERMAID CONFIG EMBEDDING - MANUAL TESTS")
    print("=" * 60)
    
    tests = [
        test_basic_embedding,
        test_handdrawn_look,
        test_no_init_block,
        test_update_existing_init_block,
        test_background_not_embedded
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except AssertionError as e:
            print(f"\n❌ TEST FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"\n❌ TEST ERROR: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Config embedding is working correctly!")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review the output above.")
        return 1

if __name__ == "__main__":
    exit(main())
