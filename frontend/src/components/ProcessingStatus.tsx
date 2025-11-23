import { getStatusColor } from '@/lib/utils';

interface ProcessingStatusProps {
  status: 'uploaded' | 'processing' | 'processed' | 'failed' | 'pending' | 'completed';
}

export default function ProcessingStatus({ status }: ProcessingStatusProps) {
  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'Uploaded';
      case 'processing':
        return 'Processing';
      case 'processed':
        return 'Processed';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
        status
      )}`}
    >
      {getStatusText(status)}
    </span>
  );
}