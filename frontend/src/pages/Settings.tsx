/**
 * Settings page — Profile / Security / Preferences tabs (ICCV #3).
 */
import React, { useState, useEffect } from 'react';
import {
    User, ShieldCheck, Bell, AlertCircle, CheckCircle,
    Trash2, Monitor, ShieldOff,
} from 'lucide-react';
import { MFASetup } from '../components/auth/MFASetup';
import { useAuthStore } from '../stores/authStore';
import {
    updateUserProfile, updateUserPreferences,
    disableMFA, getMySessions, revokeSession, revokeAllSessions,
} from '../services/api';
import type { UserSession } from '../types/api';

type Tab = 'profile' | 'security' | 'preferences';

const TIMEZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Asia/Kolkata', 'Australia/Sydney',
];

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'zh', label: 'Chinese' },
    { code: 'ja', label: 'Japanese' },
];

export const Settings: React.FC = () => {
    const { user, updateUser } = useAuthStore();
    const [tab, setTab] = useState<Tab>('profile');

    // -----------------------------------------------------------------------
    // Profile state
    // -----------------------------------------------------------------------
    const [name, setName] = useState(user?.name ?? '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
    const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
    const [language, setLanguage] = useState(user?.language_preference ?? 'en');
    const [department, setDepartment] = useState(user?.department ?? '');
    const [title, setTitle] = useState(user?.title ?? '');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const saveProfile = async () => {
        setProfileSaving(true);
        setProfileMsg(null);
        try {
            const updated = await updateUserProfile({ name, avatar_url: avatarUrl, timezone, language_preference: language, department, title });
            updateUser(updated);
            setProfileMsg({ type: 'ok', text: 'Profile saved.' });
        } catch (err: any) {
            setProfileMsg({ type: 'err', text: err.response?.data?.detail || 'Save failed' });
        } finally {
            setProfileSaving(false);
        }
    };

    // -----------------------------------------------------------------------
    // Security / MFA state
    // -----------------------------------------------------------------------
    const [mfaEnabled, setMfaEnabled] = useState(user?.mfa_enabled ?? false);
    const [showMFAWizard, setShowMFAWizard] = useState(false);
    const [disableMFACode, setDisableMFACode] = useState('');
    const [disablingMFA, setDisablingMFA] = useState(false);
    const [mfaMsg, setMfaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const handleMFAEnabled = () => {
        setMfaEnabled(true);
        updateUser({ mfa_enabled: true });
        setShowMFAWizard(false);
        setMfaMsg({ type: 'ok', text: '2FA is now enabled on your account.' });
    };

    const handleDisableMFA = async (e: React.FormEvent) => {
        e.preventDefault();
        setDisablingMFA(true);
        setMfaMsg(null);
        try {
            await disableMFA(disableMFACode);
            setMfaEnabled(false);
            updateUser({ mfa_enabled: false });
            setDisableMFACode('');
            setMfaMsg({ type: 'ok', text: '2FA has been disabled.' });
        } catch (err: any) {
            setMfaMsg({ type: 'err', text: err.response?.data?.detail || 'Invalid code' });
        } finally {
            setDisablingMFA(false);
        }
    };

    // Sessions
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [sessionsLoading, setSessLoading] = useState(false);
    const [sessMsg, setSessMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const loadSessions = async () => {
        setSessLoading(true);
        try {
            setSessions(await getMySessions());
        } catch { /* ignore */ }
        finally { setSessLoading(false); }
    };

    useEffect(() => {
        if (tab === 'security') loadSessions();
    }, [tab]); // eslint-disable-line

    const handleRevokeSession = async (id: string) => {
        setSessMsg(null);
        try {
            await revokeSession(id);
            setSessions(s => s.filter(x => x.id !== id));
            setSessMsg({ type: 'ok', text: 'Session revoked.' });
        } catch { setSessMsg({ type: 'err', text: 'Failed to revoke session.' }); }
    };

    const handleRevokeAll = async () => {
        setSessMsg(null);
        try {
            const res = await revokeAllSessions();
            await loadSessions();
            setSessMsg({ type: 'ok', text: `${res.revoked} other sessions signed out.` });
        } catch { setSessMsg({ type: 'err', text: 'Failed.' }); }
    };

    // -----------------------------------------------------------------------
    // Preferences state
    // -----------------------------------------------------------------------
    const prefs = user?.notification_preferences ?? {};
    const [emailOnAnalysis, setEmailOnAnalysis] = useState(prefs.email_on_analysis ?? true);
    const [emailOnBatch, setEmailOnBatch] = useState(prefs.email_on_batch_complete ?? true);
    const [emailOnVote, setEmailOnVote] = useState(prefs.email_on_committee_vote ?? false);
    const [prefSaving, setPrefSaving] = useState(false);
    const [prefMsg, setPrefMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const savePreferences = async () => {
        setPrefSaving(true);
        setPrefMsg(null);
        try {
            await updateUserPreferences({
                email_on_analysis: emailOnAnalysis,
                email_on_batch_complete: emailOnBatch,
                email_on_committee_vote: emailOnVote,
            });
            updateUser({ notification_preferences: { email_on_analysis: emailOnAnalysis, email_on_batch_complete: emailOnBatch, email_on_committee_vote: emailOnVote } });
            setPrefMsg({ type: 'ok', text: 'Preferences saved.' });
        } catch { setPrefMsg({ type: 'err', text: 'Save failed.' }); }
        finally { setPrefSaving(false); }
    };

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    function Msg({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
        if (!msg) return null;
        return (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {msg.text}
            </div>
        );
    }

    function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
        return (
            <label className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-sm text-gray-700">{label}</span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() => onChange(!checked)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
            </label>
        );
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck className="w-4 h-4" /> },
        { id: 'preferences', label: 'Preferences', icon: <Bell className="w-4 h-4" /> },
    ];

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h1>

            {/* Tab bar */}
            <div className="flex gap-1 mb-8 border-b border-gray-200">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                            tab === t.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* ---- Profile tab ---- */}
            {tab === 'profile' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
                    <Msg msg={profileMsg} />

                    {/* Avatar preview */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" onError={() => setAvatarUrl('')} />
                            ) : (
                                <span className="text-blue-700 text-xl font-bold">
                                    {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                                </span>
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Avatar URL</label>
                            <input
                                type="url"
                                value={avatarUrl}
                                onChange={e => setAvatarUrl(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://…"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" value={user?.email ?? ''} readOnly
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title / Position</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Associate Professor" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Computer Science" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                            <select value={timezone} onChange={e => setTimezone(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                            <select value={language} onChange={e => setLanguage(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <button onClick={saveProfile} disabled={profileSaving}
                        className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                        {profileSaving ? 'Saving…' : 'Save profile'}
                    </button>
                </div>
            )}

            {/* ---- Security tab ---- */}
            {tab === 'security' && (
                <div className="space-y-6">
                    {/* MFA section */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-base font-semibold text-gray-900 mb-1">Two-factor authentication</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Protect your account with a time-based one-time password from an authenticator app.
                        </p>

                        <Msg msg={mfaMsg} />

                        {mfaEnabled && !showMFAWizard && (
                            <div className="space-y-4 mt-4">
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <ShieldCheck className="w-5 h-5" />
                                    <span className="text-sm font-medium">2FA is active</span>
                                </div>
                                <form onSubmit={handleDisableMFA} className="flex gap-3 items-end">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            Enter your current TOTP code to disable 2FA
                                        </label>
                                        <input type="text" required maxLength={6}
                                            value={disableMFACode}
                                            onChange={e => setDisableMFACode(e.target.value.replace(/\D/g, ''))}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                                            placeholder="000000" />
                                    </div>
                                    <button type="submit" disabled={disablingMFA || disableMFACode.length !== 6}
                                        className="flex items-center gap-1.5 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors">
                                        <ShieldOff className="w-4 h-4" />
                                        {disablingMFA ? 'Disabling…' : 'Disable 2FA'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {!mfaEnabled && !showMFAWizard && (
                            <button onClick={() => setShowMFAWizard(true)}
                                className="mt-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors">
                                Enable 2FA
                            </button>
                        )}

                        {showMFAWizard && (
                            <div className="mt-4 border-t border-gray-100 pt-4">
                                <MFASetup
                                    onEnabled={handleMFAEnabled}
                                    onCancel={() => setShowMFAWizard(false)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Sessions section */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">Active sessions</h2>
                                <p className="text-sm text-gray-500">All devices currently signed in to your account.</p>
                            </div>
                            <button onClick={handleRevokeAll}
                                className="text-xs text-red-600 hover:underline font-medium">
                                Sign out all other devices
                            </button>
                        </div>

                        <Msg msg={sessMsg} />

                        {sessionsLoading && <p className="text-sm text-gray-400 animate-pulse mt-2">Loading sessions…</p>}

                        <div className="mt-3 space-y-2">
                            {sessions.map(s => (
                                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <Monitor className="w-5 h-5 text-gray-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-700 truncate">
                                            {s.user_agent ? s.user_agent.slice(0, 60) : 'Unknown device'}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {s.ip_address ?? '—'} · Last active {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : '?'}
                                        </p>
                                    </div>
                                    <button onClick={() => handleRevokeSession(s.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {!sessionsLoading && sessions.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">No active sessions found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ---- Preferences tab ---- */}
            {tab === 'preferences' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <h2 className="text-base font-semibold text-gray-900">Notification preferences</h2>
                    <p className="text-sm text-gray-500">Choose which email notifications you'd like to receive.</p>

                    <Msg msg={prefMsg} />

                    <div className="divide-y divide-gray-100">
                        <Toggle checked={emailOnAnalysis} onChange={setEmailOnAnalysis} label="Email when an analysis completes" />
                        <Toggle checked={emailOnBatch} onChange={setEmailOnBatch} label="Email when a batch job finishes" />
                        <Toggle checked={emailOnVote} onChange={setEmailOnVote} label="Email when a committee vote is submitted" />
                    </div>

                    <button onClick={savePreferences} disabled={prefSaving}
                        className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                        {prefSaving ? 'Saving…' : 'Save preferences'}
                    </button>
                </div>
            )}
        </div>
    );
};
