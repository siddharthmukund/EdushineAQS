import React, { useState } from 'react';
import { X, KeySquare } from 'lucide-react';
import { updateApiKeys } from '../../services/api';

interface ApiKeySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({ isOpen, onClose }) => {
    const [anthropic, setAnthropic] = useState('');
    const [openai, setOpenai] = useState('');
    const [gemini, setGemini] = useState('');
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    const handleSave = async () => {
        setStatus('saving');
        setErrorMsg('');
        try {
            await updateApiKeys({ anthropic, openai, gemini });
            setStatus('success');
            setTimeout(() => {
                setStatus('idle');
                onClose();
            }, 1000);
        } catch (error: any) {
            setStatus('error');
            setErrorMsg(error.message || 'Failed to save keys.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center space-x-2 text-gray-900">
                        <KeySquare className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold">API Key Configuration</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm leading-relaxed border border-blue-100">
                        Enter your API keys below to enable AI analysis. You only need to provide keys for the models you plan to use. Keys are saved securely to your local <code className="bg-blue-100 px-1 py-0.5 rounded">.env</code> file.
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Anthropic (Claude) API Key
                            </label>
                            <input
                                type="password"
                                value={anthropic}
                                onChange={(e) => setAnthropic(e.target.value)}
                                placeholder="sk-ant-..."
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-gray-900 placeholder:text-gray-400"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                OpenAI (GPT-4o) API Key
                            </label>
                            <input
                                type="password"
                                value={openai}
                                onChange={(e) => setOpenai(e.target.value)}
                                placeholder="sk-..."
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-gray-900 placeholder:text-gray-400"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Google (Gemini) API Key
                            </label>
                            <input
                                type="password"
                                value={gemini}
                                onChange={(e) => setGemini(e.target.value)}
                                placeholder="AIza..."
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-gray-900 placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    {status === 'error' && (
                        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-100">
                            {errorMsg}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        disabled={status === 'saving'}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={status === 'saving' || (!anthropic && !openai && !gemini)}
                        className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {status === 'saving' ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Saving...</span>
                            </>
                        ) : status === 'success' ? (
                            <span>Saved!</span>
                        ) : (
                            <span>Save Keys</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
