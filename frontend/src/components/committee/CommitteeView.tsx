import React, { useEffect, useRef, useState } from 'react';
import type { AnalysisResult } from '../../types/api';
import type { CommitteeIdentity } from './CommitteeSetup';
import { VotingPanel } from './VotingPanel';
import { CommentThread } from './CommentThread';
import { ScoreCard } from '../analysis/ScoreCard';
import { Eye, ChevronLeft, ChevronRight, Wifi, WifiOff } from 'lucide-react';

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');

interface Props {
    candidates: AnalysisResult[];
    identity: CommitteeIdentity;
}

export const CommitteeView: React.FC<Props> = ({ candidates, identity }) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [activeViewers, setActiveViewers] = useState<string[]>([]);
    const [newComment, setNewComment] = useState<any>(null);
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    const current = candidates[currentIdx];

    // WebSocket connection
    useEffect(() => {
        const ws = new WebSocket(`${WS_BASE}/ws/committee/${identity.committeeId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            setWsConnected(true);
            ws.send(JSON.stringify({
                type: 'member_joined',
                member_name: identity.name,
                member_email: identity.email,
            }));
        };

        ws.onclose = () => setWsConnected(false);

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'user_viewing') {
                    setActiveViewers(prev => {
                        const filtered = prev.filter(v => v !== msg.member_name);
                        return [...filtered, msg.member_name];
                    });
                } else if (msg.type === 'comment_added') {
                    setNewComment(msg);
                }
            } catch { /* ignore */ }
        };

        return () => ws.close();
    }, [identity.committeeId]);

    // Announce which candidate we're viewing
    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'user_viewing',
                candidate_id: current?.id,
                member_name: identity.name,
            }));
        }
        setActiveViewers([]);
    }, [currentIdx]);

    const broadcastVote = (vote: string) => {
        wsRef.current?.send(JSON.stringify({
            type: 'vote_cast',
            candidate_id: current?.id,
            member_name: identity.name,
            vote,
        }));
    };

    if (!current) return <p className="text-center text-gray-500 py-8">No candidates to review.</p>;

    return (
        <div className="flex flex-col gap-4">
            {/* Top bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">
                        Candidate {currentIdx + 1} / {candidates.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                        {wsConnected
                            ? <Wifi className="w-4 h-4 text-green-500" />
                            : <WifiOff className="w-4 h-4 text-gray-400" />}
                        <span className="text-xs text-gray-500">{wsConnected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>

                {/* Active viewers */}
                {activeViewers.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-blue-50 rounded-full px-3 py-1">
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span>Also viewing: {activeViewers.join(', ')}</span>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                        disabled={currentIdx === 0}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setCurrentIdx(i => Math.min(candidates.length - 1, i + 1))}
                        disabled={currentIdx === candidates.length - 1}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: candidate profile */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">
                            {current.candidate_name || 'Unknown Candidate'}
                        </h3>
                        <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            current.recommendation === 'Strong Fit' ? 'bg-green-100 text-green-700' :
                            current.recommendation === 'Conditional Fit' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                            {current.recommendation}
                        </span>
                    </div>
                    <ScoreCard scores={current.scores as any} />
                </div>

                {/* Right: collaboration panel */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Voting */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Committee Vote</h4>
                        <VotingPanel
                            committeeId={identity.committeeId}
                            candidateId={current.id}
                            identity={identity}
                            onVoteCast={broadcastVote}
                        />
                    </div>

                    {/* Discussion */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Discussion</h4>
                        <CommentThread
                            committeeId={identity.committeeId}
                            candidateId={current.id}
                            identity={identity}
                            newCommentPayload={newComment}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
