// Meeting Summarizer Frontend Application
class MeetingSummarizer {
    constructor() {
        this.currentSection = 'upload-section';
        this.uploadedFile = null;
        this.generatedSummary = null;
        this.sessionToken = localStorage.getItem('sessionToken');
        this.currentTranscript = null;
        this.workflowStep = 'upload'; // Track workflow progress

        this.initializeEventListeners();
        this.handleURLParameters();
        this.showSection('upload-section');
        this.loadExistingSession();
        this.updateNavigation();
    }

    initializeEventListeners() {
        // File upload events
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');
        const uploadArea = document.getElementById('upload-area');

        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        
        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Summary style change
        document.getElementById('summary-style').addEventListener('change', (e) => {
            this.handleStyleChange(e.target.value);
        });

        // Character counter for custom instructions
        document.getElementById('custom-instructions').addEventListener('input', (e) => {
            this.updateCharacterCount(e.target.value.length);
        });

        // Template and tips buttons
        document.getElementById('show-templates-btn').addEventListener('click', () => {
            this.togglePanel('templates-panel');
        });

        document.getElementById('show-tips-btn').addEventListener('click', () => {
            this.togglePanel('tips-panel');
        });

        // Email functionality
        document.getElementById('share-btn').addEventListener('click', () => {
            this.showEmailSection();
        });

        document.getElementById('preview-email-btn').addEventListener('click', () => {
            this.previewEmail();
        });

        document.getElementById('send-email-btn').addEventListener('click', () => {
            this.sendSummaryEmail();
        });

        document.getElementById('send-from-preview-btn').addEventListener('click', () => {
            this.sendSummaryEmail();
        });

        document.getElementById('edit-email-btn').addEventListener('click', () => {
            this.showSection('email-section');
        });

        document.getElementById('back-to-summary-btn').addEventListener('click', () => {
            this.showSection('summary-section');
        });

        // Template selection change
        document.getElementById('email-template').addEventListener('change', () => {
            this.updateTemplateDescription();
        });

        // Template selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.template-card')) {
                const templateType = e.target.closest('.template-card').dataset.template;
                this.applyTemplate(templateType);
            }
        });

        // Save instructions
        document.getElementById('save-instructions-btn').addEventListener('click', () => {
            this.saveInstructions();
        });

        // Button events
        document.getElementById('generate-btn').addEventListener('click', () => this.generateSummary());
        document.getElementById('edit-btn').addEventListener('click', () => this.toggleEdit());


        // Navigation events - use page reload for complete state reset
        // Note: Page reload is used instead of JavaScript state reset to ensure
        // all application state, event handlers, and UI elements are completely cleared
        document.getElementById('start-over-btn').addEventListener('click', (e) => {
            this.handleNavigationClick(e.target, 'start-over');
        });

        document.getElementById('process-another-btn').addEventListener('click', (e) => {
            this.handleNavigationClick(e.target, 'process-another');
        });
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show target section
        document.getElementById(sectionId).classList.remove('hidden');
        this.currentSection = sectionId;

        // Update workflow step based on section
        this.updateWorkflowStep(sectionId);
        this.updateNavigation();
    }

    /**
     * Update workflow step based on current section
     */
    updateWorkflowStep(sectionId) {
        switch (sectionId) {
            case 'upload-section':
                this.workflowStep = 'upload';
                break;
            case 'instructions-section':
                this.workflowStep = 'instructions';
                break;
            case 'summary-section':
                this.workflowStep = 'summary';
                break;
            case 'email-section':
            case 'email-preview-section':
                this.workflowStep = 'email';
                break;
            case 'success-section':
                this.workflowStep = 'success';
                break;
            default:
                // Keep current workflow step
                break;
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.classList.remove('hidden');

        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, 5000);
    }

    /**
     * Update navigation visibility based on current workflow step
     */
    updateNavigation() {
        const navigation = document.getElementById('app-navigation');

        // Show navigation for all steps except upload
        if (this.workflowStep === 'upload') {
            navigation.style.display = 'none';
        } else {
            navigation.style.display = 'block';
        }
    }

    /**
     * Handle URL parameters from email navigation
     */
    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');

        if (action === 'upload' || action === 'new') {
            // Clear URL parameters to avoid confusion
            window.history.replaceState({}, document.title, window.location.pathname);

            // Show appropriate message
            if (action === 'upload') {
                this.showStatus('Ready to upload a new file', 'info');
            } else if (action === 'new') {
                this.showStatus('Ready to process another document', 'info');
            }

            // Ensure we're on the upload section
            this.workflowStep = 'upload';
            this.resetApplicationState();
        }
    }

    /**
     * Handle navigation button clicks with user feedback
     */
    handleNavigationClick(button, action) {
        // Store original button state
        const originalText = button.textContent;
        const originalDisabled = button.disabled;

        // Disable button and show loading state
        button.disabled = true;
        button.textContent = 'Loading...';

        // Call reload function
        this.reloadToUpload();

        // Fallback: restore button state if reload doesn't happen (shouldn't occur)
        setTimeout(() => {
            button.disabled = originalDisabled;
            button.textContent = originalText;
        }, 2000);
    }

    /**
     * Reload page to return to upload flow with complete state reset
     */
    reloadToUpload() {
        // Confirm if user wants to start over (except from success page)
        if (this.workflowStep !== 'upload' && this.workflowStep !== 'success') {
            const confirmed = confirm('Are you sure you want to start over? Any unsaved progress will be lost.');
            if (!confirmed) return;
        }

        // Show loading message
        this.showStatus('Reloading application...', 'info');

        // Small delay to show the message, then reload
        setTimeout(() => {
            // Perform full page reload to ensure complete state reset
            window.location.href = window.location.pathname;
        }, 500);
    }

    /**
     * Start over - reset application state and return to upload
     * @deprecated Use reloadToUpload() instead for complete state reset
     */
    startOver() {
        // Confirm if user wants to start over
        if (this.workflowStep !== 'upload' && this.workflowStep !== 'success') {
            const confirmed = confirm('Are you sure you want to start over? Any unsaved progress will be lost.');
            if (!confirmed) return;
        }

        // Reset application state
        this.resetApplicationState();

        // Show upload section
        this.showSection('upload-section');
        this.workflowStep = 'upload';
        this.updateNavigation();

        // Clear status messages
        document.getElementById('status-message').classList.add('hidden');

        // Show success message
        this.showStatus('Ready to upload a new document', 'success');
    }

    /**
     * Reset all application state
     */
    resetApplicationState() {
        // Clear file data
        this.uploadedFile = null;
        this.generatedSummary = null;
        this.currentTranscript = null;

        // Reset file input
        const fileInput = document.getElementById('file-input');
        fileInput.value = '';

        // Reset upload area
        const uploadArea = document.getElementById('upload-area');
        uploadArea.classList.remove('dragover', 'uploaded');

        // Reset upload content to match the original HTML structure
        const uploadContent = uploadArea.querySelector('.upload-content');
        uploadContent.innerHTML = `
            <div class="upload-icon">📄</div>
            <p>Drag and drop your meeting transcript here</p>
            <p class="upload-subtitle">or click to browse files</p>
            <p class="upload-subtitle" style="font-size: 0.8em; color: #6c757d;">Supported: .txt, .md, .doc, .docx, .pdf, .rtf (max 10MB)</p>
            <input type="file" id="file-input" accept=".txt,.md,.doc,.docx,.pdf,.rtf,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
            <button type="button" id="browse-btn" class="btn btn-primary">Browse Files</button>
        `;

        // Re-attach file input and browse button events
        const newFileInput = document.getElementById('file-input');
        const newBrowseBtn = document.getElementById('browse-btn');

        newBrowseBtn.addEventListener('click', () => newFileInput.click());
        newFileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

        // Clear file info and progress
        const fileInfo = document.getElementById('file-info');
        fileInfo.classList.add('hidden');
        fileInfo.innerHTML = '';

        const uploadProgress = document.getElementById('upload-progress');
        uploadProgress.classList.add('hidden');
        const progressFill = uploadProgress.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        // Clear summary content
        document.getElementById('summary-content').innerHTML = '';

        // Clear email form
        document.getElementById('email-recipients').value = '';
        document.getElementById('email-subject').value = '';
        document.getElementById('email-custom-message').value = '';

        // Reset form states
        document.getElementById('summary-style').value = 'executive';
        document.getElementById('custom-instructions').value = '';
        document.getElementById('email-template').value = 'default';

        // Clear any metadata displays
        const metadataDiv = document.getElementById('summary-metadata');
        if (metadataDiv) {
            metadataDiv.remove();
        }

        // Reset character counter
        this.updateCharacterCount(0);

        console.log('🔄 Application state reset');
    }

    /**
     * Show success section with email details
     */
    showSuccessSection(emailData) {
        // Update success section with email details
        document.getElementById('success-recipients').textContent = emailData.recipients || 'N/A';
        document.getElementById('success-subject').textContent = emailData.subject || 'N/A';
        document.getElementById('success-timestamp').textContent = new Date().toLocaleString();

        // Show success section
        this.showSection('success-section');

        // Show status message
        this.showStatus(`Email sent successfully to ${emailData.recipients}!`, 'success');
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.remove('dragover');
    }

    handleFileDrop(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFileSelect(files[0]);
        }
    }

    async handleFileSelect(file) {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['.txt', '.md', '.doc', '.docx', '.pdf', '.rtf'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            this.showStatus('Please select a valid file type (.txt, .md, .doc, .docx, .pdf, .rtf)', 'error');
            return;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            this.showStatus('File size must be less than 10MB', 'error');
            return;
        }

        // Upload file immediately
        await this.uploadFile(file);
    }

    async loadExistingSession() {
        if (!this.sessionToken) return;

        try {
            const response = await fetch(`/api/upload/session/${this.sessionToken}`);
            if (response.ok) {
                const data = await response.json();
                if (data.transcripts && data.transcripts.length > 0) {
                    // Show existing transcripts
                    this.showExistingTranscripts(data.transcripts);
                }
            }
        } catch (error) {
            console.warn('Failed to load existing session:', error);
        }
    }

    showExistingTranscripts(transcripts) {
        const uploadSection = document.getElementById('upload-section');
        const existingDiv = document.createElement('div');
        existingDiv.className = 'existing-transcripts';
        existingDiv.innerHTML = `
            <h3>📋 Previous Transcripts</h3>
            <div class="transcript-list">
                ${transcripts.map(t => `
                    <div class="transcript-item" data-id="${t.id}">
                        <span class="transcript-name">${t.filename}</span>
                        <span class="transcript-status">${t.status}</span>
                        <button class="btn btn-secondary btn-sm" onclick="app.loadTranscript('${t.id}')">Load</button>
                    </div>
                `).join('')}
            </div>
        `;
        uploadSection.appendChild(existingDiv);
    }

    async uploadFile(file) {
        const progressBar = document.getElementById('upload-progress');
        const progressFill = progressBar.querySelector('.progress-fill');

        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';

        try {
            const formData = new FormData();
            formData.append('transcript', file);

            if (this.sessionToken) {
                formData.append('sessionToken', this.sessionToken);
            }

            // Simulate progress
            const progressInterval = setInterval(() => {
                const currentWidth = parseInt(progressFill.style.width) || 0;
                if (currentWidth < 90) {
                    progressFill.style.width = (currentWidth + 10) + '%';
                }
            }, 100);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                headers: this.sessionToken ? {
                    'X-Session-Token': this.sessionToken
                } : {}
            });

            clearInterval(progressInterval);
            progressFill.style.width = '100%';

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            // Store session token
            this.sessionToken = result.session.token;
            localStorage.setItem('sessionToken', this.sessionToken);

            // Store transcript info
            this.currentTranscript = result.transcript;

            // Display file info
            this.displayFileInfo(result.transcript);

            // Move to next step
            this.showSection('instructions-section');
            this.showStatus('File uploaded successfully!', 'success');

        } catch (error) {
            console.error('Upload error:', error);
            this.showStatus(error.message, 'error');
        } finally {
            setTimeout(() => {
                progressBar.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 1000);
        }
    }

    displayFileInfo(transcript) {
        const fileInfo = document.getElementById('file-info');
        const fileSize = (transcript.size / 1024).toFixed(2);

        fileInfo.innerHTML = `
            <strong>Uploaded File:</strong> ${transcript.filename}<br>
            <strong>Size:</strong> ${fileSize} KB<br>
            <strong>Status:</strong> ${transcript.status}
        `;
        fileInfo.classList.remove('hidden');
    }

    async loadTranscript(transcriptId) {
        try {
            const response = await fetch(`/api/upload/${transcriptId}`);
            if (!response.ok) {
                throw new Error('Failed to load transcript');
            }

            const data = await response.json();
            this.currentTranscript = data.transcript;
            this.displayFileInfo(data.transcript);
            this.showSection('instructions-section');
            this.loadSavedInstructions();
            this.showStatus('Transcript loaded successfully!', 'success');

        } catch (error) {
            console.error('Load transcript error:', error);
            this.showStatus(error.message, 'error');
        }
    }

    handleStyleChange(style) {
        const customInstructions = document.getElementById('custom-instructions');
        const styleDescription = document.getElementById('style-description');

        // Show/hide custom instructions based on style
        if (style === 'custom') {
            customInstructions.style.display = 'block';
            styleDescription.innerHTML = 'Enter your own custom instructions for how you want the summary formatted.';
        } else {
            customInstructions.style.display = 'block'; // Always show for additional context
            styleDescription.innerHTML = this.getStyleDescription(style);

            // Pre-fill with style-specific template if no custom instructions
            if (!customInstructions.value.trim()) {
                customInstructions.value = this.getStyleTemplate(style);
                this.updateCharacterCount(customInstructions.value.length);
            }
        }
    }

    getStyleDescription(style) {
        const descriptions = {
            'executive': 'High-level bullet points focusing on key decisions, outcomes, and strategic implications. Perfect for leadership and stakeholder updates.',
            'action-items': 'Structured list of action items with clear owners, deadlines, and priorities. Ideal for tracking follow-up tasks.',
            'technical': 'Detailed technical discussion points, decisions, and implementation details. Great for development teams and technical stakeholders.',
            'detailed': 'Comprehensive overview covering all discussion points, context, and nuances. Suitable for complete meeting records.'
        };
        return descriptions[style] || '';
    }

    getStyleTemplate(style) {
        const templates = {
            'executive': 'Please create an executive summary with:\n• Key decisions made\n• Strategic outcomes\n• Budget/resource implications\n• Next steps for leadership',
            'action-items': 'Please extract and format:\n• Action items with clear owners\n• Deadlines and priorities\n• Dependencies between tasks\n• Follow-up meeting requirements',
            'technical': 'Please focus on:\n• Technical decisions and rationale\n• Implementation approaches discussed\n• Architecture or design choices\n• Technical risks and mitigation strategies',
            'detailed': 'Please provide a comprehensive summary including:\n• Full context and background\n• All discussion points covered\n• Different perspectives shared\n• Complete decision-making process'
        };
        return templates[style] || '';
    }

    updateCharacterCount(count) {
        const charCountEl = document.getElementById('char-count');
        const charCounterEl = charCountEl.parentElement;

        charCountEl.textContent = count;

        // Update styling based on character count
        charCounterEl.classList.remove('warning', 'danger');
        if (count > 800) {
            charCounterEl.classList.add('danger');
        } else if (count > 600) {
            charCounterEl.classList.add('warning');
        }
    }

    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        const isHidden = panel.classList.contains('hidden');

        // Hide all panels first
        document.getElementById('templates-panel').classList.add('hidden');
        document.getElementById('tips-panel').classList.add('hidden');

        // Show the requested panel if it was hidden
        if (isHidden) {
            panel.classList.remove('hidden');
        }
    }

    applyTemplate(templateType) {
        const templates = {
            'meeting-notes': `Please create a structured meeting summary with:

## Meeting Overview
• Date, attendees, and purpose
• Key agenda items covered

## Discussion Summary
• Main points discussed for each agenda item
• Different perspectives and opinions shared

## Decisions Made
• Clear decisions with rationale
• Who made the decision and when

## Action Items
• Specific tasks with owners and deadlines
• Dependencies and priorities

## Next Steps
• Follow-up meetings or check-ins
• Key milestones and timelines`,

            'action-focused': `Please focus on actionable outcomes:

## Immediate Actions (Next 1-2 weeks)
• [Task] - Owner: [Name] - Due: [Date]

## Short-term Actions (Next month)
• [Task] - Owner: [Name] - Due: [Date]

## Long-term Actions (Next quarter)
• [Task] - Owner: [Name] - Due: [Date]

## Blocked Items
• [Item] - Blocker: [Description] - Owner: [Name]

## Follow-up Required
• [Item] - Next step: [Action] - By: [Date]`,

            'decision-log': `Please document all decisions made:

## Major Decisions
• **Decision:** [What was decided]
• **Rationale:** [Why this decision was made]
• **Impact:** [Who/what this affects]
• **Timeline:** [When this takes effect]

## Minor Decisions
• [Decision] - [Brief rationale]

## Deferred Decisions
• [Decision] - [Reason for deferral] - [Revisit date]

## Decision Owners
• [Decision] - Owner: [Name] - Accountable for implementation`,

            'stakeholder-update': `Please create an executive stakeholder update:

## Executive Summary
• 2-3 key takeaways for leadership

## Progress Update
• What was accomplished
• Current status vs. goals

## Key Decisions
• Important decisions made and their business impact

## Resource Requirements
• Budget, personnel, or other resource needs

## Risks & Mitigation
• Key risks identified and mitigation strategies

## Next Steps
• Critical path items for leadership awareness`
        };

        const customInstructions = document.getElementById('custom-instructions');
        customInstructions.value = templates[templateType] || '';
        this.updateCharacterCount(customInstructions.value.length);

        // Hide templates panel after selection
        document.getElementById('templates-panel').classList.add('hidden');

        this.showStatus('Template applied! You can customize it further.', 'success');
    }

    async saveInstructions() {
        if (!this.currentTranscript) {
            this.showStatus('No transcript loaded', 'error');
            return;
        }

        const saveBtn = document.getElementById('save-instructions-btn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const instructions = {
                transcriptId: this.currentTranscript.id,
                summaryStyle: document.getElementById('summary-style').value,
                customInstructions: document.getElementById('custom-instructions').value,
                sessionToken: this.sessionToken
            };

            // Save to backend
            const response = await fetch('/api/instructions/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': this.sessionToken
                },
                body: JSON.stringify(instructions)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save instructions');
            }

            const result = await response.json();

            // Also save to localStorage for offline persistence
            localStorage.setItem(`instructions_${this.currentTranscript.id}`, JSON.stringify(instructions));

            this.showStatus(`Instructions saved! (${result.instructions.characterCount} characters)`, 'success');

        } catch (error) {
            console.error('Save instructions error:', error);
            this.showStatus(error.message || 'Failed to save instructions', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    async loadSavedInstructions() {
        if (!this.currentTranscript) return;

        try {
            // Try to load from backend first
            const response = await fetch(`/api/instructions/${this.currentTranscript.id}`, {
                headers: {
                    'X-Session-Token': this.sessionToken
                }
            });

            let instructions = null;

            if (response.ok) {
                const data = await response.json();
                instructions = data.instructions;
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem(`instructions_${this.currentTranscript.id}`);
                if (saved) {
                    instructions = JSON.parse(saved);
                }
            }

            if (instructions) {
                document.getElementById('summary-style').value = instructions.summaryStyle || 'executive';
                document.getElementById('custom-instructions').value = instructions.customInstructions || '';

                this.handleStyleChange(instructions.summaryStyle || 'executive');
                this.updateCharacterCount(instructions.customInstructions?.length || 0);

                this.showStatus('Previous instructions loaded', 'info');
            } else {
                // Set default style and trigger description
                this.handleStyleChange('executive');
            }
        } catch (error) {
            console.warn('Failed to load saved instructions:', error);
            // Set default style on error
            this.handleStyleChange('executive');
        }
    }

    async generateSummary() {
        if (!this.currentTranscript) {
            this.showStatus('Please upload a file first', 'error');
            return;
        }

        const generateBtn = document.getElementById('generate-btn');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';

        try {
            // Prepare request data
            const requestData = {
                transcriptId: this.currentTranscript.id,
                summaryStyle: document.getElementById('summary-style').value,
                customInstructions: document.getElementById('custom-instructions').value,
                urgency: 'normal'
            };

            // Make API call to generate summary
            const response = await fetch('/api/summaries/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': this.sessionToken
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle error response
                if (result.error && result.error.userMessage) {
                    // User-friendly error from error handling system
                    this.showStatus(result.error.userMessage.title, 'error');
                    console.error('API Error:', result.error);
                } else {
                    // Fallback error message
                    throw new Error(result.message || result.error || 'Failed to generate summary');
                }
                return;
            }

            if (result.success && result.summary) {
                this.generatedSummary = result.summary;

                // Display summary with enhanced formatting
                const summaryContent = document.getElementById('summary-content');
                summaryContent.innerHTML = this.formatSummaryForDisplay(result.summary.content);

                // Show additional information if available
                this.displaySummaryMetadata(result.summary);

                this.showSection('summary-section');
                this.showStatus('Summary generated successfully!', 'success');
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error) {
            console.error('Error generating summary:', error);
            this.showStatus(error.message || 'Error generating summary. Please try again.', 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Summary';
        }
    }

    /**
     * Format summary content for display with proper HTML formatting
     */
    formatSummaryForDisplay(content) {
        if (!content) return '';

        // Convert markdown-style formatting to HTML
        let formatted = content
            // Convert headers
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // Convert bullet points
            .replace(/^[•\-\*] (.*$)/gm, '<li>$1</li>')
            // Convert numbered lists
            .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
            // Convert line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Wrap in paragraphs and handle lists
        formatted = '<p>' + formatted + '</p>';
        formatted = formatted.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');

        return formatted;
    }

    /**
     * Display summary metadata (user-relevant information only)
     */
    displaySummaryMetadata(summary) {
        // Create or update metadata display
        let metadataDiv = document.getElementById('summary-metadata');
        if (!metadataDiv) {
            metadataDiv = document.createElement('div');
            metadataDiv.id = 'summary-metadata';
            metadataDiv.className = 'summary-metadata';

            const summaryContent = document.getElementById('summary-content');
            summaryContent.parentNode.insertBefore(metadataDiv, summaryContent);
        }

        let metadataHTML = '<div class="metadata-grid">';

        // Only show user-relevant information
        // Summary style if available
        if (summary.summaryStyle) {
            metadataHTML += `
                <div class="metadata-item">
                    <span class="metadata-label">Summary Style:</span>
                    <span class="metadata-value">${this.formatSummaryStyle(summary.summaryStyle)}</span>
                </div>
            `;
        }

        // Generation timestamp
        const generatedAt = new Date().toLocaleString();
        metadataHTML += `
            <div class="metadata-item">
                <span class="metadata-label">Generated:</span>
                <span class="metadata-value">${generatedAt}</span>
            </div>
        `;

        metadataHTML += '</div>';
        metadataDiv.innerHTML = metadataHTML;
    }

    /**
     * Format summary style for display
     */
    formatSummaryStyle(style) {
        const styles = {
            'executive': 'Executive Summary',
            'action-items': 'Action Items',
            'technical': 'Technical Summary',
            'detailed': 'Detailed Summary',
            'custom': 'Custom Format'
        };
        return styles[style] || style;
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    toggleEdit() {
        const summaryContent = document.getElementById('summary-content');
        const editBtn = document.getElementById('edit-btn');
        
        if (summaryContent.contentEditable === 'true') {
            summaryContent.contentEditable = 'false';
            summaryContent.style.backgroundColor = '#fafafa';
            editBtn.textContent = 'Edit Summary';
            this.generatedSummary = summaryContent.textContent;
            this.showStatus('Summary saved', 'success');
        } else {
            summaryContent.contentEditable = 'true';
            summaryContent.style.backgroundColor = 'white';
            summaryContent.focus();
            editBtn.textContent = 'Save Changes';
        }
    }



    showEmailSection() {
        // Pre-fill email subject with intelligent subject line
        if (this.generatedSummary && this.generatedSummary.content) {
            // Try to extract meeting topic from content
            const topic = this.extractMeetingTopic(this.generatedSummary.content);
            const date = new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const style = this.generatedSummary.summaryStyle || 'Executive';
            document.getElementById('email-subject').value = `${topic} - ${style} Summary (${date})`;
        } else {
            const today = new Date().toLocaleDateString();
            document.getElementById('email-subject').value = `Meeting Summary - ${today}`;
        }

        // Update template description
        this.updateTemplateDescription();

        this.showSection('email-section');
    }

    extractMeetingTopic(content) {
        if (!content) return 'Meeting';

        // Try to find meeting topic in first few lines
        const lines = content.split('\n').slice(0, 5);

        // Look for common meeting patterns
        const topicPatterns = [
            /(?:meeting|discussion|call|session)\s+(?:about|on|regarding|for)\s+(.+?)(?:\.|$)/i,
            /^(.+?)\s+(?:meeting|discussion|call|session)/i,
            /topic:\s*(.+?)(?:\.|$)/i,
            /subject:\s*(.+?)(?:\.|$)/i,
            /agenda:\s*(.+?)(?:\.|$)/i
        ];

        for (const line of lines) {
            for (const pattern of topicPatterns) {
                const match = line.match(pattern);
                if (match && match[1]) {
                    return match[1].trim().substring(0, 50); // Limit length
                }
            }
        }

        // Fallback to filename if available
        if (this.uploadedFile && this.uploadedFile.name) {
            return this.uploadedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        }

        return 'Meeting';
    }

    updateTemplateDescription() {
        const template = document.getElementById('email-template').value;
        const descriptions = {
            'default': 'Comprehensive template with full metadata and detailed formatting.',
            'professional': 'Executive-style template optimized for business communications with clean layout.',
            'minimal': 'Clean and simple template focusing on content with essential metadata.'
        };

        // You could add a description element if needed
        console.log(`Template selected: ${template} - ${descriptions[template]}`);
    }

    async previewEmail() {
        const recipients = document.getElementById('email-recipients').value;
        const subject = document.getElementById('email-subject').value;
        const template = document.getElementById('email-template').value;
        const customMessage = document.getElementById('email-custom-message').value;

        if (!recipients.trim()) {
            this.showStatus('Please enter at least one email recipient to preview', 'error');
            return;
        }

        if (!this.generatedSummary) {
            this.showStatus('No summary available to preview', 'error');
            return;
        }

        try {
            this.showStatus('Generating email preview...', 'info');

            const response = await fetch('/api/email/preview-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    summaryId: this.generatedSummary.id,
                    recipients: recipients.split(',').map(email => email.trim()),
                    customSubject: subject,
                    customMessage: customMessage,
                    templateStyle: template
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update preview display
                document.getElementById('preview-subject').textContent = result.preview.subject;
                document.getElementById('preview-template').textContent =
                    template.charAt(0).toUpperCase() + template.slice(1);

                // Load HTML content into iframe
                const iframe = document.getElementById('email-preview-frame');
                iframe.srcdoc = result.preview.html;

                this.showSection('email-preview-section');
                this.showStatus('Email preview generated successfully!', 'success');
            } else {
                this.showStatus(`Failed to generate preview: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Email preview error:', error);
            this.showStatus('Failed to generate email preview. Please try again.', 'error');
        }
    }

    async sendSummaryEmail() {
        const recipients = document.getElementById('email-recipients').value;
        const subject = document.getElementById('email-subject').value;
        const template = document.getElementById('email-template').value;
        const customMessage = document.getElementById('email-custom-message').value;

        if (!recipients) {
            this.showStatus('Please enter at least one recipient email address', 'error');
            return;
        }

        if (!this.generatedSummary || !this.generatedSummary.id) {
            this.showStatus('No summary available to send', 'error');
            return;
        }

        const sendBtn = document.getElementById('send-email-btn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        try {
            // Parse recipients
            const recipientList = recipients.split(',').map(email => email.trim()).filter(email => email);

            // Validate email addresses
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = recipientList.filter(email => !emailRegex.test(email));

            if (invalidEmails.length > 0) {
                throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
            }

            const response = await fetch('/api/email/send-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summaryId: this.generatedSummary.id,
                    recipients: recipientList,
                    customSubject: subject || undefined,
                    customMessage: customMessage || `Summary generated on ${new Date().toLocaleDateString()}`,
                    templateStyle: template
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (result.success) {
                // Show success section with details
                this.showSuccessSection(result.data);
            } else {
                throw new Error(result.error || 'Failed to send email');
            }

        } catch (error) {
            console.error('Error sending email:', error);
            this.showStatus(`Error sending email: ${error.message}`, 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Email';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MeetingSummarizer();
});
