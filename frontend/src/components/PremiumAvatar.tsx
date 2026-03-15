import { useAuth } from '../contexts/AuthContext';

interface PremiumAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPremiumBadge?: boolean;
  className?: string;
}

export default function PremiumAvatar({ 
  size = 'md', 
  showPremiumBadge = false,
  className = '' 
}: PremiumAvatarProps) {
  const { user } = useAuth();

  // Determinar si el usuario tiene un plan de paga
  const isPremium = (user?.subscription?.plan?.price_usd ?? 0) > 0;

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

  // Tamaños del avatar
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl'
  };

  // Tamaños del borde premium
  const borderSizes = {
    sm: 'p-0.5',
    md: 'p-0.5',
    lg: 'p-1',
    xl: 'p-1'
  };

  // Tamaños del badge
  const badgeSizes = {
    sm: 'w-3 h-3 -bottom-0.5 -right-0.5',
    md: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
    lg: 'w-5 h-5 -bottom-1 -right-1',
    xl: 'w-6 h-6 -bottom-1 -right-1'
  };

  const avatarContent = user?.profile_picture ? (
    <img
      src={user.profile_picture}
      alt="Foto de perfil"
      className={`${sizeClasses[size]} rounded-full object-cover`}
    />
  ) : (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold`}>
      {getUserInitials()}
    </div>
  );

  if (isPremium) {
    return (
      <div className={`relative inline-block ${className}`}>
        {/* Contenedor con gradiente dorado */}
        <div className={`${borderSizes[size]} rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg`}>
          <div className="rounded-full bg-white p-0.5">
            {avatarContent}
          </div>
        </div>
        
        {/* Badge premium opcional */}
        {showPremiumBadge && (
          <div className={`absolute ${badgeSizes[size]} bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center border-2 border-white shadow-md`}>
            <svg className="w-full h-full p-0.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  // Usuario con plan gratuito - avatar normal
  return (
    <div className={`relative inline-block ${className}`}>
      {avatarContent}
    </div>
  );
}
