import React from 'react';
import { NavLink } from 'react-router-dom';
import { FileSearch, Layers } from 'lucide-react';

export const Header: React.FC = () => {
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
                        </nav>
                    </div>
                    <div className="flex items-center">
                        {/* Future auth/user info placeholder */}
                    </div>
                </div>
            </div>
        </header>
    );
};
