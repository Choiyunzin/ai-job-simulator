// ─────────────────────────────────────────────
// 데이터 모델 (UI와 무관한 순수 타입)
// ─────────────────────────────────────────────

export type JobId =
  | 'edu' | 'hr' | 'strategy' | 'marketing' | 'sales'
  | 'finance' | 'it' | 'admin' | 'other';

export type Frequency = 'daily' | 'twice' | 'weekly' | 'monthly';

export type TaskType =
  | 'research' | 'document' | 'data' | 'idea'
  | 'communication' | 'review' | 'repetitive' | 'other';

export type Importance = 'low' | 'mid' | 'high';

export type Difficulty =
  | 'slow' | 'findInfo' | 'verify' | 'coordinate' | 'repetitive' | 'expertise';

export type AiLevel = 0 | 1 | 2 | 3 | 4;

export type Applicability = 'high' | 'mid' | 'low' | 'unknown';

export type Criterion =
  | 'time' | 'quality' | 'error' | 'volume' | 'creative' | 'satisfaction' | 'strategic';

export type Concern =
  | 'hallucination' | 'moreReview' | 'noReduction' | 'security'
  | 'lowQuality' | 'learningCost' | 'judgment';

export type ApprovalSteps = 'none' | 'one' | 'multi';
export type PersonalData = 'none' | 'some' | 'lots';
export type TeamCulture = 'solo' | 'some' | 'team';
export type LearningTime = 'low' | 'mid' | 'high';
export type AiTool = 'internalGpt' | 'copilot' | 'externalGenAI' | 'automation' | 'none' | 'unknown';

/** 일하는 환경 (Q.G·Q.H) — 모든 업무에 공통으로 적용 */
export interface WorkEnv {
  approval: ApprovalSteps;
  personalData: PersonalData;
  culture: TeamCulture;
  tools: AiTool[];
  learning: LearningTime;
}

export interface Task {
  id: string;
  name: string;
  share: number;            // 전체 업무 중 비율(%) — 사용자가 입력
  hours: number;            // 주당 투입 시간 = 기준 근무시간 × 비율 (자동 계산)
  frequency: Frequency;
  type: TaskType;
  importance: Importance;
  difficulty: Difficulty;
  aiLevel: AiLevel;
  applicability: Applicability;
}

export interface Profile {
  job: JobId;
  jobOther: string;
  jobPath: string[];        // 사내 직무 목록에서 고른 경로 [직군, 직종, 직렬, 직무] (목록을 쓰지 않으면 빈 배열)
  weeklyHours: number;      // 시간 환산 기준 근무시간 (40 또는 52, 상세 그래프 기준)
  tasks: Task[];
  criteria: Criterion[];    // 최대 2개
  concerns: Concern[];
  env: WorkEnv;
  notes: { pain: string; tips: string };   // Q.I 자유 의견 (선택)
}

// 업무 흐름 재설계 레버 — 모든 값은 곱셈(Mult) 또는 가산(Add) 규칙
export interface Levers {
  promptMult: number;         // AI 지시 시간
  verifyMult: number;         // AI 결과 검토 시간
  reworkMult: number;         // 오류 수정·재작업 시간
  residualErrorMult: number;  // 검증 후 남는 오류율
  waitMult: number;           // 승인 대기(경과시간)
  approverLoadMult: number;   // 승인자 업무 부담
  volumeGrowthMult: number;   // 요청량 증가율
  maintenanceMult: number;    // 도구 유지관리 시간
  setupAdd: number;           // 재설계 준비(체크리스트·템플릿 등) 주당 환산 시간
  coordinationAdd: number;    // 우선순위 조율 등 추가 주당 시간
  qualityAdd: number;         // 품질 점수 가감
  usageAdd: number;           // 결과물 실제 활용률 가감(%p)
}

// 사용자가 시뮬레이션 화면에서 직접 조정한 값(시간/주)
export type ComponentKey =
  | 'beforeDirect' | 'beforeReview' | 'beforeWait'
  | 'prompt' | 'aiGen' | 'manualDirect' | 'aiReview' | 'rework' | 'afterWait' | 'maintenance';

export type Overrides = Record<string, Partial<Record<ComponentKey, number>>>;

export interface TaskResult {
  task: Task;
  potential: number;          // 업무 유형×적용 가능성 기반 자동화 잠재율 (0~1)
  reduction: number;          // 실제 직접작업 대체율 r (0~0.8)
  occurrencesPerWeek: number;
  before: {
    direct: number; review: number; wait: number;
    labor: number;            // direct+review (실제 노동시간)
    currentAiHours: number;   // 현재 AI 활용 시간 추정
    approver: number;
    quality: number; risk: number;
  };
  after: {
    prompt: number; aiGen: number; manualDirect: number;
    review: number;           // 기존 검토 + AI 결과 검토
    aiReview: number; rework: number; maintenance: number; wait: number;
    labor: number;            // 동일 업무량 기준 노동시간
    volumeGrowth: number;     // 업무량 증가율
    extraVolumeLabor: number; // 늘어난 업무량 처리에 드는 추가 노동시간
    approver: number;
    residualError: number;
    quality: number; risk: number; usage: number;
  };
}

export interface ScenarioResult {
  label: string;
  tasks: TaskResult[];
  totals: {
    beforeLabor: number;
    afterLabor: number;       // 동일 업무량 기준
    extraVolumeLabor: number;
    actualLabor: number;      // afterLabor + extraVolumeLabor + setup + coordination
    overhead: number;         // setup + coordination
    beforeWait: number; afterWait: number;
    beforeApprover: number; afterApprover: number;
    savedSameVolume: number;  // beforeLabor - (afterLabor + overhead)
    savingRate: number;       // %
    volumeGrowth: number;     // 가중평균 %
    freeTime: number;         // beforeLabor - actualLabor (전략 업무에 쓸 수 있는 시간)
    beforeQuality: number; afterQuality: number;
    beforeRisk: number; afterRisk: number;
    usage: number;
    aiGen: number;
  };
}

export type ArchetypeId = 'explorer' | 'partner' | 'orchestrator' | 'guardian';

export interface Diagnosis {
  archetype: ArchetypeId;
  scores: Record<ArchetypeId, number>;
  totalHours: number;
  avgLevel: number;
  avgPotential: number;
  topTasks: { id: string; name: string; savedHours: number; reduction: number }[];
  bottlenecks: { key: string; label: string; hours: number; desc: string }[];
  firstExperiment: { id: string; name: string; reason: string } | null;
  sentence: string;
  factors: { label: string; value: string }[];
}

export type EventId = 'error' | 'demand' | 'approval' | 'copytrap';
export type ChoiceId = 'A' | 'B' | 'C';

export type RedesignToggle = 'checklist' | 'tieredApproval' | 'promptLibrary' | 'selfService';
