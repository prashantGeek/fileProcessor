export interface File {
  fileId: string;
  originalName: string;
  s3Key: string;
  s3Bucket: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  processedAt?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  jobId: string;
  fileId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  maxAttempts: number;
  result?: {
    processed: number;
    failed: number;
    errors: any[];
  };
  error?: {
    message: string;
    stack: string;
    timestamp: string;
  };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface FileData {
  _id: string;
  fileId: string;
  lineNumber: number;
  content?: string;
  data?: any;
  timestamp: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  active: number;
  maxConcurrent: number;
  files?: {
    uploaded: number;
    processing: number;
    processed: number;
    failed: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface FileListResponse {
  files: File[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface JobListResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface FileDataResponse {
  data: FileData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}