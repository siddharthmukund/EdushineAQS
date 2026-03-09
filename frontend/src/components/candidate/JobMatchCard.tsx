import React, { useState } from 'react';
import { MapPin, Calendar, ChevronDown, ChevronUp, Briefcase } from 'lucide-react';
import type { JobPosting, CandidateProfile } from '../../types/api';
import { applyToJob } from '../../services/api';

interface Props {
    job: JobPosting;
    profile?: CandidateProfile | null;
    onApplied?: () => void;
}

const POSITION_COLORS: Record<string, string> = {
    tenure_track: 'bg-purple-100 text-purple-700',
    postdoc: 'bg-blue-100 text-blue-700',
    lecturer: 'bg-indigo-100 text-indigo-700',
    visiting: 'bg-orange-100 text-orange-700',
    research: 'bg-teal-100 text-teal-700',
};

const POSITION_LABELS: Record<string, string> = {
    tenure_track: 'Tenure Track',
    postdoc: 'Post-doc',
    lecturer: 'Lecturer',
    visiting: 'Visiting',
    research: 'Research',
};

function computeMatchScore(job: JobPosting, profile: CandidateProfile): number {
    const jobDesc = (job.description + ' ' + job.title).toLowerCase();
    const profileAreas = (profile.research_areas || []).map(a => a.toLowerCase());
    const matches = profileAreas.filter(area => jobDesc.includes(area)).length;
    return profileAreas.length > 0 ? Math.round((matches / profileAreas.length) * 100) : 0;
}

export const JobMatchCard: React.FC<Props> = ({ job, profile, onApplied }) => {
    const [expanded, setExpanded] = useState(false);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState(false);
    const [showApplyForm, setShowApplyForm] = useState(false);
    const [coverNote, setCoverNote] = useState('');

    const matchScore = profile ? computeMatchScore(job, profile) : null;

    const handleApply = async () => {
        if (!profile) return;
        setApplying(true);
        try {
            await applyToJob(job.id, {
                candidate_profile_id: profile.id,
                cover_note: coverNote || undefined,
            });
            setApplied(true);
            setShowApplyForm(false);
            onApplied?.();
        } catch { /* silent */ } finally {
            setApplying(false);
        }
    };

    const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;

    return (
        <div className={`bg-white rounded-xl border ${isExpired ? 'border-gray-200 opacity-70' : 'border-gray-100'} shadow-sm p-5 space-y-3`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug truncate">{job.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{job.institution}{job.department ? ` · ${job.department}` : ''}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${POSITION_COLORS[job.position_type] || 'bg-gray-100 text-gray-600'}`}>
                    {POSITION_LABELS[job.position_type] || job.position_type}
                </span>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
                {job.location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                )}
                {job.deadline && (
                    <span className={`flex items-center gap-1 ${isExpired ? 'text-red-400' : ''}`}>
                        <Calendar className="w-3 h-3" />
                        {isExpired ? 'Expired' : `Due ${job.deadline}`}
                    </span>
                )}
                {job.salary_range && (
                    <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {job.salary_range.currency || '$'}{job.salary_range.min?.toLocaleString()}–{job.salary_range.max?.toLocaleString()}
                    </span>
                )}
            </div>

            {/* Match score */}
            {matchScore !== null && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${matchScore >= 60 ? 'bg-green-500' : matchScore >= 30 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                            style={{ width: `${matchScore}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-500 w-14 text-right">{matchScore}% match</span>
                </div>
            )}

            {/* Description toggle */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
            >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? 'Hide details' : 'View details'}
            </button>

            {expanded && (
                <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                    {job.description.slice(0, 300)}{job.description.length > 300 ? '…' : ''}
                </p>
            )}

            {/* Apply */}
            {!isExpired && profile && (
                applied ? (
                    <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 text-center font-medium">
                        Application submitted!
                    </div>
                ) : showApplyForm ? (
                    <div className="space-y-2">
                        <textarea
                            value={coverNote}
                            onChange={e => setCoverNote(e.target.value)}
                            placeholder="Optional cover note…"
                            rows={2}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleApply}
                                disabled={applying}
                                className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {applying ? 'Submitting…' : 'Submit Application'}
                            </button>
                            <button
                                onClick={() => setShowApplyForm(false)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowApplyForm(true)}
                        className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Apply Now
                    </button>
                )
            )}
        </div>
    );
};
