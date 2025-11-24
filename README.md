# FileProc - File Processing System

A production-level file processing application with Express.js backend and Next.js frontend, featuring AWS S3 storage, MongoDB Atlas database, and a custom job queue system.

## Features

- **File Upload**: Upload text files (up to 10MB) to AWS S3
- **Stream Processing**: Memory-efficient processing of large files using Node.js streams
- **Custom Job Queue**: Built-in job queue with priority, retry logic, and timeout handling
- **Real-time Status**: Live updates on file processing status
- **Queue Monitoring**: View active, pending, and completed jobs
- **Docker Support**: Containerized deployment with Docker Compose

## Tech Stack

### Backend
- **Node.js** (v18+) with Express.js
- **MongoDB Atlas** (Free tier M0)
- **AWS S3** for file storage
- **Custom Job Queue** (no external dependencies like Bull/BullMQ)
- **Stream Processing** with readline for memory efficiency

### Frontend
- **Next.js 14** (App Router)
- **React 19** with TypeScript
- **Tailwind CSS v4** for styling
- **Axios** for API calls
- **React Hot Toast** for notifications

## Project Structure

```
fileproc/
├── backend/
│   ├── src/
│   │   ├── config/          # AWS, DB, and server configuration
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Error, upload, and validation middleware
│   │   ├── models/          # MongoDB models (File, Job, FileData)
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic (S3, file processing, queue)
│   │   ├── utils/           # Logger and stream processor utilities
│   │   └── server.js        # Application entry point
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/             # Next.js pages
    │   ├── components/      # React components
    │   ├── services/        # API client
    │   └── types/           # TypeScript definitions
    ├── Dockerfile
    └── package.json
```

## Prerequisites

- Node.js 18+
- MongoDB Atlas account (free tier)
- AWS account with S3 access (free tier)
- Docker and Docker Compose (optional)

## Environment Setup

### Backend (.env)
```env
# Server
PORT=5000
NODE_ENV=production

# MongoDB Atlas
MONGODB_URI=your_mongodb_connection_string

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name

# File Processing
MAX_FILE_SIZE=10485760
BATCH_SIZE=500
JOB_TIMEOUT=300000
MAX_RETRIES=3
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Installation

### Option 1: Using Docker (Recommended)

```bash
# Start both backend and frontend
docker-compose -f backend/docker-compose.yml up -d

# Backend will be available at http://localhost:5000
# Frontend will be available at http://localhost:3000
```

### Option 2: Manual Setup

#### Backend
```bash
cd backend
npm install
npm start  # Production
# or
npm run dev  # Development with nodemon
```

#### Frontend
```bash
cd frontend
npm install
npm run dev  # Development
# or
npm run build && npm start  # Production
```

## API Endpoints

### Upload File
```http
POST /api/upload
Content-Type: multipart/form-data

Body:
- file: File (text file, max 10MB)
```

### Process File
```http
POST /api/process/:fileId
```

### Get All Files
```http
GET /api/files
```

### Get File Details
```http
GET /api/files/:fileId
```

### Get Jobs
```http
GET /api/jobs
```

### Get Queue Stats
```http
GET /api/queue/stats
```

## Memory Optimization

The application is optimized for free tier resources:

- Node.js heap size: 4GB (`--max-old-space-size=4096`)
- Batch processing: 500 lines per batch
- Stream-based file processing to minimize memory usage
- Immediate memory clearing after batch operations
- MongoDB Atlas M0: 512MB storage limit
- AWS S3: 5GB free for 12 months

## Key Features Explained

### Custom Job Queue
- EventEmitter-based implementation
- Priority support (high, normal, low)
- Automatic retry with exponential backoff
- Timeout handling (5 minutes default)
- Graceful shutdown with job completion
- Detailed logging with Winston

### Stream Processing
- Uses Node.js readline for line-by-line processing
- Batch insertions to MongoDB (500 lines per batch)
- Immediate memory cleanup after each batch
- Handles large files without loading entire content into memory

### File Processing Flow
1. File uploaded via frontend → Multer memory storage
2. File streamed to AWS S3 → S3 key stored in MongoDB
3. User triggers processing → Job added to queue
4. Queue processes job → Streams file from S3
5. Parses and batches data → Inserts into MongoDB
6. Updates job status → Frontend shows completion

## Production Deployment

### AWS EC2 Setup (Recommended)
1. Launch an EC2 instance (t2.micro for free tier)
2. Install Docker and Docker Compose
3. Clone repository
4. Set environment variables
5. Run `docker-compose up -d`
6. Configure security groups (ports 5000, 3000)

### Vercel (Frontend Only)
```bash
cd frontend
vercel deploy
```

## Troubleshooting

### Memory Issues
- Files >1MB may cause memory spikes
- Monitor with `docker stats` or `htop`
- Reduce BATCH_SIZE in .env if needed

### MongoDB Connection
- Ensure IP whitelist includes your server IP
- Verify connection string format
- Check network access in MongoDB Atlas

### S3 Upload Failures
- Verify AWS credentials
- Check bucket permissions (PutObject, GetObject)
- Ensure bucket region matches AWS_REGION

## License

MIT

## Author

Built as a production-level file processing system with free tier optimization.