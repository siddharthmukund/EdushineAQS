import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getDiversityAnalytics, type DiversityAnalyticsResponse } from '../../services/api';
import { AlertTriangle, Users, Building2, Globe } from 'lucide-react';

interface Props {
    batchId: string;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export const DiversityDashboard: React.FC<Props> = ({ batchId }) => {
    const [data, setData] = useState<DiversityAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getDiversityAnalytics(batchId)
            .then(setData)
            .catch(e => setError(e.message || 'Failed to load diversity analytics'))
            .finally(() => setLoading(false));
    }, [batchId]);

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">Loading diversity analytics…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
        );
    }

    if (!data) return null;

    const a = data.analytics;
    const gender = a.simulated_demographics?.gender || {};
    const ethnicity = a.simulated_demographics?.ethnicity || {};

    const genderData = [
        { name: 'Female', value: gender.female ?? 0 },
        { name: 'Male', value: gender.male ?? 0 },
        { name: 'Other / Undisclosed', value: gender.non_binary_or_undisclosed ?? 0 },
    ].filter(d => d.value > 0);

    const ethnicityData = [
        { name: 'Underrepresented', value: ethnicity.underrepresented ?? 0 },
        { name: 'Majority', value: ethnicity.majority ?? 0 },
        { name: 'Undisclosed', value: ethnicity.undisclosed ?? 0 },
    ].filter(d => d.value > 0);

    const diversityScore = a.institutional_diversity.score;
    const scoreColor =
        diversityScore >= 70 ? 'bg-green-500' :
            diversityScore >= 40 ? 'bg-yellow-500' :
                'bg-red-500';

    return (
        <div className="space-y-6">
            {/* Top metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                    icon={<Users className="w-5 h-5 text-indigo-600" />}
                    label="Candidates Analyzed"
                    value={String(a.total_candidates_analyzed)}
                    bg="bg-indigo-50"
                />
                <MetricCard
                    icon={<Building2 className="w-5 h-5 text-emerald-600" />}
                    label="Unique Institutions"
                    value={String(a.institutional_diversity.unique_institutions)}
                    bg="bg-emerald-50"
                />
                <MetricCard
                    icon={<Globe className="w-5 h-5 text-blue-600" />}
                    label="Inclusivity Index"
                    value={`${a.inclusivity_index.toFixed(1)} / 100`}
                    bg="bg-blue-50"
                />
            </div>

            {/* Institutional diversity score bar */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">Institutional Diversity Score</h4>
                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all duration-700 ${scoreColor}`}
                            style={{ width: `${diversityScore}%` }}
                        />
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-12 text-right">
                        {diversityScore.toFixed(0)}%
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Based on {a.institutional_diversity.unique_institutions} unique institutions across {a.total_candidates_analyzed} candidates
                </p>
            </div>

            {/* Pie charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartCard title="Gender Distribution (Simulated)" data={genderData} />
                <ChartCard title="Ethnicity Distribution (Simulated)" data={ethnicityData} />
            </div>

            {/* Bias warnings */}
            {(a.systemic_bias_warnings || []).length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <h4 className="font-semibold text-yellow-800">Potential Bias Alerts</h4>
                    </div>
                    <ul className="space-y-1.5">
                        {(a.systemic_bias_warnings || []).map((w, i) => (
                            <li key={i} className="text-sm text-yellow-700">• {w}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Recommendation */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <span className="font-semibold">Recommendation: </span>{a.recommendation}
            </div>

            <p className="text-xs text-gray-400 text-center">
                * Demographic data is simulated for demonstration. In production, use self-reported EEO data.
            </p>
        </div>
    );
};

function MetricCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
    return (
        <div className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-600">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}

function ChartCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-4 text-sm">{title}</h4>
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {data.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v} candidates`} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
