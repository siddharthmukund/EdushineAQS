import { useState, useCallback } from 'react';
import { batchAnalyze } from '../services/api';
import type { BatchJobResponse } from '../services/api';
import { cvWorkerPool } from '../workers/adaptive-worker-pool';

export const useBatchProcessor = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [parsingProgress, setParsingProgress] = useState<{ current: number; total: number } | null>(null);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startBatch = useCallback(async (files: File[], jd: string | File, model: string = 'anthropic/claude-3-5-sonnet-20241022') => {
        setIsProcessing(true);
        setError(null);
        setParsingProgress({ current: 0, total: files.length });

        try {
            // 1. Pre-parse PDFs locally using adaptive worker pool to offload server
            const parsedFiles: File[] = [];
            let completed = 0;

            // Launch all parsing jobs. The pool will manage concurrency autonomously.
            const parsingPromises = files.map(async (file) => {
                try {
                    const result = await cvWorkerPool.processCV(file, 'normal');
                    if (result.success && result.text) {
                        // Create a lightweight .txt file holding the content
                        const txtFile = new File([result.text], file.name.replace('.pdf', '.txt'), { type: 'text/plain' });
                        parsedFiles.push(txtFile);
                    } else {
                        // Fallback to sending original PDF if parsing fails
                        parsedFiles.push(file);
                    }
                } catch (e) {
                    // Fallback to sending original PDF if parsing throws
                    parsedFiles.push(file);
                } finally {
                    completed++;
                    setParsingProgress({ current: completed, total: files.length });
                }
            });

            await Promise.all(parsingPromises);
            setParsingProgress(null);

            // 2. Upload the pre-parsed batch to the server
            const response: BatchJobResponse = await batchAnalyze(parsedFiles, jd, model);
            setBatchId(response.batch_id);
            return response.batch_id;
        } catch (err: any) {
            const msg = err.response?.data?.detail || err.message || 'Error occurred starting batch.';
            setError(msg);
            console.error(err);
            throw err;
        } finally {
            setIsProcessing(false);
            setParsingProgress(null);
        }
    }, []);

    const resetBatch = useCallback(() => {
        setBatchId(null);
        setError(null);
        setParsingProgress(null);
    }, []);

    return { isProcessing, parsingProgress, batchId, error, startBatch, resetBatch };
};
