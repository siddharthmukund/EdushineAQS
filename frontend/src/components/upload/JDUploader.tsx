import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { hashFile, getJDFromCache, cacheJD, getRecentJDs } from '../../utils/jdStorage';
import type { JDStructure } from '../../utils/jdParser';

export interface ParsedJD {
    rawText: string;
    structured: JDStructure;
    fileName?: string;
    fileHash?: string;
}

interface JDUploaderProps {
    onJDParsed: (parsed: ParsedJD) => void;
}

export const JDUploader: React.FC<JDUploaderProps> = ({ onJDParsed }) => {
    const [parsing, setParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentJDs, setRecentJDs] = useState<any[]>([]);

    // Load recent JDs from IndexedDB on mount
    useEffect(() => {
        getRecentJDs(5).then(setRecentJDs).catch(err => console.error("Failed to load recents", err));
    }, []);

    const parseJDFile = async (file: File) => {
        setParsing(true);
        setError(null);

        try {
            // Validate file
            const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
            if (file.size > MAX_FILE_SIZE) {
                throw new Error('File too large (max 5MB)');
            }

            // Check cache first
            const fileHash = await hashFile(file);
            const cached = await getJDFromCache(fileHash);

            if (cached) {
                onJDParsed(cached);
                setParsing(false);
                return;
            }

            // Parse using Web Worker
            const worker = new Worker(new URL('../../workers/jd-parser.worker.ts', import.meta.url), { type: 'module' });

            const fileBuffer = await file.arrayBuffer();
            worker.postMessage({
                file: fileBuffer,
                fileType: file.type,
                fileName: file.name
            });

            worker.onmessage = async (e) => {
                if (e.data.success) {
                    const { rawText, structured, fileName } = e.data;

                    // Cache result
                    await cacheJD(fileHash, file.name, rawText, structured);

                    // Notify parent
                    onJDParsed({ rawText, structured, fileName, fileHash });

                    setParsing(false);
                } else {
                    setError(e.data.error || 'Parsing failed');
                    setParsing(false);
                }
                worker.terminate();
            };

            worker.onerror = (e) => {
                setError(e.message || 'Worker thread crashed in parsing');
                setParsing(false);
                worker.terminate();
            };

        } catch (err: any) {
            setError(err.message);
            setParsing(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        multiple: false,
        onDrop: (files: File[]) => {
            if (files.length > 0) {
                parseJDFile(files[0]);
            }
        }
    });

    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">
                📄 Upload Job Description (Optional)
            </h3>

            {/* Upload Zone */}
            <div
                {...getRootProps()}
                className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
            >
                <input {...getInputProps()} />
                <div className="text-gray-600">
                    {parsing ? (
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                            <p>Parsing job description...</p>
                        </div>
                    ) : isDragActive ? (
                        <p className="text-blue-600">Drop JD file here...</p>
                    ) : (
                        <>
                            <p className="font-medium mb-1">
                                Drag & drop JD (PDF/DOC/DOCX)
                            </p>
                            <p className="text-sm text-gray-500">
                                or click to browse • Max 5MB
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
                    ⚠️ {error}
                </div>
            )}

            {/* Recent JDs */}
            {recentJDs.length > 0 && (
                <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        Recent Job Descriptions:
                    </p>
                    <div className="space-y-2">
                        {recentJDs.map(jd => (
                            <button
                                key={jd.id}
                                onClick={() => onJDParsed({ rawText: jd.rawText, structured: jd.structured, fileName: jd.fileName, fileHash: jd.fileHash })}
                                className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition-colors border border-transparent hover:border-gray-200"
                            >
                                <div className="font-medium text-blue-800">{jd.structured.positionTitle || jd.fileName || 'Untitled Position'}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {new Date(jd.uploadedAt).toLocaleDateString()} •
                                    Used {jd.usageCount} times
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
