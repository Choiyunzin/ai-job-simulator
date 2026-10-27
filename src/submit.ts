// 결과 제출: Power Automate 'HTTP 요청을 받았을 때' 흐름으로 익명 결과를 보내 SharePoint 엑셀에 쌓습니다.
// 제출 주소·키는 HTML 맨 위 '결과 제출 설정' 칸(window.SUBMIT_URL, window.SUBMIT_KEY)에서 읽습니다.
// 이름·사번은 보내지 않습니다. 연차는 구간으로만 보냅니다.
import type { AppState } from './state';
import type { buildReport } from './report';

declare global { interface Window { SUBMIT_URL?: string; SUBMIT_KEY?: string } }

type Report = ReturnType<typeof buildReport>;
export const SUBMIT_SCHEMA_VERSION = '1';

export const submitUrl = () => {
  const u = typeof window.SUBMIT_URL === 'string' ? window.SUBMIT_URL.trim() : '';
  return /^https:\/\//i.test(u) ? u : '';
};

const CLIENT_KEY = 'ai-job-simulator:client-id';
const LAST_KEY = 'ai-job-simulator:last-submit';
const rid = () => (globalThis.crypto && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** 이 브라우저의 익명 ID (같은 사람의 재제출을 구분하는 용도, 개인 식별 정보 아님) */
function clientId(): string {
  try {
    const v = localStorage.getItem(CLIENT_KEY);
    if (v) return v;
    const n = rid(); localStorage.setItem(CLIENT_KEY, n); return n;
  } catch { return 'unknown'; }
}

export function lastSubmit(): { id: string; at: string } | null {
  try { const v = localStorage.getItem(LAST_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

export const yearsBand = (y: number | null | undefined): string => {
  if (y === null || y === undefined) return '';
  if (y < 1) return '1년 미만';
  if (y <= 3) return '1~3년';
  if (y <= 9) return '4~9년';
  if (y <= 19) return '10~19년';
  return '20년 이상';
};

const pct = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 1000) / 10 : null);

/** 엑셀 '응답' 표 1줄 + '업무' 표 여러 줄에 그대로 대응하는 평평한 구조 */
export function buildSubmission(s: AppState, r: Report) {
  const p = s.profile;
  const path = p.jobPath.length === 4 ? p.jobPath : ['', '', '', r.job];
  const by = (h: number) => r.savedHoursByBasis.find((b) => b.weeklyHours === h);
  const submissionId = rid();
  return {
    schemaVersion: SUBMIT_SCHEMA_VERSION,
    key: typeof window.SUBMIT_KEY === 'string' ? window.SUBMIT_KEY : '',
    submissionId,
    clientId: clientId(),
    submittedAt: new Date().toISOString(),
    dataVersion: r.dataVersion.taskMaster ?? '',
    // 직무·경력 (이름·사번 없음)
    jobGroup: path[0], jobType: path[1], jobSeries: path[2], job: path[3],
    rank: p.career.rank, position: p.career.position, payGrade: p.career.payGrade, yearsBand: yearsBand(p.career.years),
    // 진단·시뮬레이션 결과
    archetype: r.archetype,
    weeklyHours: p.weeklyHours,
    saved40: by(40)?.redesign ?? null,
    saved52: by(52)?.redesign ?? null,
    savingRatePct: r.totals.savingRatePct,
    reinvestableHours: r.totals.reinvestableHours,
    qualityAfter: r.totals.qualityAfter,
    riskAfter: r.totals.riskAfter,
    // 글로벌 연구 기준 진단 (% 단위)
    exposurePct: pct(r.research.exposureBeta),
    feasiblePct: pct(r.research.feasibleExposure),
    usagePct: pct(r.research.usage),
    skillGapPct: pct(r.research.skillGap),
    infraGapPct: pct(r.research.infraGap),
    autoSharePct: pct(r.research.autoShare),
    quadrant: r.research.quadrant,
    confidence: r.research.confidence,
    // 역할 진단·환경·선택
    roleStrengths: r.roleStrengths.join(' | '),
    roleGaps: r.roleGaps.join(' | '),
    roleScores: r.roles.filter((x) => x.score !== null).map((x) => `${x.role}:${x.score}`).join(' | '),
    approval: r.workEnv.approval,
    personalData: r.workEnv.personalData,
    aiTools: r.workEnv.aiTools.join(' | '),
    teamCulture: r.workEnv.teamCulture,
    learningTime: r.workEnv.weeklyLearningTime,
    redesignToggles: r.redesignToggles.join(' | '),
    mostEffective: r.mostEffective ?? '',
    // 자유 의견 (선택)
    aiWish: r.myStory.aiWish,
    tips: r.myStory.tips,
    taskCount: r.tasks.length,
    tasks: r.tasks.map((t, i) => ({
      submissionId,
      seq: i + 1,
      name: t.name,
      sharePct: t.sharePct,
      taskId: t.taskId ?? '',
      eLevel: t.eLevel,
      eSource: t.eSource,
      type: t.type,
      frequency: t.frequency,
      importance: t.importance,
      aiLevel: t.aiLevel,
      aiMode: t.aiMode,
      applicability: t.applicability,
      perception: t.perception ?? '',
      beforeHours: t.beforeHours,
      redesignHours: t.redesignHours,
      reductionPct: t.reductionPct,
    })),
  };
}
export type Submission = ReturnType<typeof buildSubmission>;

export type SendResult = { ok: true; confirmed: boolean } | { ok: false; reason: string };

/**
 * 전송: 'text/plain'으로 보내 브라우저의 사전 확인(CORS preflight)을 피합니다.
 * 흐름이 Access-Control-Allow-Origin 헤더를 돌려주면 접수 확인까지 하고,
 * 응답을 읽을 수 없는 환경이면 확인 없이 보내는 방식(no-cors)으로 한 번 더 시도합니다.
 */
export async function sendSubmission(url: string, payload: Submission): Promise<SendResult> {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
  try {
    const res = await fetch(url, { method: 'POST', headers, body });
    if (res.ok) { remember(payload); return { ok: true, confirmed: true }; }
    return { ok: false, reason: `접수 서버가 ${res.status} 응답을 보냈어요.` };
  } catch {
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers, body });
      remember(payload);
      return { ok: true, confirmed: false };
    } catch {
      return { ok: false, reason: '네트워크에 연결할 수 없어요. 사내망 연결을 확인해 주세요.' };
    }
  }
}

function remember(p: Submission) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ id: p.submissionId, at: p.submittedAt })); } catch { /* 무시 */ }
}
