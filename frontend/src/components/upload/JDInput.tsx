import React from 'react';

interface JDInputProps {
    value: string;
    onChange: (value: string) => void;
}

export const JDInput: React.FC<JDInputProps> = ({ value, onChange }) => {
    return (
        <div className="w-full">
            <label htmlFor="jd-input" className="block text-sm font-medium text-gray-700 mb-2">
                Job Description (Optional)
            </label>
            <p className="text-sm text-gray-500 mb-3">
                Provide context about the role to receive tailored fitment analysis and interview questions.
            </p>
            <textarea
                id="jd-input"
                rows={6}
                className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="e.g. Seeking an Assistant Professor with strong track record in machine learning, demonstrated ability to secure funding, and passion for undergraduate teaching..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};
