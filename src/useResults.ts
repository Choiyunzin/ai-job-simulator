// 상태 → 계산 결과 (입력이 바뀌면 즉시 재계산)
import { useMemo } from 'react';
import { contributions, runScenarios } from './engine/simulate';
import { diagnose, eventPairs, rankEvents } from './engine/diagnose';
import { HOUR_BASES } from './engine/config';
import type { EventId, Overrides, Profile } from './engine/types';
import { hoursOf, useApp } from './state';

export const COLORS = {
  direct: '#7A8BB0', review: '#E0A458', prompt: '#4F86F7', manual: '#7A8BB0',
  aiReview: '#E8B86A', rework: '#E57373', maint: '#8A6CF0', extra: '#3FB09C', overhead: '#C792EA',
};

/** 같은 업무 비율을 다른 기준 근무시간으로 환산 (사용자가 조정한 시간값도 같은 비율로 환산) */
function atBase(p: Profile, overrides: Overrides, base: number) {
  const k = base / (p.weeklyHours || 40);
  const profile = { ...p, weeklyHours: base, tasks: p.tasks.map((t) => ({ ...t, hours: hoursOf(t.share, base) })) };
  const ov: Overrides = {};
  for (const [id, o] of Object.entries(overrides)) {
    ov[id] = Object.fromEntries(Object.entries(o ?? {}).map(([key, v]) => [key, (v as number) * k]));
  }
  return { profile, overrides: ov };
}

export interface HourBand { base: number; aiSaved: number; redesignSaved: number; beforeLabor: number; freeTime: number }

export function useResults() {
  const { s } = useApp();
  return useMemo(() => {
    const p = s.profile;
    const { after, redesign, sources } = runScenarios(p, s.overrides, s.toggles, s.choices);
    const dx = diagnose(p, after);
    const ranked = rankEvents(p);
    const pairs = eventPairs(ranked.map((r) => r.id));
    const pair = pairs[s.round % pairs.length] as [EventId, EventId];
    const contrib = contributions(p, s.overrides, sources);
    // 주 40시간·52시간 기준 절감 시간 범위
    const bands: HourBand[] = HOUR_BASES.map((base) => {
      const r = base === p.weeklyHours ? { after, redesign } : (() => {
        const x = atBase(p, s.overrides, base);
        return runScenarios(x.profile, x.overrides, s.toggles, s.choices);
      })();
      return {
        base, aiSaved: r.after.totals.savedSameVolume, redesignSaved: r.redesign.totals.savedSameVolume,
        beforeLabor: r.redesign.totals.beforeLabor, freeTime: r.redesign.totals.freeTime,
      };
    });
    return { after, redesign, sources, dx, ranked, pair, contrib, bands };
  }, [s.profile, s.overrides, s.toggles, s.choices, s.round]);
}
