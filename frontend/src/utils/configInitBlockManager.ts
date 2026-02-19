/**
 * Manager for Mermaid config init block embedding and parsing.
 * Handles conversion between MermaidConfig objects and Mermaid init block syntax.
 */

export interface MermaidConfig {
  theme: string;
  layout: string;
  look: string;
  handDrawnSeed?: number;
  fontFamily?: string;
  fontSize?: number;
  // Flowchart configuration
  curve?: string;
}

export interface InitJson {
  theme?: string;
  themeVariables?: {
    fontFamily?: string;
    fontSize?: string;
    [key: string]: any;
  };
  flowchart?: {
    curve?: string;
    [key: string]: any;
  };
  handDrawnSeed?: number;
  [key: string]: any;
}

export class ConfigInitBlockManager {
  /**
   * Embed Mermaid config into content as init block.
   * Removes any existing init block and adds new one at the beginning.
   */
  embedConfig(content: string, config: MermaidConfig): string {
    // Remove any existing init block
    const contentWithoutInit = this.removeInitBlock(content);
    
    // Convert config to init JSON
    const initJson = this.configToInitJson(config);
    
    // Format as init block (single line)
    const initBlock = `%%{init: ${JSON.stringify(initJson)}}%%`;
    
    // Combine init block with content
    if (contentWithoutInit.trim()) {
      return `${initBlock}\n${contentWithoutInit}`;
    } else {
      return initBlock;
    }
  }

  /**
   * Parse Mermaid config from init block in content.
   * Returns null if no init block is found.
   */
  parseConfig(content: string): { config: MermaidConfig | null; contentWithoutInit: string } {
    // Extract init block
    const initBlockJson = this.extractInitBlock(content);
    
    if (!initBlockJson) {
      return {
        config: null,
        contentWithoutInit: content
      };
    }

    // Parse JSON
    let initJson: InitJson;
    try {
      initJson = JSON.parse(initBlockJson);
    } catch (error) {
      console.error('Failed to parse init block JSON:', error);
      return {
        config: null,
        contentWithoutInit: this.removeInitBlock(content)
      };
    }

    // Convert to MermaidConfig
    const config = this.initJsonToConfig(initJson);
    
    return {
      config,
      contentWithoutInit: this.removeInitBlock(content)
    };
  }

  /**
   * Update existing init block in content with new config values.
   * If no init block exists, adds one.
   */
  updateInitBlock(content: string, config: MermaidConfig): string {
    return this.embedConfig(content, config);
  }

  /**
   * Convert MermaidConfig to Mermaid init JSON structure.
   */
  configToInitJson(config: MermaidConfig): InitJson {
    const initJson: InitJson = {};

    // Add theme
    if (config.theme) {
      initJson.theme = config.theme;
    }

    // Add themeVariables if any font settings are present
    const themeVariables: { [key: string]: any } = {};
    
    // Font settings
    if (config.fontFamily) {
      themeVariables.fontFamily = config.fontFamily;
    }
    if (config.fontSize) {
      themeVariables.fontSize = `${config.fontSize}px`;
    }

    if (Object.keys(themeVariables).length > 0) {
      initJson.themeVariables = themeVariables;
    }

    // Add flowchart configuration
    const flowchartConfig: { [key: string]: any } = {};
    
    // Curve type - prioritize explicit curve setting, otherwise use layout
    if (config.curve) {
      flowchartConfig.curve = config.curve;
    } else if (config.layout === 'dagre') {
      flowchartConfig.curve = 'basis';
    } else if (config.layout === 'elk') {
      flowchartConfig.curve = 'linear';
    }

    if (Object.keys(flowchartConfig).length > 0) {
      initJson.flowchart = flowchartConfig;
    }

    // Add handDrawnSeed only if look is "handDrawn"
    if (config.look === 'handDrawn' && config.handDrawnSeed !== undefined) {
      initJson.handDrawnSeed = config.handDrawnSeed;
    }

    return initJson;
  }

  /**
   * Convert Mermaid init JSON to MermaidConfig object.
   */
  initJsonToConfig(initJson: InitJson): MermaidConfig {
    // Extract theme
    const theme = initJson.theme || 'default';

    // Extract flowchart configuration
    const flowchartConfig = initJson.flowchart || {};
    
    // Extract curve type
    const curve = flowchartConfig.curve;
    
    // Extract layout from flowchart curve (for backward compatibility)
    let layout = 'dagre'; // default
    if (curve) {
      if (curve === 'linear') {
        layout = 'elk';
      } else if (curve === 'basis') {
        layout = 'dagre';
      }
    }

    // Extract look based on presence of handDrawnSeed
    let look = 'classic'; // default
    if (initJson.handDrawnSeed !== undefined) {
      look = 'handDrawn';
    }

    // Extract theme variables
    const themeVariables = initJson.themeVariables || {};
    
    // Font settings
    let fontFamily: string | undefined;
    let fontSize: number | undefined;
    if (themeVariables.fontFamily) {
      fontFamily = themeVariables.fontFamily;
    }
    const fontSizeStr = themeVariables.fontSize;
    if (fontSizeStr && typeof fontSizeStr === 'string') {
      // Remove 'px' suffix if present
      fontSize = parseInt(fontSizeStr.replace('px', ''));
    } else if (typeof fontSizeStr === 'number') {
      fontSize = fontSizeStr;
    }

    return {
      theme,
      layout,
      look,
      handDrawnSeed: initJson.handDrawnSeed,
      fontFamily,
      fontSize,
      curve
    };
  }

  /**
   * Extract the JSON string from init block in content.
   * Returns null if not found.
   */
  private extractInitBlock(content: string): string | null {
    // Pattern to match %%{init: {...}}%%
    const pattern = /%%\{init:\s*(\{.*?\})\}%%/;
    const match = content.match(pattern);
    
    if (!match) {
      return null;
    }

    return match[1];
  }

  /**
   * Remove init block from content if present.
   */
  private removeInitBlock(content: string): string {
    // Pattern to match %%{init: {...}}%%
    const pattern = /%%\{init:\s*\{.*?\}\}%%\n?/;
    return content.replace(pattern, '');
  }
}

// Export singleton instance
export const configInitBlockManager = new ConfigInitBlockManager();
