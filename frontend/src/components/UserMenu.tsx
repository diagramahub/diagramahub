import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
    <button
      onClick={() => navigate('/profile')}
      className="flex items-center hover:opacity-80 transition-opacity focus:outline-none"
      title={t('nav.myProfile')}
    >
      {user?.profile_picture ? (
        <img
          src={user.profile_picture}
          alt="Foto de perfil"
          className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
          {getUserInitials()}
        </div>
      )}
    </button>
  );
}
