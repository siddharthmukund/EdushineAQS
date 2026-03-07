import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
      title={language === 'en' ? 'Switch to Hindi' : 'अंग्रेजी में बदलें'}
    >
      <Languages size={16} />
      <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
    </button>
  );
};
