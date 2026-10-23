// 역할 진단(Q.R): 고른 직무의 역할 + (팀장·실장이면) 리더 역할을 5점 척도로 체크
// 역할 목록은 HTML 맨 위 '역할 목록' 칸(window.ROLE_LIST)에서 읽습니다. 한 줄에 "직무<탭>역할".
import { useState } from 'react';
import { DEFAULT_EDU_ROLES, DEFAULT_LEADER_ROLES, LEADER_POSITIONS } from './engine/config';
import { isEduPath } from './jobCatalog';
import type { Profile } from './engine/types';

declare global { interface Window { ROLE_LIST?: string } }

export type RoleRow = [string, string]; // [직무(또는 직렬, '리더'), 역할]
export const LEADER_KEY = '리더';

export function parseRoleList(text: string): RoleRow[] {
  const rows: RoleRow[] = [];
  const seen = new Set<string>();
  let prevJob = '';
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
    if (i <= 1 && cells[0]?.replace(/\s/g, '') === '직무' && cells[1]?.replace(/\s/g, '') === '역할') return;
    const job = cells[0] || prevJob;
    const role = cells.slice(1).filter(Boolean).join(' ');
    if (!job || !role) return;
    prevJob = job;
    const key = `${job}\u0001${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push([job, role]);
  });
  return rows;
}

export function readRoles(): RoleRow[] {
  try { return typeof window.ROLE_LIST === 'string' ? parseRoleList(window.ROLE_LIST) : []; } catch { return []; }
}

export function useRoleCatalog() {
  const [rows] = useState(readRoles);
  return rows;
}

export const isLeader = (p: Profile) => LEADER_POSITIONS.includes(p.career?.position ?? '');

/** 고른 직무의 역할: 목록에서 직무 이름 → 없으면 직렬 이름으로 찾고, 교육 직무면 기본 교육기획 역할 */
export function jobRolesFor(p: Profile, rows: RoleRow[]): string[] {
  const path = p.jobPath ?? [];
  const keys = path.length === 4 ? [path[3], path[2]] : [p.job === 'other' ? p.jobOther : ''];
  for (const k of keys) {
    if (!k) continue;
    const hit = rows.filter((r) => r[0] === k).map((r) => r[1]);
    if (hit.length) return hit;
  }
  if (path.length === 4 ? isEduPath(path) : p.job === 'edu') return DEFAULT_EDU_ROLES;
  return [];
}

export function leaderRolesFor(p: Profile, rows: RoleRow[]): string[] {
  if (!isLeader(p)) return [];
  const custom = rows.filter((r) => r[0] === LEADER_KEY).map((r) => r[1]);
  return custom.length ? custom : DEFAULT_LEADER_ROLES;
}

export interface RoleRating { role: string; group: 'job' | 'leader' | 'custom'; score: number | null }

/** 화면에 보일 역할과 현재 점수 (직무를 바꾸면 예전 직무의 점수는 보이지 않음) */
export function currentRoles(p: Profile, rows: RoleRow[]): RoleRating[] {
  const r = p.roleRatings ?? {};
  const pick = (role: string, group: RoleRating['group']) => ({ role, group, score: typeof r[role] === 'number' ? r[role] : null });
  const job = jobRolesFor(p, rows);
  const leader = leaderRolesFor(p, rows).filter((x) => !job.includes(x));
  const custom = (p.customRoles ?? []).filter((x) => x.trim() && !job.includes(x) && !leader.includes(x));
  return [...job.map((x) => pick(x, 'job')), ...leader.map((x) => pick(x, 'leader')), ...custom.map((x) => pick(x, 'custom'))];
}

/** 리포트용: 강점(4~5점)과 보완 필요(1~2점) */
export function roleSummary(list: RoleRating[]) {
  const rated = list.filter((x) => x.score !== null);
  return {
    rated,
    strengths: rated.filter((x) => (x.score ?? 0) >= 4).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    gaps: rated.filter((x) => (x.score ?? 0) <= 2).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)),
  };
}
