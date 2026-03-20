import { ChatMode } from '../types/chat';

interface ChatModeSelectorProps {
  activeMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

export default function ChatModeSelector({ activeMode, onModeChange }: ChatModeSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
      <button
        type="button"
        onClick={() => onModeChange('improvement')}
        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
          activeMode === 'improvement'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Mejoras al diagrama
        </span>
      </button>
      <button
        type="button"
        onClick={() => onModeChange('conversation')}
        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
          activeMode === 'conversation'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Conversación
        </span>
      </button>
    </div>
  );
}
