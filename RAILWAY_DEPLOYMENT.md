# Railway Deployment Guide

## Issues Fixed

The deployment was failing due to:

1. **SQLite3 Architecture Mismatch**: Native modules compiled for Windows trying to run on Linux
2. **Environment Configuration**: NODE_ENV not set to production
3. **Database Configuration**: Falling back to SQLite instead of PostgreSQL
4. **Build Process**: Missing proper rebuild of native modules
5. **Build Timeout**: npm rebuild taking too long during postinstall

## Changes Made

### 1. Package.json Updates
- Moved `sqlite3` to devDependencies (only needed for local development)
- Removed `postinstall` script that was causing build timeouts
- Simplified build process

### 2. Railway Configuration (railway.json)
- Updated build command: `npm ci --omit=dev` (faster, production-only install)
- Updated start command: `NODE_ENV=production npm start`
- Removed rebuild step that was causing timeouts

### 3. Nixpacks Configuration (nixpacks.toml)
- Added explicit Nixpacks configuration for optimized builds
- Ensures consistent Node.js version and faster installs

### 4. Database Configuration
- Enhanced database.js to properly handle production environment
- Added explicit PostgreSQL configuration when DATABASE_URL is present
- Improved SSL handling for Railway PostgreSQL
- Removed SQLite dependency from production builds

### 5. Environment Variables
- Created .env.production template
- Updated Procfile to set NODE_ENV=production

## Deployment Steps

### 1. Railway Setup
1. Create new Railway project
2. Connect your GitHub repository
3. Add PostgreSQL service to your project

### 2. Environment Variables
Set these in Railway's environment variables section:

**Required:**
```
NODE_ENV=production
GROQ_API_KEY=your_groq_api_key_here
```

**Database (automatically provided by Railway PostgreSQL service):**
```
DATABASE_URL=postgresql://...
```

**Email Service (choose one):**
```
# SendGrid
SENDGRID_API_KEY=your_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# OR Mailgun
MAILGUN_API_KEY=your_key
MAILGUN_DOMAIN=your_domain
MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# OR AWS SES
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
```

**Security:**
```
JWT_SECRET=your_super_secure_jwt_secret_here
SESSION_SECRET=your_super_secure_session_secret_here
```

### 3. Deploy
1. Push your changes to GitHub
2. Railway will automatically deploy
3. Check the health endpoint: `https://your-app.railway.app/health`

## Troubleshooting

### Health Check Failures
- Ensure DATABASE_URL is set (Railway PostgreSQL provides this)
- Verify GROQ_API_KEY is valid
- Check logs for specific error messages

### Database Connection Issues
- Confirm PostgreSQL service is added to Railway project
- Verify DATABASE_URL environment variable is present
- Check SSL configuration if needed

### Build Failures
- Ensure all dependencies are in package.json
- Check that native modules rebuild successfully
- Verify Node.js version compatibility

## Testing Locally with Production Config

```bash
# Install dependencies
npm install

# Set environment variables
export NODE_ENV=production
export DATABASE_URL=your_local_postgres_url
export GROQ_API_KEY=your_key

# Start server
npm start
```

## Next Steps After Successful Deployment

1. Test all endpoints
2. Verify file upload functionality
3. Test AI summarization
4. Test email sending
5. Monitor logs for any issues
6. Set up custom domain (optional)
