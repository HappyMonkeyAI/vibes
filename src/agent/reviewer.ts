import { getOllamaClient } from '../ollama-client.js';
import { Task, Mission } from './types.js';
import { log } from '../logger.js';
import { config } from '../config.js';
import { getModelSpecificPrompt } from './model-prompts.js';
import { extractJsonContent } from './json-repair.js';

export class Reviewer {
  async reviewTask(task: Task, mission: Mission, fileContents?: Map<string, string>): Promise<{ approved: boolean; feedback?: string }> {
    log(`Reviewing task: ${task.title}`, 'INFO');
    const modelSpecificPrompt = getModelSpecificPrompt(config.REVIEWER_MODEL, 'reviewer');

    let filesSection = '';
    if (fileContents && fileContents.size > 0) {
      filesSection = '\n\nFile Contents on Disk:\n';
      for (const [path, content] of fileContents) {
        filesSection += `--- FILE: ${path} ---\n${content}\n---\n`;
      }
    }

    const systemPrompt = `You are a Senior Software Engineer performing a code review.
Review the task completion based on the description and acceptance criteria.
You are given the agent's summary and the actual file contents from the disk.
Output ONLY a JSON object.
${modelSpecificPrompt}

Structure:
{
  "approved": true | false,
  "feedback": "Detailed feedback or LGTM"
}

Constraints:
1. If approved, feedback should be "LGTM".
2. If rejected, provide clear, actionable feedback on what is missing or incorrect.
3. Be strict but fair.`;

    const userPrompt = `Mission: ${mission.title}
Task: ${task.title}
Description: ${task.description}
Acceptance Criteria:
${task.acceptance_criteria.map(c => `- ${c}`).join('\n')}

Task Output Summary:
${task.output || 'No output provided.'}${filesSection}`;

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
      if (!content) throw new Error('No response from reviewer');

      content = extractJsonContent(content);
      const result = JSON.parse(content);
      return result;
    } catch (error: any) {
      log(`Reviewer failed: ${error.message}`, 'ERROR');
      return { approved: true, feedback: 'LGTM (Reviewer failed, defaulting to approval)' };
    }
  }
}
