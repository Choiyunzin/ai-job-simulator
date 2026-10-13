// ─────────────────────────────────────────────
// 가상 기본값(설정 객체)
// 시뮬레이션의 모든 가정은 이 파일 한 곳에 모여 있습니다.
// 숫자를 바꾸면 화면의 결과와 '계산 근거'가 함께 바뀝니다.
// ─────────────────────────────────────────────
import type {
  AiLevel, AiTool, Applicability, ApprovalSteps, LearningTime, PersonalData, TeamCulture, Concern, Criterion, Difficulty, EventId, ChoiceId,
  Frequency, Importance, JobId, Levers, RedesignToggle, TaskType,
} from './types';

export const LABELS = {
  job: {
    edu: '교육기획·교육운영', hr: '인사·조직문화', strategy: '경영기획·전략',
    marketing: '마케팅·홍보', sales: '영업·고객관리', finance: '재무·회계',
    it: 'IT·데이터', admin: '일반 사무·지원', other: '기타',
  } as Record<JobId, string>,
  frequency: {
    daily: '매일', twice: '주 2~3회', weekly: '주 1회', monthly: '월 1~3회',
  } as Record<Frequency, string>,
  type: {
    research: '자료 조사·정보 수집', document: '문서 작성·요약', data: '데이터 분석·분류',
    idea: '아이디어 기획·문제 해결', communication: '사람과의 소통·조율',
    review: '검토·승인·품질관리', repetitive: '반복적인 시스템 입력·처리', other: '기타',
  } as Record<TaskType, string>,
  importance: { low: '낮음', mid: '보통', high: '높음' } as Record<Importance, string>,
  difficulty: {
    slow: '시간이 너무 오래 걸린다', findInfo: '자료를 찾고 정리하기 어렵다',
    verify: '결과물의 품질을 검증하기 어렵다', coordinate: '이해관계자와 조율하기 어렵다',
    repetitive: '반복 작업이 많다', expertise: '전문적인 판단이 필요하다',
  } as Record<Difficulty, string>,
  aiLevel: [
    { title: '0단계', desc: 'AI를 거의 사용하지 않는다' },
    { title: '1단계', desc: '가끔 질문하거나 아이디어를 얻는다' },
    { title: '2단계', desc: '초안 작성과 요약 등에 자주 사용한다' },
    { title: '3단계', desc: '내 업무 흐름에 맞춰 반복적으로 활용한다' },
    { title: '4단계', desc: '자동화나 여러 AI 도구 연결까지 활용한다' },
  ],
  applicability: {
    high: { title: '높음', desc: '규칙이 명확하고 반복적이며 결과를 검증하기 쉽다' },
    mid: { title: '보통', desc: '일부는 AI로 처리할 수 있지만 사람의 판단이 필요하다' },
    low: { title: '낮음', desc: '맥락 이해, 대인관계, 책임 있는 의사결정이 핵심이다' },
    unknown: { title: '잘 모르겠음', desc: '시뮬레이션을 통해 확인하고 싶다' },
  } as Record<Applicability, { title: string; desc: string }>,
  criteria: {
    time: '소요 시간 단축', quality: '결과물 품질 향상', error: '오류와 재작업 감소',
    volume: '더 많은 업무 처리', creative: '창의적인 기획에 집중',
    satisfaction: '교육생 또는 고객 만족도 향상', strategic: '전략적 업무에 집중할 시간 확보',
  } as Record<Criterion, string>,
  concerns: {
    hallucination: 'AI가 사실과 다른 내용을 생성하는 것',
    moreReview: '검토와 수정이 더 많아지는 것',
    noReduction: 'AI를 도입해도 업무량이 줄지 않는 것',
    security: '개인정보와 보안 문제',
    lowQuality: '결과물의 품질이 낮아지는 것',
    learningCost: 'AI를 배우고 관리하는 데 시간이 드는 것',
    judgment: '사람이 직접 판단해야 하는 일이 여전히 많은 것',
  } as Record<Concern, string>,
};

/** 일하는 환경(Q.G·Q.H) 선택지와 계산 배수 — 모든 업무에 공통 적용 */
export const ENV = {
  approval: {
    none: { title: '내가 확정해요', desc: '별도 승인 없이 내가 마무리', waitMult: 0.4, approverMult: 0.3 },
    one: { title: '팀장 1단계', desc: '팀장님 확인 후 확정', waitMult: 1, approverMult: 1 },
    multi: { title: '2단계 이상', desc: '팀장·임원 등 여러 단계 승인', waitMult: 1.6, approverMult: 1.4 },
  } as Record<ApprovalSteps, { title: string; desc: string; waitMult: number; approverMult: number }>,
  personalData: {
    none: { title: '거의 없어요', desc: '공개 자료·일반 문서 위주', riskMult: 0.9 },
    some: { title: '일부 있어요', desc: '명단·연락처가 가끔 섞임', riskMult: 1.0 },
    lots: { title: '많이 다뤄요', desc: '인사·평가·개인정보가 자주 포함', riskMult: 1.25 },
  } as Record<PersonalData, { title: string; desc: string; riskMult: number }>,
  culture: {
    solo: { title: '주로 혼자 써요', desc: '활용법을 각자 알아서 익힘', maintMult: 1.0, promptMult: 1.0 },
    some: { title: '몇몇이 공유해요', desc: '잘 쓰는 동료에게 묻거나 팁을 나눔', maintMult: 0.85, promptMult: 0.9 },
    team: { title: '팀이 함께 써요', desc: '공용 프롬프트·템플릿이 있음', maintMult: 0.7, promptMult: 0.8 },
  } as Record<TeamCulture, { title: string; desc: string; maintMult: number; promptMult: number }>,
  learning: {
    low: { title: '30분 이하', desc: '익힐 시간이 거의 없음', errorMult: 1.1, maintMult: 1.1 },
    mid: { title: '1시간 정도', desc: '틈틈이 새 기능을 시도', errorMult: 1.0, maintMult: 1.0 },
    high: { title: '2시간 이상', desc: '꾸준히 연습·학습 가능', errorMult: 0.85, maintMult: 0.9 },
  } as Record<LearningTime, { title: string; desc: string; errorMult: number; maintMult: number }>,
  tools: {
    internalGpt: '사내 생성형 AI (사내 GPT 등)',
    copilot: 'M365 Copilot',
    externalGenAI: '외부 생성형 AI (회사 허용 범위 내)',
    automation: '업무 자동화 도구 (Power Automate 등)',
    none: '쓸 수 있는 AI 도구가 없어요',
    unknown: '잘 모르겠어요',
  } as Record<AiTool, string>,
  noToolMaintMult: 1.3,      // 쓸 수 있는 도구가 없으면 도입 준비 시간이 더 듦
  automationBoost: 1.1,      // 자동화 도구가 있으면 반복 처리 업무 잠재력 가산
  externalWithPersonalRisk: 1.1, // 외부 AI + 개인정보 많음 → 위험 가산
};

/** 업무 빈도 → 주당 발생 건수 (건당 시간 환산용) */
export const OCCURRENCES_PER_WEEK: Record<Frequency, number> = {
  daily: 5, twice: 2.5, weekly: 1, monthly: 0.46,
};

/** 업무 유형별 가정치 */
export interface TypeProfile {
  automation: number;     // AI가 대체 가능한 직접작업 비율의 상한(잠재력)
  reviewShare: number;    // 현재 노동시간 중 검토·수정 비중
  waitRatio: number;      // 노동시간 대비 승인·대기 경과시간 비율
  verifyRatio: number;    // AI가 대신한 시간 1시간당 사람이 검토해야 하는 시간
  approverRatio: number;  // 노동시간 대비 승인자의 검토 시간
  recommended: Applicability; // '잘 모르겠음' 사용자를 위한 참고 추천값
  stepsBefore: string[];
  stepsAfter: string[];
}

export const TYPE_PROFILE: Record<TaskType, TypeProfile> = {
  research: {
    automation: 0.55, reviewShare: 0.15, waitRatio: 0.10, verifyRatio: 0.30, approverRatio: 0.05,
    recommended: 'mid',
    stepsBefore: ['검색 키워드 정리', '자료 탐색', '내용 읽고 발췌', '정리·요약', '검토 및 수정'],
    stepsAfter: ['AI가 자료 탐색·요약', '사람이 출처·사실 검증', '사람이 핵심 정리', '공유 및 승인'],
  },
  document: {
    automation: 0.60, reviewShare: 0.20, waitRatio: 0.25, verifyRatio: 0.20, approverRatio: 0.08,
    recommended: 'high',
    stepsBefore: ['자료 취합', '구성 잡기', '본문 작성', '서식 정리', '검토 및 수정'],
    stepsAfter: ['AI가 구성·초안 생성', '사람이 내용·톤 검증', '사람이 수정·보완', '최종 승인'],
  },
  data: {
    automation: 0.60, reviewShare: 0.20, waitRatio: 0.20, verifyRatio: 0.25, approverRatio: 0.06,
    recommended: 'high',
    stepsBefore: ['자료 수집', '응답 분류', '결과 분석', '보고서 작성', '검토 및 수정'],
    stepsAfter: ['AI가 자료를 분류', 'AI가 분석 초안 생성', '사람이 해석과 근거를 검증', '사람이 최종 보고서 승인'],
  },
  idea: {
    automation: 0.35, reviewShare: 0.15, waitRatio: 0.20, verifyRatio: 0.25, approverRatio: 0.08,
    recommended: 'mid',
    stepsBefore: ['문제 정의', '사례 조사', '아이디어 발산', '안 정리', '검토 및 수정'],
    stepsAfter: ['AI가 사례·아이디어 발산', '사람이 문제 정의·선별', '사람이 기획안 구체화', '협의 및 승인'],
  },
  communication: {
    automation: 0.15, reviewShare: 0.10, waitRatio: 0.30, verifyRatio: 0.25, approverRatio: 0.03,
    recommended: 'low',
    stepsBefore: ['요청 파악', '일정·의견 조율', '회의·통화', '결과 공유', '후속 확인'],
    stepsAfter: ['AI가 공지·회의록 초안', '사람이 조율·대화', '사람이 결과 확인', '공유'],
  },
  review: {
    automation: 0.20, reviewShare: 0.40, waitRatio: 0.15, verifyRatio: 0.35, approverRatio: 0.10,
    recommended: 'low',
    stepsBefore: ['검토 대상 확인', '기준 대조', '수정 의견 작성', '재검토', '승인'],
    stepsAfter: ['AI가 기준 대조 1차 점검', '사람이 핵심 쟁점 판단', '사람이 의견 확정', '승인'],
  },
  repetitive: {
    automation: 0.70, reviewShare: 0.10, waitRatio: 0.10, verifyRatio: 0.12, approverRatio: 0.03,
    recommended: 'high',
    stepsBefore: ['원자료 확인', '시스템 입력', '대사·확인', '오류 수정', '마감 처리'],
    stepsAfter: ['자동화가 입력·처리', '사람이 예외 건 확인', '사람이 대사 결과 승인'],
  },
  other: {
    automation: 0.35, reviewShare: 0.15, waitRatio: 0.15, verifyRatio: 0.25, approverRatio: 0.05,
    recommended: 'mid',
    stepsBefore: ['준비', '실행', '정리', '공유', '검토 및 수정'],
    stepsAfter: ['AI가 준비·초안', '사람이 실행·검증', '공유 및 승인'],
  },
};

/** 사용자가 고른 'AI 적용 가능성'이 잠재력에 곱해지는 값 */
export const APPLICABILITY_MULT: Record<Applicability, number> = {
  high: 1.15, mid: 0.85, low: 0.45, unknown: 0.8,
};

/** 현재 AI 활용 수준별 가정 */
export const LEVEL_PROFILE: Record<AiLevel, {
  alreadyCaptured: number;   // 잠재력 중 이미 실현한 비율 (남은 개선 여지 = 1 - 이 값)
  currentAiShare: number;    // 현재 노동시간 중 AI를 쓰는 시간 비율(추정)
  errorRate: number;         // AI 결과물 중 수정이 필요한 비율
  maintenance: number;       // 주당 도구 학습·설정·유지관리 시간 (업무 1개당, 대체율 30% 이상일 때 전액)
  promptRatio: number;       // 대체된 시간 대비 지시·프롬프트 작성 시간
}> = {
  0: { alreadyCaptured: 0.00, currentAiShare: 0.00, errorRate: 0.22, maintenance: 0.6, promptRatio: 0.15 },
  1: { alreadyCaptured: 0.10, currentAiShare: 0.05, errorRate: 0.18, maintenance: 0.5, promptRatio: 0.13 },
  2: { alreadyCaptured: 0.30, currentAiShare: 0.15, errorRate: 0.15, maintenance: 0.35, promptRatio: 0.11 },
  3: { alreadyCaptured: 0.50, currentAiShare: 0.25, errorRate: 0.12, maintenance: 0.25, promptRatio: 0.09 },
  4: { alreadyCaptured: 0.65, currentAiShare: 0.35, errorRate: 0.10, maintenance: 0.25, promptRatio: 0.08 },
};

/** 공통 계산 상수 */
export const SIM = {
  maxReduction: 0.8,          // 직접작업 대체율 상한
  reworkCost: 0.5,            // 오류 1건 수정에 드는 시간(원래 작업시간 대비)
  verifyCoverage: 0.7,        // 기본 검토가 잡아내는 오류 비율
  aiGenMinutesPerOccurrence: 3, // 건당 AI 생성 대기(경과시간, 분)
  waitGrowthByReduction: 0.5, // 초안이 빨라질수록 승인 대기열이 늘어나는 정도
  draftsGrowth: 0.3,          // 초안 수 증가에 따른 승인자 검토량 증가
  volumeGrowthByReduction: 0.3, // 절감된 만큼 추가 요청이 들어오는 정도
  baseQuality: 70,
  qualityGainByReduction: 15, // 반복 작업이 줄어든 만큼 품질에 쓰는 여유
  qualityLossByError: 120,    // 남은 오류율 1당 품질 하락
  baseUsage: 85,              // 현재 결과물 실제 활용률(%)
  usageDropByGrowth: 30,      // 제작량 증가에 따른 활용률 하락
  difficultyVerifyBonus: 0.1, // '품질 검증이 어렵다'를 고르면 검토 비율 가산
  importanceRisk: { low: 0.7, mid: 1.0, high: 1.4 } as Record<Importance, number>,
  importanceWeight: { low: 0.8, mid: 1.0, high: 1.3 } as Record<Importance, number>,
};

export const NEUTRAL_LEVERS: Levers = {
  promptMult: 1, verifyMult: 1, reworkMult: 1, residualErrorMult: 1,
  waitMult: 1, approverLoadMult: 1, volumeGrowthMult: 1, maintenanceMult: 1,
  setupAdd: 0, coordinationAdd: 0, qualityAdd: 0, usageAdd: 0,
};

/** 성공 기준(Q.E)에 따른 '가장 효과적인 선택' 평가 가중치 */
export const CRITERIA_WEIGHTS: Record<Criterion, Partial<{ hours: number; wait: number; quality: number; risk: number }>> = {
  time: { hours: 0.5, wait: 0.2 }, quality: { quality: 0.2 }, error: { risk: 0.15 },
  volume: { hours: 0.2 }, creative: { hours: 0.3 }, satisfaction: { quality: 0.1 }, strategic: { hours: 0.3 },
};
export const BASE_WEIGHTS = { hours: 1, wait: 0.3, quality: 0.1, risk: 0.05 };

/** STEP 4 '전체 업무 흐름 재설계' 토글 */
export const REDESIGN: Record<RedesignToggle, { title: string; desc: string; levers: Partial<Levers> }> = {
  checklist: {
    title: '검증 체크리스트 표준화',
    desc: '핵심 수치·출처만 정해진 순서로 확인',
    levers: { verifyMult: 0.8, residualErrorMult: 0.7, setupAdd: 0.15 },
  },
  tieredApproval: {
    title: '위험도별 승인 차등화',
    desc: '중요한 결과물만 승인자가 집중 검토',
    levers: { waitMult: 0.7, approverLoadMult: 0.75 },
  },
  promptLibrary: {
    title: '프롬프트·템플릿 라이브러리',
    desc: '잘 된 지시문을 재사용해 지시 시간 단축',
    levers: { promptMult: 0.6, maintenanceMult: 0.8, setupAdd: 0.1 },
  },
  selfService: {
    title: '요청 기준·셀프서비스',
    desc: '반복 요청은 요청자가 직접 해결',
    levers: { volumeGrowthMult: 0.6, setupAdd: 0.15 },
  },
};

/** STEP 5 상황 카드 — 선택지마다 명시적 레버 규칙 */
export interface EventCard {
  id: EventId;
  title: string;
  story: string;
  icon: string;
  choices: Record<ChoiceId, { text: string; result: string; levers: Partial<Levers> }>;
}

export const EVENTS: Record<EventId, EventCard> = {
  error: {
    id: 'error', icon: '⚠', title: '그럴듯한 오류',
    story: 'AI가 보고서에 잘못된 수치를 넣었습니다. 초안은 빨리 완성했지만, 검토와 수정에 추가 시간이 필요합니다.',
    choices: {
      A: { text: '모든 결과를 사람이 처음부터 다시 검토한다.', result: '전수 재검토 체계로 바꿨습니다.',
        levers: { verifyMult: 1.8, residualErrorMult: 0.3, qualityAdd: 4 } },
      B: { text: '핵심 수치와 출처를 검증하는 체크리스트를 만든다.', result: '검증 체크리스트를 도입했습니다.',
        levers: { verifyMult: 0.85, residualErrorMult: 0.45, setupAdd: 0.25, qualityAdd: 6 } },
      C: { text: '검증 단계를 별도의 AI에게 맡기고 사람이 최종 확인한다.', result: '검증 AI를 추가하고 사람은 최종 확인만 합니다.',
        levers: { verifyMult: 0.6, residualErrorMult: 0.6, maintenanceMult: 1.3, qualityAdd: 3 } },
    },
  },
  demand: {
    id: 'demand', icon: '📈', title: '요청 폭증',
    story: 'AI 덕분에 자료 제작이 빨라졌습니다. 이제 다른 부서에서도 추가 제작을 요청하기 시작합니다.',
    choices: {
      A: { text: '들어오는 요청을 모두 처리한다.', result: '모든 요청을 받기로 했습니다.',
        levers: { volumeGrowthMult: 2.0, qualityAdd: -3, usageAdd: -8 } },
      B: { text: '요청 기준과 우선순위를 정한다.', result: '요청 기준과 우선순위를 공지했습니다.',
        levers: { volumeGrowthMult: 0.9, coordinationAdd: 0.3, usageAdd: 4 } },
      C: { text: '반복 요청을 줄이는 공통 템플릿과 셀프서비스 체계를 만든다.', result: '공통 템플릿과 셀프서비스를 열었습니다.',
        levers: { volumeGrowthMult: 0.4, setupAdd: 0.5, usageAdd: 6 } },
    },
  },
  approval: {
    id: 'approval', icon: '⏳', title: '승인 병목',
    story: 'AI가 초안을 빠르게 생성했지만 최종 승인자는 여전히 한 명입니다. 승인 대기시간이 길어졌습니다.',
    choices: {
      A: { text: '기존 승인 체계를 유지한다.', result: '기존 승인 체계를 유지했습니다.',
        levers: { waitMult: 1.15, approverLoadMult: 1.1 } },
      B: { text: '승인 기준을 명확히 하고 반복적인 검토를 표준화한다.', result: '승인 기준표를 만들어 반복 검토를 줄였습니다.',
        levers: { waitMult: 0.75, approverLoadMult: 0.8, setupAdd: 0.15, qualityAdd: 2 } },
      C: { text: '위험 수준에 따라 승인 절차를 차등화하고 중요한 결과만 집중 검토한다.', result: '위험도별 승인 체계를 도입했습니다.',
        levers: { waitMult: 0.5, approverLoadMult: 0.55, residualErrorMult: 1.1 } },
    },
  },
  copytrap: {
    id: 'copytrap', icon: '📄', title: '복붙의 함정',
    story: 'AI가 많은 결과물을 만들었지만, 실제 업무에서 활용되지 않는 자료가 늘었습니다.',
    choices: {
      A: { text: '제작량을 더 늘린다.', result: '제작량을 늘렸습니다.',
        levers: { volumeGrowthMult: 1.5, reworkMult: 1.2, qualityAdd: -5, usageAdd: -15 } },
      B: { text: '결과물의 품질 기준을 설정한다.', result: '결과물 품질 기준을 정했습니다.',
        levers: { verifyMult: 1.1, reworkMult: 0.85, qualityAdd: 5, usageAdd: 10 } },
      C: { text: '결과물 수보다 실제 활용률과 성과를 기준으로 업무를 재설계한다.', result: '활용률·성과 중심으로 업무를 재설계했습니다.',
        levers: { volumeGrowthMult: 0.7, setupAdd: 0.2, qualityAdd: 7, usageAdd: 20 } },
    },
  },
};

/** 상황 카드 개인화 규칙: 우려사항·업무 유형·성공 기준이 맞으면 점수 가산 */
export const EVENT_AFFINITY: Record<EventId, {
  concerns: Concern[]; types: TaskType[]; criteria: Criterion[]; difficulty: Difficulty[];
}> = {
  error: { concerns: ['hallucination', 'moreReview'], types: ['data', 'research', 'document'], criteria: ['error', 'quality'], difficulty: ['verify'] },
  demand: { concerns: ['noReduction'], types: ['document', 'repetitive'], criteria: ['volume', 'time'], difficulty: ['repetitive', 'slow'] },
  approval: { concerns: ['judgment'], types: ['review', 'communication'], criteria: ['time', 'strategic'], difficulty: ['coordinate'] },
  copytrap: { concerns: ['lowQuality', 'learningCost'], types: ['idea', 'document'], criteria: ['creative', 'satisfaction', 'quality'], difficulty: ['expertise'] },
};

/** 교육기획 직무 선택 시 참고용 예시 업무 */
export const EDU_EXAMPLES: Omit<import('./types').Task, 'id'>[] = [
  { name: '교육 니즈 분석', hours: 4, frequency: 'monthly', type: 'research', importance: 'high', difficulty: 'findInfo', aiLevel: 1, applicability: 'mid' },
  { name: '교육과정 기획', hours: 8, frequency: 'weekly', type: 'idea', importance: 'high', difficulty: 'expertise', aiLevel: 1, applicability: 'mid' },
  { name: '교육 콘텐츠 제작', hours: 8, frequency: 'twice', type: 'document', importance: 'mid', difficulty: 'slow', aiLevel: 2, applicability: 'high' },
  { name: '교육 운영·안내', hours: 10, frequency: 'daily', type: 'communication', importance: 'mid', difficulty: 'coordinate', aiLevel: 0, applicability: 'low' },
  { name: '교육 만족도 분석', hours: 5, frequency: 'monthly', type: 'data', importance: 'mid', difficulty: 'verify', aiLevel: 1, applicability: 'high' },
  { name: '결과 보고서 작성', hours: 4, frequency: 'monthly', type: 'document', importance: 'high', difficulty: 'slow', aiLevel: 2, applicability: 'high' },
];

/** 확보한 시간 재투자 항목 (교육 직무 / 그 외 직무) */
export const REINVEST: Record<'edu' | 'general', { key: string; label: string }[]> = {
  edu: [
    { key: 'newCourse', label: '신규 교육과정 기획' },
    { key: 'interview', label: '현업 인터뷰·니즈 발굴' },
    { key: 'effect', label: '교육 효과 분석' },
    { key: 'content', label: '콘텐츠 품질 개선' },
    { key: 'learner', label: '교육생 맞춤형 지원' },
    { key: 'strategy', label: '전략적 기획과 협업' },
  ],
  general: [
    { key: 'newCourse', label: '신규 과제 기획' },
    { key: 'interview', label: '현업·고객 인터뷰' },
    { key: 'effect', label: '성과 분석' },
    { key: 'content', label: '결과물 품질 개선' },
    { key: 'learner', label: '고객 맞춤형 지원' },
    { key: 'strategy', label: '전략적 기획과 협업' },
  ],
};

export const ARCHETYPES = {
  explorer: {
    name: 'AI 탐험가', icon: '🧭', tagline: 'AI 활용 기회는 많지만 아직 방식이 정착되지 않은 유형',
    strength: '어떤 업무에 AI를 쓸지 처음부터 설계할 수 있어 잘못된 습관이 없습니다.',
    growth: '작은 업무 하나를 정해 같은 방식으로 3번 반복해 보는 것이 출발점입니다.',
  },
  partner: {
    name: 'AI 실무 파트너', icon: '🤝', tagline: '문서 작성·요약·조사 등 개별 업무에서 AI를 자주 쓰는 유형',
    strength: '초안 작성과 정리 속도에서 이미 효과를 보고 있습니다.',
    growth: '검토와 승인까지 포함한 전체 흐름을 재설계하면 효과가 커집니다.',
  },
  orchestrator: {
    name: 'AI 오케스트레이터', icon: '🎛', tagline: '여러 작업과 도구를 연결해 업무 흐름 전체를 개선하는 유형',
    strength: '업무 사이의 연결과 자동화로 반복을 구조적으로 줄입니다.',
    growth: '연결이 늘수록 관리 부담과 숨은 오류가 함께 늘어나니 점검 지점이 필요합니다.',
  },
  guardian: {
    name: 'AI 품질 수호자', icon: '🛡', tagline: '검토·정확성·위험관리와 품질을 중요하게 생각하는 유형',
    strength: 'AI 결과물의 오류와 보안 위험을 놓치지 않습니다.',
    growth: '모든 것을 다 검토하기보다 위험도에 따라 검토 깊이를 나누면 시간이 남습니다.',
  },
} as const;
