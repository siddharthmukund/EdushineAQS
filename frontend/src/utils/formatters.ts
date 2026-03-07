export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
};

export const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

export const getScoreBgColor = (score: number): string => {
    if (score >= 85) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    if (score >= 70) return 'bg-blue-50 text-blue-700 ring-blue-600/20';
    if (score >= 60) return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    return 'bg-red-50 text-red-700 ring-red-600/20';
};
