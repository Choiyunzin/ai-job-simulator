// ─────────────────────────────────────────────
// 진단·개인화 로직: 유형 판정, TOP3, 병목, 상황 카드 추천, 리포트 문구
// ─────────────────────────────────────────────
import { APPLICABILITY_MULT, ARCHETYPES, ENV, EVENT_AFFINITY, LABELS, TYPE_PROFILE } from './config';
import { clamp, fmtH } from './simulate';
import type {
  ArchetypeId, Diagnosis, EventId, Profile, ScenarioResult, Task, TaskResult,
} from './types';

const docLike = new Set(['document', 'research', 'data']);

export function diagnose(profile: Profile, after: ScenarioResult): Diagnosis {
  const tasks = after.tasks;
  const totalHours = tasks.reduce((s, r) => s + r.task.hours, 0) || 0;
  const W = totalHours || 1;
  const wavg = (f: (t: Task) => number) => tasks.reduce((s, r) => s + f(r.task) * r.task.hours, 0) / W;

  const avgLevel = wavg((t) => t.aiLevel);
  const avgPotential = wavg((t) => clamp(TYPE_PROFILE[t.type].automation * APPLICABILITY_MULT[t.applicability], 0, 0.9));
  const share = (pred: (t: Task) => boolean) => tasks.filter((r) => pred(r.task)).reduce((s, r) => s + r.task.hours, 0) / W;

  const highLevelShare = share((t) => t.aiLevel >= 3);
  const levelTypes = new Set(tasks.filter((r) => r.task.aiLevel >= 3).map((r) => r.task.type)).size;
  const docShareUsed = share((t) => docLike.has(t.type) && t.aiLevel >= 1 && t.aiLevel <= 3);
  const verifyBurden = share((t) => t.type === 'review' || t.difficulty === 'verify' || t.importance === 'high');
  const qualityConcerns = profile.concerns.filter((c) => ['hallucination', 'lowQuality', 'security', 'moreReview'].includes(c)).length;
  const qualityCriteria = profile.criteria.filter((c) => c === 'quality' || c === 'error').length;

  // 네 유형 점수 (0~100) — 결과 화면 '계산 근거'에 그대로 노출
  const scores: Record<ArchetypeId, number> = {
    explorer: clamp(avgPotential * 100 * (1 - avgLevel / 4) * 1.6, 0, 100),
    partner: clamp(100 - Math.abs(avgLevel - 2) * 40 - (1 - docShareUsed) * 25, 0, 100),
    orchestrator: clamp(highLevelShare * 80 + (levelTypes >= 2 ? 15 : 0) + (tasks.some((r) => r.task.aiLevel === 4) ? 10 : 0), 0, 100),
    guardian: clamp(verifyBurden * 45 + qualityConcerns * 9 + qualityCriteria * 12 + (profile.env?.personalData === 'lots' ? 10 : 0), 0, 100),
  };
  const archetype = (Object.keys(scores) as ArchetypeId[]).reduce((a, b) => (scores[b] > scores[a] ? b : a), 'explorer');

  // 잠재력 TOP3 = AI 도입 시 동일 업무량 기준 절감 시간
  const saved = (r: TaskResult) => r.before.labor - r.after.labor;
  const topTasks = [...tasks]
    .sort((a, b) => saved(b) - saved(a))
    .slice(0, 3)
    .map((r) => ({ id: r.task.id, name: r.task.name || '이름 없는 업무', savedHours: saved(r), reduction: r.reduction }));

  // 병목 후보 — 실제 계산된 시간이 큰 순서
  const t = after.totals;
  const sumA = (f: (r: TaskResult) => number) => tasks.reduce((s, r) => s + f(r), 0);
  const lowHours = tasks.filter((r) => r.task.applicability === 'low' || r.task.type === 'communication').reduce((s, r) => s + r.task.hours, 0);
  const bottlenecks = [
    { key: 'verify', label: '검토·검증 부담', hours: sumA((r) => r.after.aiReview + r.after.rework),
      desc: 'AI 결과를 확인하고 고치는 시간' },
    { key: 'wait', label: '승인 대기 증가', hours: Math.max(0, t.afterWait - t.beforeWait),
      desc: '초안이 빨라져 승인 대기열이 길어지는 시간(경과시간)' },
    { key: 'volume', label: '요청량 증가', hours: t.extraVolumeLabor,
      desc: '빨라진 만큼 늘어나는 추가 요청 처리 시간' },
    { key: 'maintenance', label: '도구 학습·유지관리', hours: sumA((r) => r.after.maintenance + r.after.prompt),
      desc: '프롬프트 작성과 도구 관리에 드는 시간' },
    { key: 'judgment', label: '사람 판단 의존 업무', hours: lowHours * 0.3,
      desc: '맥락·관계·책임이 핵심이라 AI로 줄기 어려운 시간' },
  ].sort((a, b) => b.hours - a.hours).slice(0, 2);

  // 첫 실험 업무: 절감 효과 × 검증 용이성 × 위험 낮음
  const expScore = (r: TaskResult) =>
    saved(r) * (r.task.importance === 'high' ? 0.75 : 1.1) * (1 - TYPE_PROFILE[r.task.type].verifyRatio)
    * (r.task.applicability === 'low' ? 0.5 : 1);
  const best = [...tasks].sort((a, b) => expScore(b) - expScore(a))[0];
  const firstExperiment = best && saved(best) > 0.05
    ? {
      id: best.task.id, name: best.task.name || '이름 없는 업무',
      reason: `주 ${fmtH(saved(best))} 절감 가능성이 있고 ${best.task.importance === 'high' ? '중요도가 높아 검증 단계를 꼭 넣어야 하지만' : '중요도가 상대적으로 낮아'} 시도해보기 좋습니다.`,
    }
    : null;

  // 유형 문장(입력값에 따라 달라짐)
  const A = ARCHETYPES[archetype];
  const top = topTasks[0];
  const bn = bottlenecks[0];
  const levelWord = avgLevel < 1 ? '아직 AI 활용이 적지만' : avgLevel < 2.5 ? '개별 업무에서 AI를 활용하고 있지만' : '업무 흐름에 AI를 꽤 깊이 연결했지만';
  const sentence = `당신은 ${A.name}형입니다. ${levelWord}, '${top?.name ?? '주요 업무'}'에서 가장 큰 개선 여지가 보입니다. `
    + (bn ? `다만 '${bn.label}'(주 약 ${fmtH(bn.hours)})을 함께 설계하지 않으면 절감 효과가 줄어들 수 있습니다.` : '');

  const factors = [
    { label: '가중 평균 AI 활용 수준', value: `${avgLevel.toFixed(1)} / 4` },
    { label: '가중 평균 AI 적용 잠재력', value: `${Math.round(avgPotential * 100)}%` },
    { label: '3단계 이상 활용 업무 비중', value: `${Math.round(highLevelShare * 100)}%` },
    { label: '검증 부담 업무 비중(검토형·검증 어려움·중요도 높음)', value: `${Math.round(verifyBurden * 100)}%` },
    { label: '품질·정확성 관련 우려 개수', value: `${qualityConcerns}개` },
    { label: '개인정보를 많이 다루는 환경(품질 수호자 +10)', value: profile.env?.personalData === 'lots' ? '예' : '아니요' },
  ];

  return { archetype, scores, totalHours, avgLevel, avgPotential, topTasks, bottlenecks, firstExperiment, sentence, factors };
}

/** 상황 카드 개인화: 우려사항·업무유형·성공기준·어려움·일하는 환경이 맞을수록 점수가 높음 */
export function rankEvents(profile: Profile): { id: EventId; score: number; reasons: string[] }[] {
  const hours = (pred: (t: Task) => boolean) => profile.tasks.filter(pred).reduce((s, t) => s + t.hours, 0);
  const total = hours(() => true) || 1;
  return (Object.keys(EVENT_AFFINITY) as EventId[]).map((id) => {
    const a = EVENT_AFFINITY[id];
    const reasons: string[] = [];
    let score = 0;
    profile.concerns.forEach((c) => { if (a.concerns.includes(c)) { score += 3; reasons.push(`우려: ${LABELS.concerns[c]}`); } });
    profile.criteria.forEach((c) => { if (a.criteria.includes(c)) { score += 1.5; reasons.push(`성공 기준: ${LABELS.criteria[c]}`); } });
    const typeShare = hours((t) => a.types.includes(t.type)) / total;
    score += typeShare * 4;
    if (typeShare > 0.3) reasons.push(`관련 업무 비중 ${Math.round(typeShare * 100)}%`);
    const diff = profile.tasks.filter((t) => a.difficulty.includes(t.difficulty)).length;
    score += diff;
    if (diff) reasons.push(`관련 어려움 ${diff}건`);
    const env = profile.env;
    if (env) {
      if (id === 'approval' && env.approval === 'multi') { score += 2.5; reasons.unshift('승인이 2단계 이상'); }
      if (id === 'error' && env.personalData === 'lots') { score += 1; reasons.push('개인정보를 많이 다룸'); }
      if (id === 'copytrap' && env.culture === 'solo') { score += 1; reasons.push('AI를 주로 혼자 사용'); }
      if (id === 'demand' && env.culture === 'team') { score += 1; reasons.push('팀이 함께 AI 사용'); }
    }
    return { id, score, reasons };
  }).sort((x, y) => y.score - x.score);
}

/** '한 번 더 도전하기'용 상황 조합: 개인화 순위 기반으로 겹치지 않게 순환 */
export function eventPairs(ranked: EventId[]): [EventId, EventId][] {
  const [a, b, c, d] = ranked;
  return [[a, b], [c, d], [a, c], [b, d], [a, d], [b, c]];
}

/** 품질·보안 주의사항: 우려사항과 업무 유형에서 도출 */
export function cautions(profile: Profile): string[] {
  const out: string[] = [];
  const types = new Set(profile.tasks.map((t) => t.type));
  const env = profile.env;
  if (env && !env.tools.some((t) => ['internalGpt', 'copilot', 'externalGenAI', 'automation'].includes(t)))
    out.push('먼저 회사가 허용한 AI 도구와 사용 범위를 확인하세요. 허용되지 않은 외부 서비스에 업무 자료를 올리면 안 됩니다.');
  if (env?.tools.includes('externalGenAI'))
    out.push('외부 생성형 AI에는 사내 기밀, 미공개 계획, 개인정보를 입력하지 마세요.');
  if (profile.concerns.includes('security') || env?.personalData !== 'none' || types.has('data'))
    out.push('교육생·임직원 이름, 사번, 연락처는 지우거나 가명으로 바꾼 뒤 AI에 입력하고, 회사가 허용한 도구만 사용하세요.');
  if (profile.concerns.includes('hallucination') || types.has('research') || types.has('data'))
    out.push('AI가 쓴 수치·인용·출처는 원자료와 대조해 확인하세요. 핵심 숫자 3개만 정해 매번 확인하는 것도 방법입니다.');
  if (profile.concerns.includes('lowQuality') || types.has('document'))
    out.push('초안 품질 기준(목적, 대상, 분량, 톤)을 먼저 적어두고 AI 결과물을 그 기준으로 평가하세요.');
  if (profile.concerns.includes('judgment') || types.has('review'))
    out.push('승인과 최종 판단은 사람이 합니다. AI 결과를 근거로 결정했다면 결정 사유를 기록하세요.');
  if (profile.concerns.includes('learningCost'))
    out.push('잘 된 프롬프트는 팀 공용 문서에 모아 재사용하면 학습·관리 시간이 줄어듭니다.');
  if (out.length < 2) out.push('AI 결과물을 외부로 보내기 전에 사람이 마지막으로 한 번 읽어보세요.');
  return out.slice(0, 4);
}

/** 다음 주에 해볼 작은 실험 */
export function nextExperiment(task: Task | undefined, profile?: Profile): string {
  const tool = profile?.env?.tools.find((t) => ['internalGpt', 'copilot', 'externalGenAI', 'automation'].includes(t));
  const withTool = tool ? ` (${ENV.tools[tool].split(' (')[0]} 활용)` : '';
  return baseExperiment(task) + withTool;
}

function baseExperiment(task: Task | undefined): string {
  if (!task) return '반복되는 업무 하나를 골라, 다음 주에 AI로 초안을 만들고 걸린 시간을 기록해 보세요.';
  const n = `'${task.name || '선택한 업무'}'`;
  const map: Record<string, string> = {
    research: `${n} 1건에서 AI에게 자료 탐색·요약을 맡기고, 출처 3개를 직접 확인하는 데 걸린 시간까지 기록해 보세요.`,
    document: `${n} 1건을 AI 초안으로 시작하고, 수정 전·후를 비교해 고친 부분이 몇 군데인지 세어 보세요.`,
    data: `${n} 1건에서 AI에게 응답 분류 초안을 맡기고, 핵심 수치 3개만 원자료와 대조해 보세요.`,
    idea: `${n} 회의 전에 AI로 아이디어 20개를 뽑고, 그중 쓸 만한 것이 몇 개였는지 세어 보세요.`,
    communication: `${n} 중 공지·안내문 1건만 AI로 초안을 쓰고, 문의가 줄었는지 확인해 보세요.`,
    review: `${n}에 쓸 검토 체크리스트를 AI와 함께 만들고, 1건에 적용해 놓친 항목이 있는지 확인해 보세요.`,
    repetitive: `${n} 절차를 단계별로 적어보고, 그중 한 단계만 자동화했을 때 걸리는 시간을 재보세요.`,
    other: `${n} 1건을 AI 초안으로 시작하고 기존 방식과 걸린 시간을 비교해 보세요.`,
  };
  return map[task.type];
}
