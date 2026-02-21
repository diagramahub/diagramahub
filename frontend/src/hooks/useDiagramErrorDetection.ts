/**
 * Hook para detectar errores de renderizado en diagramas Mermaid y PlantUML
 */
import { useState, useEffect } from 'react';
import { DiagramError } from '../types/ai';
import mermaid from 'mermaid';

export function useDiagramErrorDetection(
  diagramCode: string,
  diagramType: string
): DiagramError {
  const [error, setError] = useState<DiagramError>({
    hasError: false,
    errorMessage: '',
    errorContext: ''
  });

  useEffect(() => {
    // Reset error state when diagram code changes
    setError({
      hasError: false,
      errorMessage: '',
      errorContext: ''
    });

    // Skip validation if code is empty
    if (!diagramCode || !diagramCode.trim()) {
      return;
    }

    // Validate based on diagram type
    const diagramTypeLower = diagramType.toLowerCase();
    
    if (diagramTypeLower.includes('plantuml') || diagramTypeLower === 'uml') {
      validatePlantUML(diagramCode);
    } else {
      // Default to Mermaid validation with actual parsing
      validateMermaidWithParser(diagramCode);
    }
  }, [diagramCode, diagramType]);

  const validateMermaidWithParser = async (code: string) => {
    try {
      // First do basic syntax checks
      const lines = code.trim().split('\n');
      
      // Check for valid diagram type
      const validTypes = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
        'stateDiagram', 'stateDiagram-v2', 'erDiagram', 'gantt',
        'pie', 'journey', 'gitGraph', 'mindmap', 'timeline',
        'quadrantChart', 'requirementDiagram', 'C4Context'
      ];
      
      // Find first non-comment line
      let firstLine = '';
      for (const line of lines) {
        const cleanLine = line.replace(/%%.*$/, '').trim();
        if (cleanLine) {
          firstLine = cleanLine;
          break;
        }
      }
      
      if (!firstLine) {
        setError({
          hasError: true,
          errorMessage: 'El diagrama está vacío o solo contiene comentarios',
          errorContext: 'El diagrama está vacío o solo contiene comentarios',
          errorLine: 1
        });
        return;
      }
      
      // Check if starts with valid type
      const hasValidType = validTypes.some(type => firstLine.startsWith(type));
      
      if (!hasValidType) {
        setError({
          hasError: true,
          errorMessage: `Tipo de diagrama no reconocido: "${firstLine}"`,
          errorContext: `Tipo de diagrama no reconocido: "${firstLine}". Debe comenzar con uno de: ${validTypes.join(', ')}`,
          errorLine: 1
        });
        return;
      }
      
      // Try to parse with Mermaid to catch syntax errors
      try {
        const id = `mermaid-validation-${Date.now()}`;
        await mermaid.parse(code, { suppressErrors: false });
        
        // If parse succeeds, no error
        setError({
          hasError: false,
          errorMessage: '',
          errorContext: ''
        });
      } catch (parseError: any) {
        // Extract error message
        const errorMessage = parseError.message || parseError.toString();
        
        // Try to extract line number if available
        const lineMatch = errorMessage.match(/line (\d+)/i);
        const errorLine = lineMatch ? parseInt(lineMatch[1]) : undefined;
        
        setError({
          hasError: true,
          errorMessage: errorMessage,
          errorContext: errorMessage,
          errorLine: errorLine
        });
      }
      
    } catch (e) {
      setError({
        hasError: true,
        errorMessage: 'Error al validar sintaxis de Mermaid',
        errorContext: `Error al validar sintaxis: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  };

  const validateMermaid = (code: string) => {
    try {
      const lines = code.trim().split('\n');
      
      // Check for valid diagram type
      const validTypes = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
        'stateDiagram', 'stateDiagram-v2', 'erDiagram', 'gantt',
        'pie', 'journey', 'gitGraph', 'mindmap', 'timeline',
        'quadrantChart', 'requirementDiagram', 'C4Context'
      ];
      
      // Find first non-comment line
      let firstLine = '';
      for (const line of lines) {
        const cleanLine = line.replace(/%%.*$/, '').trim();
        if (cleanLine) {
          firstLine = cleanLine;
          break;
        }
      }
      
      if (!firstLine) {
        setError({
          hasError: true,
          errorMessage: 'El diagrama está vacío o solo contiene comentarios',
          errorContext: 'El diagrama está vacío o solo contiene comentarios',
          errorLine: 1
        });
        return;
      }
      
      // Check if starts with valid type
      const hasValidType = validTypes.some(type => firstLine.startsWith(type));
      
      if (!hasValidType) {
        setError({
          hasError: true,
          errorMessage: `Tipo de diagrama no reconocido: "${firstLine}"`,
          errorContext: `Tipo de diagrama no reconocido: "${firstLine}". Debe comenzar con uno de: ${validTypes.join(', ')}`,
          errorLine: 1
        });
        return;
      }
      
      // Check for balanced subgraphs
      let subgraphCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/%%.*$/, '').trim();
        
        if (line.toLowerCase().includes('subgraph')) {
          subgraphCount++;
        }
        if (line.toLowerCase() === 'end') {
          subgraphCount--;
        }
        
        if (subgraphCount < 0) {
          setError({
            hasError: true,
            errorMessage: "'end' sin 'subgraph' correspondiente",
            errorContext: `'end' sin 'subgraph' correspondiente en línea ${i + 1}`,
            errorLine: i + 1
          });
          return;
        }
      }
      
      if (subgraphCount > 0) {
        setError({
          hasError: true,
          errorMessage: `${subgraphCount} subgraph(s) sin cerrar`,
          errorContext: `${subgraphCount} subgraph(s) sin cerrar (falta 'end')`,
        });
        return;
      }
      
      // If we get here, no errors detected
      setError({
        hasError: false,
        errorMessage: '',
        errorContext: ''
      });
      
    } catch (e) {
      setError({
        hasError: true,
        errorMessage: 'Error al validar sintaxis de Mermaid',
        errorContext: `Error al validar sintaxis: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  };

  const validatePlantUML = (code: string) => {
    try {
      const trimmedCode = code.trim();
      
      // Check for @startuml (case insensitive but exact spelling)
      const hasStartUml = /@startuml/i.test(trimmedCode);
      const hasTypo = /@stat[uo]ml/i.test(trimmedCode) && !hasStartUml;
      
      if (hasTypo) {
        setError({
          hasError: true,
          errorMessage: 'Error de escritura en @startuml',
          errorContext: 'Parece que hay un error de escritura. Debe ser @startuml (no @statuml)',
          errorLine: 1
        });
        return;
      }
      
      if (!hasStartUml) {
        setError({
          hasError: true,
          errorMessage: 'Falta @startuml',
          errorContext: 'Falta la etiqueta @startuml al inicio del diagrama',
          errorLine: 1
        });
        return;
      }
      
      // Check for @enduml
      if (!/@enduml/i.test(trimmedCode)) {
        setError({
          hasError: true,
          errorMessage: 'Falta @enduml',
          errorContext: 'Falta la etiqueta @enduml al final del diagrama'
        });
        return;
      }
      
      // Check order
      const startPos = trimmedCode.search(/@startuml/i);
      const endPos = trimmedCode.search(/@enduml/i);
      
      if (startPos > endPos) {
        setError({
          hasError: true,
          errorMessage: '@enduml aparece antes de @startuml',
          errorContext: '@enduml aparece antes de @startuml'
        });
        return;
      }
      
      // Check for balanced braces
      const lines = code.split('\n');
      let braceCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip comments
        if (line.startsWith("'") || line.startsWith("/'")) {
          continue;
        }
        
        // Count braces
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          
          if (braceCount < 0) {
            setError({
              hasError: true,
              errorMessage: "'}' sin bloque correspondiente",
              errorContext: `'}' sin bloque correspondiente en línea ${i + 1}`,
              errorLine: i + 1
            });
            return;
          }
        }
      }
      
      if (braceCount > 0) {
        setError({
          hasError: true,
          errorMessage: `${braceCount} bloque(s) sin cerrar`,
          errorContext: `${braceCount} bloque(s) sin cerrar (falta '}')`
        });
        return;
      }
      
      // If we get here, no errors detected
      setError({
        hasError: false,
        errorMessage: '',
        errorContext: ''
      });
      
    } catch (e) {
      setError({
        hasError: true,
        errorMessage: 'Error al validar sintaxis de PlantUML',
        errorContext: `Error al validar sintaxis: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  };

  return error;
}
