// ─────────────────────────────────────────────
// v2 글로벌 연구 기준 진단 (상세 기능 정의서 v2 · F-07, F-10, F-17, F-22)
// 실행 중 AI 호출 없음: 표준 Task에 미리 붙은 등급(eLevel)과 계산식만 사용
// ─────────────────────────────────────────────
import {
  APPLICABILITY_MULT, AUTO_SHARE_HIGH, AI_MODE, CONFIDENCE, E_POTENTIAL_COEF, FRONTIER_PENALTY, LEVEL_PROFILE,
  QUADRANT, RESEARCH_E_SCORE, TYPE_DEFAULT_E, automationCap,
} from './config';
import type { AiMode, Applicability, ELevel, ExposureScenario, Profile, Task, WorkEnv } from './types';

export const clamp01 = (v: number, max = 1) => Math.max(0, Math.min(max, v));

/** 업무의 노출 등급: 표준 Task면 사전 채점값, 직접 입력이면 업무 유형 기본값(추정) */
export const eLevelOf = (t: Task): ELevel => (t.taskId && t.eLevel ? t.eLevel : TYPE_DEFAULT_E[t.type]);
export const isStd = (t: Task) => !!(t.taskId && t.eLevel);
export const eSourceLabel = (t: Task) => (isStd(t) ? '연구 기준' : '유형 추정');

/** 활용 방식: 0단계면 '없음', 1단계 이상인데 고르지 않았으면 null(미응답) */
export const modeOf = (t: Task): AiMode | 'none' | null => (t.aiLevel === 0 ? 'none' : t.aiMode ?? null);

const GEN_TOOLS = ['internalGpt', 'copilot', 'externalGenAI'] as const;

/** F-10 사내 실현 가능 여부 (0 / 0.5 / 1) */
export function feasibleOf(e: ELevel, env: WorkEnv | undefined): number {
  if (e === 'E0') return 0;
  const tools = env?.tools ?? [];
  const gen = tools.some((x) => (GEN_TOOLS as readonly string[]).includes(x));
  const auto = tools.includes('automation');
  let f: number;
  if (!gen && !auto && (tools.length === 0 || tools.every((x) => x === 'unknown'))) f = 0.5; // 모름(또는 미응답) → 0.5
  else if (e === 'E1') f = gen ? 1 : 0;
  else f = gen && auto ? 1 : gen ? 0.5 : 0;
  // 자료 민감도 '많음' + 생성형 AI가 외부 서비스뿐 → 최대 0.5
  const externalOnly = tools.includes('externalGenAI') && !tools.includes('internalGpt') && !tools.includes('copilot');
  if (env?.personalData === 'lots' && externalOnly) f = Math.min(f, 0.5);
  return f;
}
export const toolsUnknown = (env: WorkEnv | undefined) => {
  const tools = env?.tools ?? [];
  return !tools.some((x) => ['internalGpt', 'copilot', 'externalGenAI', 'automation', 'none'].includes(x));
};
export const toolsNone = (env: WorkEnv | undefined) => (env?.tools ?? []).includes('none')
  && !(env?.tools ?? []).some((x) => ['internalGpt', 'copilot', 'externalGenAI', 'automation'].includes(x));

/** F-17 3단계 잠재력: 표준 Task = 자동화 상한 × 노출 계수, 직접 입력 = v1(자동화 상한 × 적용 가능성 배수) */
export function taskPotential(t: Task, repetitiveBoost = 1): number {
  const cap = automationCap(t.type) * (t.type === 'repetitive' ? repetitiveBoost : 1);
  return isStd(t)
    ? clamp01(cap * E_POTENTIAL_COEF[eLevelOf(t)], 0.9)
    : clamp01(cap * APPLICABILITY_MULT[t.applicability], 0.9);
}

/** 경계 밖 사용: AI가 잘 못하는 업무(E0)에 2단계 이상 활용 */
export const outsideFrontier = (t: Task) => eLevelOf(t) === 'E0' && t.aiLevel >= 2;
export const frontierMult = (t: Task) => (outsideFrontier(t) ? FRONTIER_PENALTY : 1);

/** F-07 인식 차이: 본인 응답(0~2) vs 연구 등급(E0 0, E2 1, E1 2) */
const SELF: Partial<Record<Applicability, number>> = { low: 0, mid: 1, high: 2 };
const RES: Record<ELevel, number> = { E0: 0, E2: 1, E1: 2 };
export type Perception = 'under' | 'over' | 'match' | null;
export function perceptionOf(t: Task): Perception {
  if (!isStd(t)) return null;
  const me = SELF[t.applicability];
  if (me === undefined) return null;
  const r = RES[eLevelOf(t)];
  return me < r ? 'under' : me > r ? 'over' : 'match';
}
export const PERCEPTION_LABEL: Record<Exclude<Perception, null>, string> = { under: '과소 인식', over: '과대 인식', match: '일치' };
/** 표준 Task의 '추천' 표시: E1→높음, E2→보통, E0→낮음 */
export const recommendedFromE: Record<ELevel, Applicability> = { E1: 'high', E2: 'mid', E0: 'low' };

export type Quadrant = 'spread' | 'check' | 'priority' | 'watch';
export const QUADRANT_INFO: Record<Quadrant, { name: string; desc: string }> = {
  spread: { name: '확산·고도화', desc: '연구상 AI 노출이 높고 이미 잘 쓰고 있어요. 사내 사례 공유자가 될 수 있어요.' },
  check: { name: '점검 필요', desc: 'AI가 잘 못하는 업무에 쓰고 있지 않은지 확인이 필요해요.' },
  priority: { name: '교육 최우선', desc: '연구상 AI로 줄일 수 있는 업무가 많은데 아직 덜 쓰고 있어요. AX 교육 핵심 대상이에요.' },
  watch: { name: '관망', desc: '당장 AI 적용 우선순위가 높지 않아요.' },
};

export interface ResearchTaskRow {
  id: string; name: string; weight: number; share: number; e: ELevel; source: '연구 기준' | '유형 추정';
  feasible: number; level: number; mode: AiMode | 'none' | null; frontier: boolean; perception: Perception;
  aei: number | null;
}

export interface ResearchResult {
  scenario: ExposureScenario;
  inputShare: number;               // 입력한 업무 비율 합(%)
  exposureAlpha: number; exposureBeta: number; exposureZeta: number;
  exposure: number;                 // 선택한 시나리오의 노출도
  feasibleExposure: number; usage: number;
  infraGap: number; skillGap: number; overUse: number;
  frontierSignal: number; frontierTasks: string[];
  autoShare: number | null;         // 활용 방식 응답 업무 중 자동화형 비중
  aeiCompare: { mine: number; global: number } | null;
  quadrant: Quadrant;
  stdShare: number; confidence: 'high' | 'mid' | 'low';
  recommendation: string;
  toolsUnknown: boolean; toolsNone: boolean;
  rows: ResearchTaskRow[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** F-22 지표 계산: 모든 지표는 입력한 업무 비율의 합을 100으로 다시 맞춘 가중치(w) 기준 */
export function researchDiagnosis(p: Profile, scenario: ExposureScenario = 'beta'): ResearchResult {
  const tasks = p.tasks.filter((t) => (t.share || 0) > 0);
  const total = sum(tasks.map((t) => t.share)) || 1;
  const rows: ResearchTaskRow[] = tasks.map((t) => {
    const e = eLevelOf(t);
    return {
      id: t.id, name: t.name, weight: t.share / total, share: t.share, e, source: eSourceLabel(t) as ResearchTaskRow['source'],
      feasible: feasibleOf(e, p.env), level: t.aiLevel, mode: modeOf(t), frontier: outsideFrontier(t), perception: perceptionOf(t),
      aei: isStd(t) && typeof t.aeiAutoShare === 'number' ? t.aeiAutoShare : null,
    };
  });
  const expo = (scn: ExposureScenario) => sum(rows.map((r) => r.weight * RESEARCH_E_SCORE[scn][r.e]));
  const S = RESEARCH_E_SCORE[scenario];
  const exposure = expo(scenario);
  const feasibleExposure = sum(rows.map((r) => r.weight * S[r.e] * r.feasible));
  const usage = sum(rows.map((r) => r.weight * LEVEL_PROFILE[r.level as 0 | 1 | 2 | 3 | 4].currentAiShare));
  const infraGap = Math.max(0, exposure - feasibleExposure);
  const skillGap = Math.max(0, feasibleExposure - usage);
  const overUse = Math.max(0, usage - feasibleExposure);
  const frontier = rows.filter((r) => r.frontier);
  const answered = rows.filter((r) => r.mode && r.mode !== 'none');
  const answeredW = sum(answered.map((r) => r.weight));
  const autoW = sum(answered.filter((r) => AI_MODE[r.mode as AiMode].group === 'auto').map((r) => r.weight));
  const autoShare = answeredW > 0 ? autoW / answeredW : null;
  const cmp = answered.filter((r) => r.aei !== null);
  const cmpW = sum(cmp.map((r) => r.weight));
  const aeiCompare = cmpW > 0 ? {
    mine: sum(cmp.filter((r) => AI_MODE[r.mode as AiMode].group === 'auto').map((r) => r.weight)) / cmpW,
    global: sum(cmp.map((r) => r.weight * (r.aei as number))) / cmpW,
  } : null;
  const xHigh = exposure >= QUADRANT.x, yHigh = usage >= QUADRANT.y;
  const quadrant: Quadrant = xHigh ? (yHigh ? 'spread' : 'priority') : (yHigh ? 'check' : 'watch');
  const stdShare = sum(rows.filter((r) => r.source === '연구 기준').map((r) => r.weight));
  const confidence = stdShare >= CONFIDENCE.high ? 'high' : stdShare >= CONFIDENCE.mid ? 'mid' : 'low';
  const tUnknown = toolsUnknown(p.env), tNone = toolsNone(p.env);

  let recommendation: string;
  if (tNone) recommendation = '쓸 수 있는 AI 도구가 없어요. 개인 교육보다 먼저 사내 생성형 AI·Copilot 사용 신청과 권한 요청을 팀장님과 상의해 보세요.';
  else if (infraGap > skillGap && infraGap > 0.02) recommendation = `연구상 가능한 업무 중 ${pct(infraGap)}는 지금 도구·권한으로는 어려워요. 개인 교육보다 도구 신청·권한 요청이 먼저예요. (팀장 보고용: "업무의 ${pct(infraGap)}가 도구·권한 부족으로 AI 활용이 막혀 있습니다.")`;
  else if (skillGap > 0.02) recommendation = autoShare !== null && autoShare >= AUTO_SHARE_HIGH
    ? `지금 도구로 더 쓸 수 있는 여지가 ${pct(skillGap)} 있어요. 이미 AI에 맡기는 편이니, 결과 검증과 함께 다듬는 습관으로 품질을 지켜 보세요.`
    : `지금 도구로 더 쓸 수 있는 여지가 ${pct(skillGap)} 있어요. 반복 업무를 AI에 맡기는 법(지시 작성, 업무 위임)을 실습해 보세요.`;
  else recommendation = '연구 기준으로 볼 때 지금 도구로 가능한 만큼 AI를 쓰고 있어요. 활용 사례를 팀과 나눠 보세요.';
  if (frontier.length) recommendation += ` 또한 '${frontier.map((r) => r.name).join("', '")}'은 사람 판단이 필요한 업무라 결과 검증 체크리스트를 꼭 함께 쓰세요.`;

  return {
    scenario, inputShare: total === 1 && tasks.length === 0 ? 0 : total,
    exposureAlpha: expo('alpha'), exposureBeta: expo('beta'), exposureZeta: expo('zeta'), exposure,
    feasibleExposure, usage, infraGap, skillGap, overUse,
    frontierSignal: sum(frontier.map((r) => r.weight)), frontierTasks: frontier.map((r) => r.name),
    autoShare, aeiCompare, quadrant, stdShare, confidence, recommendation,
    toolsUnknown: tUnknown, toolsNone: tNone, rows,
  };
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const CONFIDENCE_LABEL = { high: '높음', mid: '보통', low: '낮음(유형 추정 위주)' } as const;

/** 결과 한 문장 (예: "연구 기준으로는 업무의 52%가 …") */
export function researchSentence(r: ResearchResult): string {
  return `연구 기준으로는 업무의 ${pct(r.exposure)}가 AI로 단축 가능한데, 지금 회사 도구로 가능한 것은 ${pct(r.feasibleExposure)}, 실제 활용은 ${pct(r.usage)}입니다.`
    + (r.skillGap > 0.005 || r.infraGap > 0.005
      ? ` 차이 중 ${Math.round(r.skillGap * 100)}%p는 교육으로, ${Math.round(r.infraGap * 100)}%p는 도구·권한 개선으로 줄일 수 있습니다.` : '');
}
