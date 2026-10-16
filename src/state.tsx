// 앱 전체 상태: 단계 이동 시에도 입력값 유지, 브라우저에 자동 저장
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { EDU_EXAMPLES } from './engine/config';
import type {
  AiTool, ChoiceId, ComponentKey, Concern, Criterion, EventId, Overrides, Profile, RedesignToggle, Task, WorkEnv,
} from './engine/types';

export interface AppState {
  step: number;           // 0~5
  sub: number;            // STEP 2 내부 질문 화면 0~4
  profile: Profile;
  overrides: Overrides;
  simTaskId: string | null;
  simPlayed: boolean;
  toggles: Record<RedesignToggle, boolean>;
  round: number;
  choices: Partial<Record<EventId, ChoiceId>>;
  reinvest: Record<string, number>;
}

const STORAGE_KEY = 'ai-job-simulator:v2';

export const newId = () => Math.random().toString(36).slice(2, 9);

export const blankTask = (): Task => ({
  id: newId(), name: '', hours: 4, frequency: 'weekly', type: 'document',
  importance: 'mid', difficulty: 'slow', aiLevel: 0, applicability: 'unknown',
});

export const initialState = (): AppState => ({
  step: 0, sub: 0,
  profile: {
    job: 'edu', jobOther: '', jobPath: [], weeklyHours: 40, tasks: [], criteria: [], concerns: [],
    env: { approval: 'one', personalData: 'some', culture: 'solo', tools: [], learning: 'mid' },
    notes: { pain: '', tips: '' },
  },
  overrides: {}, simTaskId: null, simPlayed: false,
  toggles: { checklist: true, tieredApproval: true, promptLibrary: true, selfService: true },
  round: 0, choices: {}, reinvest: {},
});

type Action =
  | { type: 'go'; step: number; sub?: number }
  | { type: 'sub'; sub: number }
  | { type: 'profile'; patch: Partial<Profile> }
  | { type: 'task'; id: string; patch: Partial<Task> }
  | { type: 'addTask'; task?: Partial<Task> }
  | { type: 'removeTask'; id: string }
  | { type: 'loadExamples' }
  | { type: 'toggleCriterion'; c: Criterion }
  | { type: 'toggleConcern'; c: Concern }
  | { type: 'env'; patch: Partial<WorkEnv> }
  | { type: 'toggleTool'; t: AiTool }
  | { type: 'notes'; patch: Partial<Profile['notes']> }
  | { type: 'override'; taskId: string; key: ComponentKey; value: number | null }
  | { type: 'resetOverrides'; taskId: string }
  | { type: 'simTask'; id: string }
  | { type: 'simPlayed'; v: boolean }
  | { type: 'toggle'; t: RedesignToggle }
  | { type: 'choose'; e: EventId; c: ChoiceId }
  | { type: 'nextRound' }
  | { type: 'reinvest'; key: string; v: number }
  | { type: 'reset' };

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'go': return { ...s, step: a.step, sub: a.sub ?? s.sub };
    case 'sub': return { ...s, sub: a.sub };
    case 'profile': return { ...s, profile: { ...s.profile, ...a.patch } };
    case 'task': return {
      ...s, profile: { ...s.profile, tasks: s.profile.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)) },
    };
    case 'addTask':
      if (s.profile.tasks.length >= 5) return s;
      return { ...s, profile: { ...s.profile, tasks: [...s.profile.tasks, { ...blankTask(), ...a.task, id: newId() }] } };
    case 'removeTask': {
      const overrides = { ...s.overrides }; delete overrides[a.id];
      return {
        ...s, overrides, simTaskId: s.simTaskId === a.id ? null : s.simTaskId,
        profile: { ...s.profile, tasks: s.profile.tasks.filter((t) => t.id !== a.id) },
      };
    }
    case 'loadExamples': {
      const room = 5 - s.profile.tasks.length;
      const names = new Set(s.profile.tasks.map((t) => t.name));
      const add = EDU_EXAMPLES.filter((e) => !names.has(e.name)).slice(0, room).map((e) => ({ ...e, id: newId() }));
      return { ...s, profile: { ...s.profile, tasks: [...s.profile.tasks, ...add] } };
    }
    case 'toggleCriterion': {
      const has = s.profile.criteria.includes(a.c);
      if (!has && s.profile.criteria.length >= 2) return s;
      return { ...s, profile: { ...s.profile, criteria: has ? s.profile.criteria.filter((x) => x !== a.c) : [...s.profile.criteria, a.c] } };
    }
    case 'toggleConcern': {
      const has = s.profile.concerns.includes(a.c);
      return { ...s, profile: { ...s.profile, concerns: has ? s.profile.concerns.filter((x) => x !== a.c) : [...s.profile.concerns, a.c] } };
    }
    case 'env': return { ...s, profile: { ...s.profile, env: { ...s.profile.env, ...a.patch } } };
    case 'toggleTool': {
      const cur = s.profile.env.tools;
      const exclusive: AiTool[] = ['none', 'unknown'];
      let tools: AiTool[];
      if (cur.includes(a.t)) tools = cur.filter((x) => x !== a.t);
      else if (exclusive.includes(a.t)) tools = [a.t];
      else tools = [...cur.filter((x) => !exclusive.includes(x)), a.t];
      return { ...s, profile: { ...s.profile, env: { ...s.profile.env, tools } } };
    }
    case 'notes': return { ...s, profile: { ...s.profile, notes: { ...s.profile.notes, ...a.patch } } };
    case 'override': {
      const cur = { ...(s.overrides[a.taskId] ?? {}) };
      if (a.value === null) delete cur[a.key]; else cur[a.key] = a.value;
      return { ...s, overrides: { ...s.overrides, [a.taskId]: cur } };
    }
    case 'resetOverrides': {
      const overrides = { ...s.overrides }; delete overrides[a.taskId];
      return { ...s, overrides };
    }
    case 'simTask': return { ...s, simTaskId: a.id, simPlayed: false };
    case 'simPlayed': return { ...s, simPlayed: a.v };
    case 'toggle': return { ...s, toggles: { ...s.toggles, [a.t]: !s.toggles[a.t] } };
    case 'choose': return { ...s, choices: { ...s.choices, [a.e]: a.c } };
    case 'nextRound': return { ...s, round: s.round + 1, choices: {} };
    case 'reinvest': return { ...s, reinvest: { ...s.reinvest, [a.key]: a.v } };
    case 'reset': return initialState();
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = initialState();
      return {
        ...base, ...saved,
        profile: {
          ...base.profile, ...saved.profile,
          env: { ...base.profile.env, ...(saved.profile?.env ?? {}) },
          notes: { ...base.profile.notes, ...(saved.profile?.notes ?? {}) },
        },
      };
    }
  } catch { /* 저장소를 쓸 수 없는 환경 */ }
  return initialState();
}

const Ctx = createContext<{ s: AppState; d: (a: Action) => void } | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* 무시 */ }
  }, [s]);
  const v = useMemo(() => ({ s, d }), [s]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StateProvider 누락');
  return v;
}
