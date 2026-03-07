import React from 'react';
import type { AnalysisResult } from '../../types/api';
import { getScoreColor } from '../../utils/formatters';
import { ChevronRight } from 'lucide-react';

interface CandidateTableProps {
    candidates: AnalysisResult[];
    onSelect: (candidate: AnalysisResult) => void;
}

export const CandidateTable: React.FC<CandidateTableProps> = ({ candidates, onSelect }) => {
    if (candidates.length === 0) return null;

    // Sort by AQS descending
    const sorted = [...candidates].sort((a, b) => b.scores.overall_aqs - a.scores.overall_aqs);

    return (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Rank / Candidate
                            </th>
                            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                AQS Score
                            </th>
                            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Recommendation
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {sorted.map((cand, idx) => (
                            <tr
                                key={cand.id}
                                className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                onClick={() => onSelect(cand)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                                            #{idx + 1}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-semibold text-gray-900">
                                                {cand.candidate_name || `Candidate ${idx + 1}`}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className={`text-xl font-bold ${getScoreColor(cand.scores.overall_aqs)}`}>
                                        {cand.scores.overall_aqs.toFixed(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cand.recommendation === 'Strong Fit' ? 'bg-emerald-100 text-emerald-800' :
                                        cand.recommendation === 'Conditional Fit' ? 'bg-amber-100 text-amber-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {cand.recommendation || 'Need More Info'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button className="text-blue-600 hover:text-blue-900 group-hover:translate-x-1 transition-transform inline-flex items-center">
                                        Details
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
