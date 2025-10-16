import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Función para obtener las iniciales del usuario
  const getUserInitials = () => {
    if (user?.full_name) {
      const names = user.full_name.trim().split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0].substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-lg font-bold text-gray-900 hover:text-gray-600 transition-colors"
            >
              DiagramaHub
            </button>
          </div>

          {/* Right side - Avatar con iniciales */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                {getUserInitials()}
              </div>
              <span className="text-sm text-gray-700 font-medium">
                {user?.full_name || user?.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
