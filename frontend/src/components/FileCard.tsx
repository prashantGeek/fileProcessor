'use client';

import { useState, useEffect, useRef } from 'react';
import { File as FileType } from '@/types';
import { FileText, Trash2, Play, Eye } from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import ProcessingStatus from './ProcessingStatus';
import { processFile, deleteFile, getFile } from '@/services/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface FileCardProps {
  file: FileType;
  onUpdate?: () => void;
}

export default function FileCard({ file, onUpdate }: FileCardProps) {
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localFile, setLocalFile] = useState(file);
  const isProcessingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    // Only update localFile from props if we're not actively processing
    if (!isProcessingRef.current) {
      setLocalFile(file);
    }
  }, [file]);

  // Poll for status updates when processing
  useEffect(() => {
    if (localFile.status !== 'processing') {
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;

    const pollInterval = setInterval(async () => {
      try {
        const updatedFile = await getFile(localFile.fileId);
        setLocalFile(updatedFile);
        
        if (updatedFile.status === 'processed') {
          toast.success('File processed successfully!');
          isProcessingRef.current = false;
          if (onUpdate) onUpdate();
          clearInterval(pollInterval);
        } else if (updatedFile.status === 'failed') {
          toast.error('File processing failed');
          isProcessingRef.current = false;
          if (onUpdate) onUpdate();
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Failed to poll file status:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [localFile.status, localFile.fileId, onUpdate]);

  const handleProcess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessing(true);
    isProcessingRef.current = true;
    
    // Optimistically update local state
    setLocalFile({ ...localFile, status: 'processing' });
    
    try {
      const job = await processFile(file.fileId);
      toast.success(`Processing started! Job ID: ${job.jobId}`);
      // Don't call onUpdate here - let the polling handle it
    } catch (error: any) {
      toast.error(error.message || 'Failed to start processing');
      setLocalFile(file); // Revert on error
      isProcessingRef.current = false;
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this file?')) return;

    setDeleting(true);
    try {
      await deleteFile(file.fileId);
      toast.success('File deleted successfully');
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete file');
    } finally {
      setDeleting(false);
    }
  };

  const handleView = () => {
    router.push(`/files/${file.fileId}`);
  };

  return (
    <div
      onClick={handleView}
      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <FileText className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{localFile.originalName}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <ProcessingStatus status={localFile.status} />
              <span className="text-sm text-gray-500">{formatBytes(localFile.fileSize)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Uploaded: {formatDate(localFile.uploadedAt)}
            </p>
            {localFile.processedAt && (
              <p className="text-xs text-gray-500">
                Processed: {formatDate(localFile.processedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-2">
          <button
            onClick={handleView}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {localFile.status === 'uploaded' && !processing && !isProcessingRef.current && (
            <button
              onClick={handleProcess}
              disabled={processing}
              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
              title="Process file"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Delete file"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}