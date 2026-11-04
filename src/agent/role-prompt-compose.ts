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

/** Desktop T35 — single latest failure-distilled lesson (Retry seed + T80 compose). */
export interface HarnessLessonFile {
  v: number;
  at?: number;
  missionTitle?: string;
  lesson: string;
  helped?: string;
  failed?: string;
  harnessClass?: string | null;
}

const MAX_SECTION_CHARS = 12_000;
const MAX_HARNESS_LESSON_CHARS = 500;

export function roleConstitutionsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'role-constitutions.json');
}

export function missionOverlayPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'mission-overlay.json');
}

export function roleLessonsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'role-lessons.json');
}

export function harnessLessonPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'harness-lesson.json');
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

export function loadHarnessLesson(workspaceRoot: string): HarnessLessonFile | null {
  const raw = readJsonFile<HarnessLessonFile>(harnessLessonPath(workspaceRoot));
  if (!raw || typeof raw !== 'object') return null;
  if (raw.v !== 1 && raw.v !== 2) return null;
  if (typeof raw.lesson !== 'string' || !clip(raw.lesson)) return null;
  return {
    v: raw.v,
    at: raw.at,
    missionTitle: typeof raw.missionTitle === 'string' ? raw.missionTitle : undefined,
    lesson: clip(raw.lesson).slice(0, MAX_HARNESS_LESSON_CHARS),
    helped: typeof raw.helped === 'string' ? clip(raw.helped).slice(0, 200) : undefined,
    failed: typeof raw.failed === 'string' ? clip(raw.failed).slice(0, 200) : undefined,
    harnessClass: typeof raw.harnessClass === 'string' ? raw.harnessClass : raw.harnessClass === null ? null : undefined,
  };
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

function formatHarnessLesson(lesson: HarnessLessonFile | null): string {
  if (!lesson) return '';
  const lines = [lesson.lesson];
  if (lesson.helped) lines.push(`Keep: ${lesson.helped}`);
  if (lesson.failed) lines.push(`Avoid: ${lesson.failed}`);
  const title = lesson.missionTitle ? ` from "${lesson.missionTitle.slice(0, 80)}"` : '';
  return `[HARNESS LESSON${title} — prior failure; do not repeat]:\n${lines.join('\n')}`;
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
  const harness = loadHarnessLesson(workspaceRoot);

  const sections = [
    formatConstitution(role, constitution),
    formatOverlay(overlay?.patches ?? []),
    formatLessons(role, lessons),
    formatHarnessLesson(harness),
  ].filter(Boolean);

  if (sections.length === 0) return basePrompt;

  log(
    `T80 compose role=${role}: constitution=${constitution ? 'yes' : 'no'} overlay=${overlay?.patches.length ?? 0} lessons=${lessons.length} harness=${harness ? 'yes' : 'no'}`,
    'INFO',
  );
  return `${sections.join('\n\n')}\n\n${basePrompt}`;
}
