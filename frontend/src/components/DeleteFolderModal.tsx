import React, { useState, useEffect } from 'react';

interface DeleteFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteDiagrams: boolean) => void | Promise<void>;
  folderName: string;
  diagramCount: number;
}

const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  folderName,
  diagramCount,
}) => {
  const [deleteDiagrams, setDeleteDiagrams] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsConfirming(false);
      setDeleteDiagrams(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(deleteDiagrams);
      onClose();
    } catch (error) {
      console.error('Error deleting folder:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 flex-1">Eliminar carpeta</h3>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-gray-600">
            ¿Estás seguro de que quieres eliminar la carpeta <span className="font-semibold">"{folderName}"</span>?
          </p>

          {diagramCount > 0 && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Esta carpeta contiene <span className="font-semibold">{diagramCount}</span> {diagramCount === 1 ? 'diagrama' : 'diagramas'}.
                </p>
              </div>

              {/* Option to delete diagrams */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteOption"
                    checked={!deleteDiagrams}
                    onChange={() => setDeleteDiagrams(false)}
                    className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Mover a la raíz</p>
                    <p className="text-xs text-gray-500">Los diagramas se moverán al nivel principal del proyecto</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteOption"
                    checked={deleteDiagrams}
                    onChange={() => setDeleteDiagrams(true)}
                    className="mt-1 w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Eliminar todos los diagramas</p>
                    <p className="text-xs text-gray-500">Se eliminarán permanentemente junto con la carpeta</p>
                  </div>
                </label>
              </div>
            </>
          )}

          {diagramCount === 0 && (
            <p className="text-sm text-gray-500">Esta carpeta está vacía.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isConfirming && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isConfirming ? 'Eliminando...' : 'Eliminar carpeta'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteFolderModal;
