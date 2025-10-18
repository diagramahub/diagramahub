import { useNavigate } from 'react-router-dom';
import UserMenu from './UserMenu';

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
              className="text-lg font-bold text-gray-900 hover:text-gray-600 transition-colors"
            >
              DiagramaHub
            </button>
          </div>

          {/* Right side - UserMenu con avatar */}
          <div className="flex items-center gap-3">
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
