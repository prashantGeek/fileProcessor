import axios, { AxiosError } from 'axios';
import {
  ApiResponse,
  File,
  Job,
  QueueStats,
  FileListResponse,
  JobListResponse,
  FileDataResponse,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const handleError = (error: AxiosError<any>) => {
  // Log the full error for debugging
  console.error('API Error Details:', {
    status: error.response?.status,
    data: error.response?.data,
    message: error.message
  });

  if (error.response) {
    const errorMsg = error.response.data?.error || 
                     error.response.data?.message || 
                     JSON.stringify(error.response.data) ||
                     'API Error';
    throw new Error(errorMsg);
  } else if (error.request) {
    throw new Error('No response from server. Please check if backend is running.');
  } else {
    throw new Error(error.message || 'Unknown error occurred');
  }
};

// ================== File Operations ==================

export const uploadFile = async (file: globalThis.File): Promise<File> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<File>>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

export const getFiles = async (
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<FileListResponse> => {
  try {
    const params: any = { page, limit };
    if (status) params.status = status;

    const response = await api.get<ApiResponse<FileListResponse>>('/files', { params });
    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

export const getFile = async (fileId: string): Promise<File> => {
  try {
    const response = await api.get<ApiResponse<File>>(`/files/${fileId}`);
    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

export const deleteFile = async (fileId: string): Promise<void> => {
  try {
    await api.delete(`/files/${fileId}`);
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

export const getFileData = async (
  fileId: string,
  page: number = 1,
  limit: number = 100
): Promise<FileDataResponse> => {
  try {
    const response = await api.get<ApiResponse<FileDataResponse>>(
      `/files/${fileId}/data`,
      { params: { page, limit } }
    );
    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

// ================== Job Operations ==================

export const processFile = async (fileId: string, priority: number = 0): Promise<Job> => {
  try {
    const response = await api.post<ApiResponse<Job>>(`/process/${fileId}`, { priority });
    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

export const getJob = async (jobId: string): Promise<Job> => {
  try {
    const response = await api.get<ApiResponse<Job>>(`/jobs/${jobId}`);
    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

export const getJobs = async (
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<JobListResponse> => {
  try {
    const params: any = { page, limit };
    if (status) params.status = status;

    const response = await api.get<ApiResponse<JobListResponse>>('/jobs', { params });
    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};

export const getQueueStats = async (): Promise<QueueStats> => {
  try {
    const response = await api.get<ApiResponse<QueueStats>>('/queue/stats');
    return response.data.data;
  } catch (error) {
    handleError(error as AxiosError);
    throw error;
  }
};