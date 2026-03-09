import React, { useState, useEffect } from 'react';
import { getSuccessPrediction, type SuccessPredictionResponse } from '../../services/api';
import { TrendingUp, AlertTriangle, Lightbulb, Lock } from 'lucide-react';

interface Props {
    analysisId: string;
    candidateName?: string | null;
}

export const SuccessPrediction: React.FC<Props> = ({ analysisId }) => {
    const [prediction, setPrediction] = useState<SuccessPredictionResponse['prediction'] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPrediction = async () => {
            try {
                const data = await getSuccessPrediction(analysisId);
                setPrediction(data.prediction);
            } catch (err: any) {
                setError('Failed to load predictive analytics.');
            } finally {
                setIsLoading(false);
            }
        };

        if (analysisId) {
            fetchPrediction();
        }
    }, [analysisId]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
                <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 w-full bg-gray-100 rounded"></div>
                    <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !prediction) {
        return null; // Fail silently or show a small error state if preferred
    }

    const {
        success_probability_percent,
        expected_tenure_years,
        model_confidence,
    } = prediction;
    const success_drivers: string[] = prediction.success_drivers || [];
    const risk_factors: string[] = prediction.risk_factors || [];

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl shadow-lg border border-indigo-800 p-8 text-white relative overflow-hidden">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-blue-500 opacity-10 blur-2xl"></div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <TrendingUp className="w-5 h-5 text-indigo-300" />
                    </div>
                    <h2 className="text-xl font-bold">Predictive Success Modeling</h2>
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-950/50 border border-indigo-800/50">
                        <Lock className="w-3 h-3" /> AI Insights
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Primary Metrics */}
                    <div className="flex flex-col justify-center">
                        <div className="flex items-end gap-2 mb-1">
                            <span className="text-5xl font-black tracking-tight text-white drop-shadow-md">
                                {success_probability_percent}%
                            </span>
                        </div>
                        <p className="text-indigo-200 text-sm font-medium">Estimated Success Probability</p>

                        <div className="mt-6 flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                            <div>
                                <p className="text-xs text-indigo-300 uppercase tracking-wider font-semibold">Expected Tenure</p>
                                <p className="text-xl font-bold">{expected_tenure_years} Years</p>
                            </div>
                            <div className="h-10 w-px bg-white/10 mx-4"></div>
                            <div>
                                <p className="text-xs text-indigo-300 uppercase tracking-wider font-semibold">Model Confidence</p>
                                <p className={`text-xl font-bold ${model_confidence === 'High' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {model_confidence}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Drivers & Risks */}
                    <div className="space-y-4">
                        {success_drivers.length > 0 && (
                            <div className="bg-white/5 rounded-xl p-4 border border-emerald-500/20">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-300 mb-2">
                                    <Lightbulb className="w-4 h-4" /> Success Drivers
                                </h4>
                                <ul className="space-y-2">
                                    {success_drivers.map((driver, idx) => (
                                        <li key={idx} className="text-sm text-indigo-100 flex items-start gap-2 leading-tight">
                                            <span className="text-emerald-400 mt-0.5">•</span> {driver}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {risk_factors.length > 0 && (
                            <div className="bg-white/5 rounded-xl p-4 border border-amber-500/20">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-amber-300 mb-2">
                                    <AlertTriangle className="w-4 h-4" /> Risk Factors
                                </h4>
                                <ul className="space-y-2">
                                    {risk_factors.map((risk, idx) => (
                                        <li key={idx} className="text-sm text-indigo-100 flex items-start gap-2 leading-tight">
                                            <span className="text-amber-400 mt-0.5">•</span> {risk}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
