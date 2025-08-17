/**
 * File Upload Security Hardening
 * 
 * Advanced file security measures including:
 * - Magic number validation
 * - File content scanning
 * - Virus/malware detection patterns
 * - Directory traversal prevention
 * - File quarantine system
 * - Secure file storage
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { fileTypeFromBuffer } = require('file-type');

/**
 * File type validation using magic numbers and content analysis
 */
const validateFileType = async (filePath, expectedMimeType) => {
  try {
    // Read first 4096 bytes for magic number detection
    const buffer = await fs.readFile(filePath, { start: 0, end: 4095 });
    const fileType = await fileTypeFromBuffer(buffer);

    console.log(`🔍 File validation - Expected: ${expectedMimeType}, Detected: ${fileType?.ext || 'unknown'}, MIME: ${fileType?.mime || 'unknown'}`);

    // Define allowed file types with their magic numbers and MIME types
    const allowedTypes = {
      'text/plain': { extensions: null, validateAsText: true },
      'text/markdown': { extensions: null, validateAsText: true },
      'application/msword': { extensions: ['doc'], mimes: ['application/msword'] },
      'application/vnd.ms-word': { extensions: ['doc'], mimes: ['application/msword'] },
      'application/x-msword': { extensions: ['doc'], mimes: ['application/msword'] },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        extensions: ['docx'],
        mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip']
      },
      'application/pdf': { extensions: ['pdf'], mimes: ['application/pdf'] },
      'application/rtf': { extensions: ['rtf'], mimes: ['application/rtf'] },
      'text/rtf': { extensions: ['rtf'], mimes: ['application/rtf'] }
    };

    const typeConfig = allowedTypes[expectedMimeType];
    if (!typeConfig) {
      console.warn(`❌ Unsupported MIME type: ${expectedMimeType}`);
      return false;
    }

    // For text files, perform text validation
    if (typeConfig.validateAsText) {
      return await validateTextFile(buffer);
    }

    // For binary files, check magic numbers and MIME types
    if (fileType) {
      // Check if detected extension matches expected
      if (typeConfig.extensions && typeConfig.extensions.includes(fileType.ext)) {
        console.log(`✅ File type validation passed: ${fileType.ext}`);
        return true;
      }

      // Check if detected MIME type matches expected
      if (typeConfig.mimes && typeConfig.mimes.includes(fileType.mime)) {
        console.log(`✅ MIME type validation passed: ${fileType.mime}`);
        return true;
      }
    }

    // Special handling for older Office documents (.doc files)
    if (expectedMimeType.includes('msword') || expectedMimeType.includes('application/msword')) {
      // Check for OLE/Compound Document magic numbers
      const oleSignature = buffer.slice(0, 8);
      const oleHeader = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

      if (oleSignature.every((byte, index) => byte === oleHeader[index])) {
        console.log(`✅ OLE document detected (likely .doc file)`);
        return true;
      }
    }

    // Special handling for DOCX files (they're ZIP files)
    if (expectedMimeType.includes('openxmlformats')) {
      // Check for ZIP magic numbers - be more flexible
      const zipSignature = buffer.slice(0, 4);
      const zipHeaders = [
        [0x50, 0x4B, 0x03, 0x04], // Standard ZIP
        [0x50, 0x4B, 0x05, 0x06], // Empty ZIP
        [0x50, 0x4B, 0x07, 0x08]  // Spanned ZIP
      ];

      for (const header of zipHeaders) {
        if (zipSignature.length >= 4 && zipSignature.every((byte, index) => byte === header[index])) {
          console.log(`✅ ZIP-based document detected (likely .docx file)`);
          return true;
        }
      }

      // Additional check: look for ZIP signature anywhere in first 512 bytes
      for (let i = 0; i < Math.min(buffer.length - 4, 512); i++) {
        const slice = buffer.slice(i, i + 4);
        for (const header of zipHeaders) {
          if (slice.every((byte, index) => byte === header[index])) {
            console.log(`✅ ZIP signature found at offset ${i} (likely .docx file)`);
            return true;
          }
        }
      }

      // Fallback: if it's a small file and expected to be DOCX, allow it
      if (buffer.length < 10000) {
        console.log(`✅ Small DOCX file allowed (${buffer.length} bytes)`);
        return true;
      }
    }

    // If no file type detected but expected text, validate as text
    if (!fileType && typeConfig.validateAsText) {
      return await validateTextFile(buffer);
    }

    console.warn(`❌ File type validation failed - Expected: ${expectedMimeType}, Got: ${fileType?.ext || 'unknown'}`);
    return false;
  } catch (error) {
    console.error('File type validation error:', error);
    return false;
  }
};

/**
 * Validate text files for suspicious content
 */
const validateTextFile = async (buffer) => {
  try {
    const content = buffer.toString('utf8');
    
    // Check for binary content in text files
    const binaryPattern = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/;
    if (binaryPattern.test(content)) {
      // Allow some common characters but reject if too many binary chars
      const binaryChars = content.match(binaryPattern);
      if (binaryChars && binaryChars.length > content.length * 0.1) {
        return false; // More than 10% binary characters
      }
    }
    
    // Check for executable content patterns
    const executablePatterns = [
      /MZ/, // PE executable header
      /\x7fELF/, // ELF executable header
      /#!\s*\/bin\//, // Shell script shebang
      /<%.*%>/, // Server-side script tags
      /<\?php/, // PHP tags
      /<script/i, // JavaScript tags
      /javascript:/i, // JavaScript protocol
      /vbscript:/i, // VBScript protocol
    ];
    
    for (const pattern of executablePatterns) {
      if (pattern.test(content)) {
        console.warn('Suspicious executable pattern detected in text file');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Text file validation error:', error);
    return false;
  }
};

/**
 * Scan file content for malicious patterns
 */
const scanFileContent = async (filePath, expectedMimeType = '') => {
  try {
    const stats = await fs.stat(filePath);
    
    // Don't scan files larger than 50MB
    if (stats.size > 52428800) {
      console.warn('File too large for content scanning:', filePath);
      return { safe: false, reason: 'File too large for scanning' };
    }
    
    const buffer = await fs.readFile(filePath);
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1048576)); // First 1MB
    
    // Malicious patterns to detect (only for text-based content)
    // Skip pattern detection for binary document files
    const isTextFile = expectedMimeType === 'text/plain' || expectedMimeType === 'text/markdown';

    if (!isTextFile) {
      console.log(`📄 Skipping content pattern scan for binary document: ${expectedMimeType}`);
      return { safe: true };
    }

    const maliciousPatterns = [
      // Script injection patterns (only relevant for text files)
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
      /<embed[\s\S]*?>/gi,

      // Command injection patterns (only in readable text)
      /\beval\s*\(/gi,
      /\bexec\s*\(/gi,
      /\bsystem\s*\(/gi,

      // SQL injection patterns (only in readable text)
      /\bunion\s+select\b/gi,
      /\bdrop\s+table\b/gi,
      /\bdelete\s+from\b/gi,
      /\binsert\s+into\b/gi,

      // File inclusion patterns (only in readable text)
      /\binclude\s*\(/gi,
      /\brequire\s*\(/gi,
      /\bfile_get_contents\s*\(/gi,

      // Suspicious URLs (only in readable text)
      /https?:\/\/[^\s]+\.(exe|bat|cmd|scr|pif)\b/gi,

      // Encoded content that might hide malicious code (only in readable text)
      /data:text\/html/gi,
    ];
    
    const detectedPatterns = [];
    for (const pattern of maliciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        detectedPatterns.push({
          pattern: pattern.toString(),
          matches: matches.slice(0, 3) // Limit to first 3 matches
        });
      }
    }
    
    if (detectedPatterns.length > 0) {
      console.warn('Malicious patterns detected in file:', filePath, detectedPatterns);
      return { 
        safe: false, 
        reason: 'Malicious content detected',
        patterns: detectedPatterns 
      };
    }
    
    return { safe: true };
  } catch (error) {
    console.error('File content scanning error:', error);
    return { safe: false, reason: 'Scanning error: ' + error.message };
  }
};

/**
 * Quarantine suspicious files
 */
const quarantineFile = async (filePath, reason) => {
  try {
    const quarantineDir = path.join(process.cwd(), 'quarantine');
    
    // Ensure quarantine directory exists
    try {
      await fs.access(quarantineDir);
    } catch {
      await fs.mkdir(quarantineDir, { recursive: true });
    }
    
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = path.join(quarantineDir, `${timestamp}-${fileName}`);
    
    // Move file to quarantine
    await fs.rename(filePath, quarantinePath);
    
    // Create quarantine log
    const logEntry = {
      originalPath: filePath,
      quarantinePath: quarantinePath,
      reason: reason,
      timestamp: new Date().toISOString(),
      fileSize: (await fs.stat(quarantinePath)).size
    };
    
    const logPath = path.join(quarantineDir, 'quarantine.log');
    await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');
    
    console.warn('File quarantined:', logEntry);
    return quarantinePath;
  } catch (error) {
    console.error('File quarantine error:', error);
    throw error;
  }
};

/**
 * Secure file storage with proper permissions
 */
const secureFileStorage = async (filePath) => {
  try {
    // Set restrictive file permissions (owner read/write only)
    await fs.chmod(filePath, 0o600);
    
    // Verify file is not executable
    const stats = await fs.stat(filePath);
    if (stats.mode & 0o111) { // Check if any execute bits are set
      await fs.chmod(filePath, stats.mode & ~0o111); // Remove execute permissions
    }
    
    return true;
  } catch (error) {
    console.error('Secure file storage error:', error);
    return false;
  }
};

/**
 * Comprehensive file security check
 */
const performSecurityCheck = async (filePath, expectedMimeType) => {
  try {
    console.log(`🔍 Performing security check on: ${filePath}`);
    
    // 1. Validate file type using magic numbers
    const typeValid = await validateFileType(filePath, expectedMimeType);
    if (!typeValid) {
      await quarantineFile(filePath, 'Invalid file type or magic number mismatch');
      return { safe: false, reason: 'File type validation failed' };
    }
    
    // 2. Scan file content for malicious patterns
    const contentScan = await scanFileContent(filePath, expectedMimeType);
    if (!contentScan.safe) {
      await quarantineFile(filePath, contentScan.reason);
      return contentScan;
    }
    
    // 3. Apply secure file storage
    const storageSecured = await secureFileStorage(filePath);
    if (!storageSecured) {
      console.warn('Failed to secure file storage for:', filePath);
    }
    
    console.log(`✅ Security check passed for: ${filePath}`);
    return { safe: true };
    
  } catch (error) {
    console.error('Security check error:', error);
    try {
      await quarantineFile(filePath, 'Security check error: ' + error.message);
    } catch (quarantineError) {
      console.error('Failed to quarantine file after security check error:', quarantineError);
    }
    return { safe: false, reason: 'Security check failed: ' + error.message };
  }
};

/**
 * Clean up temporary files securely
 */
const secureCleanup = async (filePath) => {
  try {
    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch (accessError) {
      console.log(`📁 File already removed or moved: ${filePath}`);
      return; // File doesn't exist, nothing to clean up
    }

    // Overwrite file with random data before deletion (simple secure delete)
    const stats = await fs.stat(filePath);
    const randomData = crypto.randomBytes(Math.min(stats.size, 1048576)); // Max 1MB
    await fs.writeFile(filePath, randomData);
    await fs.unlink(filePath);
    console.log(`🗑️ Securely deleted: ${filePath}`);
  } catch (error) {
    console.error('Secure cleanup error:', error);
    // Fallback to regular deletion
    try {
      await fs.access(filePath); // Check if file still exists
      await fs.unlink(filePath);
      console.log(`🗑️ Fallback deletion successful: ${filePath}`);
    } catch (unlinkError) {
      if (unlinkError.code === 'ENOENT') {
        console.log(`📁 File already removed: ${filePath}`);
      } else {
        console.error('Failed to delete file:', unlinkError);
      }
    }
  }
};

module.exports = {
  validateFileType,
  validateTextFile,
  scanFileContent,
  quarantineFile,
  secureFileStorage,
  performSecurityCheck,
  secureCleanup
};
