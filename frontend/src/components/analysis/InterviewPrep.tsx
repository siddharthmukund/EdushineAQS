import React, { useState } from 'react';
import { getInterviewPrep } from '../../services/api';
import { Microscope, GraduationCap, Handshake, Target, Copy, Printer, ChevronDown, ChevronUp } from 'lucide-react';

interface Question {
    question: string;
    purpose: string;
    follow_up?: string;
}

interface InterviewQuestions {
    research: Question[];
    teaching: Question[];
    service: Question[];
    gaps: Question[];
}

interface Props {
    analysisId: string;
}

const SECTIONS = [
    { key: 'research', label: 'Research', icon: Microscope, color: 'blue',   borderColor: 'border-blue-500',   bg: 'bg-blue-50' },
    { key: 'teaching', label: 'Teaching', icon: GraduationCap, color: 'purple', borderColor: 'border-purple-500', bg: 'bg-purple-50' },
    { key: 'service',  label: 'Service & Fit', icon: Handshake, color: 'green',  borderColor: 'border-green-500',  bg: 'bg-green-50' },
    { key: 'gaps',     label: 'Addressing Gaps', icon: Target, color: 'amber',  borderColor: 'border-amber-500',  bg: 'bg-amber-50' },
] as const;

export const InterviewPrep: React.FC<Props> = ({ analysisId }) => {
    const [questions, setQuestions] = useState<InterviewQuestions | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set(['research', 'teaching', 'service', 'gaps']));
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getInterviewPrep(analysisId);
            setQuestions(data.questions);
        } catch (e: any) {
            setError(e.message || 'Failed to generate questions');
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (key: string) => {
        setOpenSections(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const allText = (): string => {
        if (!questions) return '';
        return SECTIONS.map(s => {
            const qs = questions[s.key as keyof InterviewQuestions] || [];
            const lines = qs.map((q, i) => `Q${i + 1}: ${q.question}\nPurpose: ${q.purpose}${q.follow_up ? `\nFollow-up: ${q.follow_up}` : ''}`).join('\n\n');
            return `=== ${s.label.toUpperCase()} ===\n\n${lines}`;
        }).join('\n\n\n');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(allText());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrint = () => window.print();

    if (!questions && !loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="text-center space-y-3 py-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <Microscope className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-gray-900">AI Interview Questions</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        Generate 12 personalized interview questions based on this candidate's profile, research gaps, and teaching background.
                    </p>
                    {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                    <button
                        onClick={handleGenerate}
                        className="mt-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
                    >
                        Generate Interview Questions
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                            <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                            <div className="h-3 bg-gray-100 rounded w-3/4" />
                        </div>
                    ))}
                    <p className="text-sm text-gray-400 text-center pt-2">Generating tailored questions…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-lg">Interview Preparation Guide</h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? 'Copied!' : 'Copy All'}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        Print Guide
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {SECTIONS.map(section => {
                    const qs = questions?.[section.key as keyof InterviewQuestions] || [];
                    const isOpen = openSections.has(section.key);
                    const Icon = section.icon;

                    return (
                        <div key={section.key} className={`rounded-xl border-l-4 ${section.borderColor} ${section.bg} overflow-hidden`}>
                            <button
                                onClick={() => toggleSection(section.key)}
                                className="w-full flex items-center justify-between px-4 py-3"
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-gray-700" />
                                    <span className="font-semibold text-gray-800 text-sm">{section.label}</span>
                                    <span className="text-xs text-gray-500">({qs.length} questions)</span>
                                </div>
                                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {isOpen && (
                                <div className="px-4 pb-4 space-y-4">
                                    {qs.map((q, i) => (
                                        <div key={i} className={`border-l-2 ${section.borderColor} pl-3`}>
                                            <p className="text-sm font-medium text-gray-800">{q.question}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                <span className="font-semibold">Purpose:</span> {q.purpose}
                                            </p>
                                            {q.follow_up && (
                                                <p className="text-xs text-indigo-600 mt-0.5">
                                                    ↳ Follow-up: {q.follow_up}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
