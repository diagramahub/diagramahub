import { useNavigate } from 'react-router-dom';
import UserMenu from './UserMenu';
import LanguageSelector from './LanguageSelector';
import UsageBadge from './UsageBadge';
import { BrandLogo } from './BrandLogo';

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              aria-label="DiagramaHub"
            >
              <BrandLogo />
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
