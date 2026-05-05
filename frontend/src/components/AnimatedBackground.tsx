/**
 * Fondo animado con formas flotantes en degradados rosa/púrpura.
 * Diseñado para pantallas de autenticación (login, register, etc.)
 * para transmitir una estética moderna con toque de IA.
 */
import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Blob 1 — grande, arriba-izquierda */}
      <div
        className="absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full opacity-40 dark:opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #c084fc 0%, #a855f7 40%, transparent 70%)',
          animation: 'float-1 10s ease-in-out infinite',
        }}
      />

      {/* Blob 2 — mediano, derecha */}
      <div
        className="absolute top-1/4 -right-20 w-[600px] h-[600px] rounded-full opacity-35 dark:opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #f0abfc 0%, #e879f9 40%, transparent 70%)',
          animation: 'float-2 13s ease-in-out infinite',
        }}
      />

      {/* Blob 3 — centro-abajo */}
      <div
        className="absolute bottom-10 left-1/3 w-[500px] h-[500px] rounded-full opacity-30 dark:opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #d8b4fe 0%, #c084fc 40%, transparent 70%)',
          animation: 'float-3 8s ease-in-out infinite',
        }}
      />

      {/* Blob 4 — arriba-derecha */}
      <div
        className="absolute -top-10 right-1/4 w-[450px] h-[450px] rounded-full opacity-30 dark:opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #f9a8d4 0%, #f472b6 40%, transparent 70%)',
          animation: 'float-4 11s ease-in-out infinite',
        }}
      />

      {/* Blob 5 — abajo-izquierda */}
      <div
        className="absolute -bottom-20 -left-10 w-[550px] h-[550px] rounded-full opacity-25 dark:opacity-10 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #e9d5ff 0%, #a78bfa 40%, transparent 70%)',
          animation: 'float-5 14s ease-in-out infinite',
        }}
      />

      {/* Sutil grid de puntos para textura AI */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #7c3aed 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
