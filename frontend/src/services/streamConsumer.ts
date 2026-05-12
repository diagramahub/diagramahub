/**
 * Stream consumer for AI chat SSE responses.
 *
 * Connects to the streaming endpoint using the Fetch API with ReadableStream,
 * parses SSE events, and routes them to the provided callbacks.
 */
import type { SSEEvent, StreamCallbacks, SendMessageStreamRequest } from '../types/streaming';

/**
 * Create a stream consumer that connects to the SSE endpoint and processes events.
 *
 * @param sessionId - The chat session ID
 * @param body - The message request body
 * @param callbacks - Event handlers for token, phase, done, and error events
 * @returns An AbortController that can be used to cancel the stream
 */
export function createStreamConsumer(
  sessionId: string,
  body: SendMessageStreamRequest,
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController();
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5172';

  const url = `${apiUrl}/api/v1/chat-sessions/${sessionId}/messages/stream`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        let errorText: string;
        try {
          const errorJson = await response.json();
          errorText = errorJson.detail || errorJson.message || response.statusText;
        } catch {
          errorText = await response.text() || response.statusText;
        }
        callbacks.onError(errorText);
        return;
      }

      if (!response.body) {
        callbacks.onError('Stream response has no body');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newline (SSE event separator)
        const parts = buffer.split('\n');
        // Keep the last incomplete part in the buffer
        buffer = parts.pop() || '';

        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          if (!jsonStr) continue;

          try {
            const event: SSEEvent = JSON.parse(jsonStr);
            switch (event.type) {
              case 'token':
                callbacks.onToken(event.content);
                break;
              case 'mode':
                callbacks.onMode(event.mode);
                break;
              case 'phase':
                callbacks.onPhase(event.phase);
                break;
              case 'done':
                callbacks.onDone(event);
                break;
              case 'error':
                callbacks.onError(event.message);
                break;
            }
          } catch {
            // Skip malformed JSON events
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6);
        try {
          const event: SSEEvent = JSON.parse(jsonStr);
          switch (event.type) {
            case 'token':
              callbacks.onToken(event.content);
              break;
            case 'mode':
              callbacks.onMode(event.mode);
              break;
            case 'phase':
              callbacks.onPhase(event.phase);
              break;
            case 'done':
              callbacks.onDone(event);
              break;
            case 'error':
              callbacks.onError(event.message);
              break;
          }
        } catch {
          // Skip malformed final event
        }
      }
    })
    .catch((err: Error) => {
      // AbortError is expected when the user cancels — don't report it
      if (err.name === 'AbortError') return;
      callbacks.onError('Network error: connection interrupted');
    });

  return controller;
}
