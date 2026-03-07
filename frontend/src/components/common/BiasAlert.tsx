import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { BiasFlag } from '../../utils/biasDetection';
import { getSeverityColor, getSeverityIcon } from '../../utils/biasDetection';

interface BiasAlertProps {
  flags: BiasFlag[];
  candidateName?: string;
}

export const BiasAlert: React.FC<BiasAlertProps> = ({ flags, candidateName }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (flags.length === 0) {
    return null;
  }

  const highCount = flags.filter((f) => f.severity === 'high').length;
  const mediumCount = flags.filter((f) => f.severity === 'medium').length;
  const lowCount = flags.filter((f) => f.severity === 'low').length;

  return (
    <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <div className="text-left">
            <p className="font-semibold text-gray-900">
              {flags.length} Bias Alert{flags.length !== 1 ? 's' : ''} Detected
            </p>
            <p className="text-xs text-gray-600">
              {highCount > 0 && `${highCount} high`}
              {mediumCount > 0 && (highCount > 0 ? ', ' : '') + `${mediumCount} medium`}
              {lowCount > 0 && (highCount > 0 || mediumCount > 0 ? ', ' : '') + `${lowCount} low`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Click to review</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="h-px bg-gray-200 my-2" />
          
          {candidateName && (
            <p className="text-sm text-gray-600">
              Review bias alerts for <strong>{candidateName}</strong>:
            </p>
          )}

          {flags.map((flag, index) => (
            <div
              key={index}
              className={`border rounded-lg p-3 ${getSeverityColor(flag.severity)}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{getSeverityIcon(flag.severity)}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">
                    {flag.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    {' '}
                    <span className="text-xs font-normal">({flag.severity})</span>
                  </p>
                  <p className="text-sm mb-2">{flag.message}</p>
                  <div className="bg-white/50 rounded p-2 border border-current/20">
                    <p className="text-xs font-medium mb-1">💡 Suggestion:</p>
                    <p className="text-xs">{flag.suggestion}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setIsExpanded(false)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                // TODO: Implement export/log functionality
                console.log('Bias flags for audit:', flags);
              }}
              className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
            >
              Log for Audit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
