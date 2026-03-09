/**
 * LoginPage — two-phase login (password → optional TOTP) (ICCV #3).
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authLogin, authMFAVerify, authOAuthGetUrl, authGetMe } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { OAuthProvider } from '../types/api';

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuthStore();

    // Phase 1 — credentials
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Phase 2 — MFA
    const [phase, setPhase] = useState<'credentials' | 'mfa'>('credentials');
    const [tempToken, setTempToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [useRecovery, setUseRecovery] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // -----------------------------------------------------------------------
    // Phase 1: Email + password
    // -----------------------------------------------------------------------
    const handleCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authLogin(email, password);
            if ('mfa_required' in res && res.mfa_required) {
                setTempToken((res as any).temp_token);
                setPhase('mfa');
            } else {
                // Full token — fetch profile and log in
                const profile = await authGetMe();
                login((res as any).access_token, profile);
                navigate('/');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------------------------------------
    // Phase 2: TOTP / recovery
    // -----------------------------------------------------------------------
    const handleMFA = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authMFAVerify(tempToken, mfaCode, useRecovery);
            const profile = await authGetMe();
            login(res.access_token, profile);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid MFA code');
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------------------------------------
    // OAuth redirect
    // -----------------------------------------------------------------------
    const handleOAuth = async (provider: OAuthProvider) => {
        setError('');
        try {
            const { url } = await authOAuthGetUrl(provider);
            window.location.href = url;
        } catch (err: any) {
            setError(err.response?.data?.detail || `${provider} SSO not configured on this server`);
        }
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
                        <LogIn className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Academic CV Analyzer</h1>
                    <p className="text-gray-500 mt-1 text-sm">Sign in to your account</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {/* Error banner */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* ---- Phase 1: credentials ---- */}
                    {phase === 'credentials' && (
                        <form onSubmit={handleCredentials} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email address
                                </label>
                                <input
                                    type="email"
                                    required
                                    autoFocus
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="you@university.edu"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                            >
                                {loading ? 'Signing in…' : 'Sign in'}
                            </button>

                            {/* Divider */}
                            <div className="relative my-2">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs text-gray-400">
                                    <span className="bg-white px-2">or continue with</span>
                                </div>
                            </div>

                            {/* SSO buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleOAuth('google')}
                                    className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Google
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOAuth('microsoft')}
                                    className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 23 23">
                                        <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                                        <path fill="#f35325" d="M1 1h10v10H1z" />
                                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                                    </svg>
                                    Microsoft
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ---- Phase 2: MFA ---- */}
                    {phase === 'mfa' && (
                        <form onSubmit={handleMFA} className="space-y-4">
                            <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
                                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">Two-factor authentication</p>
                                    <p className="text-xs text-blue-600">Open your authenticator app and enter the 6-digit code.</p>
                                </div>
                            </div>

                            {!useRecovery ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        6-digit code
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        maxLength={6}
                                        value={mfaCode}
                                        onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="000000"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Recovery code
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={mfaCode}
                                        onChange={e => setMfaCode(e.target.value.toUpperCase())}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="XXXXXXXX"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                            >
                                {loading ? 'Verifying…' : 'Verify'}
                            </button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => { setUseRecovery(v => !v); setMfaCode(''); }}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    {useRecovery ? 'Use authenticator app instead' : 'Use a recovery code instead'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-blue-600 font-medium hover:underline">
                        Register
                    </Link>
                </p>
            </div>
        </div>
    );
};
