import { useEffect, useMemo, useRef, useState } from 'react';
import { StepNav } from '../App';
import { LABELS, LEVEL_PROFILE, REDESIGN, SIM, TYPE_PROFILE } from '../engine/config';
import { envFactors, fmtMin } from '../engine/simulate';
import type { ComponentKey, RedesignToggle, TaskResult } from '../engine/types';
import { CountUp, Delta, ScenarioBars, useReducedMotion, type Segment } from '../components/viz';
import { useApp } from '../state';
import { COLORS, useResults } from '../useResults';

type Unit = 'week' | 'each';

export function beforeSegments(r: TaskResult, k = 1): Segment[] {
  return [
    { key: 'direct', label: '직접 작업', value: r.before.direct / k, color: COLORS.direct },
    { key: 'review', label: '검토·수정(기존)', value: r.before.review / k, color: COLORS.review },
  ];
}
export function afterSegments(r: TaskResult, k = 1): Segment[] {
  return [
    { key: 'prompt', label: 'AI 입력·지시', value: r.after.prompt / k, color: COLORS.prompt },
    { key: 'direct', label: '직접 작업', value: r.after.manualDirect / k, color: COLORS.direct },
    { key: 'review', label: '검토·수정(기존)', value: r.before.review / k, color: COLORS.review },
    { key: 'aiReview', label: 'AI 결과 검토', value: r.after.aiReview / k, color: COLORS.aiReview },
    { key: 'rework', label: '오류 수정·재작업', value: r.after.rework / k, color: COLORS.rework },
    { key: 'maint', label: '도구 설정·유지관리', value: r.after.maintenance / k, color: COLORS.maint },
  ];
}

export default function Simulation() {
  const { s, d } = useApp();
  const { after, redesign, dx } = useResults();
  const [unit, setUnit] = useState<Unit>('week');
  const [scope, setScope] = useState<'task' | 'all'>('task');

  const taskId = (s.simTaskId && after.tasks.some((r) => r.task.id === s.simTaskId) ? s.simTaskId : null)
    ?? dx.firstExperiment?.id ?? after.tasks[0]?.task.id;
  const ra = after.tasks.find((r) => r.task.id === taskId);
  const rr = redesign.tasks.find((r) => r.task.id === taskId);
  if (!ra || !rr) {
    return <section><p>시뮬레이션할 업무가 없습니다. 업무 프로파일에서 업무를 추가해 주세요.</p>
      <StepNav onPrev={() => d({ type: 'go', step: 1, sub: 1 })} /></section>;
  }
  const k = unit === 'each' ? ra.occurrencesPerWeek : 1;
  const uLabel = unit === 'each' ? '건당' : '주당';

  const sumSeg = (xs: Segment[]) => xs.reduce((x, y) => x + y.value, 0);
  const beforeTotal = ra.before.labor;
  const savingAfter = beforeTotal > 0 ? ((beforeTotal - ra.after.labor) / beforeTotal) * 100 : 0;
  const redesignOverheadShare = redesign.totals.overhead * (ra.before.labor / (redesign.totals.beforeLabor || 1));
  const rrLabor = rr.after.labor + redesignOverheadShare;
  const savingRedesign = beforeTotal > 0 ? ((beforeTotal - rrLabor) / beforeTotal) * 100 : 0;

  const rows = scope === 'task'
    ? [
      { label: 'AI 적용 전', segments: beforeSegments(ra, k), wait: ra.before.wait / k },
      { label: 'AI 적용 후', segments: afterSegments(ra, k), wait: ra.after.wait / k },
      { label: '전체 업무 흐름 재설계 후', segments: [...afterSegments(rr, k), { key: 'overhead', label: '재설계 준비(체크리스트·템플릿)', value: redesignOverheadShare / k, color: COLORS.overhead }], wait: rr.after.wait / k, highlight: true },
    ]
    : [
      { label: 'AI 적용 전', segments: sumTasks(after.tasks, beforeSegments), wait: after.totals.beforeWait },
      { label: 'AI 적용 후', segments: sumTasks(after.tasks, afterSegments), wait: after.totals.afterWait },
      { label: '전체 업무 흐름 재설계 후', segments: [...sumTasks(redesign.tasks, afterSegments), { key: 'overhead', label: '재설계 준비(체크리스트·템플릿)', value: redesign.totals.overhead, color: COLORS.overhead }], wait: redesign.totals.afterWait, highlight: true },
    ];

  return (
    <section className="sim">
      <p className="eyebrow">STEP 4 · AI 도입 전후 생산성 시뮬레이션</p>
      <h1 className="h-screen">AI를 도입하면 내 업무는 얼마나 달라질까?</h1>
      <p className="fine">시간은 업무 비율 × 주 {s.profile.weeklyHours}시간 근무로 환산했습니다. 근무시간은 마지막 '미래의 나'에서 바꿔 볼 수 있어요.</p>

      <div className="sim-pick">
        <label htmlFor="simtask">시뮬레이션할 업무</label>
        <select id="simtask" value={taskId} onChange={(e) => d({ type: 'simTask', id: e.target.value })}>
          {after.tasks.map((r) => <option key={r.task.id} value={r.task.id}>{r.task.name}</option>)}
        </select>
        <div className="seg small" role="radiogroup" aria-label="시간 단위">
          <button className={unit === 'week' ? 'on' : ''} aria-checked={unit === 'week'} role="radio" onClick={() => setUnit('week')}>주당</button>
          <button className={unit === 'each' ? 'on' : ''} aria-checked={unit === 'each'} role="radio" onClick={() => setUnit('each')}>건당</button>
        </div>
      </div>

      <div className="task-banner">
        <h2>{ra.task.name}</h2>
        <p>{LABELS.type[ra.task.type]} · {LABELS.frequency[ra.task.frequency]}(주 {ra.occurrencesPerWeek}건) · 현재 AI {ra.task.aiLevel}단계 · 적용 가능성 {LABELS.applicability[ra.task.applicability].title}</p>
      </div>

      <FlowRunner ra={ra} k={k} uLabel={uLabel} savingAfter={savingAfter} />

      <div className="card">
        <div className="card-head">
          <h3>세 가지 결과 비교 <small>({scope === 'task' ? `${uLabel} · ${ra.task.name}` : '주당 · 전체 업무 합계'})</small></h3>
          <div className="seg small" role="radiogroup" aria-label="비교 범위">
            <button className={scope === 'task' ? 'on' : ''} role="radio" aria-checked={scope === 'task'} onClick={() => setScope('task')}>이 업무</button>
            <button className={scope === 'all' ? 'on' : ''} role="radio" aria-checked={scope === 'all'} onClick={() => setScope('all')}>전체 업무</button>
          </div>
        </div>
        <ScenarioBars rows={rows} note="막대 길이는 실제 투입 노동시간입니다. 빗금 구간은 승인·대기로 흘러간 경과시간으로, 노동시간 합계에는 포함하지 않습니다." />
        <div className="kpis">
          <Kpi label="AI 적용 후 절감률" value={scope === 'task' ? savingAfter : after.totals.savingRate} suffix="%" />
          <Kpi label="재설계 후 절감률" value={scope === 'task' ? savingRedesign : redesign.totals.savingRate} suffix="%" strong />
          <Kpi label="품질 점수(100점)" value={scope === 'task' ? rr.after.quality : redesign.totals.afterQuality} decimals={0}
            delta={(scope === 'task' ? rr.after.quality - ra.before.quality : redesign.totals.afterQuality - redesign.totals.beforeQuality)} goodWhen="up" />
          <Kpi label="오류 위험 점수" value={scope === 'task' ? rr.after.risk : redesign.totals.afterRisk} decimals={0}
            delta={(scope === 'task' ? rr.after.risk - ra.before.risk : redesign.totals.afterRisk - redesign.totals.beforeRisk)} goodWhen="down" />
        </div>
        {sumSeg(rows[0].segments) > 0 && (
          <p className="insight">
            {savingAfter < 10
              ? `AI가 초안을 빨리 만들어도 검토·재작업·관리 시간이 생겨 '${ra.task.name}'의 실제 절감은 ${savingAfter.toFixed(1)}%에 그칩니다. `
              : `AI만 도입해도 '${ra.task.name}'은 ${savingAfter.toFixed(1)}% 줄어듭니다. `}
            {savingRedesign > savingAfter
              ? `흐름 전체를 재설계하면 ${savingRedesign.toFixed(1)}%까지 커집니다.`
              : '재설계 준비 시간이 아직 효과보다 큽니다. 아래 재설계 항목을 바꿔보세요.'}
            {ra.after.volumeGrowth > 0.005 && ` 다만 빨라진 만큼 요청이 약 ${(ra.after.volumeGrowth * 100).toFixed(0)}% 늘어나 주당 ${fmtMin(ra.after.extraVolumeLabor)}이 추가로 들 수 있습니다.`}
          </p>
        )}
      </div>

      <div className="card">
        <h3>전체 업무 흐름 재설계 항목</h3>
        <p className="fine">켜고 끄면 '재설계 후' 결과가 바로 바뀝니다. 다음 단계의 상황 대응 선택도 여기에 더해집니다.</p>
        <div className="toggles">
          {(Object.keys(REDESIGN) as RedesignToggle[]).map((t) => (
            <label key={t} className={`toggle${s.toggles[t] ? ' on' : ''}`}>
              <input type="checkbox" checked={s.toggles[t]} onChange={() => d({ type: 'toggle', t })} />
              <span className="sw" aria-hidden="true" />
              <span><b>{REDESIGN[t].title}</b><small>{REDESIGN[t].desc}</small></span>
            </label>
          ))}
        </div>
      </div>

      <Adjuster ra={ra} />

      <details className="basis">
        <summary>이 업무의 계산 근거 보기</summary>
        <Basis r={ra} />
        <EnvBasis />
      </details>

      <StepNav onPrev={() => d({ type: 'go', step: 2 })} onNext={() => d({ type: 'go', step: 4 })} nextLabel="상황 대응해 보기" />
    </section>
  );
}

function sumTasks(rs: TaskResult[], f: (r: TaskResult) => Segment[]): Segment[] {
  const base = rs[0] ? f(rs[0]).map((s) => ({ ...s, value: 0 })) : [];
  rs.forEach((r) => f(r).forEach((s, i) => { base[i].value += s.value; }));
  return base;
}

function Kpi({ label, value, suffix = '', decimals = 1, delta, goodWhen, strong }: {
  label: string; value: number; suffix?: string; decimals?: number; delta?: number; goodWhen?: 'up' | 'down'; strong?: boolean;
}) {
  return (
    <div className={`kpi${strong ? ' strong' : ''}`}>
      <span>{label}</span>
      <b><CountUp value={value} decimals={decimals} suffix={suffix} /></b>
      {delta !== undefined && <Delta value={delta} goodWhen={goodWhen} decimals={0} unit="점" />}
    </div>
  );
}

// ── 업무 흐름 애니메이션 (계산값과 동일한 시간을 누적) ──
interface FlowNode { label: string; kind: 'human' | 'ai' | 'approve'; labor: number; wait: number }

function buildFlows(r: TaskResult, k: number): { before: FlowNode[]; after: FlowNode[] } {
  const tp = TYPE_PROFILE[r.task.type];
  const workSteps = tp.stepsBefore.slice(0, -1);
  const before: FlowNode[] = workSteps.map((label) => ({ label, kind: 'human', labor: r.before.direct / k / workSteps.length, wait: 0 }));
  before.push({ label: tp.stepsBefore[tp.stepsBefore.length - 1], kind: 'human', labor: r.before.review / k, wait: 0 });
  before.push({ label: '승인 대기', kind: 'approve', labor: 0, wait: r.before.wait / k });

  const kindOf = (x: string): FlowNode['kind'] =>
    /AI가|자동화가/.test(x) ? 'ai' : /승인|공유|협의/.test(x) && !/사람이 (해석|핵심|예외)/.test(x) ? 'approve' : 'human';
  const steps = tp.stepsAfter.map((label) => ({ label, kind: kindOf(label) }));
  const ai = steps.filter((x) => x.kind === 'ai');
  const hu = steps.filter((x) => x.kind === 'human');
  const ap = steps.filter((x) => x.kind === 'approve');
  const aiLabor = (r.after.prompt + r.after.maintenance) / k;
  const huLabor = (r.after.manualDirect + r.before.review + r.after.aiReview + r.after.rework) / k;
  const after: FlowNode[] = steps.map((x) => ({
    label: x.label, kind: x.kind,
    labor: x.kind === 'ai' ? aiLabor / ai.length : x.kind === 'human' ? huLabor / Math.max(1, hu.length) : 0,
    wait: x.kind === 'ai' ? r.after.aiGen / k / ai.length : x.kind === 'approve' ? r.after.wait / k / ap.length : 0,
  }));
  if (!hu.length) after.splice(1, 0, { label: '사람이 결과 확인', kind: 'human', labor: huLabor, wait: 0 });
  if (!ap.length) after.push({ label: '승인 대기', kind: 'approve', labor: 0, wait: r.after.wait / k });
  return { before, after };
}

type Phase = 'idle' | 'before' | 'beforeDone' | 'after' | 'done';

function FlowRunner({ ra, k, uLabel, savingAfter }: { ra: TaskResult; k: number; uLabel: string; savingAfter: number }) {
  const { s, d } = useApp();
  const reduced = useReducedMotion();
  const flows = useMemo(() => buildFlows(ra, k), [ra, k]);
  const [phase, setPhase] = useState<Phase>(s.simPlayed ? 'done' : 'idle');
  const [prog, setProg] = useState({ before: s.simPlayed ? 1 : 0, after: s.simPlayed ? 1 : 0 });
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => { // 업무가 바뀌면 다시 처음부터
    if (!s.simPlayed) { setPhase('idle'); setProg({ before: 0, after: 0 }); }
  }, [ra.task.id, s.simPlayed]);

  const run = (which: 'before' | 'after') => {
    cancelAnimationFrame(raf.current);
    const dur = reduced ? 0 : 3200;
    const t0 = performance.now();
    setPhase(which);
    const tick = (now: number) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      setProg((x) => ({ ...x, [which]: p }));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else {
        setPhase(which === 'before' ? 'beforeDone' : 'done');
        if (which === 'after') d({ type: 'simPlayed', v: true });
      }
    };
    raf.current = requestAnimationFrame(tick);
  };
  const replay = () => { d({ type: 'simPlayed', v: false }); setProg({ before: 0, after: 0 }); setPhase('idle'); };

  return (
    <div className="flows">
      <FlowLane title="기존 방식" nodes={flows.before} p={prog.before} uLabel={uLabel} active={phase === 'before'} />
      <div className="flow-ctl">
        {phase === 'idle' && <button className="btn primary" onClick={() => run('before')}>▶ 기존 방식으로 업무 처리</button>}
        {phase === 'before' && <span className="running">기존 방식으로 처리하는 중…</span>}
        {phase === 'beforeDone' && <button className="btn ai" onClick={() => run('after')}>⚡ AI 도입하기</button>}
        {phase === 'after' && <span className="running">AI 노드가 작업 중…</span>}
        {phase === 'done' && (
          <div className="flow-result">
            <span>{uLabel} 노동시간</span>
            <b className="num">{fmtMin(ra.before.labor / k)} → {fmtMin(ra.after.labor / k)}</b>
            <span className={`pill ${savingAfter >= 0 ? 'good' : 'bad'}`}>{savingAfter >= 0 ? '절감' : '증가'} {Math.abs(savingAfter).toFixed(1)}%</span>
            <button className="btn tiny ghost" onClick={replay}>↻ 다시 시뮬레이션</button>
          </div>
        )}
      </div>
      <FlowLane title="AI 도입 후" nodes={flows.after} p={prog.after} uLabel={uLabel} active={phase === 'after'} ai dim={phase === 'idle' || phase === 'before' || phase === 'beforeDone'} />
    </div>
  );
}

function FlowLane({ title, nodes, p, uLabel, active, ai, dim }: {
  title: string; nodes: FlowNode[]; p: number; uLabel: string; active: boolean; ai?: boolean; dim?: boolean;
}) {
  // 노드별 진행: 노동시간+경과시간 비례로 순차 진행
  const weights = nodes.map((n) => n.labor + n.wait + 0.0001);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const per = weights.map((w) => { const st = acc / total; acc += w; return Math.max(0, Math.min(1, (p - st) / (w / total))); });
  const labor = nodes.reduce((x, n, i) => x + n.labor * per[i], 0);
  const wait = nodes.reduce((x, n, i) => x + n.wait * per[i], 0);
  return (
    <div className={`lane${ai ? ' lane-ai' : ''}${dim ? ' dim' : ''}${active ? ' active' : ''}`}>
      <div className="lane-head">
        <b>{title}</b>
        <span className="timers">
          <span className="t-labor">투입 <b className="num">{fmtMin(labor)}</b></span>
          <span className="t-wait">대기 <b className="num">{fmtMin(wait)}</b></span>
          <small>{uLabel}</small>
        </span>
      </div>
      <ol className="nodes">
        {nodes.map((n, i) => (
          <li key={n.label + i} className={`node k-${n.kind}${per[i] >= 1 ? ' done' : per[i] > 0 ? ' run' : ''}`}>
            <span className="node-fill" style={{ transform: `scaleX(${per[i]})` }} />
            <span className="node-kind">{n.kind === 'ai' ? 'AI' : n.kind === 'approve' ? '대기' : '사람'}</span>
            <span className="node-label">{n.label}</span>
            <span className="node-time num">{n.labor > 0.0005 ? fmtMin(n.labor) : ''}{n.wait > 0.0005 ? `${n.labor > 0.0005 ? ' + ' : ''}⏳${fmtMin(n.wait)}` : ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── 시간 구성 직접 조정 ──
const ADJ: { key: ComponentKey; label: string; group: 'before' | 'after'; elapsed?: boolean }[] = [
  { key: 'beforeDirect', label: '직접 작업 시간', group: 'before' },
  { key: 'beforeReview', label: '검토 및 수정 시간', group: 'before' },
  { key: 'beforeWait', label: '승인 및 대기 시간', group: 'before', elapsed: true },
  { key: 'prompt', label: 'AI 입력과 지시 시간', group: 'after' },
  { key: 'aiGen', label: 'AI 결과물 생성 시간', group: 'after', elapsed: true },
  { key: 'manualDirect', label: '남은 직접 작업 시간', group: 'after' },
  { key: 'aiReview', label: 'AI 결과 검토 및 수정 시간', group: 'after' },
  { key: 'rework', label: '오류 수정과 재작업 시간', group: 'after' },
  { key: 'afterWait', label: '승인 및 대기 시간', group: 'after', elapsed: true },
  { key: 'maintenance', label: '도구 설정 및 유지관리 시간', group: 'after' },
];

function valueOf(r: TaskResult, key: ComponentKey): number {
  switch (key) {
    case 'beforeDirect': return r.before.direct;
    case 'beforeReview': return r.before.review;
    case 'beforeWait': return r.before.wait;
    case 'prompt': return r.after.prompt;
    case 'aiGen': return r.after.aiGen;
    case 'manualDirect': return r.after.manualDirect;
    case 'aiReview': return r.after.aiReview;
    case 'rework': return r.after.rework;
    case 'afterWait': return r.after.wait;
    case 'maintenance': return r.after.maintenance;
  }
}

function Adjuster({ ra }: { ra: TaskResult }) {
  const { s, d } = useApp();
  const ov = s.overrides[ra.task.id] ?? {};
  const n = Object.keys(ov).length;
  return (
    <details className="card adjust">
      <summary>
        <span><b>시간 구성 직접 조정하기</b><small>내 경험에 맞게 각 항목의 주당 시간을 바꿔보세요{n ? ` · ${n}개 조정됨` : ''}</small></span>
      </summary>
      {(['before', 'after'] as const).map((g) => (
        <div key={g} className="adj-group">
          <h4>{g === 'before' ? 'AI 도입 전' : 'AI 도입 후'}</h4>
          {ADJ.filter((a) => a.group === g).map((a) => {
            const v = valueOf(ra, a.key);
            const max = Math.max(2, Math.ceil(ra.task.hours * 1.5));
            const id = `adj-${ra.task.id}-${a.key}`;
            return (
              <div key={a.key} className={`adj${ov[a.key] !== undefined ? ' changed' : ''}`}>
                <label htmlFor={id}>{a.label}{a.elapsed && <em>경과시간</em>}</label>
                <input id={id} type="range" min={0} max={max} step={0.05} value={Math.min(max, v)}
                  onChange={(e) => d({ type: 'override', taskId: ra.task.id, key: a.key, value: Number(e.target.value) })} />
                <span className="num">{v.toFixed(2)}h</span>
                {ov[a.key] !== undefined && <button className="btn tiny ghost" onClick={() => d({ type: 'override', taskId: ra.task.id, key: a.key, value: null })}>기본값</button>}
              </div>
            );
          })}
        </div>
      ))}
      {n > 0 && <button className="btn tiny" onClick={() => d({ type: 'resetOverrides', taskId: ra.task.id })}>이 업무 전체 기본값으로</button>}
      <p className="fine">AI 도입 전 값을 바꾸면 AI 도입 후 기본값도 함께 다시 계산됩니다. '재설계 후'에는 여기서 정한 값에 재설계 효과가 곱해집니다.</p>
    </details>
  );
}

function Basis({ r }: { r: TaskResult }) {
  const tp = TYPE_PROFILE[r.task.type];
  const lp = LEVEL_PROFILE[r.task.aiLevel];
  const f = (v: number) => v.toFixed(2);
  return (
    <div className="basis-body">
      <ul className="formula">
        <li>잠재력 = 유형 상한 {tp.automation} × 적용 가능성 배수 → <b>{Math.round(r.potential * 100)}%</b></li>
        <li>실제 대체율 r = 잠재력 × (1 − 이미 실현한 비율 {lp.alreadyCaptured}) → <b>{Math.round(r.reduction * 100)}%</b> (상한 {SIM.maxReduction * 100}%)</li>
        <li>AI 입력·지시 = 대체된 직접작업 × {lp.promptRatio} = <b>{f(r.after.prompt)}h</b></li>
        <li>AI 결과 검토 = 대체된 직접작업 × 검토비율 {tp.verifyRatio}{r.task.difficulty === 'verify' ? ` + ${SIM.difficultyVerifyBonus}(검증 어려움)` : ''} = <b>{f(r.after.aiReview)}h</b></li>
        <li>오류 재작업 = 대체된 직접작업 × 오류율 {lp.errorRate} × 수정비용 {SIM.reworkCost} = <b>{f(r.after.rework)}h</b></li>
        <li>유지관리 = {lp.maintenance}h × min(1, r ÷ 0.3) = <b>{f(r.after.maintenance)}h</b></li>
        <li>승인 대기(경과) = 기존 대기 × (1 + {SIM.waitGrowthByReduction} × r) = <b>{f(r.after.wait)}h</b></li>
        <li>요청량 증가율 = r × {SIM.volumeGrowthByReduction} = <b>{(r.after.volumeGrowth * 100).toFixed(1)}%</b> → 추가 노동 {f(r.after.extraVolumeLabor)}h (절감률 계산과 분리)</li>
        <li>절감률 = (기존 {f(r.before.labor)}h − 변경 후 {f(r.after.labor)}h) ÷ 기존 × 100 = <b>{(((r.before.labor - r.after.labor) / (r.before.labor || 1)) * 100).toFixed(1)}%</b></li>
      </ul>
      <p className="fine">가정값은 프로젝트의 src/engine/config.ts에서 바꿀 수 있습니다.</p>
    </div>
  );
}

function EnvBasis() {
  const { s } = useApp();
  const E = envFactors(s.profile.env);
  const x = (v: number) => `×${v.toFixed(2)}`;
  return (
    <div className="basis-body">
      <h4>일하는 환경(Q.G·Q.H) 반영 배수</h4>
      <ul className="factors">
        <li><span>승인 대기 (승인 방식)</span><b className="num">{x(E.waitMult)}</b></li>
        <li><span>승인자 검토 부담 (승인 방식)</span><b className="num">{x(E.approverMult)}</b></li>
        <li><span>오류 위험 (개인정보 포함·외부 AI 사용)</span><b className="num">{x(E.riskMult)}</b></li>
        <li><span>도구 유지관리 (팀 활용·학습 시간·도구 유무)</span><b className="num">{x(E.maintMult)}</b></li>
        <li><span>AI 지시 시간 (팀 활용 방식)</span><b className="num">{x(E.promptMult)}</b></li>
        <li><span>AI 오류율 (학습 시간)</span><b className="num">{x(E.errorMult)}</b></li>
        <li><span>반복 처리 업무 잠재력 (자동화 도구)</span><b className="num">{x(E.repetitiveBoost)}</b></li>
      </ul>
    </div>
  );
}
