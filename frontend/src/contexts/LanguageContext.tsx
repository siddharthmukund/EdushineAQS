import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation dictionary
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    app_title: 'Academic CV Analyzer',
    install_app: 'Install',
    
    // Upload
    upload_cvs: 'Upload CVs',
    drag_drop: 'Drag & drop CVs or click to browse',
    max_files: 'Maximum 50 CVs',
    anonymize: 'Anonymize (Reduce bias)',
    
    // Batch Analysis
    batch_analysis: 'Batch Analysis',
    upload_analyze: 'Upload and analyze up to 50 CVs simultaneously',
    processing: 'Processing',
    results: 'Results',
    
    // Candidate
    shortlist: 'Shortlist',
    reject: 'Reject',
    details: 'Details',
    aqs_score: 'AQS Score',
    research: 'Research',
    education: 'Education',
    teaching: 'Teaching',
    
    // Settings
    settings: 'Settings',
    customize_weights: 'Customize AQS Weights',
    reset: 'Reset',
    
    // Recommendations
    strong_fit: 'Strong Fit',
    conditional_fit: 'Conditional Fit',
    not_recommended: 'Not Recommended',
  },
  hi: {
    // Header
    app_title: 'शैक्षणिक सीवी विश्लेषक',
    install_app: 'इंस्टॉल करें',
    
    // Upload
    upload_cvs: 'सीवी अपलोड करें',
    drag_drop: 'सीवी ड्रैग और ड्रॉप करें या ब्राउज़ करने के लिए क्लिक करें',
    max_files: 'अधिकतम 50 सीवी',
    anonymize: 'गुमनाम करें (पूर्वाग्रह कम करें)',
    
    // Batch Analysis
    batch_analysis: 'बैच विश्लेषण',
    upload_analyze: 'एक साथ 50 तक सीवी अपलोड और विश्लेषण करें',
    processing: 'प्रसंस्करण',
    results: 'परिणाम',
    
    // Candidate
    shortlist: 'शॉर्टलिस्ट',
    reject: 'अस्वीकार',
    details: 'विवरण',
    aqs_score: 'एक्यूएस स्कोर',
    research: 'अनुसंधान',
    education: 'शिक्षा',
    teaching: 'शिक्षण',
    
    // Settings
    settings: 'सेटिंग्स',
    customize_weights: 'AQS भार अनुकूलित करें',
    reset: 'रीसेट करें',
    
    // Recommendations
    strong_fit: 'मजबूत फिट',
    conditional_fit: 'सशर्त फिट',
    not_recommended: 'अनुशंसित नहीं',
  },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  // Load saved language on mount
  useEffect(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && (saved === 'en' || saved === 'hi')) {
      setLanguageState(saved);
    }
  }, []);

  // Save language when it changes
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  // Translation function
  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
