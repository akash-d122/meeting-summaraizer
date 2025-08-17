#!/usr/bin/env node

/**
 * Pre-deployment Check Script
 * Validates that the application is ready for production deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Meeting Summarizer - Pre-Deployment Check\n');

const checks = [];
let allPassed = true;

/**
 * Check if a file exists
 */
function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  checks.push({
    name: description,
    status: exists ? 'PASS' : 'FAIL',
    message: exists ? `✅ ${filePath} exists` : `❌ ${filePath} missing`
  });
  if (!exists) allPassed = false;
  return exists;
}

/**
 * Check package.json for required scripts
 */
function checkPackageJson() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const hasStart = packageJson.scripts && packageJson.scripts.start;
    
    checks.push({
      name: 'Package.json start script',
      status: hasStart ? 'PASS' : 'FAIL',
      message: hasStart ? '✅ Start script configured' : '❌ Missing start script'
    });
    
    if (!hasStart) allPassed = false;
    return hasStart;
  } catch (error) {
    checks.push({
      name: 'Package.json validation',
      status: 'FAIL',
      message: '❌ Invalid package.json'
    });
    allPassed = false;
    return false;
  }
}

/**
 * Check environment variables template
 */
function checkEnvTemplate() {
  if (!checkFile('.env.example', 'Environment template')) return false;
  
  try {
    const envExample = fs.readFileSync('.env.example', 'utf8');
    const requiredVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'GROQ_API_KEY',
      'EMAIL_USER',
      'EMAIL_PASSWORD'
    ];
    
    const missingVars = requiredVars.filter(varName => !envExample.includes(varName));
    
    if (missingVars.length === 0) {
      checks.push({
        name: 'Environment variables template',
        status: 'PASS',
        message: '✅ All required environment variables documented'
      });
      return true;
    } else {
      checks.push({
        name: 'Environment variables template',
        status: 'FAIL',
        message: `❌ Missing variables: ${missingVars.join(', ')}`
      });
      allPassed = false;
      return false;
    }
  } catch (error) {
    checks.push({
      name: 'Environment variables template',
      status: 'FAIL',
      message: '❌ Cannot read .env.example'
    });
    allPassed = false;
    return false;
  }
}

/**
 * Check for sensitive files that shouldn't be deployed
 */
function checkSensitiveFiles() {
  const sensitiveFiles = ['.env', 'database.sqlite', 'uploads/'];
  const foundSensitive = [];
  
  sensitiveFiles.forEach(file => {
    if (fs.existsSync(file)) {
      foundSensitive.push(file);
    }
  });
  
  if (foundSensitive.length === 0) {
    checks.push({
      name: 'Sensitive files check',
      status: 'PASS',
      message: '✅ No sensitive files found in repository'
    });
    return true;
  } else {
    checks.push({
      name: 'Sensitive files check',
      status: 'WARN',
      message: `⚠️ Found sensitive files: ${foundSensitive.join(', ')} (ensure they are in .gitignore)`
    });
    return true; // Warning, not failure
  }
}

/**
 * Check .gitignore
 */
function checkGitignore() {
  if (!checkFile('.gitignore', 'Git ignore file')) return false;
  
  try {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const requiredIgnores = ['.env', 'node_modules', 'uploads/', '*.log'];
    const missingIgnores = requiredIgnores.filter(pattern => !gitignore.includes(pattern));
    
    if (missingIgnores.length === 0) {
      checks.push({
        name: 'Gitignore configuration',
        status: 'PASS',
        message: '✅ All sensitive patterns ignored'
      });
      return true;
    } else {
      checks.push({
        name: 'Gitignore configuration',
        status: 'WARN',
        message: `⚠️ Consider adding: ${missingIgnores.join(', ')}`
      });
      return true; // Warning, not failure
    }
  } catch (error) {
    checks.push({
      name: 'Gitignore configuration',
      status: 'FAIL',
      message: '❌ Cannot read .gitignore'
    });
    allPassed = false;
    return false;
  }
}

/**
 * Run all checks
 */
function runChecks() {
  console.log('Running pre-deployment checks...\n');
  
  // Required files
  checkFile('server.js', 'Main server file');
  checkFile('package.json', 'Package configuration');
  checkFile('railway.json', 'Railway configuration');
  checkFile('Procfile', 'Process configuration');
  
  // Configuration checks
  checkPackageJson();
  checkEnvTemplate();
  checkGitignore();
  checkSensitiveFiles();
  
  // Directory structure
  checkFile('public/index.html', 'Frontend HTML');
  checkFile('public/app.js', 'Frontend JavaScript');
  checkFile('public/styles.css', 'Frontend CSS');
  checkFile('middleware/security.js', 'Security middleware');
  checkFile('config/database.js', 'Database configuration');
  
  // Display results
  console.log('\n📋 Deployment Check Results:\n');
  
  checks.forEach(check => {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}: ${check.message}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (allPassed) {
    console.log('🎉 All checks passed! Your application is ready for deployment.');
    console.log('\nNext steps:');
    console.log('1. Push your code to GitHub');
    console.log('2. Create Railway/Render project');
    console.log('3. Configure environment variables');
    console.log('4. Deploy and test');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed. Please fix the issues before deploying.');
    console.log('\nRefer to DEPLOYMENT_GUIDE.md for detailed instructions.');
    process.exit(1);
  }
}

// Run the checks
runChecks();
