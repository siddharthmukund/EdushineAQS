import React, { useEffect, useState, useRef } from 'react';
import { getComments, addComment } from '../../services/api';
import type { CommitteeIdentity } from './CommitteeSetup';
import { MessageCircle, CornerDownRight } from 'lucide-react';

interface Comment {
    id: string;
    author_name: string;
    author_email: string;
    comment: string;
    parent_id: string | null;
    created_at: string;
}

interface Props {
    committeeId: string;
    candidateId: string;
    identity: CommitteeIdentity;
    newCommentPayload?: Comment | null;  // injected from WebSocket
}

export const CommentThread: React.FC<Props> = ({ committeeId, candidateId, identity, newCommentPayload }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadComments();
    }, [committeeId, candidateId]);

    useEffect(() => {
        if (newCommentPayload) {
            setComments(prev => [...prev, newCommentPayload]);
        }
    }, [newCommentPayload]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const loadComments = async () => {
        try {
            const data = await getComments(committeeId, candidateId);
            setComments(data.comments);
        } catch { /* silent */ }
    };

    const handleSubmit = async () => {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const c = await addComment(committeeId, candidateId, text, identity.sessionToken, replyTo ?? undefined);
            setComments(prev => [...prev, c]);
            setText('');
            setReplyTo(null);
        } catch (e: any) {
            alert(e.message || 'Failed to post comment');
        } finally {
            setLoading(false);
        }
    };

    const roots = comments.filter(c => !c.parent_id);
    const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-64">
                {comments.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No comments yet. Be the first.</p>
                )}
                {roots.map(c => (
                    <div key={c.id}>
                        <CommentBubble
                            comment={c}
                            isMe={c.author_email === identity.email}
                            onReply={() => setReplyTo(c.id)}
                        />
                        {replies(c.id).map(r => (
                            <div key={r.id} className="ml-6 mt-1">
                                <div className="flex items-start gap-1 text-gray-300">
                                    <CornerDownRight className="w-3 h-3 mt-1 shrink-0" />
                                    <CommentBubble
                                        comment={r}
                                        isMe={r.author_email === identity.email}
                                        onReply={() => setReplyTo(c.id)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {replyTo && (
                <p className="text-xs text-indigo-600 mb-1 flex items-center gap-1">
                    <CornerDownRight className="w-3 h-3" />
                    Replying to comment
                    <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
                </p>
            )}

            <div className="flex gap-2 mt-3">
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    placeholder="Add a comment… (Enter to send)"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                    onClick={handleSubmit}
                    disabled={loading || !text.trim()}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                    <MessageCircle className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

function CommentBubble({ comment, isMe, onReply }: { comment: Comment; isMe: boolean; onReply: () => void }) {
    const initials = comment.author_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return (
        <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                {initials}
            </div>
            <div className={`max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    <p className="font-medium text-xs mb-0.5 opacity-70">{comment.author_name}</p>
                    {comment.comment}
                </div>
                <button onClick={onReply} className="text-xs text-gray-400 hover:text-indigo-600 mt-0.5 ml-1">Reply</button>
            </div>
        </div>
    );
}
