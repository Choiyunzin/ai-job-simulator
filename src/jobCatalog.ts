// 사내 직무 목록(직군 → 직종 → 직렬 → 직무): HTML 맨 위 '직무 목록' 칸에 넣은 목록을 읽어 4단 선택에 씁니다.
import { useState } from 'react';
import { LABELS } from './engine/config';
import type { Profile } from './engine/types';

export const LEVELS = ['직군', '직종', '직렬', '직무'] as const;
export type JobRow = [string, string, string, string];

const MAX_ROWS = 3000;

export interface ParseResult { rows: JobRow[]; skipped: number }

/**
 * 엑셀에서 복사한 탭 구분 텍스트 또는 CSV를 읽습니다.
 * - 첫 줄이 '직군 …' 제목 행이면 건너뜁니다.
 * - 셀 병합 등으로 앞 칸이 비어 있으면 바로 윗줄 값으로 채웁니다.
 * - 같은 줄이 여러 번 나오면 하나만 남깁니다.
 */
export function parseJobList(text: string): ParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const rows: JobRow[] = [];
  const seen = new Set<string>();
  let prev: string[] = ['', '', '', ''];
  let skipped = 0;
  lines.forEach((line, i) => {
    const cells = (line.includes('\t') ? line.split('\t') : splitCsv(line)).map((c) => c.trim());
    if (i === 0 && cells[0]?.replace(/\s/g, '') === '직군') return;
    const filled = [0, 1, 2, 3].map((k) => cells[k] || (k < 3 ? prev[k] : ''));
    if (filled.some((c) => !c)) { skipped++; return; }
    prev = filled;
    const key = filled.join('\u0001');
    if (seen.has(key) || rows.length >= MAX_ROWS) { skipped++; return; }
    seen.add(key);
    rows.push(filled as JobRow);
  });
  return { rows, skipped };
}

function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

declare global { interface Window { JOB_LIST?: string } }

/** HTML 맨 위 '직무 목록' 칸(window.JOB_LIST)을 읽습니다. 비어 있으면 기본 직무 목록을 씁니다. */
function readList(): JobRow[] {
  try { return typeof window.JOB_LIST === 'string' ? parseJobList(window.JOB_LIST).rows : []; } catch { return []; }
}

export function useJobCatalog() {
  const [rows] = useState(readList);
  return { rows };
}

/** 앞 단계 선택값에 맞는 다음 단계 선택지 (목록에 나온 순서 유지) */
export function optionsAt(rows: JobRow[], path: string[], level: number): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (path.slice(0, level).every((v, k) => r[k] === v) && !out.includes(r[level])) out.push(r[level]);
  }
  return out;
}

/** 화면·리포트에 쓰는 직무 이름 */
export function jobLabel(p: Profile): string {
  if (p.jobPath?.length === 4) return `${p.jobPath[0]} · ${p.jobPath[2]} · ${p.jobPath[3]}`;
  return p.job === 'other' ? (p.jobOther || '기타') : LABELS.job[p.job];
}

/** 목록에서 고른 직무에 '교육'이 들어가면 교육 직무용 예시·재투자 항목을 씁니다. */
export const isEduPath = (path: string[]) => path.some((v) => v.includes('교육'));
