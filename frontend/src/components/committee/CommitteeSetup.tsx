import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { createCommittee, joinCommittee } from '../../services/api';

export interface CommitteeIdentity {
    name: string;
    email: string;
    committeeId: string;
    sessionToken: string;
    isChair: boolean;
}

interface Props {
    batchId: string;
    onReady: (identity: CommitteeIdentity) => void;
    onClose: () => void;
}

type Mode = 'choose' | 'create' | 'join';

export const CommitteeSetup: React.FC<Props> = ({ batchId, onReady, onClose }) => {
    const [mode, setMode] = useState<Mode>('choose');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [committeeName, setCommitteeName] = useState('');
    const [committeeId, setCommitteeId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!name.trim() || !email.trim() || !committeeName.trim()) {
            setError('All fields are required.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await createCommittee(batchId, committeeName, name, email);
            localStorage.setItem('committee_identity', JSON.stringify({ name, email }));
            onReady({
                name,
                email,
                committeeId: res.committee_id,
                sessionToken: res.session_token,
                isChair: true,
            });
        } catch (e: any) {
            setError(e.message || 'Failed to create committee');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!name.trim() || !email.trim() || !committeeId.trim()) {
            setError('All fields are required.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await joinCommittee(committeeId, name, email);
            localStorage.setItem('committee_identity', JSON.stringify({ name, email }));
            onReady({
                name,
                email,
                committeeId,
                sessionToken: res.session_token,
                isChair: false,
            });
        } catch (e: any) {
            setError(e.message || 'Failed to join committee');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-bold text-gray-900">Committee Review</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {mode === 'choose' && (
                        <>
                            <p className="text-sm text-gray-600">
                                Start a collaborative committee review session for this batch, or join an existing one.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setMode('create')}
                                    className="border-2 border-indigo-500 text-indigo-700 rounded-xl p-4 text-left hover:bg-indigo-50 transition-colors"
                                >
                                    <p className="font-bold">Create</p>
                                    <p className="text-xs text-gray-500 mt-1">Start a new committee session</p>
                                </button>
                                <button
                                    onClick={() => setMode('join')}
                                    className="border-2 border-gray-200 text-gray-700 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <p className="font-bold">Join</p>
                                    <p className="text-xs text-gray-500 mt-1">Enter an existing committee ID</p>
                                </button>
                            </div>
                        </>
                    )}

                    {(mode === 'create' || mode === 'join') && (
                        <>
                            <Field label="Your Name" value={name} onChange={setName} placeholder="Dr. Priya Sharma" />
                            <Field label="Your Email" value={email} onChange={setEmail} placeholder="priya@university.edu" type="email" />

                            {mode === 'create' && (
                                <Field label="Committee Name" value={committeeName} onChange={setCommitteeName} placeholder="CS Assistant Prof Search 2026" />
                            )}
                            {mode === 'join' && (
                                <Field label="Committee ID" value={committeeId} onChange={setCommitteeId} placeholder="Paste the committee ID" />
                            )}

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setMode('choose'); setError(null); }}
                                    className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={mode === 'create' ? handleCreate : handleJoin}
                                    disabled={loading}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? '…' : mode === 'create' ? 'Create Committee' : 'Join Committee'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

function Field({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
        </div>
    );
}
