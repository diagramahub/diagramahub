/**
 * Manager for PlantUML theme embedding and parsing.
 * Handles conversion between PlantUMLConfig objects and PlantUML theme directives.
 */

export interface PlantUMLConfig {
  theme?: string;
}

export class PlantUMLConfigManager {
  /**
   * Embed PlantUML theme into content as !theme directive.
   * Removes any existing !theme directive and adds new one after @startuml.
   */
  embedTheme(content: string, config: PlantUMLConfig): string {
    // Remove any existing theme directive
    const contentWithoutTheme = this.removeThemeDirective(content);
    
    // If no theme specified, return content without theme
    if (!config.theme) {
      return contentWithoutTheme;
    }
    
    // Insert theme directive after @startuml
    const lines = contentWithoutTheme.split('\n');
    const startIndex = lines.findIndex(line => line.trim().startsWith('@startuml'));
    
    if (startIndex !== -1) {
      lines.splice(startIndex + 1, 0, `!theme ${config.theme}`);
      return lines.join('\n');
    }
    
    // If no @startuml found, return content as-is
    return contentWithoutTheme;
  }

  /**
   * Parse PlantUML theme from content.
   * Returns null if no theme directive is found.
   */
  parseTheme(content: string): { config: PlantUMLConfig | null; contentWithoutTheme: string } {
    // Extract theme directive
    const theme = this.extractThemeDirective(content);
    
    if (!theme) {
      return {
        config: null,
        contentWithoutTheme: content
      };
    }

    return {
      config: { theme },
      contentWithoutTheme: this.removeThemeDirective(content)
    };
  }

  /**
   * Extract the theme name from !theme directive in content.
   * Returns null if not found.
   */
  private extractThemeDirective(content: string): string | null {
    // Pattern to match !theme directive
    const pattern = /^\s*!theme\s+(\S+)/m;
    const match = content.match(pattern);
    
    if (!match) {
      return null;
    }

    return match[1];
  }

  /**
   * Remove theme directive from content if present.
   */
  private removeThemeDirective(content: string): string {
    // Pattern to match !theme directive (entire line)
    const pattern = /^\s*!theme\s+\S+\s*\n?/gm;
    return content.replace(pattern, '');
  }
}

// Export singleton instance
export const plantUMLConfigManager = new PlantUMLConfigManager();
