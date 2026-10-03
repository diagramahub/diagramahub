/**
 * Mermaid syntax check with the same `mermaid` build that renders the
 * diagrams (loaded on demand). The server can only do a structural check for
 * Mermaid, so the real validation of AI-generated code happens here.
 */
export async function mermaidSyntaxError(code: string): Promise<string | null> {
  try {
    const { default: mermaid } = await import('mermaid');
    await mermaid.parse(code);
    return null;
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? error);
    return message.split('\n').slice(0, 3).join(' ').trim().slice(0, 400) || 'Syntax error';
  }
}

/** The chat message that asks the model to fix code that doesn't render. */
export function autoFixRequest(code: string, error: string, language: 'es' | 'en'): string {
  return language === 'en'
    ? `🔧 Automatic fix: the diagram you generated doesn't render. Error: ${error}\n\nCode:\n\`\`\`mermaid\n${code}\n\`\`\`\n\nFix only what causes the error and return the complete diagram.`
    : `🔧 Corrección automática: el diagrama que generaste no se puede renderizar. Error: ${error}\n\nCódigo:\n\`\`\`mermaid\n${code}\n\`\`\`\n\nCorrige solo lo que causa el error y devuelve el diagrama completo.`;
}
