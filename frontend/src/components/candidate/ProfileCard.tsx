import React, { useState } from 'react';
import { BadgeCheck, Loader2, ExternalLink, Pencil, X, Check } from 'lucide-react';
import type { CandidateProfile } from '../../types/api';
import { verifyORCID, updateCandidateProfile } from '../../services/api';

interface Props {
    profile: CandidateProfile;
    onProfileUpdate: (updated: CandidateProfile) => void;
}

export const ProfileCard: React.FC<Props> = ({ profile, onProfileUpdate }) => {
    const [editing, setEditing] = useState(false);
    const [orcidInput, setOrcidInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [orcidError, setOrcidError] = useState<string | null>(null);
    const [form, setForm] = useState({
        bio: profile.bio || '',
        research_areas: (profile.research_areas || []).join(', '),
        institution: profile.institution || '',
        h_index: profile.h_index != null ? String(profile.h_index) : '',
    });
    const [saving, setSaving] = useState(false);

    const completeness = [
        profile.institution, profile.bio, profile.orcid_id,
        (profile.research_areas || []).length > 0,
        profile.h_index != null,
    ].filter(Boolean).length;
    const completenessPercent = Math.round((completeness / 5) * 100);

    const handleVerifyORCID = async () => {
        if (!orcidInput.trim()) return;
        setVerifying(true);
        setOrcidError(null);
        try {
            const result = await verifyORCID(profile.id, orcidInput.trim());
            onProfileUpdate(result.profile);
            setOrcidInput('');
        } catch (e: any) {
            setOrcidError(e?.response?.data?.detail || 'ORCID verification failed');
        } finally {
            setVerifying(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateCandidateProfile(profile.id, {
                bio: form.bio || undefined,
                institution: form.institution || undefined,
                h_index: form.h_index ? parseInt(form.h_index) : undefined,
                research_areas: form.research_areas ? form.research_areas.split(',').map(s => s.trim()).filter(Boolean) : [],
            });
            onProfileUpdate(result.profile);
            setEditing(false);
        } catch { /* silent */ } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                    {profile.institution && (
                        <p className="text-sm text-gray-500 mt-0.5">{profile.institution}</p>
                    )}
                </div>
                <button
                    onClick={() => setEditing(e => !e)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                >
                    {editing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </button>
            </div>

            {/* Completeness bar */}
            <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Profile completeness</span>
                    <span className="font-semibold">{completenessPercent}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${completenessPercent >= 80 ? 'bg-green-500' : completenessPercent >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${completenessPercent}%` }}
                    />
                </div>
            </div>

            {/* ORCID status */}
            {profile.orcid_verified ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <BadgeCheck className="w-4 h-4 text-green-600" />
                    <span>ORCID Verified: <code className="font-mono text-xs">{profile.orcid_id}</code></span>
                    <a href={`https://orcid.org/${profile.orcid_id}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 text-green-500 ml-1" />
                    </a>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Verify your ORCID ID</p>
                    <div className="flex gap-2">
                        <input
                            value={orcidInput}
                            onChange={e => setOrcidInput(e.target.value)}
                            placeholder="0000-0000-0000-0000"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button
                            onClick={handleVerifyORCID}
                            disabled={verifying || !orcidInput.trim()}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 hover:bg-indigo-700 transition-colors"
                        >
                            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                        </button>
                    </div>
                    {orcidError && <p className="text-xs text-red-600">{orcidError}</p>}
                </div>
            )}

            {/* Edit form / View fields */}
            {editing ? (
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-gray-600">Institution</label>
                        <input
                            value={form.institution}
                            onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600">H-Index</label>
                        <input
                            type="number" min={0}
                            value={form.h_index}
                            onChange={e => setForm(f => ({ ...f, h_index: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600">Research Areas (comma-separated)</label>
                        <input
                            value={form.research_areas}
                            onChange={e => setForm(f => ({ ...f, research_areas: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600">Bio</label>
                        <textarea
                            value={form.bio}
                            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 hover:bg-indigo-700"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save
                        </button>
                        <button
                            onClick={() => setEditing(false)}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {profile.h_index != null && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">H-Index</span>
                            <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{profile.h_index}</span>
                        </div>
                    )}
                    {(profile.research_areas || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {profile.research_areas.slice(0, 6).map(area => (
                                <span key={area} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{area}</span>
                            ))}
                        </div>
                    )}
                    {profile.bio && (
                        <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
                    )}
                </div>
            )}
        </div>
    );
};
