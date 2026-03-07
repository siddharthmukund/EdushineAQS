import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';

interface OnboardingStep {
  title: string;
  titleHindi?: string;
  description: string;
  descriptionHindi?: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to CV Analyzer',
    titleHindi: 'सीवी विश्लेषक में आपका स्वागत है',
    description: 'Upload academic CVs to get instant AQS scoring. Drag & drop up to 100 CVs or click to browse.',
    descriptionHindi: 'तुरंत AQS स्कोरिंग प्राप्त करने के लिए शैक्षणिक सीवी अपलोड करें। 100 तक सीवी ड्रैग और ड्रॉप करें या ब्राउज़ करने के लिए क्लिक करें।',
    targetSelector: '.upload-zone',
    position: 'bottom',
  },
  {
    title: 'Reduce Unconscious Bias',
    titleHindi: 'अचेतन पूर्वाग्रह कम करें',
    description: 'Enable anonymization to remove names, genders, and other identifiers before scoring.',
    descriptionHindi: 'स्कोरिंग से पहले नाम, लिंग और अन्य पहचानकर्ताओं को हटाने के लिए गुमनामीकरण सक्षम करें।',
    targetSelector: '.bias-toggle',
    position: 'bottom',
  },
  {
    title: 'Swipe to Triage',
    titleHindi: 'ट्राइएज के लिए स्वाइप करें',
    description: 'Swipe right to shortlist candidates, swipe left to reject. Works on mobile and desktop!',
    descriptionHindi: 'उम्मीदवारों को शॉर्टलिस्ट करने के लिए दाएं स्वाइप करें, अस्वीकार करने के लिए बाएं स्वाइप करें। मोबाइल और डेस्कटॉप पर काम करता है!',
    targetSelector: '.candidate-card',
    position: 'top',
  },
];

interface OnboardingProps {
  language?: 'en' | 'hi';
  onComplete?: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ language = 'en', onComplete }) => {
  const [step, setStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('onboarding_completed');
    if (!hasSeenOnboarding) {
      // Delay showing onboarding to let the page load
      setTimeout(() => {
        setShowOnboarding(true);
        updatePosition();
      }, 1000);
    }
  }, []);

  useEffect(() => {
    if (showOnboarding) {
      updatePosition();
    }
  }, [step, showOnboarding]);

  const updatePosition = () => {
    const currentStep = ONBOARDING_STEPS[step];
    const targetElement = document.querySelector(currentStep.targetSelector);
    
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const tooltipHeight = 200; // Approximate tooltip height
      const tooltipWidth = 320;
      
      let top = rect.bottom + 10;
      let left = rect.left;

      // Adjust position based on target position preference
      switch (currentStep.position) {
        case 'top':
          top = rect.top - tooltipHeight - 10;
          break;
        case 'bottom':
          top = rect.bottom + 10;
          break;
        case 'left':
          top = rect.top;
          left = rect.left - tooltipWidth - 10;
          break;
        case 'right':
          top = rect.top;
          left = rect.right + 10;
          break;
      }

      // Keep tooltip in viewport
      if (top < 10) top = 10;
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }

      setPosition({ top, left });

      // Highlight target element
      targetElement.classList.add('onboarding-highlight');
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
    
    // Remove highlight from all elements
    document.querySelectorAll('.onboarding-highlight').forEach((el) => {
      el.classList.remove('onboarding-highlight');
    });
    
    onComplete?.();
  };

  const nextStep = () => {
    // Remove highlight from current step
    const currentStep = ONBOARDING_STEPS[step];
    const targetElement = document.querySelector(currentStep.targetSelector);
    if (targetElement) {
      targetElement.classList.remove('onboarding-highlight');
    }

    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  if (!showOnboarding) {
    return null;
  }

  const currentStep = ONBOARDING_STEPS[step];
  const title = language === 'hi' && currentStep.titleHindi ? currentStep.titleHindi : currentStep.title;
  const description = language === 'hi' && currentStep.descriptionHindi ? currentStep.descriptionHindi : currentStep.description;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={skipOnboarding} />

      {/* Tooltip */}
      <div
        className="fixed z-[9999] bg-white rounded-lg shadow-2xl p-6 max-w-sm animate-fade-in"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        {/* Close button */}
        <button
          onClick={skipOnboarding}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Step indicator */}
        <div className="flex gap-2 mb-4">
          {ONBOARDING_STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-2 flex-1 rounded-full transition-colors ${
                index === step ? 'bg-blue-600' : index < step ? 'bg-blue-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={skipOnboarding}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            {language === 'hi' ? 'स्किप करें' : 'Skip'}
          </button>
          <button
            onClick={nextStep}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            {step === ONBOARDING_STEPS.length - 1 ? (
              <>
                <Check size={18} />
                {language === 'hi' ? 'पूर्ण' : 'Done'}
              </>
            ) : (
              <>
                {language === 'hi' ? 'अगला' : 'Next'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom styles for highlighting */}
      <style>{`
        .onboarding-highlight {
          position: relative;
          z-index: 9997;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5);
          border-radius: 8px;
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
