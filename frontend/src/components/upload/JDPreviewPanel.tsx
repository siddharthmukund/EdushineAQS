import React, { useState } from 'react';
import type { ParsedJD } from './JDUploader';
import { cacheJD } from '../../utils/jdStorage';
import { extractJDStructure } from '../../utils/jdParser';
import { Check, Edit2, Save, X } from 'lucide-react';

interface JDPreviewPanelProps {
    parsedJD: ParsedJD;
    onUpdate: (updated: ParsedJD) => void;
    onClear: () => void;
}

export const JDPreviewPanel: React.FC<JDPreviewPanelProps> = ({ parsedJD, onUpdate, onClear }) => {
    const { rawText, structured, fileName, fileHash } = parsedJD;
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(rawText);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        // Re-parse the edited text
        const reStructured = extractJDStructure(editedText);
        const updated = {
            rawText: editedText,
            structured: reStructured,
            fileName,
            fileHash
        };

        // Attempt to persist to IDB if we know its hash
        if (fileHash && fileName) {
            try {
                await cacheJD(fileHash, fileName, editedText, reStructured);
            } catch (err) {
                console.error("Failed to update cache", err);
            }
        }

        onUpdate(updated);
        setIsEditing(false);
        setIsSaving(false);
    };

    const handleManualSaveTrigger = async () => {
        setIsSaving(true);
        if (fileHash && fileName) {
            try {
                await cacheJD(fileHash, fileName, rawText, structured);
            } catch (err) {
                console.error("Failed to update cache", err);
            }
        }
        setIsSaving(false);
    }

    return (
        <div className="bg-white rounded-lg shadow border border-gray-100 mb-6 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    📋 Job Description: <span className="text-blue-700 font-semibold">{fileName || 'Manual Entry'}</span>
                </h3>
                <div className="flex gap-2">
                    {!isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit JD Text"
                            >
                                <Edit2 size={16} /> Edit
                            </button>
                            <button
                                onClick={handleManualSaveTrigger}
                                disabled={isSaving || !fileHash}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                title="Save over cached version"
                            >
                                <Save size={16} /> {isSaving ? 'Saving...' : 'Save for Reuse'}
                            </button>
                            <button
                                onClick={onClear}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors ml-2"
                                title="Remove JD"
                            >
                                <X size={16} /> Clear
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm transition-colors shadow-sm"
                            >
                                <Check size={16} /> Save Changes
                            </button>
                            <button
                                onClick={() => {
                                    setEditedText(rawText);
                                    setIsEditing(false);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="p-6">
                {/* Structured View */}
                {!isEditing && structured && (
                    <div className="space-y-6">
                        {/* Position Info */}
                        <div className="grid grid-cols-2 gap-4 pb-6 border-b border-gray-100">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1">Position</p>
                                <p className="font-medium text-gray-900">{structured.positionTitle || 'Not explicitly detected'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1">Type Profile</p>
                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-indigo-100 text-indigo-800">
                                    {structured.positionType?.replace('_', ' ') || 'Balanced'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Required Qualifications */}
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Required Qualifications
                                </p>
                                <ul className="list-disc list-outside ml-5 space-y-2 text-sm text-slate-700">
                                    {structured.required?.publications?.map((req: any, idx) => (
                                        <li key={idx}><span className="font-medium text-slate-900">Publications:</span> {req.raw || req.value}</li>
                                    ))}
                                    {structured.required?.education?.map((req: any, idx) => (
                                        <li key={idx}><span className="font-medium text-slate-900">Education:</span> {req.raw || req.value}</li>
                                    ))}
                                    {structured.required?.experience?.map((req: any, idx) => (
                                        <li key={idx}><span className="font-medium text-slate-900">Experience:</span> {req.raw || req.value}</li>
                                    ))}
                                    {structured.required?.teaching?.map((req: any, idx) => (
                                        <li key={idx}><span className="font-medium text-slate-900">Teaching:</span> {req.raw || req.value}</li>
                                    ))}

                                    {(!structured.required?.publications?.length && !structured.required?.education?.length && !structured.required?.experience?.length && !structured.required?.teaching?.length) && (
                                        <li className="text-gray-400 italic list-none -ml-5">No explicit strict requirements detected. View raw text.</li>
                                    )}
                                </ul>
                            </div>

                            {/* Preferred Qualifications */}
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    Preferred Qualifications
                                </p>
                                <ul className="list-disc list-outside ml-5 space-y-2 text-sm text-slate-700">
                                    {structured.preferred?.grants?.map((pref: any, idx) => (
                                        <li key={idx}><span className="font-medium text-slate-900">Grants:</span> {pref.raw || pref.value}</li>
                                    ))}
                                    {structured.preferred?.service?.map((pref: any, idx) => (
                                        <li key={idx}><span className="font-medium text-slate-900">Service:</span> {pref.raw || pref.value}</li>
                                    ))}

                                    {(!structured.preferred?.grants?.length && !structured.preferred?.service?.length) && (
                                        <li className="text-gray-400 italic list-none -ml-5">No explicit preferred markers detected. View raw text.</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        <details className="text-sm mt-4 border-t pt-4">
                            <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-800 transition-colors focus:outline-none">
                                View Full Raw Extracted Text ({rawText.length} characters)
                            </summary>
                            <pre className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg whitespace-pre-wrap text-xs text-gray-700 font-mono overflow-auto max-h-96">
                                {rawText}
                            </pre>
                        </details>
                    </div>
                )}

                {/* Raw Text View / Edit Mode */}
                {isEditing && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="text-sm text-gray-600 mb-2 font-medium">Edit the raw job description text. The structured fields will automatically recalculate on save.</p>
                        <textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full h-96 border border-blue-200 rounded-lg p-4 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none leading-relaxed bg-blue-50/30"
                            placeholder="Edit job description..."
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
