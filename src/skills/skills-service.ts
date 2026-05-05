import { log } from '../logger.js';
import fs from 'fs';
import path from 'path';

export interface SkillDefinition {
  name: string;
  description: string;
  category: 'reference' | 'pipeline';
  prompt?: string;
  tools?: string[];
  trigger?: string;
}

export interface LoadedSkill extends SkillDefinition {
  content: string;
}

export class SkillsService {
  private skills: Map<string, LoadedSkill> = new Map();
  private skillsPath: string;

  constructor(skillsPath?: string) {
    this.skillsPath = skillsPath || path.join(process.cwd(), '.vibes', 'skills');
    this.loadSkills();
  }

  private loadSkills() {
    if (!fs.existsSync(this.skillsPath)) {
      log(`Skills directory not found: ${this.skillsPath}`, 'DEBUG');
      return;
    }

    try {
      const files = fs.readdirSync(this.skillsPath);
      
      for (const file of files) {
        if (!file.endsWith('.md') && !file.endsWith('.json')) continue;
        
        const filePath = path.join(this.skillsPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const name = path.basename(file, path.extname(file));
        
        if (file.endsWith('.json')) {
          const skillDef = JSON.parse(content) as SkillDefinition;
          this.skills.set(skillDef.name, {
            ...skillDef,
            content: JSON.stringify(skillDef),
          });
          log(`Loaded skill: ${skillDef.name} (${skillDef.category})`, 'DEBUG');
        } else {
          const skill = this.parseMarkdownSkill(name, content);
          this.skills.set(skill.name, skill);
          log(`Loaded skill: ${skill.name} (${skill.category})`, 'DEBUG');
        }
      }

      log(`Loaded ${this.skills.size} skills`, 'INFO');
    } catch (error: any) {
      log(`Failed to load skills: ${error.message}`, 'ERROR');
    }
  }

  private parseMarkdownSkill(name: string, content: string): LoadedSkill {
    const lines = content.split('\n');
    let description = '';
    let category: 'reference' | 'pipeline' = 'reference';
    let prompt = '';
    let inPrompt = false;

    for (const line of lines) {
      if (line.startsWith('## Description')) {
        continue;
      }
      if (line.startsWith('## Category:')) {
        const cat = line.replace('## Category:', '').trim().toLowerCase();
        category = cat === 'pipeline' ? 'pipeline' : 'reference';
        continue;
      }
      if (line.startsWith('## Prompt') || line.startsWith('## Skill')) {
        inPrompt = true;
        continue;
      }
      if (inPrompt) {
        prompt += line + '\n';
      } else if (description === '' && line.trim()) {
        description = line.trim();
      }
    }

    return {
      name,
      description: description.trim(),
      category,
      content: prompt.trim() || content,
    };
  }

  getReferenceSkills(): LoadedSkill[] {
    return Array.from(this.skills.values()).filter(s => s.category === 'reference');
  }

  getPipelineSkills(): LoadedSkill[] {
    return Array.from(this.skills.values()).filter(s => s.category === 'pipeline');
  }

  getSkill(name: string): LoadedSkill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  formatForSystemPrompt(): string {
    const referenceSkills = this.getReferenceSkills();
    if (referenceSkills.length === 0) return '';

    const formatted = referenceSkills
      .map(s => `- ${s.name}: ${s.description}`)
      .join('\n');

    return `\nAvailable Reference Skills:\n${formatted}\n`;
  }

  formatPipelineSkills(): string {
    const pipelineSkills = this.getPipelineSkills();
    if (pipelineSkills.length === 0) return '';

    const formatted = pipelineSkills
      .map(s => `- ${s.name}: ${s.description}`)
      .join('\n');

    return `\nAvailable Pipeline Skills:\n${formatted}\n`;
  }

  async executePipelineSkill(name: string, context: Record<string, any>): Promise<string> {
    const skill = this.getSkill(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    if (skill.category !== 'pipeline') {
      throw new Error(`Skill ${name} is not a pipeline skill`);
    }

    log(`Executing pipeline skill: ${name}`, 'INFO');

    let content = skill.content;
    for (const [key, value] of Object.entries(context)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }

    return content;
  }
}

let globalSkillsService: SkillsService | null = null;

export function getSkillsService(): SkillsService {
  if (!globalSkillsService) {
    globalSkillsService = new SkillsService();
  }
  return globalSkillsService;
}