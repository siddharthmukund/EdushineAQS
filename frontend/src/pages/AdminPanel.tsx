/**
 * AdminPanel — Users / Invitations / Audit Logs (ICCV #3).
 * Only accessible to admin and super_admin roles.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Mail, FileText, Search, ChevronLeft, ChevronRight,
    UserCheck, UserX, ShieldCheck, AlertCircle, CheckCircle, Plus, Trash2,
} from 'lucide-react';
import {
    adminListUsers, adminChangeUserRole, adminToggleUserStatus,
    adminSendInvitation, adminListInvitations, adminRevokeInvitation,
    adminGetAuditLogs,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile, UserInvitation, AuditLog, UserRole } from '../types/api';

type Tab = 'users' | 'invitations' | 'audit';

const VALID_ROLES: UserRole[] = [
    'super_admin', 'admin', 'committee_chair', 'committee_member',
    'analyst', 'observer', 'viewer', 'invited',
];

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

function StatusBadge({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
    if (!msg) return null;
    return (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 mb-4 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
        </div>
    );
}

export const AdminPanel: React.FC = () => {
    const navigate = useNavigate();
    const { isAdmin, user } = useAuthStore();
    const [tab, setTab] = useState<Tab>('users');

    // Guard
    useEffect(() => {
        if (!isAdmin()) navigate('/');
    }, []); // eslint-disable-line

    // -----------------------------------------------------------------------
    // Users tab
    // -----------------------------------------------------------------------
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [userTotal, setUserTotal] = useState(0);
    const [userPage, setUserPage] = useState(1);
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('');
    const [usersLoading, setUsersLoading] = useState(false);
    const [userMsg, setUserMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const loadUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const res = await adminListUsers({ search: userSearch || undefined, role: userRoleFilter || undefined, page: userPage });
            setUsers(res.users);
            setUserTotal(res.total);
        } catch { /* ignore */ }
        finally { setUsersLoading(false); }
    }, [userSearch, userRoleFilter, userPage]);

    useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);

    const handleRoleChange = async (userId: string, role: UserRole) => {
        setUserMsg(null);
        try {
            await adminChangeUserRole(userId, role);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
            setUserMsg({ type: 'ok', text: 'Role updated.' });
        } catch { setUserMsg({ type: 'err', text: 'Failed to update role.' }); }
    };

    const handleToggleStatus = async (userId: string, isActive: boolean) => {
        setUserMsg(null);
        try {
            await adminToggleUserStatus(userId, !isActive);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !isActive } : u));
            setUserMsg({ type: 'ok', text: `User ${!isActive ? 'enabled' : 'disabled'}.` });
        } catch { setUserMsg({ type: 'err', text: 'Failed to update status.' }); }
    };

    // -----------------------------------------------------------------------
    // Invite modal
    // -----------------------------------------------------------------------
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('committee_member');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteResult, setInviteResult] = useState<string | null>(null);

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        try {
            const res = await adminSendInvitation(inviteEmail, inviteRole);
            setInviteResult(res.invite_url);
        } catch { setInviteResult('ERROR'); }
        finally { setInviteLoading(false); }
    };

    // -----------------------------------------------------------------------
    // Invitations tab
    // -----------------------------------------------------------------------
    const [invitations, setInvitations] = useState<UserInvitation[]>([]);
    const [invLoading, setInvLoading] = useState(false);
    const [invMsg, setInvMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const loadInvitations = async () => {
        setInvLoading(true);
        try { setInvitations(await adminListInvitations()); }
        catch { /* ignore */ }
        finally { setInvLoading(false); }
    };

    useEffect(() => { if (tab === 'invitations') loadInvitations(); }, [tab]); // eslint-disable-line

    const handleRevokeInvite = async (id: string) => {
        setInvMsg(null);
        try {
            await adminRevokeInvitation(id);
            setInvitations(prev => prev.map(i => i.id === id ? { ...i, status: 'expired' as const, expires_at: new Date().toISOString() } : i));
            setInvMsg({ type: 'ok', text: 'Invitation revoked.' });
        } catch { setInvMsg({ type: 'err', text: 'Failed.' }); }
    };

    // -----------------------------------------------------------------------
    // Audit logs tab
    // -----------------------------------------------------------------------
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditAction, setAuditAction] = useState('');

    const loadAudit = async () => {
        setAuditLoading(true);
        try {
            setAuditLogs(await adminGetAuditLogs({ action: auditAction || undefined, limit: 100 }));
        } catch { /* ignore */ }
        finally { setAuditLoading(false); }
    };

    useEffect(() => { if (tab === 'audit') loadAudit(); }, [tab]); // eslint-disable-line

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
        { id: 'invitations', label: 'Invitations', icon: <Mail className="w-4 h-4" /> },
        { id: 'audit', label: 'Audit Logs', icon: <FileText className="w-4 h-4" /> },
    ];

    const perPage = 20;
    const totalPages = Math.ceil(userTotal / perPage);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>

            {/* Tab bar */}
            <div className="flex gap-1 mb-8 border-b border-gray-200">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* ---- Users ---- */}
            {tab === 'users' && (
                <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="relative flex-1 min-w-48">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search name or email…"
                                value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <select value={userRoleFilter} onChange={e => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">All roles</option>
                            {VALID_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                        </select>
                        <button onClick={() => setShowInviteModal(true)}
                            className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors">
                            <Plus className="w-4 h-4" /> Invite user
                        </button>
                    </div>

                    <StatusBadge msg={userMsg} />

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Name</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Email</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Role</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">MFA</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {usersLoading && (
                                    <tr><td colSpan={6} className="text-center text-gray-400 py-8 animate-pulse">Loading…</td></tr>
                                )}
                                {!usersLoading && users.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                                                    {u.name.slice(0, 1).toUpperCase()}
                                                </div>
                                                {u.name}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                                        <td className="px-4 py-3">
                                            {/* Prevent changing own role */}
                                            {u.id === user?.id ? (
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                                    {u.role.replace(/_/g, ' ')}
                                                </span>
                                            ) : (
                                                <select value={u.role}
                                                    onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
                                                    {VALID_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                {u.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {u.mfa_enabled
                                                ? <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                                : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {u.id !== user?.id && (
                                                <button onClick={() => handleToggleStatus(u.id, u.is_active)}
                                                    className={`text-xs rounded-lg px-2.5 py-1 font-medium transition-colors ${u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}>
                                                    {u.is_active ? <><UserX className="w-3.5 h-3.5 inline mr-1" />Disable</> : <><UserCheck className="w-3.5 h-3.5 inline mr-1" />Enable</>}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!usersLoading && users.length === 0 && (
                                    <tr><td colSpan={6} className="text-center text-gray-400 py-8">No users found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                            <span>Showing {(userPage - 1) * perPage + 1}–{Math.min(userPage * perPage, userTotal)} of {userTotal}</span>
                            <div className="flex gap-1">
                                <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button disabled={userPage === totalPages} onClick={() => setUserPage(p => p + 1)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Invite modal */}
                    {showInviteModal && (
                        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite a new user</h3>
                                {!inviteResult ? (
                                    <form onSubmit={handleSendInvite} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                                            <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="colleague@university.edu" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)}
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                                {VALID_ROLES.filter(r => r !== 'super_admin').map(r => (
                                                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-3 justify-end">
                                            <button type="button" onClick={() => { setShowInviteModal(false); setInviteResult(null); setInviteEmail(''); }}
                                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                                                Cancel
                                            </button>
                                            <button type="submit" disabled={inviteLoading}
                                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                                                {inviteLoading ? 'Sending…' : 'Send invite'}
                                            </button>
                                        </div>
                                    </form>
                                ) : inviteResult === 'ERROR' ? (
                                    <div>
                                        <p className="text-red-600 text-sm">Failed to create invitation. Please try again.</p>
                                        <button onClick={() => setInviteResult(null)} className="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600">Invitation created! Share this link with the invitee:</p>
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-700 break-all">
                                            {inviteResult}
                                        </div>
                                        <p className="text-xs text-gray-400">In production, this URL would be emailed automatically. For now, copy and share it manually.</p>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => navigator.clipboard.writeText(inviteResult)}
                                                className="text-xs text-blue-600 hover:underline">Copy link</button>
                                            <button onClick={() => { setShowInviteModal(false); setInviteResult(null); setInviteEmail(''); loadInvitations(); }}
                                                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors">Done</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ---- Invitations ---- */}
            {tab === 'invitations' && (
                <div>
                    <StatusBadge msg={invMsg} />
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Email</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Role</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Sent</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Expires</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                                    <th className="text-right px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {invLoading && <tr><td colSpan={6} className="text-center text-gray-400 py-8 animate-pulse">Loading…</td></tr>}
                                {!invLoading && invitations.map(inv => (
                                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-gray-900">{inv.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[inv.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                                {inv.role.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status === 'pending' ? 'bg-amber-100 text-amber-700' : inv.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {inv.status === 'pending' && (
                                                <button onClick={() => handleRevokeInvite(inv.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!invLoading && invitations.length === 0 && (
                                    <tr><td colSpan={6} className="text-center text-gray-400 py-8">No invitations yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ---- Audit logs ---- */}
            {tab === 'audit' && (
                <div>
                    <div className="flex gap-3 mb-4">
                        <input type="text" placeholder="Filter by action (e.g. login, mfa_enable)…"
                            value={auditAction} onChange={e => setAuditAction(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadAudit()}
                            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={loadAudit}
                            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors">
                            Filter
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Time</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Action</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">User ID</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Resource</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {auditLoading && <tr><td colSpan={5} className="text-center text-gray-400 py-8 animate-pulse">Loading…</td></tr>}
                                {!auditLoading && auditLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                                            {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">{log.action}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{log.user_id ? log.user_id.slice(0, 8) + '…' : '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                                            {log.resource_type ? `${log.resource_type}${log.resource_id ? ':' + log.resource_id.slice(0, 8) : ''}` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-400 text-xs">{log.ip_address ?? '—'}</td>
                                    </tr>
                                ))}
                                {!auditLoading && auditLogs.length === 0 && (
                                    <tr><td colSpan={5} className="text-center text-gray-400 py-8">No audit logs found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
