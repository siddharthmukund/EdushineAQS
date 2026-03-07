import React, { useCallback, useState } from 'react';
import { UploadCloud, File as FileIcon, X, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface CVUploaderProps {
    onFileSelect: (file: File | null) => void;
    selectedFile: File | null;
    error?: string | null;
}

export const CVUploader: React.FC<CVUploaderProps> = ({
    onFileSelect,
    selectedFile,
    error
}) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragOut = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf') {
                onFileSelect(file);
            } else {
                alert("Please upload a PDF file");
            }
        }
    }, [onFileSelect]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.type === 'application/pdf') {
                onFileSelect(file);
            } else {
                alert("Please upload a PDF file");
            }
        }
    };

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        onFileSelect(null);
    };

    return (
        <div className="w-full">
            <div
                className={clsx(
                    "relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-h-[240px]",
                    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50",
                    error ? "border-red-400 bg-red-50" : "",
                    selectedFile ? "border-emerald-300 bg-emerald-50/30" : ""
                )}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('cv-upload-input')?.click()}
            >
                <input
                    id="cv-upload-input"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleChange}
                />

                {selectedFile ? (
                    <div className="flex flex-col items-center text-center">
                        <div className="relative">
                            <FileIcon className="h-16 w-16 text-blue-600 mb-4" />
                            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow">
                                <CheckCircle className="h-6 w-6 text-emerald-500" />
                            </div>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-1">{selectedFile.name}</h4>
                        <p className="text-sm text-gray-500 mb-6">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <button
                            onClick={removeFile}
                            className="flex items-center text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full transition-colors"
                        >
                            <X className="h-4 w-4 mr-1" />
                            Remove File
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center pointer-events-none">
                        <div className="bg-blue-100 p-4 rounded-full mb-4">
                            <UploadCloud className="h-10 w-10 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Upload Academic CV
                        </h3>
                        <p className="text-gray-500 mb-4 max-w-sm">
                            Drag and drop your PDF file here, or click to browse files
                        </p>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            PDF up to 10MB
                        </span>
                    </div>
                )}
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
    );
};
