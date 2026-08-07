/**
 * TypeScript types for AI provider integration
 */

export enum AIProviderType {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  CLAUDE = 'claude',
  DEEPSEEK = 'deepseek',
  MINIMAX = 'minimax'
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

export interface RefineDescriptionRequest {
  diagram_code: string;
  diagram_type: string;
  current_description: string;
  refinement_request: string;
  provider?: AIProviderType;
  language?: string;
}

export interface RefineDescriptionResponse {
  description: string;
  provider_used: AIProviderType;
  model_used: string;
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
  [AIProviderType.DEEPSEEK]: 'DeepSeek',
  [AIProviderType.MINIMAX]: 'Minimax'
};

export interface ModelOption {
  id: string;
  recommended?: boolean;
}

export const AI_PROVIDER_MODELS: Record<AIProviderType, ModelOption[]> = {
  [AIProviderType.GEMINI]: [
    { id: 'gemini-3.1-pro-preview', recommended: true },
    { id: 'gemini-3-flash-preview' },
    { id: 'gemini-3.1-flash-lite-preview' },
    { id: 'gemini-2.5-flash' },
    { id: 'gemini-2.5-pro' },
  ],
  [AIProviderType.OPENAI]: [
    { id: 'gpt-4.1-mini', recommended: true },
    { id: 'gpt-4.1-nano' },
    { id: 'gpt-4.1' },
    { id: 'gpt-4o-mini' },
    { id: 'gpt-4o' },
    { id: 'gpt-5.4-mini' },
    { id: 'gpt-5.4-nano' },
    { id: 'gpt-5.4' },
  ],
  [AIProviderType.CLAUDE]: [
    { id: 'claude-haiku-4-5-20251001', recommended: true },
    { id: 'claude-sonnet-4-6' },
  ],
  [AIProviderType.DEEPSEEK]: [
    { id: 'deepseek-v4-flash', recommended: true },
    { id: 'deepseek-v4-pro' },
    { id: 'deepseek-chat' },
  ],
  [AIProviderType.MINIMAX]: [
    { id: 'MiniMax-M2.7', recommended: true },
    { id: 'MiniMax-M2.5' },
  ],
};

/** Helper: get the recommended (default) model for a provider */
export function getRecommendedModel(provider: AIProviderType): string {
  const models = AI_PROVIDER_MODELS[provider];
  const rec = models.find((m) => m.recommended);
  return rec ? rec.id : models[0].id;
}

/** Helper: check if a model is the recommended one */
export function isRecommendedModel(provider: AIProviderType, modelId: string): boolean {
  const models = AI_PROVIDER_MODELS[provider];
  const rec = models.find((m) => m.recommended);
  return rec?.id === modelId;
}

/**
 * Helper: get the effective model for a provider.
 * If the stored model has been retired (not in current list), falls back to recommended.
 */
export function getEffectiveModel(provider: AIProviderType, storedModel: string): string {
  const models = AI_PROVIDER_MODELS[provider];
  const exists = models.some((m) => m.id === storedModel);
  if (exists) return storedModel;
  // Model was retired — use recommended
  return getRecommendedModel(provider);
}

export const AI_PROVIDER_STATUS: Record<AIProviderType, 'available' | 'coming_soon'> = {
  [AIProviderType.GEMINI]: 'available',
  [AIProviderType.OPENAI]: 'available',
  [AIProviderType.CLAUDE]: 'available',
  [AIProviderType.DEEPSEEK]: 'available',
  [AIProviderType.MINIMAX]: 'available'
};

export const AI_PROVIDER_API_KEY_URLS: Record<AIProviderType, string> = {
  [AIProviderType.GEMINI]: 'https://aistudio.google.com/app/apikey',
  [AIProviderType.OPENAI]: 'https://platform.openai.com/api-keys',
  [AIProviderType.CLAUDE]: 'https://console.anthropic.com/settings/keys',
  [AIProviderType.DEEPSEEK]: 'https://platform.deepseek.com/api_keys',
  [AIProviderType.MINIMAX]: 'https://platform.minimax.io/user-center/basic-information'
};

// Types for diagram fix functionality

export interface FixDiagramRequest {
  error_context?: string;
  provider?: AIProviderType;
  language?: string;
}

export interface FixDiagramResponse {
  original_code: string;
  corrected_code: string;
  explanation: string;
  changes_summary: string;
  diff: string;
  provider_used: AIProviderType;
  model_used: string;
  generation_time: number;
  validation_passed: boolean;
}

export interface DiagramError {
  hasError: boolean;
  errorMessage: string;
  errorLine?: number;
  errorContext: string;
}

// Types for diagram type conversion

export interface ConvertDiagramRequest {
  diagram_code: string;
  source_type: string;
  target_type: string;
  provider?: AIProviderType;
  model?: string;
  language?: string;
}

export interface ConvertDiagramResponse {
  original_code: string;
  converted_code: string;
  source_type: string;
  target_type: string;
  provider_used: AIProviderType;
  model_used: string;
  generation_time: number;
  warning?: string;
}
