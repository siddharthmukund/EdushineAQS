/**
 * RegisterPage — new user registration with optional invite-token support (ICCV #3).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { UserPlus, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { authRegister, authCheckInvite, authGetMe } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types/api';

// Simple client-side password strength check
function checkPasswordStrength(pw: string): string[] {
    const issues: string[] = [];
    if (pw.length < 8) issues.push('At least 8 characters');
    if (!/[A-Z]/.test(pw)) issues.push('At least one uppercase letter');
    if (!/[0-9]/.test(pw)) issues.push('At least one number');
    return issues;
}

const ROLE_LABELS: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    committee_chair: 'Committee Chair',
    committee_member: 'Committee Member',
    analyst: 'Analyst',
    observer: 'Observer',
    viewer: 'Viewer',
    invited: 'Invited',
};

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAuthStore();

    const inviteToken = searchParams.get('invite') || '';

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [emailLocked, setEmailLocked] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [inviteRole, setInviteRole] = useState<UserRole | null>(null);
    const [inviteValid, setInviteValid] = useState<boolean | null>(null); // null=checking

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // -----------------------------------------------------------------------
    // Validate invite token on mount
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!inviteToken) return;
        let cancelled = false;
        authCheckInvite(inviteToken)
            .then(({ email: invEmail, role }) => {
                if (cancelled) return;
                setEmail(invEmail);
                setEmailLocked(true);
                setInviteRole(role);
                setInviteValid(true);
            })
            .catch(() => {
                if (!cancelled) setInviteValid(false);
            });
        return () => { cancelled = true; };
    }, [inviteToken]);

    const passwordIssues = checkPasswordStrength(password);
    const passwordsMatch = password === confirm;

    // -----------------------------------------------------------------------
    // Submit
    // -----------------------------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (passwordIssues.length > 0) {
            setError('Password does not meet requirements');
            return;
        }
        if (!passwordsMatch) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await authRegister(name, email, password, inviteToken || undefined);
            const profile = await authGetMe();
            login(res.access_token, profile);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 mb-4">
                        <UserPlus className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
                    <p className="text-gray-500 mt-1 text-sm">Join the Academic CV Analyzer platform</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {/* Invite banner */}
                    {inviteToken && inviteValid === true && inviteRole && (
                        <div className="mb-4 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                            <div>
                                <span className="font-semibold">You've been invited!</span>{' '}
                                Your account will be created with the{' '}
                                <span className="font-semibold">{ROLE_LABELS[inviteRole]}</span> role.
                            </div>
                        </div>
                    )}
                    {inviteToken && inviteValid === false && (
                        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>Invite link is invalid or expired — you can still register with a default role.</span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full name
                            </label>
                            <input
                                type="text"
                                required
                                autoFocus
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="Dr. Jane Smith"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email address
                            </label>
                            <input
                                type="email"
                                required
                                readOnly={emailLocked}
                                value={email}
                                onChange={e => !emailLocked && setEmail(e.target.value)}
                                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                    emailLocked
                                        ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                                        : 'border-gray-300'
                                }`}
                                placeholder="you@university.edu"
                            />
                            {emailLocked && (
                                <p className="text-xs text-gray-400 mt-1">Email pre-filled from your invitation</p>
                            )}
                        </div>

                        {/* Password */}
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
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                            {/* Strength indicators */}
                            {password && passwordIssues.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5">
                                    {passwordIssues.map(issue => (
                                        <li key={issue} className="flex items-center gap-1.5 text-xs text-amber-600">
                                            <AlertCircle className="w-3 h-3" />
                                            {issue}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {password && passwordIssues.length === 0 && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                                    <CheckCircle className="w-3 h-3" /> Password looks good
                                </p>
                            )}
                        </div>

                        {/* Confirm */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm password
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                    confirm && !passwordsMatch ? 'border-red-400' : 'border-gray-300'
                                }`}
                                placeholder="••••••••"
                            />
                            {confirm && !passwordsMatch && (
                                <p className="mt-1 text-xs text-red-600">Passwords don't match</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || passwordIssues.length > 0 || !passwordsMatch}
                            className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                        >
                            {loading ? 'Creating account…' : 'Create account'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
};
