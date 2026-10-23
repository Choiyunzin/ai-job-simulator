// F-21 표준 Task 마스터: HTML 맨 위 '표준 Task 목록' 칸(window.TASK_LIST)을 읽습니다.
// 한 줄 = Task 1개, 탭 구분 13열:
// 직무 | Task ID | Task 문장 | 업무 유형 | McKinsey 활동 유형 | O*NET 직업 코드 | O*NET Task/DWA | 대응 수준 | 노출 등급 | 채점 근거 | 채점 방식 | Anthropic 자동화형 비중 | 기준일
import { LABELS } from './engine/config';
import type { ELevel, Profile, TaskType } from './engine/types';

declare global { interface Window { TASK_LIST?: string } }

export interface StdTask {
  job: string; id: string; text: string; type: TaskType; mckActivity: string; onetCode: string; onetTask: string;
  matchLevel: string; eLevel: ELevel; rationale: string; method: string; aeiAutoShare: number | null; date: string;
}
export interface TaskListError { line: number; reason: string; text: string }

const TYPE_BY_LABEL = Object.fromEntries(
  (Object.entries(LABELS.type) as [TaskType, string][]).flatMap(([k, v]) => [[v.replace(/\s/g, ''), k], [k, k]]),
) as Record<string, TaskType>;

function toShare(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace('%', ''));
  if (!Number.isFinite(n)) return null;
  const x = t.includes('%') || n > 1 ? n / 100 : n;
  return x >= 0 && x <= 1 ? x : null;
}

export function parseTaskList(text: string): { tasks: StdTask[]; errors: TaskListError[] } {
  const tasks: StdTask[] = [];
  const errors: TaskListError[] = [];
  const ids = new Set<string>();
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const c = raw.split('\t').map((x) => x.trim());
    if (c[0]?.replace(/\s/g, '') === '직무' && /task/i.test(c[1] ?? '')) return; // 제목 행
    if (c.length < 9) { errors.push({ line, reason: `열 수가 부족합니다(${c.length}열, 최소 9열)`, text: raw.slice(0, 60) }); return; }
    const [job, id, sentence, typeLabel, mck, onetCode, onetTask, match, e, rationale = '', method = '', aei = '', date = ''] = c;
    const type = TYPE_BY_LABEL[(typeLabel ?? '').replace(/\s/g, '')];
    const eLevel = (e ?? '').toUpperCase() as ELevel;
    if (!job || !id || !sentence) { errors.push({ line, reason: '직무·Task ID·Task 문장은 비울 수 없습니다', text: raw.slice(0, 60) }); return; }
    if (!type) { errors.push({ line, reason: `업무 유형 '${typeLabel}'을(를) 알 수 없습니다`, text: raw.slice(0, 60) }); return; }
    if (!['E0', 'E1', 'E2'].includes(eLevel)) { errors.push({ line, reason: `노출 등급 '${e}'은(는) E0/E1/E2 중 하나여야 합니다`, text: raw.slice(0, 60) }); return; }
    if (ids.has(id)) { errors.push({ line, reason: `Task ID '${id}'가 중복됩니다`, text: raw.slice(0, 60) }); return; }
    ids.add(id);
    tasks.push({ job, id, text: sentence, type, mckActivity: mck, onetCode, onetTask, matchLevel: match, eLevel, rationale, method, aeiAutoShare: toShare(aei), date });
  });
  return { tasks, errors };
}

let cache: { tasks: StdTask[]; errors: TaskListError[] } | null = null;
export function readTaskList() {
  if (!cache) {
    try { cache = typeof window.TASK_LIST === 'string' ? parseTaskList(window.TASK_LIST) : { tasks: [], errors: [] }; }
    catch { cache = { tasks: [], errors: [] }; }
    if (cache.errors.length) console.warn('[표준 Task 목록] 무시한 줄', cache.errors);
  }
  return cache;
}

/** 고른 직무의 이름 (직무 목록 사용 시 4단계 직무, 아니면 기본 직무 이름 또는 직접 입력) */
export function jobNameOf(p: Profile): string {
  if (p.jobPath?.length === 4) return p.jobPath[3];
  return p.job === 'other' ? p.jobOther.trim() : LABELS.job[p.job];
}

export function stdTasksFor(p: Profile): StdTask[] {
  const name = jobNameOf(p);
  return name ? readTaskList().tasks.filter((t) => t.job === name) : [];
}

/** 표준 Task 마스터 버전: 목록에 적힌 기준일 중 가장 최근 값 */
export function taskMasterVersion(): string {
  const dates = readTaskList().tasks.map((t) => t.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : '';
}
