import React, { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';
import type { AnalysisResult } from '../../types/api';
import { AQSRadarChart } from '../analysis/AQSRadarChart';
import { BiasAlert } from '../common/BiasAlert';
import type { BiasFlag } from '../../utils/biasDetection';
import { getScoreColor } from '../../utils/formatters';

interface SwipeableCardProps {
  candidate: AnalysisResult & { biasFlags?: BiasFlag[] };
  onShortlist: (id: string) => void;
  onReject: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  candidate,
  onShortlist,
  onReject,
  onViewDetails,
}) => {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setSwipeDirection('left');
      setTimeout(() => {
        onReject(candidate.id);
        setSwipeDirection(null);
      }, 300);
    },
    onSwipedRight: () => {
      setSwipeDirection('right');
      setTimeout(() => {
        onShortlist(candidate.id);
        setSwipeDirection(null);
      }, 300);
    },
    onSwiping: () => setIsSwipeActive(true),
    onSwiped: () => setIsSwipeActive(false),
    trackMouse: true, // Enable mouse dragging on desktop
    preventScrollOnSwipe: true,
  });

  const getRecommendationColor = (rec: string | null) => {
    if (!rec) return 'bg-gray-100 text-gray-800';
    if (rec.toLowerCase().includes('strong')) return 'bg-green-100 text-green-800';
    if (rec.toLowerCase().includes('conditional')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div
      {...handlers}
      className={`
        bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden
        transition-all duration-300 mb-6
        ${swipeDirection === 'left' ? '-translate-x-full opacity-0 border-red-400' : ''}
        ${swipeDirection === 'right' ? 'translate-x-full opacity-0 border-green-400' : ''}
        ${isSwipeActive ? 'cursor-grabbing scale-105' : 'cursor-grab'}
        hover:shadow-xl
      `}
    >
      {/* Swipe Indicators */}
      {swipeDirection === 'left' && (
        <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold text-xl flex items-center gap-2">
            <ThumbsDown size={24} />
            REJECT
          </div>
        </div>
      )}
      {swipeDirection === 'right' && (
        <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full font-bold text-xl flex items-center gap-2">
            <ThumbsUp size={24} />
            SHORTLIST
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {candidate.candidate_name || 'Candidate'}
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(
                  candidate.recommendation
                )}`}
              >
                {candidate.recommendation || 'Need Review'}
              </span>
              {candidate.biasFlags && candidate.biasFlags.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  <AlertTriangle size={12} className="mr-1" />
                  {candidate.biasFlags.length} Alert{candidate.biasFlags.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              <span className={getScoreColor(candidate.scores.overall_aqs)}>
                {candidate.scores.overall_aqs.toFixed(1)}
              </span>
            </div>
            <div className="text-xs text-gray-500 uppercase font-semibold">AQS Score</div>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="mb-4">
          <AQSRadarChart scores={candidate.scores} size="medium" />
        </div>

        {/* Bias Alerts */}
        {candidate.biasFlags && candidate.biasFlags.length > 0 && (
          <div className="mb-4">
            <BiasAlert flags={candidate.biasFlags} candidateName={candidate.candidate_name || undefined} />
          </div>
        )}

        {/* Score Breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {candidate.scores.research?.toFixed(0) || 0}
            </div>
            <div className="text-xs text-gray-600 font-medium">Research</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {candidate.scores.education?.toFixed(0) || 0}
            </div>
            <div className="text-xs text-gray-600 font-medium">Education</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {candidate.scores.teaching?.toFixed(0) || 0}
            </div>
            <div className="text-xs text-gray-600 font-medium">Teaching</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onReject(candidate.id)}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ThumbsDown size={20} />
            Reject
          </button>
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(candidate.id)}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
            >
              Details
            </button>
          )}
          <button
            onClick={() => onShortlist(candidate.id)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ThumbsUp size={20} />
            Shortlist
          </button>
        </div>

        {/* Swipe Hints */}
        <div className="flex justify-between mt-4 text-xs text-gray-400 select-none">
          <span>← Swipe left to reject</span>
          <span>Swipe right to shortlist →</span>
        </div>
      </div>
    </div>
  );
};
