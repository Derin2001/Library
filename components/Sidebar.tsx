
import React from 'react';
import { View } from '../types';
import { DashboardIcon, UserAddIcon, BookOpenIcon, CheckCircleIcon, PlusCircleIcon, BookmarkIcon, CogIcon, CloseIcon } from './icons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  setView: (view: View) => void;
  currentView: View;
}

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <li
        onClick={onClick}
        className={`flex items-center p-3 rounded-lg cursor-pointer transition-all mx-2 ${
            isActive
                ? 'bg-indigo-600 text-white font-semibold shadow-lg'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
    >
        {icon}
        <span className="ml-3 font-medium">{label}</span>
    </li>
);

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, setView, currentView }) => {
    
    const handleSetView = (view: View) => {
        setView(view);
        onClose(); // Close sidebar on mobile after selection
    };

    return (
        <>
            <aside
                className={`fixed top-0 left-0 z-40 w-64 h-screen bg-slate-900 shadow-lg transform transition-transform ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0`}
            >
                <div className="flex items-center justify-between p-4 h-[65px] border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                        <BookOpenIcon className="h-8 w-8 text-indigo-400"/>
                        <h2 className="text-2xl font-bold text-white">Library ILS</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>
                <nav className="p-2 mt-2">
                    <ul className="space-y-2">
                        <NavItem icon={<DashboardIcon className="h-6 w-6" />} label="Dashboard" isActive={currentView === 'DASHBOARD'} onClick={() => handleSetView('DASHBOARD')} />
                        <NavItem icon={<UserAddIcon className="h-6 w-6" />} label="Add Member" isActive={currentView === 'ADD_MEMBER'} onClick={() => handleSetView('ADD_MEMBER')} />
                        <NavItem icon={<BookOpenIcon className="h-6 w-6" />} label="Checkout Book" isActive={currentView === 'CHECKOUT_BOOK'} onClick={() => handleSetView('CHECKOUT_BOOK')} />
                        <NavItem icon={<CheckCircleIcon className="h-6 w-6" />} label="Check-in Book" isActive={currentView === 'CHECKIN_BOOK'} onClick={() => handleSetView('CHECKIN_BOOK')} />
                        <NavItem icon={<PlusCircleIcon className="h-6 w-6" />} label="Add Books" isActive={currentView === 'ADD_BOOK'} onClick={() => handleSetView('ADD_BOOK')} />
                        <NavItem icon={<BookmarkIcon className="h-6 w-6" />} label="Reserve Book" isActive={currentView === 'RESERVE_BOOK'} onClick={() => handleSetView('RESERVE_BOOK')} />
                        <NavItem icon={<CogIcon className="h-6 w-6" />} label="Manage" isActive={currentView === 'MANAGE'} onClick={() => handleSetView('MANAGE')} />
                    </ul>
                </nav>
            </aside>
            {isOpen && <div onClick={onClose} className="fixed inset-0 bg-black opacity-50 z-30 lg:hidden"></div>}
        </>
    );
};

export default Sidebar;