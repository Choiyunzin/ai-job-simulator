// 상태 → 계산 결과 (입력이 바뀌면 즉시 재계산)
import { useMemo } from 'react';
import { contributions, runScenarios } from './engine/simulate';
import { diagnose, eventPairs, rankEvents } from './engine/diagnose';
import type { EventId } from './engine/types';
import { useApp } from './state';

export const COLORS = {
  direct: '#7A8BB0', review: '#E0A458', prompt: '#6FA8FF', manual: '#7A8BB0',
  aiReview: '#E8B86A', rework: '#E57373', maint: '#9C86FF', extra: '#5FC7B4', overhead: '#C792EA',
};

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
    return { after, redesign, sources, dx, ranked, pair, contrib };
  }, [s.profile, s.overrides, s.toggles, s.choices, s.round]);
}
