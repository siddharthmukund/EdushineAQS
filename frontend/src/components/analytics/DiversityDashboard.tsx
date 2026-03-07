import React, { useState, useEffect } from 'react';
import { getDiversityAnalytics, type DiversityAnalyticsResponse } from '../../services/api';
import { Users, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';

interface DiversityDashboardProps {
    batchId: string;
}

export const DiversityDashboard: React.FC<DiversityDashboardProps> = ({ batchId }) => {
    const [analytics, setAnalytics] = useState<DiversityAnalyticsResponse['analytics'] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const data = await getDiversityAnalytics(batchId);
                setAnalytics(data.analytics);
            } catch (err: any) {
                setError('Failed to load diversity analytics.');
            } finally {
                setIsLoading(false);
            }
        };

        if (batchId) {
            fetchAnalytics();
        }
    }, [batchId]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse mt-8">
                <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="h-20 bg-gray-100 rounded"></div>
                    <div className="h-20 bg-gray-100 rounded"></div>
                    <div className="h-20 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !analytics) {
        return null;
    }

    const {
        total_candidates_analyzed,
        institutional_diversity,
        simulated_demographics,
        inclusivity_index,
        systemic_bias_warnings,
        recommendation
    } = analytics;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
            <div className="bg-gradient-to-r from-teal-800 to-emerald-800 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-teal-200" />
                    <h2 className="text-lg font-bold">Diversity & Inclusion Analytics</h2>
                </div>
                <span className="text-sm font-medium opacity-80">{total_candidates_analyzed} Candidates Evaluated</span>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Inclusivity Index */}
                    <div className="bg-teal-50 rounded-xl p-5 border border-teal-100 flex flex-col items-center justify-center text-center">
                        <p className="text-teal-700 text-sm font-semibold uppercase tracking-wider mb-2">Inclusivity Index</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-teal-900">{inclusivity_index.toFixed(1)}</span>
                            <span className="text-teal-600 font-medium">/100</span>
                        </div>
                        <p className="text-xs text-teal-600 mt-2">Distribution Fairness Score</p>
                    </div>

                    {/* Institutional Diversity */}
                    <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 flex flex-col items-center justify-center text-center">
                        <Building2 className="w-8 h-8 text-blue-500 mb-2" />
                        <p className="text-blue-900 font-bold text-xl">{institutional_diversity.unique_institutions} Institutions</p>
                        <p className="text-xs text-blue-700 mt-1 uppercase tracking-wider font-semibold">
                            Score: {institutional_diversity.score.toFixed(1)}/100
                        </p>
                    </div>

                    {/* Breakdown (Simulated) */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3 text-center">Simulated Demographics</p>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium text-gray-700">Female Candidates</span>
                                    <span className="text-gray-500">{simulated_demographics.gender.female}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${(simulated_demographics.gender.female / total_candidates_analyzed) * 100}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium text-gray-700">Underrepresented Minorities</span>
                                    <span className="text-gray-500">{simulated_demographics.ethnicity.underrepresented}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(simulated_demographics.ethnicity.underrepresented / total_candidates_analyzed) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recommendations and Warnings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {systemic_bias_warnings.length > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-red-800 mb-2">
                                <AlertCircle className="w-4 h-4" /> Systemic Bias Warnings
                            </h4>
                            <ul className="space-y-1">
                                {systemic_bias_warnings.map((warning, idx) => (
                                    <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                                        <span className="mt-0.5">•</span> {warning}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-800 mb-2">
                            <CheckCircle2 className="w-4 h-4" /> Recommendation
                        </h4>
                        <p className="text-sm text-emerald-700 font-medium">
                            {recommendation}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
