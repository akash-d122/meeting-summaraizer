# 🤖 AI-Powered Meeting Summarizer

A full-stack web application that transforms meeting transcripts into structured, shareable summaries using Groq AI integration with customizable output formats and email distribution.

## 📋 Features

- **File Upload System**: Support for .txt, .md, .doc, .docx files up to 10MB
- **Custom AI Instructions**: Multiple summary styles (Executive, Action Items, Technical, Detailed)
- **Groq AI Integration**: Using llama-3.3-70b-versatile with fallback to llama-3.1-8b-instant
- **Summary Editing**: Real-time editing with preview functionality
- **Email Distribution**: Send summaries to multiple recipients
- **Security**: Rate limiting, input validation, secure file handling

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- PostgreSQL or MongoDB
- Groq API key
- Email service API key (SendGrid/AWS SES/Mailgun)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meeting-summaraizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.meeting-summarizer .env
   # Edit .env with your actual API keys and configuration
   ```

   **📋 For detailed Groq API setup**: See [docs/GROQ_SETUP.md](docs/GROQ_SETUP.md)
   **🧠 For prompt engineering details**: See [docs/PROMPT_ENGINEERING.md](docs/PROMPT_ENGINEERING.md)

4. **Create required directories**
   ```bash
   mkdir logs
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Groq API key for AI processing | Yes |
| `DATABASE_URL` | Database connection string | Yes |
| `SENDGRID_API_KEY` | SendGrid API key for email | Yes* |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |

*Choose one email service provider

### Database Setup

**PostgreSQL:**
```sql
CREATE DATABASE meeting_summarizer;
```

**MongoDB:**
```bash
# MongoDB will create the database automatically
```

## 📁 Project Structure

```
meeting-summaraizer/
├── public/                 # Frontend files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styles
│   └── app.js            # Frontend JavaScript
├── routes/                # API routes
│   ├── upload.js         # File upload endpoints
│   ├── summary.js        # Summary generation endpoints
│   └── email.js          # Email sending endpoints
├── uploads/              # Uploaded files storage
├── logs/                 # Application logs
├── .taskmaster/          # Task Master AI configuration
├── server.js             # Main server file
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## 🔄 Development Workflow

This project uses **Task Master AI** for structured development. Current development phases:

### Phase 1: Foundation ✅
- [x] Project initialization and environment setup
- [ ] Database schema design and implementation
- [ ] File upload API with validation
- [ ] Frontend file upload interface

### Phase 2: AI Integration
- [ ] Custom instruction input system
- [ ] Groq AI service integration
- [ ] AI processing workflow and error handling

### Phase 3: Summary Management
- [ ] Summary display and editing interface
- [ ] Preview and formatting options

### Phase 4: Email Distribution
- [ ] Email composition interface
- [ ] Email service provider integration

### Phase 5: Production Readiness
- [ ] Security implementation
- [ ] Testing and documentation
- [ ] Deployment preparation

## 🧪 Testing

```bash
# Run tests
npm test

# Run development server with auto-reload
npm run dev

# Start production server
npm start
```

## 📊 API Endpoints

### File Upload
- `POST /api/upload` - Upload meeting transcript file

### Summary Generation
- `POST /api/summary/generate` - Generate AI summary
- `GET /api/summary/:id` - Get summary by ID
- `PUT /api/summary/:id` - Update summary content

### Email Distribution
- `POST /api/email/send` - Send summary via email
- `GET /api/email/status/:id` - Check email delivery status

### Health Check
- `GET /health` - Application health status

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **File Validation**: Type and size restrictions
- **Input Sanitization**: Express-validator for all inputs
- **Helmet.js**: Security headers
- **Environment Variables**: Secure API key storage

## 🚀 Deployment

### Local Deployment
```bash
npm start
```

### Cloud Deployment (Heroku)
```bash
# Install Heroku CLI and login
heroku create your-app-name
heroku config:set GROQ_API_KEY=your_key_here
# ... set other environment variables
git push heroku main
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check the [Issues](../../issues) page for known problems
- Create a new issue for bug reports or feature requests
- Review the Task Master AI logs in `.taskmaster/` for development tracking
