/**
 * SVG export utility.
 *
 * Serializes a rendered diagram's <svg> element into a standalone, downloadable
 * .svg file. Unlike PNG/PDF exports, this produces a clean scalable vector with
 * no metadata header — the format developers expect for embedding in docs,
 * READMEs, or further editing.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

export class SvgExporter {
  /**
   * Serialize the given SVG element and trigger a download as a `.svg` file.
   *
   * The element is cloned (so the live DOM is untouched), namespaces and explicit
   * dimensions are ensured for standalone viewing, and Mermaid/Kroki embedded
   * <style> blocks are preserved via the clone.
   *
   * @param svgElement - The rendered diagram SVG element (e.g. from the preview)
   * @param diagramName - Used to build the download filename
   * @throws Error with key 'export.error.svgFailed' when no SVG is available
   */
  export(svgElement: SVGElement | null, diagramName?: string): void {
    if (!svgElement) {
      throw new Error('export.error.svgFailed');
    }

    const clone = svgElement.cloneNode(true) as SVGElement;

    // Ensure required namespaces so the file renders standalone in any viewer
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', SVG_NS);
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', XLINK_NS);
    }

    // Ensure explicit width/height so the SVG doesn't collapse to 0×0 when
    // opened on its own (some Mermaid/Kroki outputs rely on viewBox + CSS only).
    const rect = svgElement.getBoundingClientRect();
    if (!clone.getAttribute('width') && rect.width) {
      clone.setAttribute('width', String(Math.round(rect.width)));
    }
    if (!clone.getAttribute('height') && rect.height) {
      clone.setAttribute('height', String(Math.round(rect.height)));
    }

    const serialized = new XMLSerializer().serializeToString(clone);
    const svgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${serialized}`;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = this.buildFilename(diagramName);
      link.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private buildFilename(diagramName?: string): string {
    const name = diagramName?.trim() || 'diagram';
    return `${name.replace(/\s+/g, '_')}.svg`;
  }
}
