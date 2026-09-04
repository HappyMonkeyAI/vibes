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

export type MemoryItemInput =
  Omit<MemoryItem, 'id' | 'timestamp'> & Partial<Pick<MemoryItem, 'id' | 'timestamp'>>;

function clampConfidence(value: number): number {
  // NaN survives Math.min/Math.max unchanged and then fails every comparison
  // downstream, silently dropping the item instead of ranking it. Infinities
  // clamp to the range like any other out-of-bounds number.
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeMemoryItem(input: MemoryItemInput): MemoryItem {
  return {
    id: input.id ?? `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    summary: input.summary.trim(),
    content: input.content.trim(),
    source: input.source,
    confidence: clampConfidence(input.confidence),
    status: input.status,
    supersedes: input.supersedes,
    taskId: input.taskId,
    runId: input.runId,
  };
}

function parsedTime(item: MemoryItem): number {
  const parsed = Date.parse(item.timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Collapse a journal of items to the ones still in force: newest write per id,
 * minus anything an item explicitly supersedes, minus non-active statuses.
 *
 * Honouring `supersedes` is what makes the field mean anything — deduping by id
 * alone leaves a replaced fact active alongside the fact that replaced it.
 */
export function dedupeMemoryItems(items: MemoryItem[]): MemoryItem[] {
  const byId = new Map<string, MemoryItem>();
  for (const item of items) {
    const current = byId.get(item.id);
    if (!current || parsedTime(item) >= parsedTime(current)) byId.set(item.id, item);
  }

  const supersededIds = new Set<string>();
  for (const item of byId.values()) {
    if (item.supersedes && item.status === 'active') supersededIds.add(item.supersedes);
  }

  return [...byId.values()].filter(item => item.status === 'active' && !supersededIds.has(item.id));
}
