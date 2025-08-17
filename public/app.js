// Meeting Summarizer Frontend Application
class MeetingSummarizer {
    constructor() {
        this.currentSection = 'upload-section';
        this.uploadedFile = null;
        this.generatedSummary = null;
        this.sessionToken = localStorage.getItem('sessionToken');
        this.currentTranscript = null;

        this.initializeEventListeners();
        this.showSection('upload-section');
        this.loadExistingSession();
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
        document.getElementById('preview-btn').addEventListener('click', () => this.previewSummary());
        document.getElementById('share-btn').addEventListener('click', () => this.showEmailSection());
        document.getElementById('send-email-btn').addEventListener('click', () => this.sendEmail());
        document.getElementById('back-to-summary-btn').addEventListener('click', () => this.showSection('summary-section'));
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show target section
        document.getElementById(sectionId).classList.remove('hidden');
        this.currentSection = sectionId;
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
        const allowedTypes = ['.txt', '.md', '.doc', '.docx'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            this.showStatus('Please select a valid file type (.txt, .md, .doc, .docx)', 'error');
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
            <strong>Status:</strong> ${transcript.status}<br>
            <strong>Content Length:</strong> ${transcript.contentLength || 0} characters<br>
            <strong>Token Count:</strong> ${transcript.tokenCount || 0} tokens
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
                customInstructions: document.getElementById('custom-instructions').value
            };

            // Make API call (will be implemented in Task 6)
            const response = await fetch('/api/summary/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': this.sessionToken
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'placeholder') {
                // Handle placeholder response for now
                this.showStatus('Summary generation will be available after Groq AI integration (Task 6)', 'info');
                return;
            }

            this.generatedSummary = result.summary;

            // Display summary
            document.getElementById('summary-content').textContent = this.generatedSummary;
            this.showSection('summary-section');
            this.showStatus('Summary generated successfully!', 'success');

        } catch (error) {
            console.error('Error generating summary:', error);
            this.showStatus(error.message || 'Error generating summary. Please try again.', 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Summary';
        }
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

    previewSummary() {
        const summaryContent = document.getElementById('summary-content').textContent;
        const previewWindow = window.open('', '_blank', 'width=600,height=400');
        previewWindow.document.write(`
            <html>
                <head><title>Summary Preview</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
                    <h2>Meeting Summary Preview</h2>
                    <pre style="white-space: pre-wrap;">${summaryContent}</pre>
                </body>
            </html>
        `);
    }

    showEmailSection() {
        // Pre-fill email subject
        const today = new Date().toLocaleDateString();
        document.getElementById('email-subject').value = `Meeting Summary - ${today}`;
        this.showSection('email-section');
    }

    async sendEmail() {
        const recipients = document.getElementById('email-recipients').value;
        const subject = document.getElementById('email-subject').value;
        const summaryContent = document.getElementById('summary-content').textContent;

        if (!recipients || !subject) {
            this.showStatus('Please fill in all email fields', 'error');
            return;
        }

        const sendBtn = document.getElementById('send-email-btn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        try {
            const response = await fetch('/api/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipients: recipients.split(',').map(email => email.trim()),
                    subject: subject,
                    content: summaryContent
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.showStatus('Email sent successfully!', 'success');
            this.showSection('summary-section');

        } catch (error) {
            console.error('Error sending email:', error);
            this.showStatus('Error sending email. Please try again.', 'error');
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
