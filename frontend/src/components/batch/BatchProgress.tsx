import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

interface BatchProgressProps {
  batchId: string;
  onComplete: () => void;
}

interface ProgressData {
  stage: 'processing' | 'complete' | 'failed';
  current: number;
  total: number;
  percentage: number;
  current_filename?: string;
  total_cost?: number;
  error?: string;
  type?: string;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({ batchId, onComplete }) => {
  const [progress, setProgress] = useState<ProgressData>({
    stage: 'processing',
    current: 0,
    total: 0,
    percentage: 0,
    current_filename: '',
  });
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/batch/${batchId}`;

    console.log('Connecting to WebSocket:', wsUrl);

    // Connect to WebSocket
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data: ProgressData = JSON.parse(event.data);
        
        // Ignore keepalive messages
        if (data.type === 'keepalive') {
          return;
        }

        console.log('Progress update:', data);
        setProgress(data);

        if (data.stage === 'complete') {
          console.log('Batch complete!');
          setTimeout(() => {
            onComplete();
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsError('Connection error. Progress may be delayed.');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    return () => {
      ws.close();
    };
  }, [batchId, onComplete]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Batch Analysis Progress</h3>
        {progress.stage === 'processing' && (
          <Loader className="w-6 h-6 text-blue-600 animate-spin" />
        )}
        {progress.stage === 'complete' && (
          <CheckCircle className="w-6 h-6 text-green-600" />
        )}
        {progress.stage === 'failed' && (
          <XCircle className="w-6 h-6 text-red-600" />
        )}
      </div>

      {/* WebSocket Error */}
      {wsError && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">{wsError}</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>
            {progress.current} of {progress.total} CVs analyzed
          </span>
          <span>{progress.percentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Current File */}
      {progress.stage === 'processing' && progress.current_filename && (
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-700">Currently analyzing:</p>
          <p className="font-medium text-blue-900 break-all">{progress.current_filename}</p>
        </div>
      )}

      {/* Completion Summary */}
      {progress.stage === 'complete' && (
        <div className="bg-green-50 rounded-lg p-4">
          <p className="font-medium text-green-900">Batch complete!</p>
          <p className="text-sm text-green-700 mt-1">
            {progress.total} candidates analyzed
          </p>
          {progress.total_cost && (
            <p className="text-sm text-green-600 mt-1">
              Total cost: ${progress.total_cost.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Error State */}
      {progress.stage === 'failed' && (
        <div className="bg-red-50 rounded-lg p-4">
          <p className="font-medium text-red-900">Batch processing failed</p>
          {progress.error && (
            <p className="text-sm text-red-700 mt-1">{progress.error}</p>
          )}
        </div>
      )}
    </div>
  );
};
