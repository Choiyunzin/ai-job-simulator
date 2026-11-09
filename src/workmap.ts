// Work Mapping 진단: 직무현황 · 태스크&스킬 · 스킬 활용분석 · 업무패턴 · 실행 인사이트
// 스킬 목록은 HTML 맨 위 '스킬 목록' 칸(window.SKILL_LIST)에서 읽습니다.
// 한 줄에 "직무<탭>스킬명<탭>스킬 정의<탭>개념인지<탭>가이드수행<탭>독립수행<탭>복잡대응<탭>전문가".
import { useState } from 'react';
import type { Activity, Profile, Task, TaskType } from './engine/types';
import { isEduPath } from './jobCatalog';

declare global { interface Window { SKILL_LIST?: string } }

// ─────────────────────────────────────────────
// 8가지 활동 = 업무 패턴 8유형
// 좌표: x 0(개념·전략) → 1(실행·운영), y 0(혼자·분석) → 1(소통·관계)
// ─────────────────────────────────────────────
export interface ActivityDef {
  label: string;      // 활동 이름
  pattern: string;    // 유형 이름
  desc: string;       // 활동 설명 (선택지 아래 문구)
  x: number; y: number;
  color: string;
  interp: string;     // 유형 해석
  strengths: string[];
  cautions: string[];
}

export const ACTIVITY: Record<Activity, ActivityDef> = {
  planning: {
    label: '기획·설계', pattern: '기획형', desc: '방향을 정하고 구조와 계획을 설계', x: 0.2, y: 0.75, color: '#6250d6',
    interp: '일의 방향을 정하고 구조를 설계하는 데 시간을 가장 많이 씁니다. 무엇을 왜 해야 하는지를 먼저 그리는 방식으로 일합니다.',
    strengths: ['큰 그림을 보고 문제를 구조화합니다', '여러 요소를 엮어 실행 가능한 계획으로 만듭니다'],
    cautions: ['설계가 현장과 멀어지지 않도록 실행 담당자의 피드백을 자주 받아 보세요', '후속 관리와 실행 디테일이 약해지지 않게 점검 지점을 정해 두세요'],
  },
  relationship: {
    label: '관계·협력', pattern: '관계형', desc: '사람을 돕고 신뢰·협력 관계를 쌓음', x: 0.4, y: 0.81, color: '#e87ba4',
    interp: '사람을 돕고 신뢰와 협력을 쌓는 일의 비중이 큽니다. 일이 사람을 통해 굴러가도록 만드는 방식으로 일합니다.',
    strengths: ['신뢰를 바탕으로 협업을 끌어냅니다', '구성원과 고객의 필요를 세심하게 살핍니다'],
    cautions: ['관계 업무의 성과는 잘 드러나지 않으니 기록하고 보이게 만들어 보세요', '거절하기 어려운 요청이 쌓이지 않도록 우선순위 기준을 세워 두세요'],
  },
  communication: {
    label: '소통·전달', pattern: '소통형', desc: '정보를 전달하고 안내·설득', x: 0.65, y: 0.86, color: '#eb6834',
    interp: '정보를 전달하고 안내·설득하는 일의 비중이 큽니다. 사람들 사이에서 메시지를 정리하고 흐르게 하는 방식으로 일합니다.',
    strengths: ['대상에 맞춰 메시지를 쉽게 전달합니다', '현장의 반응과 분위기를 빠르게 파악합니다'],
    cautions: ['응대·안내가 잘게 쪼개져 집중 시간이 흩어지기 쉬우니 몰입 시간을 따로 확보해 보세요', '반복되는 안내·답변은 템플릿이나 AI 초안으로 줄일 수 있습니다'],
  },
  coordination: {
    label: '조율·관리', pattern: '조율형', desc: '일정·자원·이해관계를 맞추고 관리', x: 0.8, y: 0.65, color: '#1baf7a',
    interp: '일정·자원·이해관계를 맞춰 일이 굴러가게 만드는 비중이 큽니다. 여러 사람과 일 사이의 균형을 잡는 방식으로 일합니다.',
    strengths: ['복잡한 이해관계를 정리하고 합의를 이끕니다', '일정과 리스크를 미리 챙겨 일이 멈추지 않게 합니다'],
    cautions: ['조율 자체에 시간이 과하게 들지 않도록 결정 기준과 권한을 명확히 해 보세요', '본인의 전문 업무에 쓸 시간이 줄어들지 않았는지 살펴보세요'],
  },
  analysis: {
    label: '분석·판단', pattern: '분석형', desc: '데이터를 해석하고 판단 근거를 만듦', x: 0.25, y: 0.45, color: '#2a78d6',
    interp: '데이터를 해석하고 판단 근거를 만드는 비중이 큽니다. 숫자와 사실로 일의 방향을 확인하는 방식으로 일합니다.',
    strengths: ['객관적인 근거로 의사결정을 돕습니다', '데이터 속 패턴과 이상 신호를 찾아냅니다'],
    cautions: ['분석 결과가 실제 행동으로 이어지도록 "그래서 무엇을 할까"까지 정리해 보세요', '데이터 정리 같은 준비 작업은 AI·자동화로 줄일 여지가 큽니다'],
  },
  execution: {
    label: '실행·처리', pattern: '실행형', desc: '정해진 일을 정확하고 빠르게 처리', x: 0.75, y: 0.35, color: '#eda100',
    interp: '정해진 일을 정확하고 빠르게 처리하는 비중이 큽니다. 계획을 결과물로 바꾸는 방식으로 일합니다.',
    strengths: ['마감과 품질을 안정적으로 지킵니다', '업무 처리 절차를 잘 알고 빠르게 실행합니다'],
    cautions: ['반복 업무에 시간이 묶이면 개선·기획에 쓸 여유가 사라지니 AI·자동화 1순위 후보를 찾아보세요', '일의 목적과 우선순위를 주기적으로 다시 확인해 보세요'],
  },
  research: {
    label: '조사·연구', pattern: '연구형', desc: '자료·정보를 찾아 깊이 탐구', x: 0.3, y: 0.2, color: '#008300',
    interp: '자료와 정보를 깊이 파고들어 근거를 만드는 비중이 큽니다. 충분히 알고 난 뒤 움직이는 방식으로 일합니다.',
    strengths: ['정확한 근거를 찾아 신뢰도 높은 결과를 만듭니다', '새로운 지식을 빠르게 흡수하고 정리합니다'],
    cautions: ['탐색이 길어져 실행이 늦어지지 않도록 조사 범위와 마감을 먼저 정해 보세요', '찾은 내용을 동료와 나누면 조직 전체의 시간을 줄일 수 있습니다'],
  },
  learning: {
    label: '학습·습득', pattern: '학습형', desc: '새로운 지식·기술을 익혀 적용', x: 0.5, y: 0.15, color: '#e34948',
    interp: '새로운 지식과 기술을 익혀 일에 적용하는 비중이 큽니다. 배우면서 일의 방식을 넓혀 가는 방식으로 일합니다.',
    strengths: ['변화에 빠르게 적응합니다', '새로운 도구와 방법을 먼저 시도합니다'],
    cautions: ['배운 것이 실제 성과로 이어지는지 작은 적용 사례로 확인해 보세요', '학습이 당장의 업무 우선순위를 밀어내지 않게 시간을 정해 두세요'],
  },
};
export const ACTIVITY_KEYS = Object.keys(ACTIVITY) as Activity[];

/** 업무 유형으로 추정한 기본 활동 (사용자가 바꿀 수 있음) */
const DEFAULT_ACTIVITY: Record<TaskType, Activity> = {
  research: 'research', document: 'execution', data: 'analysis', idea: 'planning',
  communication: 'communication', review: 'coordination', repetitive: 'execution', other: 'execution',
};
export const activityOf = (t: Task): Activity => t.activity ?? DEFAULT_ACTIVITY[t.type];

// ─────────────────────────────────────────────
// 스킬 수준 5단계 · 스킬 목록
// ─────────────────────────────────────────────
export const SKILL_LEVELS = [
  { name: '개념인지', desc: '분야 입문 단계로, 기본 원리·구조를 학습하는 중' },
  { name: '가이드수행', desc: '선배·팀의 지원을 받아 업무를 수행' },
  { name: '독립수행', desc: '본인 책임 하에 판단하고 실행' },
  { name: '복잡대응', desc: '복잡·변동 상황에서도 정밀하게 조정·재구성' },
  { name: '전문가', desc: '분야의 새로운 프레임·표준을 정립하고 전파' },
] as const;

export interface SkillDef { job: string; name: string; def: string; levels: string[] }
export const COMMON_KEY = '공통';

const sk = (job: string, name: string, def: string, levels: string[]): SkillDef => ({ job, name, def, levels });

/** 스킬 목록 칸이 비어 있을 때 쓰는 기본 스킬 (예시 — 사내 스킬셋으로 바꿔 쓰세요) */
export const DEFAULT_COMMON_SKILLS: SkillDef[] = [
  sk(COMMON_KEY, 'AI 도구 활용', '생성형 AI·자동화 도구를 채용·교육·문서·분석 업무에 활용하는 능력', [
    '생성형 AI의 개념과 사내에서 쓸 수 있는 도구를 알고 있음',
    '안내·예시를 따라 AI로 초안 작성·요약을 수행',
    '업무 목적에 맞게 지시문을 설계하고 결과를 검증해 활용',
    '여러 도구를 조합해 복잡한 업무 흐름을 자동화·개선',
    '조직의 AI 활용 방식·가이드를 정립하고 확산',
  ]),
  sk(COMMON_KEY, '데이터 분석', '업무 데이터를 정리·분석해 의사결정에 필요한 시사점을 도출하는 능력', [
    '기본 지표와 엑셀 집계 방법을 학습하는 중',
    '정해진 양식에 따라 데이터를 집계·시각화',
    '분석 목적을 스스로 정하고 결과를 해석해 보고',
    '여러 데이터 원천을 결합해 원인·추세를 정밀 분석',
    '조직의 분석 체계·지표 표준을 설계',
  ]),
  sk(COMMON_KEY, '문서·보고', '목적과 대상에 맞게 내용을 구조화해 문서·보고서로 전달하는 능력', [
    '보고서의 기본 구조와 사내 양식을 익히는 중',
    '선배의 검토를 받아 보고서 초안을 작성',
    '목적에 맞게 스스로 구조를 잡아 완성도 있게 작성',
    '복잡하거나 민감한 사안도 핵심을 정리해 설득력 있게 보고',
    '조직의 보고 기준·템플릿을 만들고 코칭',
  ]),
  sk(COMMON_KEY, '소통·협업', '이해관계자와 의견을 조율하고 협업을 이끄는 능력', [
    '협업 대상과 소통 채널을 파악하는 중',
    '정해진 범위 안에서 유관부서와 협의',
    '이해관계자를 스스로 조율해 합의를 이끔',
    '이해가 충돌하는 상황에서도 대안을 만들어 조정',
    '부서 간 협업 체계와 소통 원칙을 정립',
  ]),
];

export const DEFAULT_EDU_SKILLS: SkillDef[] = [
  sk('교육', '교육체계 설계', '교육·역량 분야의 개발 체계를 설계하는 능력', [
    '교육·역량 분야 입문 단계, 기본 원리·구조를 학습 중',
    '팀 지원을 받아 개발 체계 설계 초안을 수립',
    '본인 책임 하에 개발 체계 설계를 결정·실행',
    '복잡·변동 상황에서도 개발 체계 설계를 정밀 조정·재구성',
    '교육·역량 분야의 신규 프레임·표준을 정립할 수 있음',
  ]),
  sk('교육', '교육과정 개발', '학습 목표에 맞는 과정·콘텐츠를 설계하고 개발하는 능력', [
    '교수설계의 기본 개념(ADDIE 등)을 학습 중',
    '정해진 템플릿에 따라 과정·콘텐츠를 개발',
    '요구 분석부터 과정 설계·개발까지 스스로 수행',
    '대상·환경이 다양한 과정도 맞춤형으로 재설계',
    '새로운 교수설계 방법론을 정립하고 전파',
  ]),
  sk('교육', '교육 운영·평가', '교육을 운영하고 성과를 측정해 개선하는 능력', [
    '교육 운영 절차와 평가 개념을 익히는 중',
    '운영 매뉴얼에 따라 과정 운영·만족도 조사를 수행',
    '운영 이슈를 스스로 해결하고 평가 결과로 개선안을 도출',
    '대규모·다중 과정도 성과 지표 기반으로 정밀 관리',
    '조직의 교육 성과 평가 체계를 정립',
  ]),
];

export function parseSkillList(text: string): SkillDef[] {
  const out: SkillDef[] = [];
  const seen = new Set<string>();
  let prevJob = '';
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const c = (line.includes('\t') ? line.split('\t') : line.split(',')).map((x) => x.trim());
    if (i <= 1 && c[0]?.replace(/\s/g, '') === '직무' && c[1]?.replace(/\s/g, '').startsWith('스킬')) return;
    const job = c[0] || prevJob;
    const name = c[1];
    if (!job || !name) return;
    prevJob = job;
    const key = `${job}\u0001${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(sk(job, name, c[2] ?? '', [3, 4, 5, 6, 7].map((k) => c[k] ?? '')));
  });
  return out;
}

function readSkills(): SkillDef[] {
  try { return typeof window.SKILL_LIST === 'string' ? parseSkillList(window.SKILL_LIST) : []; } catch { return []; }
}

export function useSkillCatalog() {
  const [rows] = useState(readSkills);
  return rows;
}

/** 내 직무의 스킬 (직무 이름 → 직렬 이름으로 찾고) + 공통 스킬 */
export function skillsFor(p: Profile, rows: SkillDef[]): SkillDef[] {
  const path = p.jobPath ?? [];
  const keys = path.length === 4 ? [path[3], path[2]] : [p.job === 'other' ? p.jobOther : ''];
  let job: SkillDef[] = [];
  for (const k of keys) {
    if (!k) continue;
    const hit = rows.filter((r) => r.job === k);
    if (hit.length) { job = hit; break; }
  }
  const edu = path.length === 4 ? isEduPath(path) : p.job === 'edu';
  if (!job.length && !rows.length && edu) job = DEFAULT_EDU_SKILLS;
  let common = rows.length ? rows.filter((r) => r.job === COMMON_KEY) : DEFAULT_COMMON_SKILLS;
  if (!job.length && !common.length) common = DEFAULT_COMMON_SKILLS;
  const names = new Set(job.map((x) => x.name));
  return [...job, ...common.filter((x) => !names.has(x.name))];
}

/** 스킬 수준 설명: 목록에 적힌 단계 설명이 있으면 그것, 없으면 공통 설명 */
export const levelDesc = (s: SkillDef, lv: number) => s.levels[lv - 1] || SKILL_LEVELS[lv - 1].desc;

// ─────────────────────────────────────────────
// 계산
// ─────────────────────────────────────────────
export type Quadrant = 'core' | 'boost' | 'expand' | 'adjust';
export const QUADRANT_INFO: Record<Quadrant, { title: string; desc: string; tone: string }> = {
  core: { title: '핵심 강점 업무', desc: '비중 높음, 스킬 높음. 노하우 표준화·공유 대상.', tone: 'good' },
  boost: { title: '스킬 보강 필요', desc: '비중 높음, 스킬 낮음. 학습·AI 보조 우선 검토 대상.', tone: 'bad' },
  expand: { title: '역량 확장 여지', desc: '비중 낮음, 스킬 높음. 역할 확대 검토 대상.', tone: 'blue' },
  adjust: { title: '효율화·조정 검토', desc: '비중 낮음, 스킬 낮음. 위임·자동화·조정 검토 대상.', tone: 'warn' },
};
export const Y_MID = 3; // 스킬 매치 기준선: 독립수행

export interface TaskMatch {
  id: string; name: string; share: number; hours: number; activity: Activity;
  skills: { name: string; score: number | null }[];
  score: number | null;   // 연결 스킬 본인 평가 평균 (1~5)
  quadrant: Quadrant | null;
}

export interface WorkMap {
  totalShare: number;
  tasks: TaskMatch[];                         // 비중 큰 순
  activities: { key: Activity; share: number }[]; // 입력한 업무 안에서의 비율(0~1), 큰 순
  skillAvg: number | null;
  skills: { def: SkillDef; score: number | null; linked: string[] }[];
  xMid: number;                               // 비중 기준선 (업무 평균 비중 %)
  me: { x: number; y: number } | null;
  primary: Activity | null;
  secondary: Activity | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeWorkMap(p: Profile, catalog: SkillDef[]): WorkMap {
  const defs = skillsFor(p, catalog);
  const r = p.skillRatings ?? {};
  const tasks0 = p.tasks.filter((t) => t.name.trim() && t.share > 0);
  const totalShare = tasks0.reduce((x, t) => x + t.share, 0);
  const xMid = tasks0.length ? totalShare / tasks0.length : 20;

  const tasks: TaskMatch[] = tasks0.map((t) => {
    const skills = (t.skills ?? []).map((name) => ({ name, score: typeof r[name] === 'number' ? r[name] : null }));
    const score = avg(skills.map((x) => x.score).filter((x): x is number => x !== null));
    const quadrant: Quadrant | null = score === null ? null
      : t.share >= xMid ? (score >= Y_MID ? 'core' : 'boost') : (score >= Y_MID ? 'expand' : 'adjust');
    return { id: t.id, name: t.name, share: t.share, hours: t.hours, activity: activityOf(t), skills, score, quadrant };
  }).sort((a, b) => b.share - a.share);

  const act = new Map<Activity, number>();
  tasks.forEach((t) => act.set(t.activity, (act.get(t.activity) ?? 0) + t.share));
  const activities = [...act.entries()].map(([key, v]) => ({ key, share: totalShare ? v / totalShare : 0 }))
    .sort((a, b) => b.share - a.share);

  const me = totalShare ? {
    x: tasks.reduce((x, t) => x + ACTIVITY[t.activity].x * t.share, 0) / totalShare,
    y: tasks.reduce((x, t) => x + ACTIVITY[t.activity].y * t.share, 0) / totalShare,
  } : null;

  const skills = defs.map((def) => ({
    def, score: typeof r[def.name] === 'number' ? r[def.name] : null,
    linked: tasks.filter((t) => t.skills.some((x) => x.name === def.name)).map((t) => t.name),
  }));
  const skillAvg = avg(skills.map((x) => x.score).filter((x): x is number => x !== null));

  return {
    totalShare, tasks, activities, skillAvg, skills, xMid, me,
    primary: activities[0]?.key ?? null,
    secondary: activities[1] && activities[1].share >= 0.2 ? activities[1].key : null,
  };
}

export interface Insight { tag: string; title: string; body: string }

/** 실행 인사이트: 진단 결과에서 바로 시작해 볼 다음 행동 (최대 5개) */
export function buildInsights(m: WorkMap, firstExperiment: { name: string; reason: string } | null): Insight[] {
  const out: Insight[] = [];
  const by = (q: Quadrant) => m.tasks.filter((t) => t.quadrant === q);
  const lowest = (t: TaskMatch) => [...t.skills].filter((x) => x.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  const boost = by('boost')[0];
  if (boost) {
    const lw = lowest(boost);
    out.push({ tag: '스킬 보강', title: `'${boost.name}' 스킬부터 한 단계 올리기`,
      body: `업무 비중 ${fmt(boost.share)}, 연결 스킬 평균 ${boost.score!.toFixed(1)}점.${lw ? ` '${lw.name}'(${SKILL_LEVELS[(lw.score ?? 1) - 1].name})을 다음 단계로 올릴 학습 방법 1개 선정: 사내 교육, 선배 코칭, AI 보조 실습 중 택일.` : ''}` });
  }
  if (firstExperiment) {
    out.push({ tag: 'AI 실험', title: `AI로 먼저 실험해 볼 업무: ${firstExperiment.name}`, body: firstExperiment.reason });
  }
  const core = by('core')[0];
  if (core) {
    out.push({ tag: '강점 확산', title: `'${core.name}' 노하우를 템플릿으로 남기기`,
      body: '비중과 스킬 수준이 모두 높은 업무. 작업 방식을 체크리스트·지시문·예시로 정리해 AI 활용과 공유에 사용.' });
  }
  const expand = by('expand')[0];
  if (expand) {
    out.push({ tag: '역할 확장', title: `'${expand.name}' 비중을 넓힐 기회 찾기`,
      body: '스킬 수준은 높고 비중은 낮은 업무. 역할 확대 또는 다른 업무와의 비중 조정을 팀장과 협의.' });
  }
  const adjust = by('adjust')[0];
  if (adjust && out.length < 5) {
    out.push({ tag: '업무 조정', title: `'${adjust.name}'은 위임·자동화 검토`,
      body: '비중과 스킬 수준이 모두 낮은 업무. 담당 필요성, 자동화·위임 가능성 점검.' });
  }
  const ai = m.skills.find((x) => x.def.name.includes('AI'));
  if (ai && ai.score !== null && ai.score <= 2 && out.length < 5) {
    out.push({ tag: 'AI 역량', title: `'${ai.def.name}' 다음 단계(${SKILL_LEVELS[ai.score].name}) 도전`,
      body: `다음 단계 기준: ${levelDesc(ai.def, ai.score + 1)}. 업무 1개를 정해 같은 방식으로 3회 반복.` });
  }
  if (m.primary && out.length < 5) {
    const A = ACTIVITY[m.primary];
    out.push({ tag: '일하는 방식', title: `${A.pattern}의 주의 영역 살피기`, body: A.cautions[0] });
  }
  const unlinked = m.tasks.filter((t) => t.score === null).length;
  if (unlinked && out.length < 5) {
    out.push({ tag: '진단 보완', title: `스킬이 연결되지 않은 업무 ${unlinked}개`,
      body: 'Q.B에서 업무별 스킬을 연결하고 Q.S에서 수준을 선택하면 스킬 활용분석에 포함됩니다.' });
  }
  return out.slice(0, 5);
}

const fmt = (v: number) => `${Math.round(v * 10) / 10}%`;
