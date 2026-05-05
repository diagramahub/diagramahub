import { ReactNode, useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ content, children, position = 'top', delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  let timeoutId: ReturnType<typeof setTimeout>;

  const handleMouseEnter = () => {
    timeoutId = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;

        switch (position) {
          case 'right':
            top = rect.top + rect.height / 2;
            left = rect.right + 8;
            break;
          case 'left':
            top = rect.top + rect.height / 2;
            left = rect.left - 8;
            break;
          case 'top':
            top = rect.top - 8;
            left = rect.left + rect.width / 2;
            break;
          case 'bottom':
            top = rect.bottom + 8;
            left = rect.left + rect.width / 2;
            break;
        }

        setCoords({ top, left });
      }
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const getTransformClass = () => {
    switch (position) {
      case 'right':
        return 'translate-y-[-50%]';
      case 'left':
        return 'translate-x-[-100%] translate-y-[-50%]';
      case 'top':
        return 'translate-x-[-50%] translate-y-[-100%]';
      case 'bottom':
        return 'translate-x-[-50%]';
    }
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div
          className={`fixed z-[9999] pointer-events-none ${getTransformClass()}`}
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
