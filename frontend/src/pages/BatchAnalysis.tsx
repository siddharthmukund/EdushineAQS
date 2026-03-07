import React, { useState } from 'react';
import { Layers, ArrowLeft, Users } from 'lucide-react';
import { BatchUploader } from '../components/upload/BatchUploader';
import { JDUploader, type ParsedJD } from '../components/upload/JDUploader';
import { JDPreviewPanel } from '../components/upload/JDPreviewPanel';
import { BatchProgress } from '../components/batch/BatchProgress';
import { CandidateTable } from '../components/comparison/CandidateTable';
import { DiversityDashboard } from '../components/analysis/DiversityDashboard';
import { CommitteeSetup, type CommitteeIdentity } from '../components/committee/CommitteeSetup';
import { CommitteeView } from '../components/committee/CommitteeView';
import { getBatchResults } from '../services/api';
import { useBatchProcessor } from '../hooks/useBatchProcessor';
import type { AnalysisResult } from '../types/api';

type ResultsTab = 'results' | 'diversity' | 'committee';

type WorkflowStage = 'upload' | 'progress' | 'results';

export const BatchAnalysis: React.FC = () => {
    const [stage, setStage] = useState<WorkflowStage>('upload');
    const [results, setResults] = useState<AnalysisResult[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);
    const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
    const [resultsTab, setResultsTab] = useState<ResultsTab>('results');
    const [showCommitteeSetup, setShowCommitteeSetup] = useState(false);
    const [committeeIdentity, setCommitteeIdentity] = useState<CommitteeIdentity | null>(null);

    // Extracted orchestrated state logic
    const { isProcessing, batchId, error, startBatch, resetBatch } = useBatchProcessor();
    const [fetchError, setFetchError] = useState<string | null>(null);

    const handleBatchSubmit = async (files: File[], model: string) => {
        if (!parsedJD) {
            alert('Please upload a job description first.');
            return;
        }

        try {
            // Enhanced formatted block using the structured output
            const formattedJD = `
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

            await startBatch(files, formattedJD, model);
            setStage('progress');
        } catch (err) {
            // Error is handled and exposed by hook
        }
    };

    const handleBatchComplete = async () => {
        if (!batchId) return;

        setLoadingResults(true);
        setFetchError(null);

        try {
            const data = await getBatchResults(batchId);
            setResults(data.results);
            setStage('results');
        } catch (err) {
            console.error('Failed to fetch batch results:', err);
            setFetchError('Failed to load results. Please try again.');
        } finally {
            setLoadingResults(false);
        }
    };

    const handleStartNew = () => {
        setStage('upload');
        resetBatch();
        setResults([]);
        setFetchError(null);
        setParsedJD(null);
        setResultsTab('results');
        setCommitteeIdentity(null);
    };

    const handleCommitteeReady = (identity: CommitteeIdentity) => {
        setCommitteeIdentity(identity);
        setShowCommitteeSetup(false);
        setResultsTab('committee');
    };

    const handleSelectCandidate = (candidate: AnalysisResult) => {
        // TODO: Navigate to detailed view or show modal
        console.log('Selected candidate:', candidate);
        alert(`View details for ${candidate.candidate_name || 'candidate'}`);
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-indigo-100 p-3 rounded-full">
                        <Layers className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Batch Analysis</h1>
                        <p className="text-gray-600">
                            Upload and analyze up to 50 CVs simultaneously against a structured JD
                        </p>
                    </div>
                </div>

                {/* Stage indicator */}
                <div className="flex items-center gap-4 mt-6">
                    <div className={`flex items-center gap-2 ${stage === 'upload' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            1
                        </div>
                        <span>Criteria & Upload</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-200" />
                    <div className={`flex items-center gap-2 ${stage === 'progress' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === 'progress' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            2
                        </div>
                        <span>Processing</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-200" />
                    <div className={`flex items-center gap-2 ${stage === 'results' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            3
                        </div>
                        <span>Results</span>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {(error || fetchError) && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">{error || fetchError}</p>
                </div>
            )}

            {/* Stage Content */}
            {stage === 'upload' && (
                <div className="grid grid-cols-1 gap-6">
                    {!parsedJD ? (
                        <JDUploader onJDParsed={setParsedJD} />
                    ) : (
                        <JDPreviewPanel
                            parsedJD={parsedJD}
                            onUpdate={setParsedJD}
                            onClear={() => setParsedJD(null)}
                        />
                    )}

                    <BatchUploader
                        onBatchSubmit={handleBatchSubmit}
                        isProcessing={isProcessing}
                        disabledToolTip={!parsedJD ? "Please provide a job description first." : undefined}
                    />
                </div>
            )}

            {stage === 'progress' && batchId && (
                <div>
                    <BatchProgress
                        batchId={batchId}
                        onComplete={handleBatchComplete}
                    />
                    <div className="mt-4 text-center text-sm text-gray-500">
                        <p>Please keep this page open while processing completes.</p>
                        <p className="mt-1">You'll be notified when all CVs are analyzed against the structured job profile.</p>
                    </div>
                </div>
            )}

            {stage === 'results' && (
                <div>
                    {/* Results header */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold">Batch Results</h2>
                                <p className="text-gray-600 mt-1">
                                    {results.length} candidates analyzed and ranked by AQS
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowCommitteeSetup(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    <Users size={15} />
                                    Committee Review
                                </button>
                                <button
                                    onClick={handleStartNew}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                    <ArrowLeft size={15} />
                                    New Batch
                                </button>
                            </div>
                        </div>

                        {/* Tab strip */}
                        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                            {([
                                { key: 'results',   label: 'Results' },
                                { key: 'diversity', label: 'Diversity Analytics' },
                                ...(committeeIdentity ? [{ key: 'committee', label: 'Committee Review' }] : []),
                            ] as const).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setResultsTab(tab.key as ResultsTab)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        resultsTab === tab.key
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab content */}
                    {resultsTab === 'results' && (
                        loadingResults ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
                                <p className="mt-4 text-gray-600">Loading results…</p>
                            </div>
                        ) : (
                            <CandidateTable candidates={results} onSelect={handleSelectCandidate} />
                        )
                    )}

                    {resultsTab === 'diversity' && batchId && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Diversity & Inclusion Analytics</h3>
                            <DiversityDashboard batchId={batchId} />
                        </div>
                    )}

                    {resultsTab === 'committee' && committeeIdentity && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <CommitteeView candidates={results} identity={committeeIdentity} />
                        </div>
                    )}
                </div>
            )}

            {/* Committee Setup Modal */}
            {showCommitteeSetup && batchId && (
                <CommitteeSetup
                    batchId={batchId}
                    onReady={handleCommitteeReady}
                    onClose={() => setShowCommitteeSetup(false)}
                />
            )}
        </div>
    );
};
