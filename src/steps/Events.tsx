import { useMemo } from 'react';
import { StepNav } from '../App';
import { EVENTS } from '../engine/config';
import { runScenarios } from '../engine/simulate';
import type { ChoiceId, EventId, ScenarioResult } from '../engine/types';
import { CountUp, Delta, ScenarioBars } from '../components/viz';
import { useApp } from '../state';
import { COLORS, useResults } from '../useResults';
import { afterSegments } from './Simulation';

type Metric = { label: string; get: (r: ScenarioResult) => number; unit: string; good: 'up' | 'down'; d?: number };

const sum = (r: ScenarioResult, f: (t: ScenarioResult['tasks'][number]) => number) => r.tasks.reduce((x, t) => x + f(t), 0);
const COMMON: Metric[] = [
  { label: '총 작업시간(주)', get: (r) => r.totals.actualLabor, unit: '시간', good: 'down' },
  { label: '검토·수정 시간', get: (r) => sum(r, (t) => t.after.aiReview + t.after.rework), unit: '시간', good: 'down' },
  { label: '오류 위험', get: (r) => r.totals.afterRisk, unit: '점', good: 'down', d: 0 },
  { label: '품질 점수', get: (r) => r.totals.afterQuality, unit: '점', good: 'up', d: 0 },
];
const EXTRA: Record<EventId, Metric[]> = {
  error: [],
  demand: [
    { label: '처리량 증가', get: (r) => r.totals.volumeGrowth, unit: '%', good: 'up' },
    { label: '전략 업무 가능 시간', get: (r) => r.totals.freeTime, unit: '시간', good: 'up' },
  ],
  approval: [
    { label: '승인 대기(경과)', get: (r) => r.totals.afterWait, unit: '시간', good: 'down' },
    { label: '승인자 검토 부담', get: (r) => r.totals.afterApprover, unit: '시간', good: 'down' },
  ],
  copytrap: [
    { label: '결과물 활용률', get: (r) => r.totals.usage, unit: '%', good: 'up', d: 0 },
    { label: '재작업 시간', get: (r) => sum(r, (t) => t.after.rework), unit: '시간', good: 'down' },
  ],
};

export default function Events() {
  const { s, d } = useApp();
  const { pair, ranked, after, redesign } = useResults();
  const chosenCount = pair.filter((e) => s.choices[e]).length;
  const visible = pair.filter((_, i) => i === 0 || s.choices[pair[i - 1]]);

  return (
    <section className="events">
      <p className="eyebrow">STEP 5 · AI와 일할 때 만나는 상황 · 라운드 {s.round + 1}</p>
      <h1 className="h-screen">AI와 일하다 보면 이런 상황도 생겨요</h1>
      <p className="lead-s">앞에서 고른 업무와 걱정되는 점을 바탕으로 상황 {pair.length}개를 골랐어요. 나라면 어떻게 할지 골라보세요.</p>

      <div className="event-stack">
        {visible.map((e, i) => (
          <EventCardView key={`${s.round}-${e}`} id={e} index={i} reasons={ranked.find((r) => r.id === e)?.reasons ?? []} />
        ))}
      </div>

      <div className="card">
        <h3>내 선택이 반영된 전체 업무 흐름 <small>(주당 · 전체 업무)</small></h3>
        <ScenarioBars rows={[
          { label: 'AI만 도입했을 때', segments: [...sumSeg(after), { key: 'extra', label: '늘어난 요청 처리', value: after.totals.extraVolumeLabor, color: COLORS.extra }], wait: after.totals.afterWait },
          { label: `내 대응 반영 (${chosenCount}/${pair.length})`, segments: [...sumSeg(redesign), { key: 'extra', label: '늘어난 요청 처리', value: redesign.totals.extraVolumeLabor, color: COLORS.extra }, { key: 'overhead', label: '재설계 준비', value: redesign.totals.overhead, color: COLORS.overhead }], wait: redesign.totals.afterWait, highlight: true },
        ]} />
      </div>

      {chosenCount === pair.length && (
        <div className="card retry">
          <div><b>다른 상황도 만나볼까요?</b><small>새로운 상황 조합이 나오고, 이번 라운드의 선택은 초기화됩니다.</small></div>
          <button className="btn ghost" onClick={() => d({ type: 'nextRound' })}>🎲 한 번 더 도전하기</button>
        </div>
      )}

      <StepNav onPrev={() => d({ type: 'go', step: 3 })} onNext={() => d({ type: 'go', step: 5 })}
        nextLabel="미래의 나 확인하기" disabled={chosenCount < pair.length}
        hint={chosenCount < pair.length ? `상황 ${pair.length - chosenCount}개에 대해 골라주세요.` : undefined} />
    </section>
  );
}

function sumSeg(r: ScenarioResult) {
  const base = afterSegments(r.tasks[0] ?? ({} as never)).map((x) => ({ ...x, value: 0 }));
  if (!r.tasks.length) return base;
  r.tasks.forEach((t) => afterSegments(t).forEach((x, i) => { base[i].value += x.value; }));
  return base;
}

function EventCardView({ id, index, reasons }: { id: EventId; index: number; reasons: string[] }) {
  const { s, d } = useApp();
  const ev = EVENTS[id];
  const chosen = s.choices[id];

  // 이 상황의 선택만 뺀 결과와 비교해 즉시 효과를 보여줌
  const cmp = useMemo(() => {
    if (!chosen) return null;
    const without = { ...s.choices }; delete without[id];
    const a = runScenarios(s.profile, s.overrides, s.toggles, without).redesign;
    const b = runScenarios(s.profile, s.overrides, s.toggles, s.choices).redesign;
    return { a, b };
  }, [chosen, s.choices, s.profile, s.overrides, s.toggles, id]);

  const metrics = [...COMMON, ...EXTRA[id]];
  return (
    <article className={`event-card${chosen ? ' resolved' : ''}`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="ev-front">
        <div className="ev-top">
          <span className="ev-icon" aria-hidden="true">{ev.icon}</span>
          <div>
            <span className="ev-no num">상황 {index + 1}</span>
            <h2>{ev.title}</h2>
          </div>
        </div>
        <p className="ev-story">{ev.story}</p>
        {reasons.length > 0 && <p className="ev-why">이 상황이 나온 이유 · {reasons.slice(0, 2).join(' · ')}</p>}
        <div className="ev-choices" role="radiogroup" aria-label={`${ev.title} 대응 선택`}>
          {(Object.keys(ev.choices) as ChoiceId[]).map((c) => (
            <button key={c} role="radio" aria-checked={chosen === c} className={`ev-choice${chosen === c ? ' on' : ''}`}
              onClick={() => d({ type: 'choose', e: id, c })}>
              <b className="num">{c}</b><span>{ev.choices[c].text}</span>
            </button>
          ))}
        </div>
      </div>
      {chosen && cmp && (
        <div className="ev-result" key={chosen}>
          <p className="ev-res-title">✔ {ev.choices[chosen].result}</p>
          <div className="ev-metrics">
            {metrics.map((m) => {
              const va = m.get(cmp.a), vb = m.get(cmp.b);
              return (
                <div key={m.label} className="evm">
                  <span>{m.label}</span>
                  <b><CountUp value={vb} decimals={m.d ?? 1} suffix={m.unit} /></b>
                  <Delta value={vb - va} unit={m.unit} goodWhen={m.good} decimals={m.d ?? 1} />
                </div>
              );
            })}
          </div>
          <p className="fine">변화량은 이 상황에서 아무것도 바꾸지 않았을 때(나머지 선택은 동일)와 비교한 값입니다.</p>
        </div>
      )}
    </article>
  );
}
