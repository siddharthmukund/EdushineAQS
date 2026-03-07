import React from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';

interface Publication {
    title: string;
    venue: string;
    year: number;
    authors: string;
    estimated_quality: string;
}

interface ValidationReportProps {
    publications: Publication[];
}

export const ValidationReport: React.FC<ValidationReportProps> = ({ publications = [] }) => {
    if (publications.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow p-6 border border-gray-100 text-center text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No publications found to validate.</p>
            </div>
        );
    }

    const getQualityBadge = (quality: string) => {
        const q = quality.toLowerCase();
        if (q.includes('q1') || q.includes('top')) {
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1" /> Q1 / Top Tier</span>;
        }
        if (q.includes('q2')) {
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">Q2</span>;
        }
        if (q.includes('q3') || q.includes('q4')) {
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">Q3/Q4</span>;
        }
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">Pending</span>;
    };

    return (
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-gray-900">Publication Validation</h3>
                </div>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                    {publications.length} Found
                </span>
            </div>

            <div className="overflow-x-auto flex-grow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Title & Year
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Venue
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Authors
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Quality
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {publications.map((pub, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-semibold text-gray-900 line-clamp-2" title={pub.title}>{pub.title}</div>
                                    <div className="text-sm text-gray-500 font-medium mt-1">{pub.year || 'Unknown Year'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-700 font-medium max-w-[200px] truncate" title={pub.venue}>{pub.venue}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 italic">
                                    {pub.authors}
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    {getQualityBadge(pub.estimated_quality)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
