import React, { useEffect, useState } from 'react';
import { User, Briefcase, ClipboardList, Plus, Loader2 } from 'lucide-react';
import type { CandidateProfile, JobPosting, JobApplication } from '../types/api';
import {
    getCandidateProfileByEmail, createCandidateProfile,
    listJobPostings, getMyApplications,
} from '../services/api';
import { ProfileCard } from '../components/candidate/ProfileCard';
import { JobMatchCard } from '../components/candidate/JobMatchCard';
import { ApplicationStatusCard } from '../components/candidate/ApplicationStatusCard';

type Tab = 'jobs' | 'applications';

const POSITION_TYPES = [
    { value: '', label: 'All Positions' },
    { value: 'tenure_track', label: 'Tenure Track' },
    { value: 'postdoc', label: 'Post-doc' },
    { value: 'lecturer', label: 'Lecturer' },
    { value: 'visiting', label: 'Visiting' },
    { value: 'research', label: 'Research' },
];

export const CandidateDashboard: React.FC = () => {
    const [email, setEmail] = useState<string>(() => localStorage.getItem('candidate_email') || '');
    const [emailInput, setEmailInput] = useState('');
    const [profile, setProfile] = useState<CandidateProfile | null>(null);
    const [jobs, setJobs] = useState<JobPosting[]>([]);
    const [applications, setApplications] = useState<JobApplication[]>([]);
    const [tab, setTab] = useState<Tab>('jobs');
    const [positionFilter, setPositionFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', email: emailInput });
    const [creating, setCreating] = useState(false);

    const loadData = async (candidateEmail: string) => {
        setLoading(true);
        try {
            const profileResult = await getCandidateProfileByEmail(candidateEmail);
            setProfile(profileResult?.profile || null);
            if (profileResult?.profile) {
                const [jobsResult, appsResult] = await Promise.all([
                    listJobPostings(positionFilter || undefined),
                    getMyApplications(candidateEmail),
                ]);
                setJobs(jobsResult.jobs);
                setApplications(appsResult.applications);
            }
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (email) loadData(email);
    }, [email, positionFilter]);

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInput.trim()) return;
        localStorage.setItem('candidate_email', emailInput.trim());
        setEmail(emailInput.trim());
    };

    const handleCreateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            const result = await createCandidateProfile({
                email: createForm.email || email,
                name: createForm.name,
            });
            setProfile(result.profile);
            setShowCreateForm(false);
            await loadData(email);
        } catch { /* silent */ } finally {
            setCreating(false);
        }
    };

    // Not signed in
    if (!email) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm space-y-6">
                    <div className="text-center">
                        <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User className="w-7 h-7 text-indigo-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Candidate Portal</h2>
                        <p className="text-sm text-gray-500 mt-1">Enter your email to access your academic profile and job matches</p>
                    </div>
                    <form onSubmit={handleEmailSubmit} className="space-y-3">
                        <input
                            type="email"
                            required
                            value={emailInput}
                            onChange={e => setEmailInput(e.target.value)}
                            placeholder="your@email.edu"
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <button
                            type="submit"
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
                        >
                            Continue
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    // No profile yet
    if (!profile) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                    <User className="w-8 h-8 text-indigo-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">No profile found for {email}</h2>
                <p className="text-sm text-gray-500">Create your academic candidate profile to browse job opportunities and track applications.</p>
                {showCreateForm ? (
                    <form onSubmit={handleCreateProfile} className="text-left space-y-3 max-w-sm mx-auto bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <div>
                            <label className="text-xs font-medium text-gray-600">Full Name *</label>
                            <input
                                required
                                value={createForm.name}
                                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Email *</label>
                            <input
                                type="email"
                                required
                                value={createForm.email || email}
                                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={creating}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60 hover:bg-indigo-700"
                            >
                                {creating ? 'Creating…' : 'Create Profile'}
                            </button>
                            <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
                        </div>
                    </form>
                ) : (
                    <button
                        onClick={() => { setShowCreateForm(true); setCreateForm({ name: '', email }); }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700"
                    >
                        <Plus className="w-4 h-4" /> Create Profile
                    </button>
                )}
                <button onClick={() => { localStorage.removeItem('candidate_email'); setEmail(''); }} className="block mx-auto text-xs text-gray-400 hover:text-gray-600 mt-2">
                    Use a different email
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Candidate Dashboard</h1>
                <button onClick={() => { localStorage.removeItem('candidate_email'); setEmail(''); }} className="text-xs text-gray-400 hover:text-gray-600">
                    Switch account
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Profile sidebar */}
                <div className="lg:col-span-4">
                    <ProfileCard profile={profile} onProfileUpdate={setProfile} />
                </div>

                {/* Main content */}
                <div className="lg:col-span-8 space-y-4">
                    {/* Tab strip */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setTab('jobs')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'jobs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Briefcase className="w-4 h-4" /> Job Matches
                            <span className="text-xs font-semibold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{jobs.length}</span>
                        </button>
                        <button
                            onClick={() => setTab('applications')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'applications' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ClipboardList className="w-4 h-4" /> My Applications
                            <span className="text-xs font-semibold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{applications.length}</span>
                        </button>
                    </div>

                    {tab === 'jobs' && (
                        <>
                            {/* Position filter */}
                            <div className="flex gap-2 flex-wrap">
                                {POSITION_TYPES.map(pt => (
                                    <button
                                        key={pt.value}
                                        onClick={() => setPositionFilter(pt.value)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${positionFilter === pt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {pt.label}
                                    </button>
                                ))}
                            </div>

                            {jobs.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No job postings available right now.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {jobs.map(job => (
                                        <JobMatchCard
                                            key={job.id}
                                            job={job}
                                            profile={profile}
                                            onApplied={() => getMyApplications(email).then(r => setApplications(r.applications))}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {tab === 'applications' && (
                        applications.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No applications yet. Browse job matches to get started.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {applications.map(app => (
                                    <ApplicationStatusCard
                                        key={app.id}
                                        application={app}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
