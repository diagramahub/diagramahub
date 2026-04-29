/**
 * Manager for D2 theme embedding and parsing.
 * Handles conversion between D2 theme IDs and the vars block
 * that D2 uses for configuration: vars: { d2-config: { theme-id: N } }
 */

export interface D2Config {
  themeId?: number;
}

/** Available D2 themes grouped by category. */
export const D2_THEMES = {
  light: [
    { id: 0, name: 'Default' },
    { id: 1, name: 'Neutral Grey' },
    { id: 3, name: 'Flagship Terrastruct' },
    { id: 4, name: 'Cool Classics' },
    { id: 5, name: 'Mixed Berry Blue' },
    { id: 6, name: 'Grape Soda' },
    { id: 7, name: 'Aubergine' },
    { id: 8, name: 'Colorblind Clear' },
    { id: 100, name: 'Vanilla Nitro Cola' },
    { id: 101, name: 'Orange Creamsicle' },
    { id: 102, name: 'Shirley Temple' },
    { id: 103, name: 'Earth Tones' },
    { id: 104, name: 'Everglade Green' },
    { id: 105, name: 'Buttered Toast' },
  ],
  dark: [
    { id: 200, name: 'Dark Mauve' },
    { id: 201, name: 'Dark Flagship Terrastruct' },
  ],
  special: [
    { id: 300, name: 'Terminal' },
    { id: 301, name: 'Terminal Grayscale' },
    { id: 302, name: 'Origami' },
  ],
} as const;

/**
 * Regex that matches the vars block containing d2-config with theme-id.
 * Captures the full vars block so it can be removed/replaced.
 */
const VARS_BLOCK_REGEX = /^vars:\s*\{\s*\n\s*d2-config:\s*\{\s*\n\s*theme-id:\s*(\d+)\s*\n\s*\}\s*\n\s*\}\s*\n?/m;

/** Simpler regex for just extracting theme-id from any vars block. */
const THEME_ID_REGEX = /theme-id:\s*(\d+)/;

export class D2ConfigManager {
  /**
   * Embed D2 theme into content as a vars block.
   * Removes any existing vars/d2-config block and prepends a new one.
   */
  embedTheme(content: string, config: D2Config): string {
    // Remove any existing vars block with theme-id
    const contentWithoutTheme = this.removeThemeBlock(content);

    // If no theme specified or default (0), return content without theme block
    if (config.themeId === undefined || config.themeId === null || config.themeId === 0) {
      return contentWithoutTheme;
    }

    // Prepend vars block
    const varsBlock = `vars: {\n  d2-config: {\n    theme-id: ${config.themeId}\n  }\n}\n`;
    return varsBlock + contentWithoutTheme;
  }

  /**
   * Parse D2 theme from content.
   * Returns the theme ID if found, null otherwise.
   */
  parseTheme(content: string): { config: D2Config | null; contentWithoutTheme: string } {
    const match = content.match(THEME_ID_REGEX);

    if (!match) {
      return {
        config: null,
        contentWithoutTheme: content,
      };
    }

    return {
      config: { themeId: parseInt(match[1], 10) },
      contentWithoutTheme: this.removeThemeBlock(content),
    };
  }

  /**
   * Remove the vars block containing d2-config/theme-id from content.
   */
  private removeThemeBlock(content: string): string {
    return content.replace(VARS_BLOCK_REGEX, '');
  }
}

// Export singleton instance
export const d2ConfigManager = new D2ConfigManager();
