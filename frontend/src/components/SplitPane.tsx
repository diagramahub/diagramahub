import { useState, useCallback, useRef, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number;
  minLeft?: number;
  minRight?: number;
}

export default function SplitPane({
  left,
  right,
  defaultSplit = 50,
  minLeft = 300,
  minRight = 300,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState(defaultSplit);
  const isResizing = useRef(false);

  // Clamp split percentage based on min widths whenever the container resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const containerWidth = container.offsetWidth;
      if (containerWidth === 0) return;

      const minLeftPercent = (minLeft / containerWidth) * 100;
      const maxLeftPercent = 100 - (minRight / containerWidth) * 100;

      setSplitPercent((prev) => Math.min(Math.max(prev, minLeftPercent), maxLeftPercent));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [minLeft, minRight]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;

      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;

        const offsetX = e.clientX - containerRect.left;
        let newPercent = (offsetX / containerWidth) * 100;

        // Enforce min widths
        const minLeftPercent = (minLeft / containerWidth) * 100;
        const maxLeftPercent = 100 - (minRight / containerWidth) * 100;
        newPercent = Math.min(Math.max(newPercent, minLeftPercent), maxLeftPercent);

        setSplitPercent(newPercent);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [minLeft, minRight]
  );

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div
        className="h-full overflow-hidden flex-shrink-0"
        style={{ width: `${splitPercent}%` }}
      >
        {left}
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={handleMouseDown}
        className="relative flex-shrink-0 w-1.5 cursor-col-resize group"
        role="separator"
        aria-label="Resize panels"
        aria-valuenow={Math.round(splitPercent)}
      >
        {/* Visible bar */}
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 group-hover:bg-purple-300 group-active:bg-purple-400 dark:group-hover:bg-purple-600 dark:group-active:bg-purple-500 transition-colors" />
        {/* Grip indicator (three dots) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
          <span className="block w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-purple-500 dark:group-hover:bg-purple-300 transition-colors" />
          <span className="block w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-purple-500 dark:group-hover:bg-purple-300 transition-colors" />
          <span className="block w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-purple-500 dark:group-hover:bg-purple-300 transition-colors" />
        </div>
      </div>

      {/* Right panel */}
      <div className="h-full overflow-hidden flex-1 min-w-0">
        {right}
      </div>
    </div>
  );
}
