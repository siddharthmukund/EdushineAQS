import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../stores/analysisStore';
import { FileSearch, Layers, Clock, TrendingUp, Users } from 'lucide-react';
import { formatDate, getScoreColor } from '../utils/formatters';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { history, loadHistoryFromDB } = useAnalysisStore();

    useEffect(() => {
        loadHistoryFromDB();
    }, [loadHistoryFromDB]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            <div className="mb-10 text-center max-w-2xl mx-auto">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                    Academic CV Analyzer
                </h1>
                <p className="text-xl text-gray-500">
                    AI-powered hiring intelligence for academic and research positions. Extract structured insights in seconds.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 max-w-6xl mx-auto">
                <div
                    onClick={() => navigate('/')}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-transparent hover:border-blue-400 hover:shadow-lg cursor-pointer transition-all duration-300 group ring-1 ring-gray-100"
                >
                    <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                        <FileSearch className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Single Analysis</h2>
                    <p className="text-sm text-gray-500">Generate Academic Quality Scores and validation reports.</p>
                </div>

                <div
                    onClick={() => navigate('/batch')}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-transparent hover:border-indigo-400 hover:shadow-lg cursor-pointer transition-all duration-300 group ring-1 ring-gray-100"
                >
                    <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                        <Layers className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Batch Processing</h2>
                    <p className="text-sm text-gray-500">Rank up to 50 CVs against a structured job description.</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-2xl p-6 shadow-md border border-indigo-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 rounded-full bg-white opacity-5"></div>
                    <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                        <TrendingUp className="w-6 h-6 text-indigo-200" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Predictive Success</h2>
                    <p className="text-sm text-indigo-200">ML-driven forecasting of candidate tenure and potential impact.</p>
                </div>

                <div className="bg-gradient-to-br from-teal-800 to-emerald-800 rounded-2xl p-6 shadow-md border border-teal-700 relative overflow-hidden group">
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white opacity-5"></div>
                    <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                        <Users className="w-6 h-6 text-teal-200" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Diversity Analytics</h2>
                    <p className="text-sm text-teal-100">Simulate and measure institutional inclusivity and bias warnings.</p>
                </div>
            </div>

            {history && history.length > 0 && (
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-2 mb-6">
                        <Clock className="w-5 h-5 text-gray-400" />
                        <h3 className="text-lg font-bold text-gray-900">Recent Analyses</h3>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-left overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Candidate</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">AQS</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recommendation</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {history.slice(0, 5).map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.candidate_name || 'Unknown'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`font-bold ${getScoreColor(item.scores.overall_aqs)}`}>{item.scores.overall_aqs.toFixed(1)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.recommendation}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-right">{formatDate(item.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
};
