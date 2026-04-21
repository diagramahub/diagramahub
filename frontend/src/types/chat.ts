// Tipos TypeScript para el módulo de chat sessions

export type ChatMode = 'improvement' | 'conversation' | 'auto';
export type MessageRole = 'user' | 'assistant' | 'error';
export type ImprovementStatus = 'pending' | 'accepted' | 'rejected';
export type SessionStatus = 'active' | 'finalized';

export interface ChatSession {
  id: string;
  diagram_id: string;
  title: string;
  status: SessionStatus;
  parent_session_id?: string;
  last_provider?: string;
  last_model?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  mode: ChatMode;
  improved_code?: string;
  improvement_status?: ImprovementStatus;
  provider_used?: string;
  model_used?: string;
  generation_time?: number;
  created_at: string;
}

export interface ChatSessionWithMessages {
  session: ChatSession;
  messages: ChatMessage[];
}

// Request types
export interface CreateChatSessionRequest {
  diagram_id: string;
  title?: string;
}

export interface SendMessageRequest {
  content: string;
  mode: ChatMode;
  diagram_code: string;
  diagram_type: string;
  provider?: string;
  model?: string;
  language?: string;
}

export interface UpdateMessageStatusRequest {
  status: ImprovementStatus;
}

export interface UpdateSessionTitleRequest {
  title: string;
}

export interface UpdateSessionModelRequest {
  provider: string;
  model: string;
}
