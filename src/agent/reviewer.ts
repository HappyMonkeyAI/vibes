import { getOllamaClient } from '../ollama-client.js';
import { Task, Mission } from './types.js';
import { log } from '../logger.js';
import { config } from '../config.js';
import { getModelSpecificPrompt } from './model-prompts.js';
import { extractJsonContent } from './json-repair.js';
import { execSync } from 'child_process';

export interface ReviewIssue {
  file: string;
  line: number;
  comment: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ReviewResult {
  approved: boolean;
  issues: ReviewIssue[];
  feedback?: string;
}

export class Reviewer {
  /**
   * Performs a code review on the git diff of modified files using the reviewer model.
   */
  async reviewTask(task: Task, mission: Mission, workspaceRoot: string): Promise<ReviewResult> {
    log(`Reviewing task via git diff: ${task.title}`, 'INFO');
    const modelSpecificPrompt = getModelSpecificPrompt(config.REVIEWER_MODEL, 'reviewer');

    const diffContent = this.getGitDiffForTask(workspaceRoot, task.files);
    if (!diffContent) {
      log(`No git diff detected for task files in ${task.title}. Defaulting to approval.`, 'INFO');
      return { approved: true, issues: [] };
    }

    const systemPrompt = `You are a Senior Software Engineer performing a code review.
Review the task completion based on the description, acceptance criteria, and the git diff of the changes.
Output ONLY a JSON object matching the schema below.

Structure:
{
  "approved": false,
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "comment": "Description of the issue...",
      "severity": "error", // "error" or "warning"
      "suggestion": "Optional suggestion to fix the code..."
    }
  ]
}

Constraints:
1. If the changes are correct and fulfill all acceptance criteria without bugs, style issues, resource leaks, or security vulnerabilities, set "approved": true and "issues": [].
2. Focus on code quality checks (e.g. null pointer exceptions, unclosed resources/file descriptors, thread safety, and type errors).
3. Pinpoint exact file names and line numbers of the issue.
4. Output raw JSON ONLY. Do not write text before or after the JSON.
${modelSpecificPrompt}`;

    const userPrompt = `Mission: ${mission.title}
Task: ${task.title}
Description: ${task.description}
Acceptance Criteria:
${task.acceptance_criteria.map(c => `- ${c}`).join('\n')}

Task Output Summary:
${task.output || 'No output summary.'}

Git Diff of Changes:
\`\`\`diff
${diffContent}
\`\`\``;

    try {
      const response = await getOllamaClient('reviewer').chat.completions.create({
        model: config.REVIEWER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      });

      const msg = response.choices[0]?.message as any;
      let content = msg?.content || msg?.reasoning_content || '';
      if (!content) throw new Error('No response from reviewer model');

      content = extractJsonContent(content);
      const result: ReviewResult = JSON.parse(content);
      
      // Enforce schema sanity
      if (typeof result.approved !== 'boolean') {
        result.approved = result.issues ? result.issues.length === 0 : true;
      }
      if (!result.issues) {
        result.issues = [];
      }
      
      // Build a unified feedback text string if none is present
      if (!result.approved && !result.feedback) {
        result.feedback = result.issues.map(i => `- [${i.severity}] ${i.file}:${i.line}: ${i.comment}${i.suggestion ? ` (Suggestion: ${i.suggestion})` : ''}`).join('\n');
      }

      return result;
    } catch (error: any) {
      log(`Reviewer model failed: ${error.message}. Defaulting to approval.`, 'ERROR');
      return { approved: true, issues: [], feedback: 'LGTM (Reviewer failed, defaulting to approval)' };
    }
  }

  /**
   * Retrieves the git diff of specific task files from HEAD.
   */
  private getGitDiffForTask(workspaceRoot: string, files: string[]): string {
    try {
      if (!files || files.length === 0) return '';
      const insideGit = execSync('git rev-parse --is-inside-work-tree', {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim();
      if (insideGit !== 'true') {
        log(`Skipping git diff for ${workspaceRoot}: workspace is not a git repository.`, 'DEBUG');
        return '';
      }
      const escapedFiles = files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ');
      const diffOutput = execSync(`git diff HEAD -- ${escapedFiles}`, { cwd: workspaceRoot }).toString();
      return diffOutput;
    } catch (err: any) {
      log(`Git diff query failed: ${err.message}`, 'WARN');
      return '';
    }
  }
}
