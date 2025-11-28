'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { uploadFile } from '@/services/api';
import { formatBytes } from '@/lib/utils';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['.txt'];

export default function FileUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${formatBytes(MAX_FILE_SIZE)} limit`;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return `Only .txt files are allowed`;
    }

    return null;
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setValidationError(null);
    resetFileInput();
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    resetFileInput();

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const error = validateFile(files[0]);
      if (error) {
        setValidationError(error);
        toast.error(error);
        setSelectedFile(null);
      } else {
        setValidationError(null);
        setSelectedFile(files[0]);
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        toast.error(error);
        setSelectedFile(null);
        e.target.value = '';
      } else {
        setValidationError(null);
        setSelectedFile(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const error = validateFile(selectedFile);
    if (error) {
      toast.error(error);
      return;
    }

    setUploading(true);
    try {
      await uploadFile(selectedFile);
      toast.success('File uploaded successfully!');
      setSelectedFile(null);
      setValidationError(null);
      resetFileInput();
      if (onUploadSuccess) onUploadSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      
      if (error.message?.includes('File too large') || error.message?.includes('LIMIT_FILE_SIZE')) {
        toast.error(`File too large. Maximum size: ${formatBytes(MAX_FILE_SIZE)}`);
      } else if (error.message?.includes('rate limit')) {
        toast.error('Too many uploads. Please wait a moment and try again.');
      } else {
        toast.error(error.message || 'Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : validationError
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileSelect}
          accept=".txt"
        />

        {!selectedFile ? (
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className={`w-12 h-12 mb-4 ${validationError ? 'text-red-400' : 'text-gray-400'}`} />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Drop your .txt file here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Only .txt files allowed (max {formatBytes(MAX_FILE_SIZE)})
            </p>
          </label>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {validationError && (
        <div className="mt-3 flex items-center space-x-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{validationError}</span>
        </div>
      )}

      {selectedFile && !validationError && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="mt-4 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
      )}
    </div>
  );
}
