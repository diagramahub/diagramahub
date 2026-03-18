/**
 * Botón para corregir diagramas con errores usando IA
 */
import React, { useState } from 'react';
import { FixDiagramResponse } from '../types/ai';
import apiService from '../services/api';

interface FixDiagramButtonProps {
  diagramId: string;
  errorContext: string;
  onFixSuccess: (response: FixDiagramResponse) => void;
  onFixError: (error: string) => void;
}

export const FixDiagramButton: React.FC<FixDiagramButtonProps> = ({
  diagramId,
  errorContext,
  onFixSuccess,
  onFixError
}) => {
  const [isFixing, setIsFixing] = useState(false);

  const handleFix = async () => {
    setIsFixing(true);
    
    try {
      const response = await apiService.fixDiagram(diagramId, {
        error_context: errorContext,
        language: 'es'
      });
      
      onFixSuccess(response);
    } catch (error: any) {
      let errorMessage = 'Error al corregir el diagrama';
      
      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || error.message;
        
        switch (status) {
          case 401:
            errorMessage = 'No estás autenticado. Por favor inicia sesión.';
            break;
          case 403:
            errorMessage = 'No tienes permisos para corregir este diagrama.';
            break;
          case 404:
            errorMessage = 'Diagrama no encontrado.';
            break;
          case 408:
            errorMessage = 'La corrección tomó demasiado tiempo. Por favor intenta de nuevo.';
            break;
          case 422:
            errorMessage = `El código corregido no es válido: ${detail}`;
            break;
          case 429:
            errorMessage = 'Límite de solicitudes excedido. Por favor intenta de nuevo en unos momentos.';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = `Error del servidor: ${detail}`;
            break;
          default:
            errorMessage = detail || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      onFixError(errorMessage);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <button
      onClick={handleFix}
      disabled={isFixing}
      data-fix-diagram-trigger="true"
      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white btn-glass rounded-lg transition-colors duration-200 font-medium text-sm shadow-sm"
      title="Corregir diagrama con IA"
    >
      {isFixing ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Corrigiendo...</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Corregir con IA</span>
        </>
      )}
    </button>
  );
};
