import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { JobApplication } from '../../types/api';

interface Props {
    application: JobApplication;
    jobTitle?: string;
    institution?: string;
}

const STATUS_ORDER = ['submitted', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected'];

const STATUS_COLORS: Record<string, string> = {
    submitted: 'bg-gray-300',
    reviewing: 'bg-blue-400',
    shortlisted: 'bg-indigo-500',
    interviewed: 'bg-purple-500',
    offered: 'bg-green-500',
    rejected: 'bg-red-400',
};

const STATUS_LABELS: Record<string, string> = {
    submitted: 'Submitted',
    reviewing: 'Under Review',
    shortlisted: 'Shortlisted',
    interviewed: 'Interviewed',
    offered: 'Offer Extended',
    rejected: 'Not Selected',
};

export const ApplicationStatusCard: React.FC<Props> = ({ application, jobTitle, institution }) => {
    const [expanded, setExpanded] = useState(false);
    const currentIdx = STATUS_ORDER.indexOf(application.status);

    return (
        <div className={`bg-white rounded-xl border shadow-sm p-5 ${application.status === 'offered' ? 'border-green-200' : application.status === 'rejected' ? 'border-red-100' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm truncate">{jobTitle || 'Job Application'}</h4>
                    {institution && <p className="text-xs text-gray-500">{institution}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">Applied {new Date(application.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full text-white ${STATUS_COLORS[application.status] || 'bg-gray-300'}`}>
                    {STATUS_LABELS[application.status] || application.status}
                </span>
            </div>

            {/* Progress dots — only for non-rejected */}
            {application.status !== 'rejected' && (
                <div className="flex items-center gap-1 mt-4">
                    {['submitted', 'reviewing', 'shortlisted', 'interviewed', 'offered'].map((step, i) => {
                        const idx = STATUS_ORDER.indexOf(step);
                        const done = idx <= currentIdx;
                        const active = idx === currentIdx;
                        return (
                            <React.Fragment key={step}>
                                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${done ? (active ? STATUS_COLORS[application.status] : 'bg-indigo-500') : 'bg-gray-200'}`} />
                                {i < 4 && <div className={`flex-1 h-0.5 ${done && !active ? 'bg-indigo-400' : 'bg-gray-100'}`} />}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* History toggle */}
            {(application.status_history || []).length > 0 && (
                <>
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-3"
                    >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {expanded ? 'Hide history' : `Show history (${application.status_history.length} events)`}
                    </button>
                    {expanded && (
                        <div className="mt-2 space-y-1.5 border-t border-gray-50 pt-2">
                            {application.status_history.map((h, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[h.status] || 'bg-gray-300'}`} />
                                    <div>
                                        <span className="font-medium">{STATUS_LABELS[h.status] || h.status}</span>
                                        {h.note && <span className="text-gray-400"> — {h.note}</span>}
                                        <span className="text-gray-400 ml-2">{new Date(h.changed_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {application.cover_note && (
                <p className="text-xs text-gray-500 italic mt-3 border-t border-gray-50 pt-2">"{application.cover_note}"</p>
            )}
        </div>
    );
};
