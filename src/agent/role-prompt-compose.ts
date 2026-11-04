/**
 * T80 — compose operator constitution ⊕ mission overlay ⊕ role lessons
 * into the vibes child system prompt. Desktop T79 writes
 * `.vibes/role-constitutions.json`; overlays/lessons are optional siblings.
 * Overlay never rewrites constitution — append-only labeled sections.
 */
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../logger.js';

export type RoleKey = 'default' | 'planner' | 'executor' | 'reviewer' | 'triage';

export type OverlayOp = 'add' | 'emphasize' | 'forbid';

export interface OverlayPatch {
  op: OverlayOp;
  text: string;
}

export interface MissionOverlayFile {
  v: number;
  at?: number;
  patches: OverlayPatch[];
}

export interface RoleConstitutionsFile {
  v: number;
  at?: number;
  roles: Partial<Record<RoleKey, string>>;
}

export interface RoleLessonsFile {
  v: number;
  at?: number;
  roles: Partial<Record<RoleKey, string[]>>;
}

const MAX_SECTION_CHARS = 12_000;

export function roleConstitutionsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'role-constitutions.json');
}

export function missionOverlayPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'mission-overlay.json');
}

export function roleLessonsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'role-lessons.json');
}

function readJsonFile<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch (error: any) {
    log(`Failed to read ${path.basename(file)}: ${error?.message ?? error}`, 'WARN');
    return null;
  }
}

function clip(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.length > MAX_SECTION_CHARS ? trimmed.slice(0, MAX_SECTION_CHARS) : trimmed;
}

export function loadRoleConstitutions(workspaceRoot: string): RoleConstitutionsFile | null {
  const raw = readJsonFile<RoleConstitutionsFile>(roleConstitutionsPath(workspaceRoot));
  if (!raw || typeof raw !== 'object' || !raw.roles || typeof raw.roles !== 'object') return null;
  return raw;
}

export function loadMissionOverlay(workspaceRoot: string): MissionOverlayFile | null {
  const raw = readJsonFile<MissionOverlayFile>(missionOverlayPath(workspaceRoot));
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.patches)) return null;
  const patches = raw.patches
    .filter((p): p is OverlayPatch =>
      !!p
      && typeof p === 'object'
      && (p.op === 'add' || p.op === 'emphasize' || p.op === 'forbid')
      && typeof p.text === 'string'
      && clip(p.text).length > 0,
    )
    .map((p) => ({ op: p.op, text: clip(p.text) }));
  return { v: typeof raw.v === 'number' ? raw.v : 1, at: raw.at, patches };
}

export function loadRoleLessons(workspaceRoot: string): RoleLessonsFile | null {
  const raw = readJsonFile<RoleLessonsFile>(roleLessonsPath(workspaceRoot));
  if (!raw || typeof raw !== 'object' || !raw.roles || typeof raw.roles !== 'object') return null;
  return raw;
}

function constitutionForRole(file: RoleConstitutionsFile | null, role: RoleKey): string {
  if (!file?.roles) return '';
  const direct = clip(String(file.roles[role] ?? ''));
  if (direct) return direct;
  if (role !== 'default') {
    const fallback = clip(String(file.roles.default ?? ''));
    if (fallback) return fallback;
  }
  return '';
}

function lessonsForRole(file: RoleLessonsFile | null, role: RoleKey): string[] {
  if (!file?.roles) return [];
  const pick = (key: RoleKey): string[] => {
    const list = file.roles[key];
    if (!Array.isArray(list)) return [];
    return list
      .filter((item): item is string => typeof item === 'string')
      .map(clip)
      .filter(Boolean);
  };
  const own = pick(role);
  if (own.length > 0) return own;
  return role === 'default' ? [] : pick('default');
}

function formatOverlay(patches: OverlayPatch[]): string {
  if (patches.length === 0) return '';
  const lines = patches.map((p) => `- ${p.op.toUpperCase()}: ${p.text}`);
  return `[MISSION OVERLAY — refine only; cannot rewrite constitution]:\n${lines.join('\n')}`;
}

function formatConstitution(role: RoleKey, text: string): string {
  if (!text) return '';
  return `[OPERATOR CONSTITUTION (${role}) — source of truth]:\n${text}`;
}

function formatLessons(role: RoleKey, lessons: string[]): string {
  if (lessons.length === 0) return '';
  return `[ROLE LESSONS (${role})]:\n${lessons.map((l) => `- ${l}`).join('\n')}`;
}

export interface ComposeRolePromptInput {
  workspaceRoot: string;
  role: RoleKey;
  /** Built-in vibes system prompt body (minion rules, task, etc.). */
  basePrompt: string;
}

/**
 * Prepend labeled constitution ⊕ overlay ⊕ lessons ahead of the base prompt.
 * Missing files are no-ops. Empty sections omitted.
 */
export function composeRoleSystemPrompt(input: ComposeRolePromptInput): string {
  const { workspaceRoot, role, basePrompt } = input;
  if (!workspaceRoot) return basePrompt;

  const constitution = constitutionForRole(loadRoleConstitutions(workspaceRoot), role);
  const overlay = loadMissionOverlay(workspaceRoot);
  const lessons = lessonsForRole(loadRoleLessons(workspaceRoot), role);

  const sections = [
    formatConstitution(role, constitution),
    formatOverlay(overlay?.patches ?? []),
    formatLessons(role, lessons),
  ].filter(Boolean);

  if (sections.length === 0) return basePrompt;

  log(
    `T80 compose role=${role}: constitution=${constitution ? 'yes' : 'no'} overlay=${overlay?.patches.length ?? 0} lessons=${lessons.length}`,
    'INFO',
  );
  return `${sections.join('\n\n')}\n\n${basePrompt}`;
}
