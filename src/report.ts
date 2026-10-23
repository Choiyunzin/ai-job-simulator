// 결과 리포트 데이터(JSON/CSV/텍스트 내보내기용)
import { ARCHETYPES, ENV, EVENTS, LABELS, REDESIGN, REINVEST } from './engine/config';
import { cautions, nextExperiment } from './engine/diagnose';
import type { EventId, RedesignToggle } from './engine/types';
import { careerLabel, jobLabel } from './jobCatalog';
import { currentRoles, readRoles, roleSummary } from './roleCatalog';
import { ROLE_SCALE } from './engine/config';
import { savingsSentence } from './components/WorkweekSim';
import type { AppState } from './state';
import type { useResults } from './useResults';

type Res = ReturnType<typeof useResults>;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildReport(s: AppState, res: Res) {
  const { after, redesign, dx, contrib, bands } = res;
  const T = redesign.totals;
  const items = REINVEST[s.profile.job === 'edu' ? 'edu' : 'general'];
  const expTask = s.profile.tasks.find((t) => t.id === dx.firstExperiment?.id) ?? s.profile.tasks[0];
  return {
    generatedAt: new Date().toLocaleString('ko-KR'),
    note: '가정에 기반한 교육용 추정치입니다.',
    job: jobLabel(s.profile),
    career: {
      rank: s.profile.career.rank || null,
      position: s.profile.career.position || null,
      payGrade: s.profile.career.payGrade || null,
      years: s.profile.career.years,
      label: careerLabel(s.profile),
    },
    weeklyHours: s.profile.weeklyHours,
    savingsSummary: savingsSentence(bands),
    savedHoursByBasis: bands.map((b) => ({ weeklyHours: b.base, aiOnly: r2(b.aiSaved), redesign: r2(b.redesignSaved) })),
    workEnv: {
      approval: ENV.approval[s.profile.env.approval].title,
      personalData: ENV.personalData[s.profile.env.personalData].title,
      aiTools: s.profile.env.tools.map((t) => ENV.tools[t]),
      teamCulture: ENV.culture[s.profile.env.culture].title,
      weeklyLearningTime: ENV.learning[s.profile.env.learning].title,
    },
    myStory: { aiWish: s.profile.notes.pain.trim(), tips: s.profile.notes.tips.trim() },
    archetype: ARCHETYPES[dx.archetype].name,
    archetypeScores: Object.fromEntries(Object.entries(dx.scores).map(([k, v]) => [ARCHETYPES[k as keyof typeof ARCHETYPES].name, r2(v)])),
    summary: dx.sentence,
    topTasks: dx.topTasks.map((t) => ({ name: t.name, savedHoursPerWeek: r2(t.savedHours) })),
    roles: currentRoles(s.profile, readRoles()).map((x) => ({
      role: x.role, group: x.group === 'job' ? '직무 역할' : x.group === 'leader' ? '리더 역할' : '직접 추가',
      score: x.score, level: x.score ? ROLE_SCALE[x.score - 1] : null,
    })),
    roleStrengths: roleSummary(currentRoles(s.profile, readRoles())).strengths.map((x) => x.role),
    roleGaps: roleSummary(currentRoles(s.profile, readRoles())).gaps.map((x) => x.role),
    bottlenecks: dx.bottlenecks.map((b) => ({ name: b.label, hoursPerWeek: r2(b.hours) })),
    totals: {
      beforeHours: r2(T.beforeLabor),
      afterAiHours: r2(after.totals.afterLabor),
      redesignHours: r2(T.afterLabor + T.overhead),
      savedHoursSameVolume: r2(T.savedSameVolume),
      savingRatePct: r2(T.savingRate),
      extraVolumeHours: r2(T.extraVolumeLabor),
      volumeGrowthPct: r2(T.volumeGrowth),
      reinvestableHours: r2(T.freeTime),
      waitHoursBefore: r2(T.beforeWait), waitHoursAfter: r2(T.afterWait),
      qualityBefore: r2(T.beforeQuality), qualityAfter: r2(T.afterQuality),
      riskBefore: r2(T.beforeRisk), riskAfter: r2(T.afterRisk),
    },
    tasks: redesign.tasks.map((r, i) => {
      const a = after.tasks[i];
      return {
        name: r.task.name, sharePct: r.task.share, type: LABELS.type[r.task.type], frequency: LABELS.frequency[r.task.frequency],
        importance: LABELS.importance[r.task.importance], aiLevel: r.task.aiLevel,
        applicability: LABELS.applicability[r.task.applicability].title,
        beforeHours: r2(r.before.labor), afterAiHours: r2(a.after.labor), redesignHours: r2(r.after.labor),
        reductionPct: r2(r.reduction * 100), qualityAfter: r2(r.after.quality), riskAfter: r2(r.after.risk),
      };
    }),
    redesignToggles: (Object.keys(REDESIGN) as RedesignToggle[]).filter((t) => s.toggles[t]).map((t) => REDESIGN[t].title),
    eventChoices: (Object.keys(s.choices) as EventId[]).map((e) => ({
      event: EVENTS[e].title, choice: s.choices[e], action: EVENTS[e].choices[s.choices[e]!].text,
    })),
    mostEffective: contrib[0] ? contrib[0].label : null,
    reinvest: items.map((it) => ({ activity: it.label, hours: s.reinvest[it.key] ?? 0 })),
    nextExperiment: nextExperiment(expTask, s.profile),
    cautions: cautions(s.profile),
  };
}

type Report = ReturnType<typeof buildReport>;

const esc = (v: unknown) => {
  const t = String(v ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function toCSV(r: Report): string {
  const lines: string[] = [];
  lines.push('구분,항목,값');
  lines.push(`기본,직무,${esc(r.job)}`);
  lines.push(`기본,직급,${esc(r.career.rank ?? '')}`);
  lines.push(`기본,직책,${esc(r.career.position ?? '')}`);
  lines.push(`기본,Pay Grade,${esc(r.career.payGrade ?? '')}`);
  lines.push(`기본,연차,${r.career.years ?? ''}`);
  lines.push(`요약,AI 업무 유형,${esc(r.archetype)}`);
  r.roles.forEach((x) => lines.push(`역할 진단(${esc(x.group)}),${esc(x.role)},${x.score ?? ''}`));
  const tl: [string, number][] = [
    ['AI 도입 전 주당 시간', r.totals.beforeHours], ['AI 도입 후 주당 시간', r.totals.afterAiHours],
    ['재설계 후 주당 시간', r.totals.redesignHours], ['순절감 시간', r.totals.savedHoursSameVolume],
    ['절감률(%)', r.totals.savingRatePct], ['늘어난 요청 처리 시간', r.totals.extraVolumeHours],
    ['재투자 가능 시간', r.totals.reinvestableHours], ['품질 점수(후)', r.totals.qualityAfter], ['위험 점수(후)', r.totals.riskAfter],
  ];
  tl.forEach(([k, v]) => lines.push(`요약,${esc(k)},${v}`));
  r.savedHoursByBasis.forEach((b) => lines.push(`요약,${esc(`주 ${b.weeklyHours}시간 기준 절감 시간(재설계)`)},${b.redesign}`));
  lines.push(`환경,승인 방식,${esc(r.workEnv.approval)}`);
  lines.push(`환경,개인정보 포함,${esc(r.workEnv.personalData)}`);
  lines.push(`환경,사용 가능한 AI 도구,${esc(r.workEnv.aiTools.join(' / '))}`);
  lines.push(`환경,팀의 AI 활용,${esc(r.workEnv.teamCulture)}`);
  lines.push(`환경,주당 AI 학습 시간,${esc(r.workEnv.weeklyLearningTime)}`);
  if (r.myStory.aiWish) lines.push(`나의 이야기,AI로 덜고 싶은 고민,${esc(r.myStory.aiWish)}`);
  if (r.myStory.tips) lines.push(`나의 이야기,활용 팁,${esc(r.myStory.tips)}`);
  lines.push('');
  lines.push('업무명,업무 비율(%),유형,빈도,중요도,AI 활용 단계,적용 가능성,도입 전(h),AI 도입 후(h),재설계 후(h),대체율(%),품질,위험');
  r.tasks.forEach((t) => lines.push([t.name, t.sharePct, t.type, t.frequency, t.importance, t.aiLevel, t.applicability,
    t.beforeHours, t.afterAiHours, t.redesignHours, t.reductionPct, t.qualityAfter, t.riskAfter].map(esc).join(',')));
  lines.push('');
  lines.push('상황,선택,대응');
  r.eventChoices.forEach((e) => lines.push([e.event, e.choice, e.action].map(esc).join(',')));
  lines.push('');
  lines.push('재투자 활동,시간');
  r.reinvest.forEach((x) => lines.push(`${esc(x.activity)},${x.hours}`));
  return lines.join('\n');
}

export function toText(r: Report): string {
  return [
    `■ 나의 AI 업무혁신 리포트 (${r.job}${r.career.label ? ` · ${r.career.label}` : ''})`,
    `유형: ${r.archetype}`,
    r.summary,
    '',
    `· ${r.savingsSummary} (업무 흐름 재설계 반영, 같은 업무량)`,
    `· [주 ${r.weeklyHours}시간 근무 기준] AI 도입 전 ${r.totals.beforeHours}h → AI 도입 후 ${r.totals.afterAiHours}h → 재설계 후 ${r.totals.redesignHours}h (주당, 같은 업무량)`,
    `· 순절감 ${r.totals.savedHoursSameVolume}h (${r.totals.savingRatePct}%), 늘어난 요청 처리 ${r.totals.extraVolumeHours}h, 재투자 가능 ${r.totals.reinvestableHours}h`,
    `· 품질 ${r.totals.qualityBefore}→${r.totals.qualityAfter}점, 위험 ${r.totals.riskBefore}→${r.totals.riskAfter}점`,
    ...(r.roles.some((x) => x.score) ? [
      `· 강점 역할: ${r.roleStrengths.join(', ') || '없음'}`,
      `· 보완이 필요한 역할: ${r.roleGaps.join(', ') || '없음'}`,
    ] : []),
    `· 잠재력 TOP3: ${r.topTasks.map((t) => t.name).join(', ')}`,
    `· 병목 TOP2: ${r.bottlenecks.map((b) => b.name).join(', ')}`,
    `· 가장 효과적인 선택: ${r.mostEffective ?? '없음'}`,
    `· 다음 주 실험: ${r.nextExperiment}`,
    `· 주의사항: ${r.cautions.join(' / ')}`,
    `· 일하는 환경: 승인 ${r.workEnv.approval}, 개인정보 ${r.workEnv.personalData}, 도구 ${r.workEnv.aiTools.join('·') || '미선택'}, 팀 활용 ${r.workEnv.teamCulture}`,
    ...(r.myStory.aiWish ? [`· AI로 덜고 싶은 고민: ${r.myStory.aiWish}`] : []),
    ...(r.myStory.tips ? [`· 나의 활용 팁: ${r.myStory.tips}`] : []),
    '',
    `(${r.note} ${r.generatedAt})`,
  ].join('\n');
}
