import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PremiumAvatar from './PremiumAvatar';

export default function UserMenu() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      onClick={() => navigate('/profile')}
      className="flex items-center hover:opacity-80 transition-opacity focus:outline-none"
      title={t('nav.myProfile')}
    >
      <PremiumAvatar size="sm" />
    </button>
  );
}
