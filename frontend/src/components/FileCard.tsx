'use client';

import { useState } from 'react';
import { File as FileType } from '@/types';
import { FileText, Trash2, Play, Eye } from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import ProcessingStatus from './ProcessingStatus';
import { processFile, deleteFile } from '@/services/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface FileCardProps {
  file: FileType;
  onUpdate?: () => void;
}

export default function FileCard({ file, onUpdate }: FileCardProps) {
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleProcess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessing(true);
    try {
      const job = await processFile(file.fileId);
      toast.success(`Processing started! Job ID: ${job.jobId}`);
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start processing');
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
            <h3 className="font-medium text-gray-900 truncate">{file.originalName}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <ProcessingStatus status={file.status} />
              <span className="text-sm text-gray-500">{formatBytes(file.fileSize)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Uploaded: {formatDate(file.uploadedAt)}
            </p>
            {file.processedAt && (
              <p className="text-xs text-gray-500">
                Processed: {formatDate(file.processedAt)}
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

          {file.status === 'uploaded' && (
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