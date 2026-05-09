import { useRef, useCallback } from 'react';

interface BottomSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Called to close the sheet */
  onClose: () => void;
  /** Sheet title shown in the header bar */
  title?: string;
  /** Content inside the sheet */
  children: React.ReactNode;
  /** Height as a Tailwind class (default: h-[60vh] = 60% viewport height) */
  height?: string;
}

/**
 * Swipeable bottom sheet for mobile panels (code editor, description, file browser).
 *
 * - Drag the handle bar down to dismiss
 * - Backdrop tap to dismiss
 * - Animates in from the bottom
 */
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  height = 'h-[60vh]',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = currentY.current - startY.current;
    if (delta > 80) {
      // Swiped down far enough — close
      onClose();
    }
    // Reset transform
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`relative bg-white dark:bg-gray-800 rounded-t-2xl ${height} flex flex-col overflow-hidden animate-slide-up shadow-2xl`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {title}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>

      {/* Slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
