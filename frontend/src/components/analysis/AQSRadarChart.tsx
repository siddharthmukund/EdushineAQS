import React, { Suspense } from 'react';

const LazyRadar = React.lazy(() => import('./LazyRadarComponent'));

interface AQSRadarChartProps {
    scores: {
        research?: number;
        education?: number;
        teaching?: number;
    };
    candidateName?: string;
    size?: 'small' | 'medium' | 'large';
}

export const AQSRadarChart: React.FC<AQSRadarChartProps> = (props) => {
    const heightClass = {
        small: 'h-40',
        medium: 'h-64',
        large: 'h-80',
    }[props.size || 'medium'];

    return (
        <div className={`w-full ${heightClass} flex items-center justify-center`}>
            <Suspense fallback={
                <div className="flex w-full h-full items-center justify-center text-gray-400">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="mt-4 text-sm font-medium">Loading Chart...</span>
                    </div>
                </div>
            }>
                <LazyRadar {...props} />
            </Suspense>
        </div>
    );
};
