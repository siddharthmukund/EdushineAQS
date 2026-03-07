import React, { useState, useEffect } from 'react';
import { Settings, RotateCcw } from 'lucide-react';

export interface AQSWeights {
  research: number;
  education: number;
  teaching: number;
}

interface AQSWeightSettingsProps {
  onWeightChange?: (weights: AQSWeights) => void;
  compact?: boolean;
}

type PresetName = 'balanced' | 'research_intensive' | 'teaching_focused';

const PRESETS: Record<PresetName, AQSWeights> = {
  balanced: { research: 50, education: 30, teaching: 20 },
  research_intensive: { research: 60, education: 20, teaching: 20 },
  teaching_focused: { research: 20, education: 30, teaching: 50 },
};

const PRESET_LABELS: Record<PresetName, string> = {
  balanced: 'Balanced',
  research_intensive: 'Research-Intensive',
  teaching_focused: 'Teaching-Focused',
};

const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  balanced: '50% Research, 30% Education, 20% Teaching - Default for most positions',
  research_intensive: '60% Research, 20% Education, 20% Teaching - R1 universities, research faculty',
  teaching_focused: '20% Research, 30% Education, 50% Teaching - Teaching colleges, lecturer positions',
};

export const AQSWeightSettings: React.FC<AQSWeightSettingsProps> = ({
  onWeightChange,
  compact = false,
}) => {
  const [weights, setWeights] = useState<AQSWeights>(PRESETS.balanced);
  const [preset, setPreset] = useState<PresetName>('balanced');
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Load saved weights from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('aqs_weights');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWeights(parsed);
        // Check if it matches a preset
        const matchingPreset = Object.entries(PRESETS).find(
          ([, presetWeights]) =>
            presetWeights.research === parsed.research &&
            presetWeights.education === parsed.education &&
            presetWeights.teaching === parsed.teaching
        );
        if (matchingPreset) {
          setPreset(matchingPreset[0] as PresetName);
        }
      } catch (e) {
        console.error('Failed to parse saved weights:', e);
      }
    }
  }, []);

  const saveWeights = (newWeights: AQSWeights) => {
    localStorage.setItem('aqs_weights', JSON.stringify(newWeights));
    onWeightChange?.(newWeights);
  };

  const handlePresetChange = (presetName: PresetName) => {
    setPreset(presetName);
    const newWeights = PRESETS[presetName];
    setWeights(newWeights);
    saveWeights(newWeights);
  };

  const handleSliderChange = (dimension: keyof AQSWeights, value: number) => {
    const newWeights = { ...weights, [dimension]: value };

    // Auto-adjust other weights to maintain 100% total
    const total = newWeights.research + newWeights.education + newWeights.teaching;
    
    if (total !== 100) {
      const diff = 100 - total;
      const others = (Object.keys(newWeights) as (keyof AQSWeights)[]).filter(
        (k) => k !== dimension
      );
      
      // Distribute the difference proportionally
      const otherTotal = others.reduce((sum, key) => sum + newWeights[key], 0);
      
      if (otherTotal > 0) {
        others.forEach((key) => {
          const proportion = newWeights[key] / otherTotal;
          newWeights[key] = Math.max(0, Math.min(100, newWeights[key] + diff * proportion));
        });
      }
    }

    // Round to nearest integer
    newWeights.research = Math.round(newWeights.research);
    newWeights.education = Math.round(newWeights.education);
    newWeights.teaching = Math.round(newWeights.teaching);

    // Force total to 100
    const finalTotal = newWeights.research + newWeights.education + newWeights.teaching;
    if (finalTotal !== 100) {
      const adjustment = 100 - finalTotal;
      newWeights[dimension] += adjustment;
    }

    setWeights(newWeights);
    saveWeights(newWeights);
    setPreset('balanced'); // Reset preset when custom values set
  };

  const resetToDefault = () => {
    handlePresetChange('balanced');
  };

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
      >
        <Settings size={16} />
        Customize AQS Weights
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">AQS Weight Settings</h3>
        </div>
        <button
          onClick={resetToDefault}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Customize scoring weights based on your position requirements. Total must equal 100%.
      </p>

      {/* Quick Presets */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Quick Presets</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(PRESETS) as PresetName[]).map((presetName) => (
            <button
              key={presetName}
              onClick={() => handlePresetChange(presetName)}
              className={`
                p-3 rounded-lg border-2 transition-all text-left
                ${
                  preset === presetName
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }
              `}
            >
              <div className="font-semibold text-sm mb-1">{PRESET_LABELS[presetName]}</div>
              <div className="text-xs text-gray-600">{PRESET_DESCRIPTIONS[presetName]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Sliders */}
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-gray-700">Custom Weights</label>

        {/* Research */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Research</span>
            <span className="text-lg font-bold text-blue-600">{weights.research}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.research}
            onChange={(e) => handleSliderChange('research', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Education */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Education</span>
            <span className="text-lg font-bold text-purple-600">{weights.education}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.education}
            onChange={(e) => handleSliderChange('education', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        </div>

        {/* Teaching */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Teaching</span>
            <span className="text-lg font-bold text-green-600">{weights.teaching}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.teaching}
            onChange={(e) => handleSliderChange('teaching', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
          />
        </div>
      </div>

      {/* Total Display */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Total Weight</span>
          <span
            className={`text-xl font-bold ${
              weights.research + weights.education + weights.teaching === 100
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {weights.research + weights.education + weights.teaching}%
          </span>
        </div>
      </div>

      {compact && (
        <button
          onClick={() => setIsExpanded(false)}
          className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Collapse
        </button>
      )}
    </div>
  );
};
