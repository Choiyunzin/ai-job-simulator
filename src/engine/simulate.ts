// ─────────────────────────────────────────────
// 계산 엔진: 업무별 AI 도입 전·후 시간/품질/위험 계산
// UI와 완전히 분리된 순수 함수입니다.
// ─────────────────────────────────────────────
import {
  ENV, BASE_WEIGHTS, CRITERIA_WEIGHTS, EVENTS, LEVEL_PROFILE, NEUTRAL_LEVERS, OCCURRENCES_PER_WEEK,
  REDESIGN, SIM, TYPE_PROFILE,
} from './config';
import { frontierMult, taskPotential } from './research';
import type {
  ChoiceId, ComponentKey, WorkEnv, EventId, Levers, Overrides, Profile, RedesignToggle,
  ScenarioResult, Task, TaskResult,
} from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const safe = (v: number) => (Number.isFinite(v) ? v : 0);

const MULT_KEYS: (keyof Levers)[] = [
  'promptMult', 'verifyMult', 'reworkMult', 'residualErrorMult', 'waitMult',
  'approverLoadMult', 'volumeGrowthMult', 'maintenanceMult',
];
const ADD_KEYS: (keyof Levers)[] = ['setupAdd', 'coordinationAdd', 'qualityAdd', 'usageAdd'];

/** 여러 레버를 합칩니다. *Mult 는 곱하고 *Add 는 더합니다. */
export function combineLevers(...parts: Partial<Levers>[]): Levers {
  const out: Levers = { ...NEUTRAL_LEVERS };
  for (const p of parts) {
    for (const k of MULT_KEYS) if (p[k] !== undefined) out[k] *= p[k] as number;
    for (const k of ADD_KEYS) if (p[k] !== undefined) out[k] += p[k] as number;
  }
  return out;
}

export interface LeverSource { key: string; label: string; levers: Partial<Levers> }

/** 재설계 토글 + 상황 선택 → 레버 출처 목록 */
export function leverSources(
  toggles: Record<RedesignToggle, boolean>,
  choices: Partial<Record<EventId, ChoiceId>>,
): LeverSource[] {
  const list: LeverSource[] = [];
  (Object.keys(REDESIGN) as RedesignToggle[]).forEach((t) => {
    if (toggles[t]) list.push({ key: `toggle:${t}`, label: REDESIGN[t].title, levers: REDESIGN[t].levers });
  });
  (Object.keys(choices) as EventId[]).forEach((e) => {
    const c = choices[e];
    if (!c) return;
    const ch = EVENTS[e].choices[c];
    list.push({ key: `event:${e}`, label: `${EVENTS[e].title} → ${c}. ${ch.result}`, levers: ch.levers });
  });
  return list;
}

/** 일하는 환경 → 공통 배수 (계산 근거 화면에 그대로 노출) */
export interface EnvFactors {
  waitMult: number; approverMult: number; riskMult: number;
  maintMult: number; promptMult: number; errorMult: number; repetitiveBoost: number;
}
const READY_TOOLS = ['internalGpt', 'copilot', 'externalGenAI', 'automation'];
export function envFactors(env: WorkEnv | undefined): EnvFactors {
  if (!env) return { waitMult: 1, approverMult: 1, riskMult: 1, maintMult: 1, promptMult: 1, errorMult: 1, repetitiveBoost: 1 };
  const ready = env.tools.some((t) => READY_TOOLS.includes(t));
  const a = ENV.approval[env.approval], p = ENV.personalData[env.personalData];
  const c = ENV.culture[env.culture], l = ENV.learning[env.learning];
  return {
    waitMult: a.waitMult,
    approverMult: a.approverMult,
    riskMult: p.riskMult * (env.tools.includes('externalGenAI') && env.personalData === 'lots' ? ENV.externalWithPersonalRisk : 1),
    maintMult: c.maintMult * l.maintMult * (ready ? 1 : ENV.noToolMaintMult),
    promptMult: c.promptMult,
    errorMult: l.errorMult,
    repetitiveBoost: env.tools.includes('automation') ? ENV.automationBoost : 1,
  };
}
const NO_ENV = envFactors(undefined);

export function simulateTask(task: Task, L: Levers, ov: Partial<Record<ComponentKey, number>> = {}, E: EnvFactors = NO_ENV): TaskResult {
  const tp = TYPE_PROFILE[task.type];
  const lp = LEVEL_PROFILE[task.aiLevel];
  const h = Math.max(0, safe(task.hours));
  const occ = OCCURRENCES_PER_WEEK[task.frequency];
  const pick = (k: ComponentKey, v: number) => Math.max(0, safe(ov[k] ?? v));

  // ── AI 도입 전 (현재) ──
  const bDirect = pick('beforeDirect', h * (1 - tp.reviewShare));
  const bReview = pick('beforeReview', h * tp.reviewShare);
  const bLabor = bDirect + bReview;
  const bWait = pick('beforeWait', bLabor * tp.waitRatio * E.waitMult);
  const bApprover = bLabor * tp.approverRatio * E.approverMult;

  // ── 잠재력과 실제 대체율 ──
  // v2: 표준 Task는 자동화 상한 × 노출 계수, 직접 입력은 v1(자동화 상한 × 적용 가능성 배수)
  const potential = taskPotential(task, E.repetitiveBoost);
  const reduction = h > 0 ? clamp(potential * (1 - lp.alreadyCaptured), 0, SIM.maxReduction) : 0;
  const replaced = bDirect * reduction;
  const active = reduction > 0.02;

  // ── AI 도입 후: 기본값 → 사용자 조정값 → 재설계 레버 순으로 적용 ──
  const verifyRatio = tp.verifyRatio + (task.difficulty === 'verify' ? SIM.difficultyVerifyBonus : 0);
  // v2: AI가 잘 못하는 업무(E0)에 2단계 이상 활용하면 오류율 가산 (Dell'Acqua et al. 2023)
  const errorRate = lp.errorRate * E.errorMult * frontierMult(task);
  const prompt = pick('prompt', replaced * lp.promptRatio * E.promptMult) * L.promptMult;
  const manualDirect = pick('manualDirect', bDirect - replaced);
  const aiReview = pick('aiReview', replaced * verifyRatio) * L.verifyMult;
  const rework = pick('rework', replaced * errorRate * SIM.reworkCost) * L.reworkMult;
  const maintenance = pick('maintenance', active ? lp.maintenance * E.maintMult * Math.min(1, reduction / 0.3) : 0) * L.maintenanceMult;
  const aiGen = pick('aiGen', active ? (occ * SIM.aiGenMinutesPerOccurrence) / 60 : 0);
  const aWait = pick('afterWait', bWait * (1 + SIM.waitGrowthByReduction * reduction)) * L.waitMult;

  const aLabor = prompt + manualDirect + bReview + aiReview + rework + maintenance;
  const volumeGrowth = reduction * SIM.volumeGrowthByReduction * L.volumeGrowthMult;
  const extraVolumeLabor = Math.max(0, aLabor - maintenance) * volumeGrowth;
  const aApprover = bApprover * (1 + SIM.draftsGrowth * reduction) * (1 + volumeGrowth) * L.approverLoadMult;

  // ── 품질·위험 (시간과 별도 지표) ──
  const humanErr = 0.04;
  const bResidual = humanErr * (1 - SIM.verifyCoverage);
  const aResidual = (humanErr * (1 - reduction) + errorRate * reduction) * (1 - SIM.verifyCoverage) * L.residualErrorMult;
  const riskOf = (res: number) => clamp(res * 1200 * SIM.importanceRisk[task.importance] * E.riskMult, 0, 100);
  const bQuality = SIM.baseQuality;
  const aQuality = clamp(
    SIM.baseQuality + SIM.qualityGainByReduction * reduction - SIM.qualityLossByError * (aResidual - bResidual) + L.qualityAdd,
    0, 100,
  );
  const usage = clamp(SIM.baseUsage - SIM.usageDropByGrowth * volumeGrowth + L.usageAdd, 0, 100);

  return {
    task, potential, reduction, occurrencesPerWeek: occ,
    before: {
      direct: bDirect, review: bReview, wait: bWait, labor: bLabor,
      currentAiHours: bLabor * lp.currentAiShare, approver: bApprover,
      quality: bQuality, risk: riskOf(bResidual),
    },
    after: {
      prompt, aiGen, manualDirect, review: bReview + aiReview, aiReview, rework, maintenance,
      wait: aWait, labor: aLabor, volumeGrowth, extraVolumeLabor, approver: aApprover,
      residualError: aResidual, quality: aQuality, risk: riskOf(aResidual), usage,
    },
  };
}

export function simulate(profile: Profile, L: Levers, overrides: Overrides, label: string): ScenarioResult {
  const E = envFactors(profile.env);
  const tasks = profile.tasks.filter((t) => t.hours > 0).map((t) => simulateTask(t, L, overrides[t.id], E));
  const sum = (f: (r: TaskResult) => number) => tasks.reduce((s, r) => s + f(r), 0);
  const weight = (r: TaskResult) => r.before.labor * SIM.importanceWeight[r.task.importance];
  const wSum = sum(weight) || 1;
  const wAvg = (f: (r: TaskResult) => number) => sum((r) => f(r) * weight(r)) / wSum;

  const beforeLabor = sum((r) => r.before.labor);
  const afterLabor = sum((r) => r.after.labor);
  const extraVolumeLabor = sum((r) => r.after.extraVolumeLabor);
  const overhead = tasks.length ? L.setupAdd + L.coordinationAdd : 0;
  const actualLabor = afterLabor + extraVolumeLabor + overhead;
  const savedSameVolume = beforeLabor - afterLabor - overhead;
  const laborW = sum((r) => r.before.labor) || 1;

  return {
    label, tasks,
    totals: {
      beforeLabor, afterLabor, extraVolumeLabor, actualLabor, overhead,
      beforeWait: sum((r) => r.before.wait), afterWait: sum((r) => r.after.wait),
      beforeApprover: sum((r) => r.before.approver), afterApprover: sum((r) => r.after.approver),
      savedSameVolume,
      savingRate: beforeLabor > 0 ? (savedSameVolume / beforeLabor) * 100 : 0,
      volumeGrowth: (sum((r) => r.after.volumeGrowth * r.before.labor) / laborW) * 100,
      freeTime: beforeLabor - actualLabor,
      beforeQuality: wAvg((r) => r.before.quality), afterQuality: wAvg((r) => r.after.quality),
      beforeRisk: wAvg((r) => r.before.risk), afterRisk: wAvg((r) => r.after.risk),
      usage: wAvg((r) => r.after.usage),
      aiGen: sum((r) => r.after.aiGen),
    },
  };
}

/** 세 가지 비교 시나리오 */
export function runScenarios(
  profile: Profile, overrides: Overrides,
  toggles: Record<RedesignToggle, boolean>, choices: Partial<Record<EventId, ChoiceId>>,
) {
  const after = simulate(profile, NEUTRAL_LEVERS, overrides, 'AI 적용 후');
  const sources = leverSources(toggles, choices);
  const redesign = simulate(profile, combineLevers(...sources.map((s) => s.levers)), overrides, '업무 흐름 재설계 후');
  return { after, redesign, sources };
}

/** 각 재설계 선택이 결과에 기여한 정도(해당 선택을 뺐을 때와 비교) */
export function contributions(profile: Profile, overrides: Overrides, sources: LeverSource[]) {
  const all = simulate(profile, combineLevers(...sources.map((s) => s.levers)), overrides, 'all');
  return sources.map((s) => {
    const without = simulate(
      profile, combineLevers(...sources.filter((x) => x !== s).map((x) => x.levers)), overrides, 'without',
    );
    return {
      key: s.key, label: s.label,
      hours: without.totals.actualLabor - all.totals.actualLabor,
      quality: all.totals.afterQuality - without.totals.afterQuality,
      risk: without.totals.afterRisk - all.totals.afterRisk,
      wait: without.totals.afterWait - all.totals.afterWait,
    };
  }).map((c) => {
    const w = { ...BASE_WEIGHTS };
    profile.criteria.forEach((k) => {
      const cw = CRITERIA_WEIGHTS[k];
      (Object.keys(cw) as (keyof typeof w)[]).forEach((m) => { w[m] += cw[m] ?? 0; });
    });
    return { ...c, score: c.hours * w.hours + c.wait * w.wait + c.quality * w.quality + c.risk * w.risk };
  })
    .sort((a, b) => b.score - a.score);
}

/** 표시용 형식 */
export const fmtH = (v: number, d = 1) => `${(Math.round(v * 10 ** d) / 10 ** d).toFixed(d)}시간`;
export const fmtMin = (hours: number) => {
  const m = Math.round(hours * 60);
  if (m < 60) return `${m}분`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}시간 ${mm}분` : `${hh}시간`;
};
