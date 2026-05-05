# Test-First Development

Category: pipeline

Run tests before and after making changes to ensure code works correctly.

## Description

Execute a test-driven development workflow: run existing tests first, make changes, then verify tests pass.

## Prompt

Follow this test-first workflow:

1. First, run the existing test suite to establish a baseline
2. Analyze any failing tests - they may indicate the current state
3. Make your code changes
4. Run tests again to verify your changes work and don't break existing functionality
5. If tests fail, fix the issues rather than ignoring them
6. Ensure all tests pass before considering the task complete

Use appropriate test commands for the project (npm test, jest, vitest, etc.)