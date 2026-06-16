import fs from 'fs';
import path from 'path';

export interface Snapshot {
  id: number;
  layer_name: string;
  raw_content: string;
  timestamp: string;
}

export class ContextIndexService {
  private dbPath: string;
  private fallbackPath: string;
  private isUsingFallback: boolean = false;
  private db: any = null;

  constructor(dbPath?: string, fallbackPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), '.vibes', 'context_snapshots.db');
    this.fallbackPath = fallbackPath || path.join(process.cwd(), '.vibes', 'context_snapshots.jsonl');
  }

  /**
   * Initializes the service. Tries to load node:sqlite and set up FTS5.
   * If node:sqlite or FTS5 is not supported, it falls back to a JSONL file system.
   */
  public async init(): Promise<void> {
    const vibesDir = path.dirname(this.dbPath);
    if (!fs.existsSync(vibesDir)) {
      fs.mkdirSync(vibesDir, { recursive: true });
    }

    try {
      // Dynamic import to handle environments where node:sqlite is completely missing or restricted
      const { DatabaseSync } = await import('node:sqlite');
      
      this.db = new DatabaseSync(this.dbPath);
      
      // Create schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS context_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          layer_name TEXT NOT NULL,
          raw_content TEXT NOT NULL,
          timestamp TEXT NOT NULL
        );
      `);

      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_context_index USING fts5(
          layer_name,
          raw_content,
          content='context_snapshots',
          content_rowid='id'
        );
      `);

      // Create sync triggers
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS ts_ai AFTER INSERT ON context_snapshots BEGIN
          INSERT INTO fts_context_index(rowid, layer_name, raw_content) 
          VALUES (new.id, new.layer_name, new.raw_content);
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS ts_ad AFTER DELETE ON context_snapshots BEGIN
          INSERT INTO fts_context_index(fts_context_index, rowid, layer_name, raw_content) 
          VALUES('delete', old.id, old.layer_name, old.raw_content);
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS ts_au AFTER UPDATE ON context_snapshots BEGIN
          INSERT INTO fts_context_index(fts_context_index, rowid, layer_name, raw_content) 
          VALUES('delete', old.id, old.layer_name, old.raw_content);
          INSERT INTO fts_context_index(rowid, layer_name, raw_content) 
          VALUES (new.id, new.layer_name, new.raw_content);
        END;
      `);

      this.isUsingFallback = false;
    } catch (error) {
      console.warn('⚠️ SQLite/FTS5 support unavailable. Falling back to JSONL storage:', error);
      this.isUsingFallback = true;
      if (!fs.existsSync(this.fallbackPath)) {
        fs.writeFileSync(this.fallbackPath, '', 'utf-8');
      }
    }
  }

  /**
   * Returns true if using JSONL fallback storage.
   */
  public isFallback(): boolean {
    return this.isUsingFallback;
  }

  /**
   * Appends a new context snapshot to the index.
   * @param layerName The state layer name (e.g. Memory, Checkpoint, Notes, Progress)
   * @param rawContent The content of the snapshot
   * @returns The generated id of the snapshot
   */
  public async append(layerName: string, rawContent: string): Promise<number> {
    const timestamp = new Date().toISOString();

    if (this.isUsingFallback) {
      let lastId = 0;
      if (fs.existsSync(this.fallbackPath)) {
        const fileContent = fs.readFileSync(this.fallbackPath, 'utf-8');
        const lines = fileContent.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.id > lastId) lastId = obj.id;
          } catch (e) {}
        }
      }
      const newId = lastId + 1;
      const snapshot: Snapshot = { id: newId, layer_name: layerName, raw_content: rawContent, timestamp };
      fs.appendFileSync(this.fallbackPath, JSON.stringify(snapshot) + '\n', 'utf-8');
      return newId;
    } else {
      const stmt = this.db.prepare('INSERT INTO context_snapshots (layer_name, raw_content, timestamp) VALUES (?, ?, ?)');
      const result = stmt.run(layerName, rawContent, timestamp);
      return result.lastInsertRowid as number;
    }
  }

  /**
   * Queries the context snapshots using a query string (MATCH for SQLite FTS5, substring search for fallback).
   * @param matchQuery Search query string
   * @param limit Maximum results to return
   */
  public async query(matchQuery: string, limit: number = 50): Promise<Snapshot[]> {
    if (this.isUsingFallback) {
      if (!fs.existsSync(this.fallbackPath)) {
        return [];
      }
      const fileContent = fs.readFileSync(this.fallbackPath, 'utf-8');
      const lines = fileContent.trim().split('\n').filter(Boolean);
      const results: Snapshot[] = [];
      const queryLower = matchQuery.toLowerCase();

      for (const line of lines) {
        try {
          const snapshot: Snapshot = JSON.parse(line);
          const rawContentMatch = snapshot.raw_content.toLowerCase().includes(queryLower);
          const layerNameMatch = snapshot.layer_name.toLowerCase().includes(queryLower);
          if (rawContentMatch || layerNameMatch) {
            results.push(snapshot);
          }
        } catch (e) {}
      }
      return results.slice(0, limit);
    } else {
      const stmt = this.db.prepare(`
        SELECT cs.id, cs.layer_name, cs.raw_content, cs.timestamp 
        FROM context_snapshots cs 
        JOIN fts_context_index fts ON cs.id = fts.rowid 
        WHERE fts_context_index MATCH ? 
        LIMIT ?
      `);
      return stmt.all(matchQuery, limit) as Snapshot[];
    }
  }

  /**
   * Deletes a snapshot by id.
   * @param id Snapshot id to delete
   */
  public async delete(id: number): Promise<void> {
    if (this.isUsingFallback) {
      if (!fs.existsSync(this.fallbackPath)) return;
      const fileContent = fs.readFileSync(this.fallbackPath, 'utf-8');
      const lines = fileContent.trim().split('\n').filter(Boolean);
      const newLines: string[] = [];
      for (const line of lines) {
        try {
          const snapshot: Snapshot = JSON.parse(line);
          if (snapshot.id !== id) {
            newLines.push(line);
          }
        } catch (e) {
          newLines.push(line);
        }
      }
      fs.writeFileSync(this.fallbackPath, newLines.join('\n') + (newLines.length > 0 ? '\n' : ''), 'utf-8');
    } else {
      const stmt = this.db.prepare('DELETE FROM context_snapshots WHERE id = ?');
      stmt.run(id);
    }
  }

  /**
   * Clears all snapshots in the database/fallback file.
   */
  public async clear(): Promise<void> {
    if (this.isUsingFallback) {
      if (fs.existsSync(this.fallbackPath)) {
        fs.writeFileSync(this.fallbackPath, '', 'utf-8');
      }
    } else {
      this.db.exec('DELETE FROM context_snapshots');
    }
  }

  /**
   * Closes the SQLite connection if open.
   */
  public close(): void {
    if (this.db) {
      if (typeof this.db.close === 'function') {
        this.db.close();
      }
      this.db = null;
    }
  }
}
