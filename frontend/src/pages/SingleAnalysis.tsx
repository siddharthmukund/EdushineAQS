import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../stores/analysisStore';
import { analyzeCV, GuestLimitError } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { GuestTrialModal } from '../components/common/GuestTrialModal';
import { ApiSetupWizard } from '../components/common/ApiSetupWizard';
import { useConfigStatus } from '../hooks/useConfigStatus';
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
import { AlertCircle, RefreshCcw, Sparkles, Settings2 } from 'lucide-react';

type ResultTab = 'overview' | 'fitment' | 'validation' | 'interview';

export const SingleAnalysis: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();

    const [file, setFile] = useState<File | null>(null);
    const [jd, setJd] = useState('');
    const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
    const [model, setModel] = useState('gemini/gemini-2.0-flash');
    const [resultTab, setResultTab] = useState<ResultTab>('overview');
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [showSetupWizard, setShowSetupWizard] = useState(false);

    // Check if any LLM provider is configured; refresh after wizard completes
    const { anyConfigured, loading: configLoading, refresh: refreshConfig } = useConfigStatus();

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
            // Show the "trial complete" modal for guests after a successful analysis
            if (!isAuthenticated) setShowGuestModal(true);
        } catch (err: any) {
            console.error(err);
            if (err instanceof GuestLimitError) {
                // Guest has already used their free trial — prompt to register
                setShowGuestModal(true);
            } else if (err.response?.status === 503) {
                // LLM not configured — open the setup wizard automatically
                setShowSetupWizard(true);
                setError('LLM API key not configured or invalid. Use the setup wizard to add one.');
            } else if (err.response?.status === 429) {
                // Rate limit / quota exhausted
                setError(
                    'LLM quota or rate limit exceeded. ' +
                    'Free-tier limits apply — wait a moment and try again, or select a different model.'
                );
            } else {
                // FastAPI 422 returns detail as an array of validation objects;
                // other errors return a plain string. Always coerce to string so
                // React can render it without crashing.
                const raw = err.response?.data?.detail;
                const detail = Array.isArray(raw)
                    ? raw.map((d: any) => d.msg ?? JSON.stringify(d)).join(' · ')
                    : (typeof raw === 'string' ? raw : null);
                setError(detail || err.message || 'An error occurred during analysis.');
            }
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
            <>
            {showGuestModal && <GuestTrialModal onClose={() => setShowGuestModal(false)} />}
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
            </>
        );
    }

    // Upload View
    return (
        <>
        {showGuestModal && <GuestTrialModal onClose={() => setShowGuestModal(false)} />}
        {showSetupWizard && (
            <ApiSetupWizard
                onClose={() => setShowSetupWizard(false)}
                onConfigured={() => { refreshConfig(); setError(null); }}
            />
        )}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

            {/* LLM not-configured warning banner */}
            {!configLoading && !anyConfigured && (
                <div className="mb-6 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Settings2 className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">No LLM API key configured</p>
                            <p className="text-xs text-amber-600 mt-0.5">
                                CV analysis requires an API key from Anthropic, OpenAI, or Google.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSetupWizard(true)}
                        className="shrink-0 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                    >
                        Set up now →
                    </button>
                </div>
            )}

            {/* Guest trial banner */}
            {!isAuthenticated && (
                <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
                        <p className="text-sm text-blue-800">
                            <span className="font-semibold">Free trial</span> — analyse 1 CV without an account.
                            <span className="ml-1 text-blue-600">Sign up to unlock unlimited analyses.</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
                        >
                            Sign in
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Get started
                        </button>
                    </div>
                </div>
            )}

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
                        <optgroup label="── Google Gemini 3 (Latest Preview) ──">
                            <option value="gemini/gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite — fastest &amp; cheapest</option>
                            <option value="gemini/gemini-3-flash-preview">Gemini 3 Flash — best quality/speed balance</option>
                            <option value="gemini/gemini-3.1-pro-preview">Gemini 3.1 Pro — most capable</option>
                        </optgroup>
                        <optgroup label="── Google Gemini 2 (Stable GA) ──">
                            <option value="gemini/gemini-2.0-flash">Gemini 2.0 Flash — free tier</option>
                            <option value="gemini/gemini-2.0-flash-lite">Gemini 2.0 Flash Lite — lowest latency</option>
                        </optgroup>
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
        </>
    );
};
