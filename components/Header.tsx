
import React from 'react';
import { MenuIcon } from './icons';

interface HeaderProps {
  toggleSidebar: () => void;
  onSignOut: () => void;
  userName?: string;
  role?: 'LIBRARIAN' | 'MEMBER' | null;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, onSignOut, userName = "Librarian", role = "LIBRARIAN" }) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between sticky top-0 z-30 h-[65px]">
      <div className="flex items-center">
        {role === 'LIBRARIAN' && (
            <button onClick={toggleSidebar} className="text-slate-600 dark:text-slate-300 lg:hidden mr-4">
            <MenuIcon className="h-6 w-6" />
            </button>
        )}
        <h1 className="text-xl font-semibold text-slate-800 dark:text-white">MAHSS Library</h1>
      </div>
      <div className="flex items-center">
        <span className="text-sm text-slate-600 dark:text-slate-400 mr-4">Welcome, {userName}</span>
         <button
            onClick={onSignOut}
            className="px-3 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
            Sign Out
        </button>
      </div>
    </header>
  );
};

export default Header;
