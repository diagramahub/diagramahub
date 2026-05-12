/**
 * TypeScript types for AI chat streaming via Server-Sent Events.
 */

/** SSE event: a text chunk from the AI provider. */
export interface SSETokenEvent {
  type: 'token';
  content: string;
}

/** SSE event: response mode indicator (emitted early). */
export interface SSEModeEvent {
  type: 'mode';
  /** "text" = show content progressively; "code" = hide content, show only phases. */
  mode: 'text' | 'code';
}

/** SSE event: generation phase indicator label. */
export interface SSEPhaseEvent {
  type: 'phase';
  phase: string;
}

/** SSE event: stream completed successfully with message metadata. */
export interface SSEDoneEvent {
  type: 'done';
  message_id: string;
  improved_code?: string;
  provider_used: string;
  model_used: string;
  generation_time: number;
  /** Chain-of-thought content from reasoning models (e.g., DeepSeek). */
  thinking_content?: string;
}

/** SSE event: an error occurred during streaming. */
export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

/** Union of all possible SSE event types. */
export type SSEEvent = SSETokenEvent | SSEModeEvent | SSEPhaseEvent | SSEDoneEvent | SSEErrorEvent;

/** Callbacks for the stream consumer to notify the UI of events. */
export interface StreamCallbacks {
  onToken: (content: string) => void;
  onMode: (mode: 'text' | 'code') => void;
  onPhase: (phase: string) => void;
  onDone: (event: SSEDoneEvent) => void;
  onError: (message: string) => void;
}

/** State managed by the AIChatPanel during streaming. */
export interface StreamingState {
  isStreaming: boolean;
  accumulatedText: string;
  currentPhase: string | null;
  diagramCode: string | null;
  error: string | null;
  retryCount: number;
  /** True when diagram markers are detected (code is being generated). */
  isDiagramGenerating: boolean;
}

/** Request body for the streaming endpoint (mirrors SendMessageRequest). */
export interface SendMessageStreamRequest {
  content: string;
  diagram_code: string;
  diagram_type: string;
  provider?: string;
  model?: string;
  language: string;
}
