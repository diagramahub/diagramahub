import { useState, FormEvent } from 'react';

interface AccessCodeFormProps {
  onSubmit: (code: string) => void;
  error: string | null;
  attemptsRemaining: number | null;
  loading: boolean;
}

export default function AccessCodeForm({
  onSubmit,
  error,
  attemptsRemaining,
  loading,
}: AccessCodeFormProps) {
  const [code, setCode] = useState('');

  const isBlocked = attemptsRemaining !== null && attemptsRemaining <= 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading || isBlocked) return;
    onSubmit(code.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 text-center mb-2">
            Diagrama protegido
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Ingresa el código de acceso para ver este diagrama
          </p>

          {isBlocked ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm font-medium text-red-700">
                Demasiados intentos fallidos
              </p>
              <p className="text-xs text-red-500 mt-1">
                Intenta de nuevo en 15 minutos
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="access-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Código de acceso
                </label>
                <input
                  id="access-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ingresa el código"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg tracking-widest font-mono focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors"
                  autoFocus
                  disabled={loading}
                  maxLength={20}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600 text-center">{error}</p>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <p className="text-xs text-red-400 text-center mt-1">
                      Intentos restantes: {attemptsRemaining}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!code.trim() || loading}
                className="w-full py-3 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  'Verificar código'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
