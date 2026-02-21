/**
 * TypeScript types for AI provider integration
 */

export enum AIProviderType {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  CLAUDE = 'claude',
  DEEPSEEK = 'deepseek'
}

export interface AIProviderConfig {
  provider: AIProviderType;
  api_key: string;  // Masked in responses
  model: string;
  is_active: boolean;
  is_default: boolean;
  parameters: Record<string, any>;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAISettings {
  user_id: string;
  providers: AIProviderConfig[];
  auto_generate_on_save: boolean;
  default_provider: AIProviderType | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  provider: AIProviderType;
  api_key: string;
  model: string;
  display_name?: string;
  parameters?: Record<string, any>;
  is_default?: boolean;
}

export interface UpdateProviderRequest {
  api_key?: string;
  model?: string;
  display_name?: string;
  parameters?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface TestProviderRequest {
  provider: AIProviderType;
  api_key: string;
  model: string;
}

export interface TestProviderResponse {
  valid: boolean;
  message: string;
  provider_name?: string;
}

export interface GenerateDescriptionRequest {
  diagram_code: string;
  diagram_type: string;
  provider?: AIProviderType;
  language?: string;
  regenerate?: boolean;
}

export interface GenerateDescriptionResponse {
  description: string;
  provider_used: AIProviderType;
  model_used: string;
  tokens_used?: number;
  generation_time?: number;
}

export interface GenerateDiagramRequest {
  description: string;
  diagram_type: string;
  provider?: AIProviderType;
  language?: string;
}

export interface GenerateDiagramResponse {
  diagram_code: string;
  provider_used: AIProviderType;
  model_used: string;
  generation_time?: number;
}

export interface ImproveDiagramRequest {
  diagram_code: string;
  improvement_request: string;
  diagram_type: string;
  provider?: AIProviderType;
  language?: string;
}

export interface ImproveDiagramResponse {
  diagram_code: string;
  original_code: string;
  improvement_applied: string;
  provider_used: AIProviderType;
  model_used: string;
  generation_time?: number;
}

export const AI_PROVIDER_NAMES: Record<AIProviderType, string> = {
  [AIProviderType.GEMINI]: 'Google Gemini',
  [AIProviderType.OPENAI]: 'OpenAI GPT',
  [AIProviderType.CLAUDE]: 'Anthropic Claude',
  [AIProviderType.DEEPSEEK]: 'DeepSeek'
};

export const AI_PROVIDER_MODELS: Record<AIProviderType, string[]> = {
  [AIProviderType.GEMINI]: [
    'gemini-3.0-pro',
    'gemini-3.0-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro'
  ],
  [AIProviderType.OPENAI]: [
  'gpt-4o',        // Balance potencia/costo (muy buena opción general)
  'gpt-4o-mini',   // Más barato y rápido
  'gpt-5',         // Más avanzado
  'gpt-5-mini',    // Balance moderno
  'gpt-5-nano'     // Ultra low cost / alta concurrencia
  ],
  [AIProviderType.CLAUDE]: [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-1-20250805',
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-opus-4-5-20251101'
  ],
  [AIProviderType.DEEPSEEK]: [
    'deepseek-chat',
    'deepseek-coder'
  ]
};

export const AI_PROVIDER_STATUS: Record<AIProviderType, 'available' | 'coming_soon'> = {
  [AIProviderType.GEMINI]: 'available',
  [AIProviderType.OPENAI]: 'available',
  [AIProviderType.CLAUDE]: 'available',
  [AIProviderType.DEEPSEEK]: 'available'
};

export const AI_PROVIDER_API_KEY_URLS: Record<AIProviderType, string> = {
  [AIProviderType.GEMINI]: 'https://aistudio.google.com/app/apikey',
  [AIProviderType.OPENAI]: 'https://platform.openai.com/api-keys',
  [AIProviderType.CLAUDE]: 'https://console.anthropic.com/settings/keys',
  [AIProviderType.DEEPSEEK]: 'https://platform.deepseek.com/api_keys'
};
