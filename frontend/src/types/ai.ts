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
    'gemini-2.0-flash-lite',
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest'
  ],
  [AIProviderType.OPENAI]: [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ],
  [AIProviderType.CLAUDE]: [
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku'
  ],
  [AIProviderType.DEEPSEEK]: [
    'deepseek-chat',
    'deepseek-coder'
  ]
};

export const AI_PROVIDER_STATUS: Record<AIProviderType, 'available' | 'coming_soon'> = {
  [AIProviderType.GEMINI]: 'available',
  [AIProviderType.OPENAI]: 'coming_soon',
  [AIProviderType.CLAUDE]: 'coming_soon',
  [AIProviderType.DEEPSEEK]: 'coming_soon'
};
