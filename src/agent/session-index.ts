import fs from 'fs/promises';
import path from 'path';

export interface SessionSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  eventCount: number;
  workspace: string;
}

export class SessionIndex {
  private readonly indexPath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(workspaceRoot: string = process.cwd()) {
    this.indexPath = path.join(workspaceRoot, '.vibes', 'sessions', 'index.json');
  }

  async upsert(summary: SessionSummary): Promise<void> {
    const next = this.queue.then(async () => {
      const current = await this.read();
      current[summary.id] = summary;
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      const temp = `${this.indexPath}.tmp`;
      await fs.writeFile(temp, JSON.stringify(current, null, 2), 'utf8');
      await fs.rename(temp, this.indexPath);
    });
    this.queue = next.catch(() => undefined);
    await next;
  }

  async get(id: string): Promise<SessionSummary | undefined> {
    return (await this.read())[id];
  }

  async list(): Promise<SessionSummary[]> {
    return Object.values(await this.read()).sort((a, b) =>
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  }

  private async read(): Promise<Record<string, SessionSummary>> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.indexPath, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
