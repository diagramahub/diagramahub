import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import Navbar from '../components/Navbar';

// Lista de zonas horarias comunes
const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Cancun', label: 'Cancún (GMT-5)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT-8)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'Denver (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'Europe/London', label: 'Londres (GMT+0)' },
  { value: 'Europe/Paris', label: 'París (GMT+1)' },
  { value: 'Europe/Berlin', label: 'Berlín (GMT+1)' },
  { value: 'Asia/Tokyo', label: 'Tokio (GMT+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghái (GMT+8)' },
  { value: 'Asia/Dubai', label: 'Dubái (GMT+4)' },
  { value: 'Australia/Sydney', label: 'Sídney (GMT+11)' },
  { value: 'UTC', label: 'UTC (Hora Universal)' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Estados para edición de perfil
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState<string | undefined>(user?.profile_picture);
  const [imagePreview, setImagePreview] = useState<string | undefined>(user?.profile_picture);
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');

  // Estados para cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados de UI
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Obtener iniciales para el avatar
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

  // Manejar selección de imagen
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen debe ser menor a 2MB');
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfilePicture(base64String);
      setImagePreview(base64String);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  // Eliminar foto de perfil
  const handleRemoveImage = () => {
    setProfilePicture(undefined);
    setImagePreview(undefined);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updatedUser = await apiService.updateProfile({
        full_name: fullName,
        profile_picture: profilePicture,
        timezone: timezone
      });

      // Actualizar usuario en localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setSuccess('Perfil actualizado exitosamente');
      setIsEditingProfile(false);

      // Recargar página para reflejar cambios en toda la aplicación
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Todos los campos son obligatorios');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      await apiService.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess('Contraseña actualizada exitosamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestiona tu información personal y configuración de seguridad
          </p>
        </div>

        {/* Mensajes de éxito o error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Información del Perfil */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Información Personal</h2>
            {!isEditingProfile && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Editar
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            {!isEditingProfile ? (
              <div className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Foto de perfil"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                      {getUserInitials()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">Foto de Perfil</p>
                    <p className="text-xs text-gray-500">JPG, PNG o GIF (máx. 2MB)</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Nombre Completo</label>
                  <p className="mt-1 text-gray-900">{user?.full_name || 'No especificado'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Correo Electrónico</label>
                  <p className="mt-1 text-gray-900">{user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Zona Horaria</label>
                  <p className="mt-1 text-gray-900">
                    {TIMEZONES.find(tz => tz.value === user?.timezone)?.label || 'UTC (Hora Universal)'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Miembro desde</label>
                  <p className="mt-1 text-gray-900">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Upload de foto de perfil */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Foto de Perfil
                  </label>
                  <div className="flex items-center gap-6">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                        {getUserInitials()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex gap-3">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                          <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                            Subir foto
                          </span>
                        </label>
                        {imagePreview && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-600 bg-white hover:bg-red-50 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        JPG, PNG o GIF. Máximo 2MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tu nombre completo"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500">El correo electrónico no se puede cambiar</p>
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                    Zona Horaria
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Esta zona horaria se usará para mostrar fechas y horas</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setFullName(user?.full_name || '');
                      setEmail(user?.email || '');
                      setProfilePicture(user?.profile_picture);
                      setImagePreview(user?.profile_picture);
                      setTimezone(user?.timezone || 'UTC');
                      setError('');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Seguridad - Cambiar Contraseña */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Seguridad</h2>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Cambiar Contraseña
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            {!isChangingPassword ? (
              <div>
                <p className="text-sm text-gray-600">
                  Mantén tu cuenta segura actualizando tu contraseña regularmente.
                </p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña Actual
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Nueva Contraseña
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setError('');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
