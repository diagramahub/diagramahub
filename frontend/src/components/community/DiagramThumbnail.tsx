import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fitSvgToContainer } from '../../utils/fitSvg';
import { loadCommunitySvg } from './svgCache';

interface DiagramThumbnailProps {
  /** Cache key: changes when the content changes (id + updated_at). */
  cacheKey: string;
  content: string;
  diagramType: string;
  title: string;
  className?: string;
}

/**
 * A diagram rendered as a static preview. It renders only when it scrolls into
 * view (Kroki types go through the rate-limited /diagrams/render endpoint).
 */
export function DiagramThumbnail({ cacheKey, content, diagramType, title, className = '' }: DiagramThumbnailProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    let cancelled = false;
    const show = (svg: string | null) => {
      if (cancelled || !ref.current) return;
      if (svg === null) {
        setFailed(true);
        return;
      }
      ref.current.innerHTML = svg;
      fitSvgToContainer(ref.current);
    };
    loadCommunitySvg(cacheKey, content, diagramType).then(show);
    return () => {
      cancelled = true;
    };
  }, [visible, cacheKey, content, diagramType]);

  return (
    // Diagram canvases stay light, as in the editor.
    <div role="img" aria-label={title} className={`relative bg-white flex items-center justify-center overflow-hidden ${className}`}>
      <div ref={ref} className="w-full h-full flex items-center justify-center" />
      {failed && <span className="absolute text-xs text-amber-600">{t('community.previewError')}</span>}
    </div>
  );
}
