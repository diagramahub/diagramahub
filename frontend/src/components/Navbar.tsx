import { useNavigate } from 'react-router-dom';
import UserMenu from './UserMenu';
import LanguageSelector from './LanguageSelector';
import UsageBadge from './UsageBadge';

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-lg font-bold transition-opacity hover:opacity-80"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7, #9333ea)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              DiagramaHub
            </button>
          </div>

          {/* Right side - Usage badge, Language selector and UserMenu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <UsageBadge />
            </div>
            <LanguageSelector />
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
