import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScoreCardProps {
    scores: {
        overall_aqs: number;
        percentile?: number;
        research?: {
            total: number;
            breakdown: {
                quality: number;
                productivity: number;
                citations: number;
                position: number;
                bonus: number;
            };
        };
        education?: {
            total: number;
            breakdown: {
                degree: number;
                alignment: number;
                honors: number;
            };
        };
        teaching?: {
            total: number;
            breakdown: {
                experience: number;
                feedback: number;
                diversity: number;
                innovation: number;
            };
        };
    };
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ scores }) => {
    const [expanded, setExpanded] = useState(false);

    const getScoreColor = (score: number): string => {
        if (score >= 85) return 'text-emerald-600';
        if (score >= 70) return 'text-blue-600';
        if (score >= 60) return 'text-amber-600';
        return 'text-red-600';
    };

    const getScoreLabel = (score: number): string => {
        if (score >= 85) return 'Excellent';
        if (score >= 70) return 'Strong';
        if (score >= 60) return 'Good';
        return 'Needs Improvement';
    };

    // Safe defaults if API hasn't generated proper breakdown
    const research = scores.research || { total: 0, breakdown: {} };
    const education = scores.education || { total: 0, breakdown: {} };
    const teaching = scores.teaching || { total: 0, breakdown: {} };

    return (
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
            {/* Overall Score */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    Academic Quality Score
                </h2>
                <div className="relative inline-block">
                    <svg className="w-40 h-40 drop-shadow-sm">
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            fill="none"
                            stroke="#f3f4f6"
                            strokeWidth="12"
                        />
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="12"
                            strokeDasharray={`${(scores.overall_aqs / 100) * 439.6} 439.6`}
                            strokeLinecap="round"
                            transform="rotate(-90 80 80)"
                            className={`transition-all duration-1000 ease-in-out ${getScoreColor(scores.overall_aqs)}`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-5xl font-extrabold tracking-tight ${getScoreColor(scores.overall_aqs)}`}>
                            {scores.overall_aqs.toFixed(1)}
                        </span>
                        <span className="text-sm font-medium text-gray-400">/100</span>
                    </div>
                </div>
                <div className="mt-4">
                    <p className="text-lg font-bold text-gray-700">
                        {getScoreLabel(scores.overall_aqs)}
                    </p>
                    {scores.percentile && (
                        <p className="text-sm font-medium text-gray-500 mt-1 bg-gray-100 inline-block px-3 py-1 rounded-full">
                            Top {100 - scores.percentile}th percentile
                        </p>
                    )}
                </div>
            </div>

            {/* Component Scores */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <ScoreBox
                    label="Research"
                    score={research.total}
                    color={getScoreColor(research.total)}
                />
                <ScoreBox
                    label="Education"
                    score={education.total}
                    color={getScoreColor(education.total)}
                />
                <ScoreBox
                    label="Teaching"
                    score={teaching.total}
                    color={getScoreColor(teaching.total)}
                />
            </div>

            {/* Breakdown Toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 py-3 rounded-lg font-semibold transition-colors"
            >
                {expanded ? 'Hide' : 'Show'} Detailed Breakdown
                {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {/* Detailed Breakdown */}
            {expanded && (
                <div className="mt-6 space-y-6 pt-4 border-t border-gray-100 animate-in slide-in-from-top-4 fade-in duration-300">
                    <BreakdownSection
                        title="Research Score"
                        total={research.total}
                        breakdown={research.breakdown}
                    />
                    <BreakdownSection
                        title="Education Score"
                        total={education.total}
                        breakdown={education.breakdown}
                    />
                    <BreakdownSection
                        title="Teaching Score"
                        total={teaching.total}
                        breakdown={teaching.breakdown}
                    />
                </div>
            )}
        </div>
    );
};

// Helper component: Score box
const ScoreBox: React.FC<{ label: string; score: number; color: string }> = ({
    label,
    score,
    color,
}) => (
    <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
        <p className={`text-3xl font-bold ${color}`}>{score.toFixed(0)}</p>
    </div>
);

// Helper component: Breakdown section
const BreakdownSection: React.FC<{
    title: string;
    total: number;
    breakdown: Record<string, number>;
}> = ({ title, total, breakdown }) => (
    <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-gray-800">
                {title}
            </h4>
            <span className="font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded text-sm">
                {total.toFixed(0)} / 100
            </span>
        </div>
        <div className="space-y-2">
            {Object.entries(breakdown || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm items-center border-b border-gray-200 border-dashed pb-1 last:border-0 last:pb-0">
                    <span className="text-gray-600 font-medium capitalize">
                        {key.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-gray-900">{typeof value === 'number' ? value.toFixed(1) : value} pts</span>
                </div>
            ))}
        </div>
    </div>
);
