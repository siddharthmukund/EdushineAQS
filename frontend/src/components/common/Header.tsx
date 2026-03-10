import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    FileSearch, Layers, GraduationCap, LayoutDashboard,
    Settings, LogOut, ShieldCheck, ChevronDown, Users, KeyRound,
} from 'lucide-react';
import { ApiKeySettingsModal } from './ApiKeySettingsModal';
import { ApiSetupWizard } from './ApiSetupWizard';
import { useAuthStore } from '../../stores/authStore';
import { authLogout } from '../../services/api';
import { useConfigStatus } from '../../hooks/useConfigStatus';

// Role badge color map
const ROLE_COLORS: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    committee_chair: 'bg-indigo-100 text-indigo-700',
    committee_member: 'bg-sky-100 text-sky-700',
    analyst: 'bg-teal-100 text-teal-700',
    observer: 'bg-gray-100 text-gray-600',
    viewer: 'bg-gray-100 text-gray-600',
    invited: 'bg-yellow-100 text-yellow-700',
};

function navClass({ isActive }: { isActive: boolean }) {
    return isActive
        ? 'border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium';
}

export const Header: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout: storeLogout, isAdmin } = useAuthStore();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showSetupWizard, setShowSetupWizard] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { anyConfigured, loading: configLoading, refresh: refreshConfig } = useConfigStatus();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = async () => {
        setMenuOpen(false);
        try {
            await authLogout();
        } catch { /* ignore errors */ }
        storeLogout();
        navigate('/login');
    };

    // Avatar initials
    const initials = user?.name
        ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    return (
        <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Logo + Nav */}
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <FileSearch className="h-8 w-8 text-blue-600" />
                            <span className="ml-2 text-xl font-bold tracking-tight text-gray-900">
                                AQS Analyzer
                            </span>
                        </div>
                        <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <NavLink to="/" className={navClass}>Single CV</NavLink>
                            {/* The following tabs require authentication */}
                            {isAuthenticated && (
                                <>
                                    <NavLink to="/batch" className={navClass}>
                                        <Layers className="w-4 h-4 mr-1" />Batch Analysis
                                    </NavLink>
                                    <NavLink to="/candidate" className={navClass}>
                                        <GraduationCap className="w-4 h-4 mr-1" />Candidates
                                    </NavLink>
                                    <NavLink to="/dashboard" className={navClass}>
                                        <LayoutDashboard className="w-4 h-4 mr-1" />Dashboard
                                    </NavLink>
                                </>
                            )}
                        </nav>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {/* LLM not-configured nudge — visible to all until setup is done */}
                        {!configLoading && !anyConfigured && (
                            <button
                                onClick={() => setShowSetupWizard(true)}
                                className="relative flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                                title="Configure LLM API key"
                            >
                                {/* Pulsing dot */}
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                </span>
                                <KeyRound className="w-3.5 h-3.5" />
                                Set up LLM
                            </button>
                        )}

                        {/* API key settings (legacy, only for authenticated users) */}
                        {isAuthenticated && (
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                title="API Key Settings"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        )}

                        {/* Guest CTAs — shown when not authenticated */}
                        {!isAuthenticated && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    Sign in
                                </button>
                                <button
                                    onClick={() => navigate('/register')}
                                    className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition-colors shadow-sm"
                                >
                                    Get Started
                                </button>
                            </div>
                        )}

                        {/* User menu (only shown when authenticated) */}
                        {isAuthenticated && user && (
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setMenuOpen(v => !v)}
                                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
                                >
                                    {/* Avatar circle */}
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                        {initials}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-sm font-medium text-gray-800 leading-tight">{user.name}</p>
                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                            {user.role.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown */}
                                {menuOpen && (
                                    <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                                        {/* User info header */}
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                        </div>

                                        {/* Settings */}
                                        <button
                                            onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            <Settings className="w-4 h-4 text-gray-400" />
                                            Profile &amp; Settings
                                        </button>

                                        {/* MFA indicator */}
                                        {user.mfa_enabled && (
                                            <div className="flex items-center gap-3 px-4 py-2 text-xs text-emerald-700">
                                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                                2FA active
                                            </div>
                                        )}

                                        {/* Admin panel — admin+ only */}
                                        {isAdmin() && (
                                            <button
                                                onClick={() => { setMenuOpen(false); navigate('/admin'); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                                <Users className="w-4 h-4 text-gray-400" />
                                                Admin Panel
                                            </button>
                                        )}

                                        <div className="border-t border-gray-100 mt-1" />

                                        {/* Logout */}
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ApiKeySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            {showSetupWizard && (
                <ApiSetupWizard
                    onClose={() => setShowSetupWizard(false)}
                    onConfigured={() => { refreshConfig(); }}
                />
            )}
        </header>
    );
};
