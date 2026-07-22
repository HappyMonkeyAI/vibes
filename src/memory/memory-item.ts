export type MemoryItemStatus = 'active' | 'superseded' | 'discarded';

export interface MemoryItem {
  id: string;
  summary: string;
  content: string;
  source?: string;
  confidence: number;
  status: MemoryItemStatus;
  supersedes?: string;
  taskId?: string;
  runId?: string;
  timestamp: string;
}

export function normalizeMemoryItem(input: Omit<MemoryItem, 'id' | 'timestamp'> & Partial<Pick<MemoryItem, 'id' | 'timestamp'>>): MemoryItem {
  return {
    id: input.id ?? `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    summary: input.summary.trim(),
    content: input.content.trim(),
    source: input.source,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    status: input.status,
    supersedes: input.supersedes,
    taskId: input.taskId,
    runId: input.runId,
  };
}

export function dedupeMemoryItems(items: MemoryItem[]): MemoryItem[] {
  const byId = new Map<string, MemoryItem>();
  for (const item of items) {
    const current = byId.get(item.id);
    if (!current || Date.parse(item.timestamp) >= Date.parse(current.timestamp)) byId.set(item.id, item);
  }
  return [...byId.values()].filter(item => item.status === 'active');
}
