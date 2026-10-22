import { config } from '../config.js';
import { log } from '../logger.js';
import { decideInterveneAction, toAutoResolution, type InterveneChoice } from './intervene-gate.js';

type FetchLike = typeof fetch;

interface KevEvaluateAnswer {
  choice?: string;
  probabilities?: Record<string, number>;
}

interface KevEvaluateResult {
  answers?: Record<string, KevEvaluateAnswer>;
}

function parseSseOrJson(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.includes('data:')) {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.startsWith('data:'));
    const last = lines.at(-1)?.slice(5).trim();
    if (last && last !== '[DONE]') {
      try {
        return JSON.parse(last);
      } catch {
        /* fall through */
      }
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function sessionHeaders(base: HeadersInit, sessionId: string | null): Headers {
  const h = new Headers(base);
  if (sessionId) h.set('mcp-session-id', sessionId);
  return h;
}

async function mcpPost(
  url: string,
  headers: HeadersInit,
  body: unknown,
  fetchImpl: FetchLike,
  sessionId: string | null,
): Promise<{ status: number; sessionId: string | null; payload: unknown }> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: sessionHeaders(headers, sessionId),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const nextSession = res.headers.get('mcp-session-id') || sessionId;
  const text = await res.text();
  return { status: res.status, sessionId: nextSession, payload: parseSseOrJson(text) };
}

export function isDecisionInterveneGateEnabled(): boolean {
  return Boolean(
    config.ENABLE_DECISION_INTERVENE_GATE
    && config.KEV_MCP_URL.trim()
    && config.KEV_MCP_AUTH_TOKEN.trim(),
  );
}

async function kevEvaluateIntervene(
  state: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
): Promise<KevEvaluateResult | null> {
  const url = config.KEV_MCP_URL.trim();
  const token = config.KEV_MCP_AUTH_TOKEN.trim();
  if (!url || !token) return null;

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };

  try {
    const init = await mcpPost(
      url,
      headers,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'vibes', version: '0.4.0' },
        },
      },
      fetchImpl,
      null,
    );
    if (init.status === 401 || init.status === 403) return null;
    const sessionId = init.sessionId;
    if (!sessionId && init.status >= 400) return null;

    await fetchImpl(url, {
      method: 'POST',
      headers: sessionHeaders(headers, sessionId),
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);

    const call = await mcpPost(
      url,
      headers,
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'kev_evaluate',
          arguments: {
            state,
            questions: {
              action: {
                type: 'choice',
                instructions: 'Mission triage: intervene vs continue',
                criteria: {
                  continue: 'Keep executing; no operator needed yet',
                  escalate: 'Ask the operator / open intervention',
                  skip: 'Skip the blocked work and move on',
                },
              },
            },
          },
        },
      },
      fetchImpl,
      sessionId,
    );
    if (call.status >= 400) return null;
    const rpc = call.payload as { result?: unknown; error?: unknown } | null;
    if (!rpc || rpc.error) return null;
    const result = rpc.result as {
      structuredContent?: KevEvaluateResult;
      content?: Array<{ type?: string; text?: string }>;
      isError?: boolean;
    } | null;
    if (!result || result.isError) return null;
    if (result.structuredContent && typeof result.structuredContent === 'object') {
      return result.structuredContent;
    }
    const text = result.content?.find((c) => c.type === 'text')?.text;
    if (text) {
      try {
        return JSON.parse(text) as KevEvaluateResult;
      } catch {
        return null;
      }
    }
    return null;
  } catch (error: any) {
    log(`Decision MCP call failed: ${error?.message ?? error}`, 'WARN');
    return null;
  }
}

/**
 * Before blocking on operator intervention, ask KEV whether to auto-retry/skip.
 * Returns an auto-resolution, or null to proceed with the normal intervene wait.
 */
export async function maybeAutoResolveIntervention(context: {
  missionTitle: string;
  taskTitle: string;
  error: string;
}): Promise<{ action: 'retry' | 'skip'; message: string } | null> {
  if (!isDecisionInterveneGateEnabled()) return null;

  const evaluated = await kevEvaluateIntervene({
    mission: context.missionTitle,
    task: context.taskTitle,
    symptom: context.error,
    open_question: 'escalate to operator or auto-retry/skip?',
  });

  const actionAnswer = evaluated?.answers?.action;
  const gate = decideInterveneAction({
    choice: actionAnswer?.choice,
    probabilities: actionAnswer?.probabilities,
  });
  log(`Decision intervene gate: ${gate.action} — ${gate.reason}`, 'INFO');
  return toAutoResolution(gate.action);
}

export type { InterveneChoice };
