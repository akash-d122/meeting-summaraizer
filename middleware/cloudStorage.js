const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Cloud Storage Configuration for Production
 * Supports local storage (development) and cloud storage (production)
 */

const isProduction = process.env.NODE_ENV === 'production';

// File type validation
const allowedTypes = ['.txt', '.md', '.doc', '.docx', '.pdf', '.rtf'];
const allowedMimeTypes = [
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/rtf',
  'text/rtf',
  'application/vnd.ms-word',
  'application/x-msword'
];

/**
 * Local Storage Configuration (Development)
 */
const localStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `transcript-${uniqueSuffix}-${sanitizedName}`);
  }
});

/**
 * Memory Storage Configuration (Production - for cloud upload)
 */
const memoryStorage = multer.memoryStorage();

/**
 * File Filter
 */
const fileFilter = (req, file, cb) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  console.log(`📁 File upload attempt: ${file.originalname} (${mimeType})`);

  // Check file extension
  if (!allowedTypes.includes(fileExtension)) {
    const error = new Error(`File type ${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(mimeType)) {
    const error = new Error(`MIME type ${mimeType} not allowed.`);
    error.code = 'INVALID_MIME_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

/**
 * Multer Configuration
 */
const upload = multer({
  storage: isProduction ? memoryStorage : localStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

/**
 * Cloud Storage Upload Functions
 */

/**
 * Upload file to cloud storage (implement based on your chosen provider)
 */
const uploadToCloud = async (file, filename) => {
  if (!isProduction) {
    // In development, file is already saved locally
    return {
      url: `/uploads/${filename}`,
      path: path.join(process.env.UPLOAD_DIR || 'uploads', filename),
      size: file.size,
    };
  }

  // Production cloud storage implementation
  // Choose one of the following implementations:

  // Option 1: AWS S3 (uncomment if using S3)
  /*
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `uploads/${filename}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const result = await s3.upload(uploadParams).promise();
  return {
    url: result.Location,
    path: result.Key,
    size: file.size,
  };
  */

  // Option 2: Cloudinary (uncomment if using Cloudinary)
  /*
  const cloudinary = require('cloudinary').v2;
  
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: `uploads/${filename}`,
        use_filename: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(file.buffer);
  });

  return {
    url: result.secure_url,
    path: result.public_id,
    size: file.size,
  };
  */

  // Fallback: Save to local filesystem (not recommended for production)
  const uploadDir = '/tmp/uploads'; // Use /tmp for serverless
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, file.buffer);

  return {
    url: `/uploads/${filename}`,
    path: filePath,
    size: file.size,
  };
};

/**
 * Delete file from cloud storage
 */
const deleteFromCloud = async (filePath) => {
  if (!isProduction) {
    // Delete local file
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Local file deleted: ${filePath}`);
    } catch (error) {
      console.error('Error deleting local file:', error);
    }
    return;
  }

  // Implement cloud deletion based on your provider
  console.log(`🗑️ Cloud file deletion not implemented: ${filePath}`);
};

/**
 * Get file from cloud storage
 */
const getFileFromCloud = async (filePath) => {
  if (!isProduction) {
    // Read local file
    return await fs.readFile(filePath);
  }

  // Implement cloud file retrieval based on your provider
  throw new Error('Cloud file retrieval not implemented');
};

module.exports = {
  upload,
  uploadToCloud,
  deleteFromCloud,
  getFileFromCloud,
  allowedTypes,
  allowedMimeTypes,
};
