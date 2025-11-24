# Deployment Guide - FileProc

Complete guide to deploy FileProc to Render (free tier).

## 🚀 Quick Deploy to Render (10 minutes)

### Prerequisites
- GitHub account
- MongoDB Atlas account (free tier)
- AWS account with S3 bucket configured

---

## Step 1: Prepare MongoDB Atlas

1. Go to https://cloud.mongodb.com
2. Navigate to **Network Access**
3. Click **"Add IP Address"**
4. Select **"Allow Access from Anywhere"** (0.0.0.0/0)
5. Click **"Confirm"**

*Note: For production, restrict to Render's IP addresses*

---

## Step 2: Push to GitHub

```bash
cd /Users/prashant/coding/fileproc

# Make sure .env is NOT tracked
git status

# If .env appears, remove it:
git rm --cached backend/.env
git rm --cached frontend/.env.local

# Add all files
git add .

# Commit
git commit -m "feat: Add Render deployment configuration"

# Push to GitHub
git push origin main
```

---

## Step 3: Deploy Backend to Render

### A. Create Account
1. Go to https://render.com
2. Click **"Get Started"**
3. Sign up with GitHub
4. Authorize Render to access your repositories

### B. Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Click **"Connect account"** if needed
3. Find and select your **"fileproc"** repository
4. Click **"Connect"**

### C. Configure Service
Fill in these exact settings:

| Setting | Value |
|---------|-------|
| **Name** | `fileproc-backend` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### D. Add Environment Variables

Click **"Advanced"** then **"Add Environment Variable"** for each:

```env
MONGODB_URI=your_mongodb_connection_string_from_atlas

AWS_REGION=your_aws_region

AWS_ACCESS_KEY_ID=your_aws_access_key

AWS_SECRET_ACCESS_KEY=your_aws_secret_key

S3_BUCKET_NAME=your_s3_bucket_name

CORS_ORIGIN=http://localhost:3000
```

*Note: We'll update CORS_ORIGIN after deploying the frontend*

### E. Create Service
1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Watch the logs for any errors
4. Once you see "Live ✓", copy your URL

**Your backend URL will be**: `https://fileproc-backend-xxxx.onrender.com`

### F. Test Backend
```bash
# Test health endpoint (replace with your URL)
curl https://fileproc-backend-xxxx.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-24T..."}
```

---

## Step 4: Deploy Frontend to Vercel

### A. Install Vercel CLI
```bash
npm install -g vercel
```

### B. Deploy Frontend
```bash
cd /Users/prashant/coding/fileproc/frontend

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### C. Configure During Deployment
When prompted:

- **Set up and deploy?** → `Y`
- **Which scope?** → Select your account
- **Link to existing project?** → `N`
- **What's your project's name?** → `fileproc-frontend`
- **In which directory is your code located?** → `./`
- **Want to override the settings?** → `N`

### D. Add Environment Variable
After deployment:

1. Go to https://vercel.com/dashboard
2. Select your `fileproc-frontend` project
3. Go to **Settings** → **Environment Variables**
4. Add:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://fileproc-backend-xxxx.onrender.com/api
   ```
   *(Replace with your actual Render backend URL)*
5. Click **"Save"**
6. Go to **Deployments** tab
7. Click **"Redeploy"** on the latest deployment

**Your frontend URL**: `https://fileproc-frontend-xxxx.vercel.app`

---

## Step 5: Update CORS Configuration

1. Go back to **Render dashboard**
2. Click on your **fileproc-backend** service
3. Go to **Environment** tab
4. Find **CORS_ORIGIN** variable
5. Update to your Vercel URL:
   ```
   CORS_ORIGIN=https://fileproc-frontend-xxxx.vercel.app
   ```
6. Click **"Save Changes"**
7. Service will automatically redeploy (~2 minutes)

---

## Step 6: Test Complete Application

1. Visit your Vercel URL: `https://fileproc-frontend-xxxx.vercel.app`
2. Upload a `.txt` file (try a small file first, < 1MB)
3. Click **"Process"**
4. Wait for processing to complete
5. View the processed data
6. Check the **Jobs** page to see queue status

✅ **If all works, your deployment is complete!**

---

## 📊 Monitoring & Logs

### View Backend Logs
1. Go to Render dashboard
2. Click on your service
3. Click **"Logs"** tab
4. Monitor real-time logs

### View Frontend Logs
```bash
# In terminal
vercel logs https://your-app.vercel.app
```

---

## 🔧 Troubleshooting

### Backend Won't Start
**Check logs in Render dashboard**

Common issues:
- Missing environment variables
- MongoDB connection failed (check Network Access)
- AWS credentials invalid
- Port binding issue (Render auto-assigns PORT)

### CORS Errors in Browser
**Symptoms**: `Access-Control-Allow-Origin` error in browser console

**Fix**:
1. Verify CORS_ORIGIN in Render exactly matches your Vercel URL
2. Include `https://` protocol
3. No trailing slash
4. Wait for Render to redeploy after changing

### MongoDB Connection Failed
**Error**: `MongoServerError: Authentication failed`

**Fix**:
1. Check MongoDB Atlas Network Access
2. Add `0.0.0.0/0` to IP whitelist
3. Verify MONGODB_URI format
4. Check username/password in connection string

### File Upload Fails
**Error**: `Access Denied` or `SignatureDoesNotMatch`

**Fix**:
1. Verify AWS credentials in Render environment
2. Check S3 bucket permissions
3. Ensure bucket region matches AWS_REGION
4. Test AWS credentials locally first

### Service Sleeps After 15 Minutes
**Behavior**: First request takes 30+ seconds

This is **normal** for Render free tier:
- Services sleep after 15 minutes of inactivity
- First request "wakes" the service
- Subsequent requests are fast
- Consider paid plan ($7/month) for always-on

### Out of Memory Error
**Error**: `JavaScript heap out of memory`

**Fix in Render**:
1. Go to Environment variables
2. Update `BATCH_SIZE` to `100`
3. Update `MAX_CONCURRENT_JOBS` to `1`
4. Save and redeploy

**Or upgrade to paid plan** (512MB → 2GB RAM)

### Frontend Shows "Network Error"
**Check**:
1. Backend is running (visit `/health` endpoint)
2. NEXT_PUBLIC_API_URL is correct in Vercel
3. CORS is configured correctly
4. Backend hasn't gone to sleep (first request slow)

---

## 💰 Cost Breakdown

### Free Tier (Forever)
- **Render**: 750 hours/month free (enough for demos)
- **Vercel**: Unlimited deploys, 100GB bandwidth
- **MongoDB Atlas**: 512MB storage (M0 cluster)
- **AWS S3**: 5GB storage (free for 12 months)

**Total: $0/month for first year**

### After Free Tier
- **Render Paid**: $7/month (always-on, more memory)
- **Vercel Pro**: $20/month (optional, better analytics)
- **MongoDB M10**: $9/month (dedicated cluster)
- **AWS S3**: ~$0.023/GB (~$0.23 for 10GB)

**Recommended setup: ~$7-16/month**

---

## 🔐 Security Checklist

Before submitting to interviewer:

- [ ] `.env` file is in `.gitignore`
- [ ] No credentials in git history
- [ ] `.env.example` has placeholder values only
- [ ] MongoDB IP whitelist configured
- [ ] AWS IAM user has minimal permissions
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Health check endpoint works

---

## 🌐 Custom Domain (Optional)

### Add Custom Domain to Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. SSL auto-configured by Vercel

### Add Custom Domain to Render
1. Go to Service Settings → Custom Domains
2. Add your domain
3. Update DNS CNAME record
4. Free SSL certificate auto-issued

**Don't forget to update CORS_ORIGIN if you add a custom domain!**

---

## 📞 Support Resources

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas**: https://docs.atlas.mongodb.com
- **AWS S3**: https://docs.aws.amazon.com/s3

---

## ✅ Deployment Checklist

- [ ] MongoDB Atlas IP whitelist configured
- [ ] Code pushed to GitHub
- [ ] Backend deployed to Render
- [ ] All environment variables added to Render
- [ ] Backend health check passes
- [ ] Frontend deployed to Vercel
- [ ] NEXT_PUBLIC_API_URL set in Vercel
- [ ] CORS_ORIGIN updated in Render
- [ ] Test file upload works
- [ ] Test file processing works
- [ ] Check Jobs page works
- [ ] Monitor logs for errors

---

## 🎯 Interview Submission

Include these URLs in your submission:

- **Live Demo**: https://your-app.vercel.app
- **GitHub Repository**: https://github.com/yourusername/fileproc
- **Backend API**: https://fileproc-backend-xxxx.onrender.com
- **API Health Check**: https://fileproc-backend-xxxx.onrender.com/health

**Note**: Mention that backend may take 30 seconds to wake up on first request (Render free tier behavior).

---

## 🚀 What's Deployed

### Backend Features
✅ Express.js REST API  
✅ File upload to AWS S3  
✅ Custom job queue (no external dependencies)  
✅ Stream-based file processing  
✅ MongoDB Atlas integration  
✅ Rate limiting & security middleware  
✅ Health check endpoint  

### Frontend Features
✅ Next.js 14 with App Router  
✅ File upload interface  
✅ Real-time processing status  
✅ Job queue monitoring  
✅ Responsive design with Tailwind CSS  

---

**Your app is now live! 🎉**

Test it thoroughly before submitting to the interviewer.
