import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FileSearch, Layers, GraduationCap, Store, LayoutDashboard, Settings } from 'lucide-react';
import { ApiKeySettingsModal } from './ApiKeySettingsModal';

export const Header: React.FC = () => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    return (
        <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <FileSearch className="h-8 w-8 text-blue-600" />
                            <span className="ml-2 text-xl font-bold tracking-tight text-gray-900">
                                AQS Analyzer
                            </span>
                        </div>
                        <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <NavLink
                                to="/"
                                className={({ isActive }) =>
                                    isActive
                                        ? 'border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                }
                            >
                                Single CV
                            </NavLink>
                            <NavLink
                                to="/batch"
                                className={({ isActive }) =>
                                    isActive
                                        ? 'border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                }
                            >
                                <Layers className="w-4 h-4 mr-1" />
                                Batch Analysis
                            </NavLink>
                            <NavLink
                                to="/candidate"
                                className={({ isActive }) =>
                                    isActive
                                        ? 'border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                }
                            >
                                <GraduationCap className="w-4 h-4 mr-1" />
                                Candidates
                            </NavLink>
                            <NavLink
                                to="/marketplace"
                                className={({ isActive }) =>
                                    isActive
                                        ? 'border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                }
                            >
                                <Store className="w-4 h-4 mr-1" />
                                Marketplace
                            </NavLink>
                            <NavLink
                                to="/dashboard"
                                className={({ isActive }) =>
                                    isActive
                                        ? 'border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                                }
                            >
                                <LayoutDashboard className="w-4 h-4 mr-1" />
                                Dashboard
                            </NavLink>
                        </nav>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            title="API Key Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        {/* Future auth/user info placeholder */}
                    </div>
                </div>
            </div>

            <ApiKeySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </header>
    );
};
