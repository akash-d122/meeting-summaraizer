const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// Create a new PDF document
const doc = new jsPDF();

// Add title
doc.setFontSize(20);
doc.text('Meeting Transcript - Test Document', 20, 30);

// Add date
doc.setFontSize(12);
doc.text('Date: August 17, 2025', 20, 50);
doc.text('Meeting: Weekly Team Standup', 20, 60);

// Add content
doc.setFontSize(10);
const content = `
ATTENDEES:
- John Smith (Project Manager)
- Sarah Johnson (Developer)
- Mike Chen (Designer)
- Lisa Brown (QA Engineer)

AGENDA:
1. Project Status Updates
2. Sprint Planning
3. Technical Challenges
4. Next Steps

DISCUSSION:

John Smith: Good morning everyone. Let's start with our weekly standup. Sarah, can you give us an update on the backend API development?

Sarah Johnson: Sure, John. I've completed the user authentication endpoints and the data validation middleware. The API is now handling about 95% of our test cases successfully. I'm currently working on the file upload functionality, which should be ready by tomorrow.

Mike Chen: That's great progress, Sarah. From the design perspective, I've finalized the user interface mockups for the dashboard. The new design incorporates the feedback from last week's user testing session. I'll share the updated prototypes with the team after this meeting.

Lisa Brown: Thanks, Mike. I've been working on the test automation suite. We now have 85% code coverage, and I've identified a few edge cases that need attention. Sarah, when you finish the file upload feature, I'll need about two days to write comprehensive tests for it.

John Smith: Excellent work, everyone. Let's talk about the upcoming sprint. We have three major features to implement: real-time notifications, advanced search functionality, and the reporting dashboard.

Sarah Johnson: I can take on the real-time notifications. I've been researching WebSocket implementation, and I think we can have a working prototype within a week.

Mike Chen: I'll handle the UI components for both the search functionality and the reporting dashboard. The design system we've built should make this pretty straightforward.

Lisa Brown: I'll focus on creating test scenarios for these new features and updating our regression test suite.

TECHNICAL CHALLENGES:

Sarah Johnson: One challenge I'm facing is with the database performance. As our dataset grows, some queries are taking longer than expected. I'm looking into query optimization and possibly implementing caching.

Mike Chen: On the frontend, we're dealing with some performance issues when rendering large datasets. I'm exploring virtual scrolling and pagination solutions.

Lisa Brown: The main challenge for testing is ensuring cross-browser compatibility, especially with the new file upload feature. We need to test across different browsers and operating systems.

ACTION ITEMS:

1. Sarah: Complete file upload functionality by August 18
2. Sarah: Research database optimization solutions by August 20
3. Mike: Share updated UI prototypes with team by end of day
4. Mike: Implement virtual scrolling for large datasets by August 22
5. Lisa: Complete test automation for file upload by August 20
6. Lisa: Set up cross-browser testing environment by August 19
7. John: Schedule user testing session for new features by August 25

NEXT STEPS:

- Sprint planning meeting scheduled for August 19 at 2 PM
- Code review session for authentication module on August 18 at 10 AM
- Design review for dashboard components on August 21 at 3 PM

MEETING NOTES:

The team discussed the importance of maintaining code quality while meeting deadlines. Everyone agreed to prioritize thorough testing and documentation.

Sarah mentioned that the new authentication system has improved security significantly, with better password hashing and session management.

Mike highlighted that the new design system has reduced development time by approximately 30%, as components are now more reusable.

Lisa emphasized the importance of automated testing, noting that it has caught several critical bugs before they reached production.

DECISIONS MADE:

1. Implement caching solution for database queries
2. Use virtual scrolling for performance optimization
3. Prioritize cross-browser testing for file upload feature
4. Schedule additional user testing session before release

FOLLOW-UP:

Next meeting scheduled for August 24, 2025 at 9:00 AM.

Meeting adjourned at 10:30 AM.
`;

// Split content into lines and add to PDF
const lines = content.split('\n');
let yPosition = 80;
const lineHeight = 5;
const pageHeight = 280;

lines.forEach((line) => {
  if (yPosition > pageHeight) {
    doc.addPage();
    yPosition = 20;
  }
  
  doc.text(line, 20, yPosition);
  yPosition += lineHeight;
});

// Save the PDF
const outputPath = path.join(__dirname, 'test-meeting-transcript.pdf');
const pdfBuffer = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));

console.log(`✅ Test PDF generated successfully: ${outputPath}`);
console.log(`📄 File size: ${fs.statSync(outputPath).size} bytes`);
console.log(`🔗 You can now upload this file to test PDF functionality`);
