# 🚀 Meeting Summarizer - Deployment Guide

## 📋 **Prerequisites**

Before deploying, ensure you have:
- [x] GitHub account with your code repository
- [x] Groq API key for AI processing
- [x] Email service credentials (Gmail App Password recommended)
- [x] Railway account (recommended) or Render account

## 🎯 **Recommended Platform: Railway**

Railway is recommended because it provides:
- ✅ Full Node.js support with persistent storage
- ✅ Built-in PostgreSQL database
- ✅ Simple deployment from GitHub
- ✅ Automatic HTTPS and custom domains
- ✅ Environment variable management
- ✅ Reasonable pricing ($5/month for hobby projects)

## 🚀 **Step-by-Step Deployment**

### **Step 1: Prepare Your Repository**

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

2. **Ensure these files are in your repository:**
   - `package.json` (with production scripts)
   - `server.js` (main server file)
   - `railway.json` (Railway configuration)
   - `Procfile` (process configuration)
   - `.env.example` (environment template)

### **Step 2: Create Railway Project**

1. **Sign up for Railway:**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your meeting-summarizer repository

3. **Add PostgreSQL database:**
   - In your Railway project dashboard
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically create a database and provide connection details

### **Step 3: Configure Environment Variables**

In your Railway project dashboard, go to "Variables" and add:

#### **Required Variables:**
```
NODE_ENV=production
PORT=3000

# Database (Railway provides this automatically)
DATABASE_URL=postgresql://...

# AI Service
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL_PRIMARY=llama-3.3-70b-versatile
GROQ_MODEL_FALLBACK=llama-3.1-8b-instant

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_FROM_NAME=Meeting Summarizer
EMAIL_FROM_ADDRESS=your_email@gmail.com

# Security
SESSION_SECRET=your_very_long_random_session_secret_here
JWT_SECRET=your_jwt_secret_here

# URLs (Railway provides these)
FRONTEND_URL=https://your-app-name.railway.app
BACKEND_URL=https://your-app-name.railway.app
CORS_ORIGIN=https://your-app-name.railway.app

# File Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=.txt,.md,.doc,.docx,.pdf,.rtf

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### **Optional Variables (for enhanced features):**
```
# Cloud Storage (if using AWS S3)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Logging
LOG_LEVEL=info
HEALTH_CHECK_ENABLED=true
```

### **Step 4: Deploy**

1. **Automatic deployment:**
   - Railway automatically deploys when you push to GitHub
   - Monitor deployment in Railway dashboard

2. **Check deployment status:**
   - Go to "Deployments" tab in Railway
   - Check logs for any errors

3. **Test your deployment:**
   - Visit your Railway app URL
   - Test file upload and AI processing
   - Check health endpoint: `https://your-app.railway.app/health`

## 🔧 **Post-Deployment Configuration**

### **1. Database Setup**
Your database will be automatically created, but you may want to:
- Check database connection in Railway logs
- Monitor database usage in Railway dashboard

### **2. Custom Domain (Optional)**
1. In Railway dashboard, go to "Settings"
2. Add your custom domain
3. Configure DNS records as instructed

### **3. Monitoring**
- Use Railway's built-in monitoring
- Check application logs regularly
- Monitor database performance

## 🛠️ **Alternative: Render Deployment**

If you prefer Render:

1. **Create Render account:** [render.com](https://render.com)
2. **Create Web Service:**
   - Connect GitHub repository
   - Choose "Node" environment
   - Set build command: `npm install`
   - Set start command: `node server.js`

3. **Add PostgreSQL database:**
   - Create new PostgreSQL database in Render
   - Copy connection string to environment variables

4. **Configure environment variables** (same as Railway)

## ⚠️ **Important Production Considerations**

### **File Upload Storage:**
- Current setup uses temporary storage
- For production, implement cloud storage (S3, Cloudinary)
- Update `middleware/cloudStorage.js` with your chosen provider

### **Database Backups:**
- Railway provides automatic backups
- Consider additional backup strategy for critical data

### **Security:**
- Use strong, unique secrets for SESSION_SECRET and JWT_SECRET
- Enable HTTPS (automatic with Railway/Render)
- Monitor for security vulnerabilities

### **Performance:**
- Monitor API response times
- Consider implementing caching for frequently accessed data
- Monitor Groq API usage and costs

## 🔍 **Troubleshooting**

### **Common Issues:**

1. **Database Connection Errors:**
   - Check DATABASE_URL format
   - Ensure database is running
   - Check network connectivity

2. **File Upload Issues:**
   - Verify UPLOAD_MAX_SIZE setting
   - Check file type restrictions
   - Monitor disk space usage

3. **AI Processing Errors:**
   - Verify GROQ_API_KEY is correct
   - Check API rate limits
   - Monitor token usage

4. **Email Sending Issues:**
   - Use Gmail App Password (not regular password)
   - Check EMAIL_* configuration
   - Verify SMTP settings

### **Debugging:**
- Check Railway/Render logs
- Use health check endpoint
- Monitor error rates in dashboard

## 📊 **Cost Estimation**

### **Railway (Recommended):**
- Hobby Plan: $5/month
- Includes: 512MB RAM, PostgreSQL database, custom domains
- Additional usage: $0.000463/GB-hour

### **Render:**
- Free tier available (with limitations)
- Paid plans start at $7/month
- PostgreSQL: $7/month

### **Additional Costs:**
- Groq API: Pay-per-use (very affordable)
- Domain name: $10-15/year (optional)
- Cloud storage: $1-5/month (if implemented)

## ✅ **Deployment Checklist**

- [ ] Code pushed to GitHub
- [ ] Railway/Render project created
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Application deployed successfully
- [ ] Health check endpoint working
- [ ] File upload functionality tested
- [ ] AI processing working
- [ ] Email sending functional
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up

## 🔧 **Production Optimizations**

### **Performance Optimizations:**

1. **Enable Compression:**
   ```javascript
   // Already included in server.js
   app.use(compression());
   ```

2. **Database Connection Pooling:**
   ```javascript
   // Configured in config/database-production.js
   pool: {
     max: 10,
     min: 0,
     acquire: 30000,
     idle: 10000,
   }
   ```

3. **Caching Headers:**
   ```javascript
   // Add to static file serving
   app.use(express.static('public', {
     maxAge: '1d', // Cache static files for 1 day
   }));
   ```

### **Security Enhancements:**

1. **Rate Limiting:** Already configured in middleware/security.js
2. **Helmet Security Headers:** Already configured
3. **CORS Protection:** Production-ready CORS configuration
4. **Input Validation:** File type and size validation

### **Monitoring and Logging:**

1. **Health Check Endpoint:**
   ```
   GET /health
   ```

2. **Application Logs:**
   - Monitor Railway/Render logs
   - Check for errors and performance issues

3. **Database Monitoring:**
   - Monitor connection pool usage
   - Track query performance

## 🚨 **Potential Challenges & Solutions**

### **1. File Upload Storage**

**Challenge:** Serverless environments don't support persistent file storage.

**Solutions:**

#### **Option A: AWS S3 (Recommended)**
```bash
npm install aws-sdk
```

Update `middleware/cloudStorage.js`:
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Implement uploadToCloud function
```

#### **Option B: Cloudinary**
```bash
npm install cloudinary
```

#### **Option C: Temporary Storage (Current)**
- Files stored in `/tmp` (cleared on restart)
- Suitable for processing-only workflows
- No permanent file storage needed

### **2. Database Connection Limits**

**Challenge:** Cloud databases have connection limits.

**Solution:** Connection pooling (already implemented)
```javascript
pool: {
  max: 10, // Maximum connections
  min: 0,  // Minimum connections
  acquire: 30000, // Timeout for acquiring connection
  idle: 10000, // Timeout for idle connections
}
```

### **3. API Rate Limiting**

**Challenge:** Groq API has rate limits.

**Solutions:**
- Implement request queuing
- Add retry logic with exponential backoff
- Monitor API usage

### **4. Environment Variables**

**Challenge:** Secure management of secrets.

**Solutions:**
- Use Railway/Render environment variable management
- Never commit `.env` files
- Use strong, unique secrets

### **5. CORS Issues**

**Challenge:** Cross-origin requests blocked.

**Solution:** Update CORS configuration
```javascript
// Add your domain to allowed origins
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
```

## 📊 **Monitoring & Maintenance**

### **Key Metrics to Monitor:**

1. **Application Health:**
   - Response times
   - Error rates
   - Uptime percentage

2. **Database Performance:**
   - Connection pool usage
   - Query execution times
   - Database size growth

3. **API Usage:**
   - Groq API calls per day
   - Token consumption
   - Cost tracking

4. **User Activity:**
   - File uploads per day
   - Summary generations
   - Email sends

### **Regular Maintenance Tasks:**

1. **Weekly:**
   - Review application logs
   - Check error rates
   - Monitor API costs

2. **Monthly:**
   - Database performance review
   - Security updates
   - Backup verification

3. **Quarterly:**
   - Performance optimization
   - Feature usage analysis
   - Scaling assessment

## 🎉 **Success!**

Your Meeting Summarizer is now deployed and ready for production use!

**Next Steps:**
- Share your application URL with users
- Monitor usage and performance
- Consider implementing cloud storage
- Set up regular backups
- Plan for scaling as usage grows

**Production URL:** `https://your-app-name.railway.app`

**Admin Tasks:**
- [ ] Monitor logs daily
- [ ] Check health endpoint regularly
- [ ] Review API usage weekly
- [ ] Update dependencies monthly
- [ ] Backup database regularly
