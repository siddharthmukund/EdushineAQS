import React from 'react';
import { Target, TrendingUp, AlertTriangle, MessageSquare } from 'lucide-react';

interface FitmentAnalysisProps {
    fitment?: {
        strengths?: string[];
        gaps?: string[];
        interview_topics?: string[];
    };
}

export const FitmentAnalysis: React.FC<FitmentAnalysisProps> = ({ fitment }) => {
    if (!fitment || (!fitment.strengths?.length && !fitment.gaps?.length && !fitment.interview_topics?.length)) {
        return (
            <div className="bg-white rounded-xl shadow p-8 text-center border border-gray-100">
                <Target className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-900">No Fitment Data</h3>
                <p className="mt-1 text-gray-500">Provide a Job Description to generate a tailored fitment analysis.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden h-full">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Role Fitment Analysis</h3>
            </div>

            <div className="p-6 space-y-8">
                {fitment.strengths && fitment.strengths.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            <h4 className="font-bold text-emerald-800">Key Strengths</h4>
                        </div>
                        <ul className="space-y-2 pl-7 list-disc list-outside marker:text-emerald-400 text-gray-700 text-sm leading-relaxed">
                            {fitment.strengths.map((str, i) => (
                                <li key={i}>{str}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {fitment.gaps && fitment.gaps.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 mt-6 border-t border-gray-100 pt-6">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h4 className="font-bold text-amber-800">Potential Gaps</h4>
                        </div>
                        <ul className="space-y-2 pl-7 list-disc list-outside marker:text-amber-400 text-gray-700 text-sm leading-relaxed">
                            {fitment.gaps.map((gap, i) => (
                                <li key={i}>{gap}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {fitment.interview_topics && fitment.interview_topics.length > 0 && (
                    <div className="bg-blue-50 -mx-6 -mb-6 p-6 mt-6 border-t border-blue-100">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                            <h4 className="font-bold text-blue-900">Suggested Interview Topics</h4>
                        </div>
                        <ul className="space-y-3">
                            {fitment.interview_topics.map((topic, i) => (
                                <li key={i} className="flex gap-3 bg-white p-3 rounded-lg border border-blue-100 text-sm text-gray-700 shadow-sm">
                                    <span className="font-bold text-blue-600 shrink-0">Q{i + 1}:</span>
                                    <span>{topic}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};
