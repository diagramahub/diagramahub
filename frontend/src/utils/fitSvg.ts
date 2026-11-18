/**
 * Make the first SVG inside `container` scale to fill it, keeping its aspect
 * ratio. Kroki and Mermaid SVGs come with a fixed size (width/height or an
 * inline max-width), so a large slide or frame would show them small.
 */
export function fitSvgToContainer(container: HTMLElement): void {
  const svg = container.querySelector('svg');
  if (!svg) return;
  if (!svg.getAttribute('viewBox')) {
    const width = parseFloat(svg.getAttribute('width') || '');
    const height = parseFloat(svg.getAttribute('height') || '');
    if (width > 0 && height > 0) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  if (!svg.getAttribute('viewBox')) return; // nothing to scale against
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.maxWidth = 'none';
  svg.style.width = '100%';
  svg.style.height = '100%';
}
