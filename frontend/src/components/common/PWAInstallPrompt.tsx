import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
  language?: 'en' | 'hi';
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ language = 'en' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if prompt was previously dismissed
    const dismissedAt = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Don't show again for 7 days after dismissal
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Smart timing: Show after 2 successful uploads
      const uploadCount = parseInt(localStorage.getItem('upload_count') || '0');
      if (uploadCount >= 2) {
        setTimeout(() => {
          setShowPrompt(true);
        }, 2000); // Delay by 2 seconds for better UX
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful app install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      console.log('PWA installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Track uploads to determine smart timing
  useEffect(() => {
    const trackUploads = () => {
      const currentCount = parseInt(localStorage.getItem('upload_count') || '0');
      localStorage.setItem('upload_count', (currentCount + 1).toString());
    };

    // Listen for upload events (you'll need to trigger this from your upload component)
    window.addEventListener('cv_uploaded', trackUploads);

    return () => {
      window.removeEventListener('cv_uploaded', trackUploads);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's choice
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      localStorage.setItem('pwa_installed', 'true');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', new Date().toISOString());
  };

  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  const content = {
    en: {
      title: 'Install CV Analyzer',
      description: 'Add to your home screen for faster access and offline support.',
      benefits: [
        '⚡ Launch instantly from home screen',
        '📱 Works offline with cached results',
        '🔒 Secure - no data leaves your device',
        '🚀 50% faster load times',
      ],
      install: 'Install App',
      later: 'Maybe Later',
    },
    hi: {
      title: 'सीवी विश्लेषक इंस्टॉल करें',
      description: 'तेज़ पहुंच और ऑफ़लाइन समर्थन के लिए अपनी होम स्क्रीन में जोड़ें।',
      benefits: [
        '⚡ होम स्क्रीन से तुरंत लॉन्च करें',
        '📱 कैश्ड परिणामों के साथ ऑफ़लाइन काम करता है',
        '🔒 सुरक्षित - कोई डेटा आपके डिवाइस से नहीं निकलता',
        '🚀 50% तेज़ लोड समय',
      ],
      install: 'ऐप इंस्टॉल करें',
      later: 'बाद में शायद',
    },
  };

  const text = content[language];

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-up">
      <div className="bg-white rounded-xl shadow-2xl border-2 border-blue-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">{text.title}</h3>
              <p className="text-xs text-blue-100">{text.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <ul className="space-y-2 mb-6">
            {text.benefits.map((benefit, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-base">{benefit.split(' ')[0]}</span>
                <span>{benefit.substring(benefit.indexOf(' ') + 1)}</span>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors text-sm"
            >
              {text.later}
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Download size={18} />
              {text.install}
            </button>
          </div>
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

// Helper function to trigger upload tracking from upload components
export const trackCVUpload = () => {
  window.dispatchEvent(new Event('cv_uploaded'));
};
