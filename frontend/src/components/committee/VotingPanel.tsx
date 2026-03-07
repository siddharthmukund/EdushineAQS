import React, { useEffect, useState } from 'react';
import { getVotes, submitVote } from '../../services/api';
import type { CommitteeIdentity } from './CommitteeSetup';

interface VoteTally {
    strong_yes: number;
    yes: number;
    maybe: number;
    no: number;
    strong_no: number;
}

interface Props {
    committeeId: string;
    candidateId: string;
    identity: CommitteeIdentity;
    onVoteCast?: (vote: string) => void;
}

const VOTE_OPTIONS = [
    { value: 'strong_yes', label: '++ Strong Yes', bg: 'bg-green-600 hover:bg-green-700', border: 'border-green-600' },
    { value: 'yes', label: '+ Yes', bg: 'bg-green-400 hover:bg-green-500', border: 'border-green-400' },
    { value: 'maybe', label: '± Maybe', bg: 'bg-yellow-400 hover:bg-yellow-500', border: 'border-yellow-400' },
    { value: 'no', label: '- No', bg: 'bg-red-400 hover:bg-red-500', border: 'border-red-400' },
    { value: 'strong_no', label: '-- Strong No', bg: 'bg-red-600 hover:bg-red-700', border: 'border-red-600' },
] as const;

export const VotingPanel: React.FC<Props> = ({ committeeId, candidateId, identity, onVoteCast }) => {
    const [tally, setTally] = useState<VoteTally>({ strong_yes: 0, yes: 0, maybe: 0, no: 0, strong_no: 0 });
    const [total, setTotal] = useState(0);
    const [myVote, setMyVote] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [showComment, setShowComment] = useState(false);

    useEffect(() => {
        loadVotes();
    }, [committeeId, candidateId]);

    const loadVotes = async () => {
        try {
            const data = await getVotes(committeeId, candidateId);
            setTally(data.tally as unknown as VoteTally);
            setTotal(data.total);
            const mine = data.details?.find((d: any) => d.member_email === identity.email);
            if (mine) setMyVote(mine.vote);
        } catch { /* silent */ }
    };

    const handleVote = async (vote: string) => {
        setLoading(true);
        try {
            await submitVote(committeeId, candidateId, vote, identity.sessionToken, comment || undefined);
            setMyVote(vote);
            setComment('');
            setShowComment(false);
            onVoteCast?.(vote);
            await loadVotes();
        } catch (e: any) {
            alert(e.message || 'Vote failed');
        } finally {
            setLoading(false);
        }
    };

    const maxCount = Math.max(...Object.values(tally), 1);

    return (
        <div className="space-y-4">
            {/* My vote buttons */}
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Vote</p>
                <div className="flex flex-col gap-1.5">
                    {VOTE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { setShowComment(true); handleVote(opt.value); }}
                            disabled={loading}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-white transition-all ${opt.bg}
                                ${myVote === opt.value ? 'ring-2 ring-offset-1 ring-gray-400' : ''}
                                disabled:opacity-60`}
                        >
                            {opt.label} {myVote === opt.value && '✓'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Optional comment */}
            {showComment && (
                <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add reasoning (optional)…"
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
            )}

            {/* Tally visualization */}
            {total > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Committee Votes ({total})</p>
                    <div className="space-y-1.5">
                        {VOTE_OPTIONS.map(opt => {
                            const count = tally[opt.value as keyof VoteTally];
                            return (
                                <div key={opt.value} className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-20 truncate">{opt.label.replace(/[+\-±]/g, '').trim()}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 border ${opt.border}`}
                                            style={{ width: `${(count / maxCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 w-4 text-right">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
