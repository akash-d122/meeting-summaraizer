# Taskmaster-AI Usage Guide

## Getting Started

Taskmaster-AI is now integrated into your project. Here's how to use it effectively:

## Basic Commands

### In Your AI Editor (Cursor, VS Code, etc.)

#### Project Initialization
- "Initialize taskmaster-ai in my project" ✅ (Already done!)
- "Parse my PRD at .taskmaster/docs/prd.txt"
- "Generate tasks from the PRD"

#### Task Management
- "What's the next task I should work on?"
- "Can you help me implement task 3?"
- "Show me tasks 1, 3, and 5"
- "Can you help me expand task 4?"

#### Research and Context
- "Research the latest best practices for implementing JWT authentication with Node.js"
- "Research React Query v5 migration strategies for our current API implementation"

### Command Line Interface

```bash
# List all tasks
npx task-master list

# Show the next task to work on  
npx task-master next

# Show specific task(s)
npx task-master show 1,3,5

# Research with project context
npx task-master research "What are the latest best practices for JWT authentication?"

# Generate task files
npx task-master generate
```

## Configuration

### Model Configuration

You can change the AI models used by taskmaster-ai:

```
Change the main, research and fallback models to claude-3-5-sonnet-20241022, perplexity/llama-3.1-sonar-large-128k-online and gpt-4o respectively.
```

### Available Models

- **Claude**: claude-3-5-sonnet-20241022, claude-3-opus-20240229
- **OpenAI**: gpt-4o, gpt-4-turbo, gpt-3.5-turbo
- **Google**: gemini-pro, gemini-1.5-pro
- **Perplexity**: perplexity/llama-3.1-sonar-large-128k-online
- **Claude Code**: claude-code/sonnet, claude-code/opus (no API key required)

## Best Practices

### 1. Start with a Detailed PRD
- The more detailed your PRD, the better the generated tasks
- Include technical requirements, user stories, and acceptance criteria
- Update the PRD as requirements evolve

### 2. Work Incrementally
- Focus on one task at a time
- Use AI assistance to implement each task
- Test each feature before moving to the next

### 3. Use Research Capabilities
- Leverage the research model for up-to-date information
- Ask for best practices and current standards
- Research specific technologies before implementation

### 4. Maintain Context
- Keep your PRD updated
- Document decisions and changes
- Use descriptive task names and descriptions

## Common Workflows

### Starting a New Feature
1. "Can you help me plan the implementation of [feature name]?"
2. "Break down this feature into smaller tasks"
3. "What's the best approach for implementing [specific requirement]?"

### Debugging and Problem Solving
1. "I'm having trouble with [specific issue], can you help?"
2. "Research the best practices for [technology/pattern]"
3. "Can you review my implementation and suggest improvements?"

### Code Review and Optimization
1. "Can you review this code and suggest improvements?"
2. "Research performance optimization techniques for [technology]"
3. "What are the security best practices for [specific implementation]?"

## Troubleshooting

### MCP Server Not Working
1. Check that API keys are properly set in the MCP configuration
2. Restart your editor after configuration changes
3. Verify the MCP server is enabled in editor settings

### Tasks Not Generating
1. Ensure your PRD is detailed and well-structured
2. Try asking more specific questions about task generation
3. Check that the main AI model is properly configured

### Research Not Working
1. Verify the research model API key is set
2. Try using a different research model
3. Check internet connectivity for online research models

## Advanced Usage

### Custom Task Templates
- Modify `.taskmaster/templates/` to create custom task formats
- Define project-specific task structures
- Create reusable templates for common patterns

### Integration with Other Tools
- Use taskmaster-ai alongside your existing project management tools
- Export tasks to external systems
- Integrate with CI/CD pipelines for automated task tracking

## Support and Resources

- [Official Documentation](https://task-master.dev)
- [GitHub Repository](https://github.com/eyaltoledano/claude-task-master)
- Use your AI assistant for real-time help and guidance
