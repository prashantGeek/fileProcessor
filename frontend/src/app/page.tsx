'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import FileList from '@/components/FileList';
import QueueStats from '@/components/QueueStats';
import Navbar from '@/components/Navbar';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">File Processing Dashboard</h1>
          <p className="text-gray-600">Upload and process your text files with ease</p>
        </div>

        <div className="mb-8">
          <QueueStats />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload File</h2>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>
          <div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">How it works</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">1.</span>
                  Upload your file (max 100MB)
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">2.</span>
                  File is stored securely in AWS S3
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">3.</span>
                  Click "Process" to parse line by line
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">4.</span>
                  View processed data in MongoDB
                </li>
              </ol>
            </div>
          </div>
        </div>

        <FileList refreshTrigger={refreshTrigger} />
      </main>
    </div>
  );
}