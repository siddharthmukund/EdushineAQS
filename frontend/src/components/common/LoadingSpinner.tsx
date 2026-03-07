import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    message = "Processing (this usually takes 15-20 seconds)..."
}) => {
    return (
        <div className="flex flex-col items-center justify-center p-12">
            <div className="relative w-24 h-24">
                {/* Outer ring */}
                <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                {/* Spinner */}
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                {/* Inner pulsing dot */}
                <div className="absolute inset-0 m-auto w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            <p className="mt-6 text-lg font-medium text-gray-700 animate-pulse">
                {message}
            </p>
        </div>
    );
};
