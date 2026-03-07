import React, { useState } from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { analyzeCV } from '../services/api';
import { cvWorkerPool } from '../workers/adaptive-worker-pool';
import { CVUploader } from '../components/upload/CVUploader';
import { JDInput } from '../components/upload/JDInput';
import { JDUploader, type ParsedJD } from '../components/upload/JDUploader';
import { JDPreviewPanel } from '../components/upload/JDPreviewPanel';
import { ScoreCard } from '../components/analysis/ScoreCard';
import { ValidationReport } from '../components/analysis/ValidationReport';
import { FitmentAnalysis } from '../components/analysis/FitmentAnalysis';
import { SuccessPrediction } from '../components/analysis/SuccessPrediction';
import { InterviewPrep } from '../components/analysis/InterviewPrep';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AlertCircle, RefreshCcw } from 'lucide-react';

type ResultTab = 'overview' | 'fitment' | 'validation' | 'interview';

export const SingleAnalysis: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [jd, setJd] = useState('');
    const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
    const [model, setModel] = useState('anthropic/claude-3-5-sonnet-20241022');
    const [resultTab, setResultTab] = useState<ResultTab>('overview');

    const {
        currentAnalysis,
        isLoading,
        error,
        setCurrentAnalysis,
        addToHistory,
        setLoading,
        setError
    } = useAnalysisStore();

    const handleAnalyze = async () => {
        if (!file) {
            setError("Please select a CV file first.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let finalJd = jd;
            if (parsedJD) {
                finalJd = `
# JOB REQUIREMENTS (Structured)

## Position Details
- Title: ${parsedJD.structured.positionTitle || 'N/A'}
- Rank: ${parsedJD.structured.rank || 'N/A'}
- Type: ${parsedJD.structured.positionType}

## Required Qualifications (MUST HAVE)
${JSON.stringify(parsedJD.structured.required, null, 2)}

## Preferred Qualifications (NICE TO HAVE)
${JSON.stringify(parsedJD.structured.preferred, null, 2)}

## Additional Details (Full Text)
${parsedJD.rawText}
`;
            }

            let uploadFile = file;
            try {
                const parseResult = await cvWorkerPool.processCV(file, 'high');
                if (parseResult.success && parseResult.text) {
                    uploadFile = new File([parseResult.text], file.name.replace('.pdf', '.txt'), { type: 'text/plain' });
                }
            } catch (e) {
                console.warn("Local PDF parsing failed, falling back to server...", e);
            }

            const result = await analyzeCV(uploadFile, finalJd, model);
            setCurrentAnalysis(result);
            addToHistory(result);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred during analysis.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setJd('');
        setParsedJD(null);
        setCurrentAnalysis(null);
        setError(null);
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-20 flex justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    // Has Results view
    if (currentAnalysis) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Analysis Results</h1>
                        <p className="text-gray-500 mt-1">Candidate: <span className="font-semibold text-gray-700">{currentAnalysis.candidate_name || file?.name.replace('.pdf', '') || 'Unknown'}</span></p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        New Analysis
                    </button>
                </div>

                {/* Result tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
                    {([
                        { key: 'overview',   label: 'Scores' },
                        { key: 'fitment',    label: 'Fitment' },
                        { key: 'validation', label: 'Publications' },
                        { key: 'interview',  label: 'Interview Prep' },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setResultTab(tab.key)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                resultTab === tab.key
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {resultTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-5">
                            <ScoreCard scores={currentAnalysis.scores as any} />
                        </div>
                        <div className="lg:col-span-7">
                            <SuccessPrediction analysisId={currentAnalysis.id} candidateName={currentAnalysis.candidate_name} />
                        </div>
                    </div>
                )}

                {resultTab === 'fitment' && (
                    <FitmentAnalysis fitment={currentAnalysis.fitment} />
                )}

                {resultTab === 'validation' && (
                    <ValidationReport publications={currentAnalysis.validation?.publications || []} />
                )}

                {resultTab === 'interview' && (
                    <InterviewPrep analysisId={currentAnalysis.id} />
                )}
            </div>
        );
    }

    // Upload View
    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Analyze a Single CV</h1>
                <p className="text-gray-500">Upload an academic CV and optional job description to get instant AQS scores and validation.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">1. Upload Curriculum Vitae</h2>
                    <CVUploader
                        selectedFile={file}
                        onFileSelect={(f) => { setFile(f); setError(null); }}
                        error={error && !file ? error : undefined}
                    />
                </div>

                <div className="border-t border-gray-100 pt-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">2. Job Context (Optional)</h2>
                    {!parsedJD ? (
                        <div className="space-y-6">
                            <JDUploader onJDParsed={setParsedJD} />
                            <div className="flex items-center gap-3">
                                <div className="h-px bg-gray-200 flex-1"></div>
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">OR PASTE TEXT</span>
                                <div className="h-px bg-gray-200 flex-1"></div>
                            </div>
                            <JDInput value={jd} onChange={setJd} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <JDPreviewPanel
                                parsedJD={parsedJD}
                                onUpdate={setParsedJD}
                                onClear={() => setParsedJD(null)}
                            />
                            {jd && (
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>Your manually entered text will be ignored in favor of the uploaded context file. Clear the file to use manual text.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-100 pt-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">3. Select LLM Model</h2>
                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-3 shadow-sm outline-none transition-colors"
                    >
                        <option value="anthropic/claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
                        <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
                        <option value="gemini/gemini-2.5-pro">Gemini 2.5 Pro (Google)</option>
                    </select>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 shrink-0" />
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={handleAnalyze}
                        disabled={!file}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-md transition-all ${file
                            ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                            : 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none'
                            }`}
                    >
                        Analyze Candidate
                    </button>
                </div>
            </div>
        </div>
    );
};
