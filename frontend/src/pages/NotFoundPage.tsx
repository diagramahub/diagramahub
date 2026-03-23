import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BROKEN_DIAGRAM = `graph TD
    A[You] -->|typed a URL| B{Router}
    B -->|/dashboard| C[Dashboard ✅]
    B -->|/projects| D[Projects ✅]
    B -->|this page| E[??? 🤔]
    E -->|404| F[Lost in the nodes]
    style E fill:#fbbf24,stroke:#f59e0b,color:#000
    style F fill:#ef4444,stroke:#dc2626,color:#fff`;

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(15);
  const [glitchText, setGlitchText] = useState('404');

  // Countdown to redirect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  // Glitch effect on the 404 text
  useEffect(() => {
    const chars = '!@#$%^&*()_+{}|:<>?~`-=[];,./';
    const interval = setInterval(() => {
      const shouldGlitch = Math.random() > 0.7;
      if (shouldGlitch) {
        const glitched = '404'
          .split('')
          .map((c) => (Math.random() > 0.5 ? chars[Math.floor(Math.random() * chars.length)] : c))
          .join('');
        setGlitchText(glitched);
        setTimeout(() => setGlitchText('404'), 150);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background nodes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-lg border-2 border-purple-500/20 bg-purple-500/5"
            style={{
              width: `${60 + i * 20}px`,
              height: `${35 + i * 10}px`,
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 25}%`,
              animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
        {/* Connecting lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          <line x1="15%" y1="20%" x2="30%" y2="45%" stroke="#a855f7" strokeWidth="1" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
          </line>
          <line x1="40%" y1="30%" x2="60%" y2="55%" stroke="#a855f7" strokeWidth="1" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1.5s" repeatCount="indefinite" />
          </line>
          <line x1="70%" y1="20%" x2="85%" y2="50%" stroke="#a855f7" strokeWidth="1" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1.2s" repeatCount="indefinite" />
          </line>
        </svg>
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Glitchy 404 */}
        <h1
          className="text-[10rem] font-black leading-none bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent select-none"
          style={{ fontFamily: 'monospace' }}
          aria-label="Error 404"
        >
          {glitchText}
        </h1>

        {/* Broken diagram box */}
        <div className="mt-2 mb-8 mx-auto max-w-md bg-gray-800/60 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 shadow-2xl shadow-purple-500/10">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-500 text-xs ml-2 font-mono">diagrama_perdido.mmd</span>
          </div>
          <pre className="text-left text-xs text-purple-300/80 font-mono overflow-x-auto whitespace-pre leading-relaxed">
            {BROKEN_DIAGRAM}
          </pre>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Este nodo no existe en el diagrama
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Parece que seguiste una conexión rota. La página que buscas no existe, fue movida o nunca fue parte del flujo.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-purple-500/25 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Volver al Dashboard
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Regresar
          </button>
        </div>

        {/* Countdown */}
        <p className="mt-6 text-gray-500 text-sm">
          Redirigiendo al dashboard en <span className="text-purple-400 font-mono font-bold">{countdown}s</span>
        </p>
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          100% { transform: translateY(-20px) rotate(3deg); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
