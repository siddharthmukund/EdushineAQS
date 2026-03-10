/**
 * GuestTrialModal — shown to unauthenticated users after they complete their
 * one free trial CV analysis. Prompts them to register or sign in.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BarChart3, Layers, BookOpen, Zap, CheckCircle } from 'lucide-react';

interface Props {
    onClose: () => void;
}

const BENEFITS = [
    { icon: BarChart3,  text: 'Unlimited CV analyses' },
    { icon: Layers,     text: 'Batch processing for multiple candidates' },
    { icon: BookOpen,   text: 'Save & compare results over time' },
    { icon: Zap,        text: 'Interview prep & diversity analytics' },
    { icon: CheckCircle, text: 'Committee review & collaborative voting' },
];

export const GuestTrialModal: React.FC<Props> = ({ onClose }) => {
    const navigate = useNavigate();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 relative animate-in zoom-in-95 duration-200">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Hero */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-7 h-7 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        You've used your free trial!
                    </h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Create a free account to unlock unlimited analyses,
                        save your results, and access all pro features.
                    </p>
                </div>

                {/* Benefits list */}
                <ul className="space-y-3 mb-8">
                    {BENEFITS.map(({ icon: Icon, text }) => (
                        <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                            <span className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-blue-500" />
                            </span>
                            {text}
                        </li>
                    ))}
                </ul>

                {/* CTA buttons */}
                <div className="space-y-3">
                    <button
                        onClick={() => navigate('/register')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
                    >
                        Create Free Account
                    </button>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl border border-gray-300 transition-colors"
                    >
                        Sign In to Existing Account
                    </button>
                </div>

                <p className="text-center text-xs text-gray-400 mt-4">
                    No credit card required &bull; Free forever plan available
                </p>
            </div>
        </div>
    );
};
