'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { File as FileType, FileData } from '@/types';
import { getFile, getFileData, processFile } from '@/services/api';
import Navbar from '@/components/Navbar';
import ProcessingStatus from '@/components/ProcessingStatus';
import { formatBytes, formatDate } from '@/lib/utils';
import { ArrowLeft, Play, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const [file, setFile] = useState<FileType | null>(null);
  const [fileData, setFileData] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchFileDetails = async () => {
    try {
      const fileDetails = await getFile(fileId);
      setFile(fileDetails);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const fetchFileData = async () => {
    if (!file || file.status !== 'processed') return;
    
    try {
      setDataLoading(true);
      const response = await getFileData(fileId, page, 50);
      setFileData(response.data);
      setTotalPages(response.pagination.pages);
    } catch (error: any) {
      console.error('Failed to load file data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchFileDetails();
  }, [fileId]);

  useEffect(() => {
    if (file) {
      fetchFileData();
    }
  }, [file, page]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const job = await processFile(fileId);
      toast.success(`Processing started! Job ID: ${job.jobId}`);
      setTimeout(fetchFileDetails, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start processing');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-600">File not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{file.originalName}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{formatBytes(file.fileSize)}</span>
                <span>•</span>
                <span>{file.mimeType}</span>
                <span>•</span>
                <ProcessingStatus status={file.status} />
              </div>
            </div>
            
            {file.status === 'uploaded' && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>{processing ? 'Processing...' : 'Process File'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500">File ID</p>
              <p className="font-mono text-xs text-gray-900 mt-1 break-all">{file.fileId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Uploaded</p>
              <p className="text-sm text-gray-900 mt-1">{formatDate(file.uploadedAt)}</p>
            </div>
            {file.processedAt && (
              <div>
                <p className="text-sm text-gray-500">Processed</p>
                <p className="text-sm text-gray-900 mt-1">{formatDate(file.processedAt)}</p>
              </div>
            )}
          </div>
        </div>

        {file.status === 'processing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-blue-900 font-medium">Processing in progress...</p>
            <p className="text-blue-700 text-sm mt-1">This may take a few moments for large files</p>
          </div>
        )}

        {file.status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-900 font-medium">Processing failed</p>
            <p className="text-red-700 text-sm mt-1">Please try processing again or contact support</p>
          </div>
        )}

        {file.status === 'processed' && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Processed Data</h2>
                <button
                  onClick={fetchFileData}
                  disabled={dataLoading}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-5 h-5 ${dataLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {dataLoading && fileData.length === 0 ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading processed data...</p>
              </div>
            ) : fileData.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No processed data available
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Line #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Content
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {fileData.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.lineNumber}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-2xl truncate">
                              {item.content || (item.data ? JSON.stringify(item.data) : '-')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(item.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}