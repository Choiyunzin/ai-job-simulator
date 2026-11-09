import { useEffect, useMemo, useRef, useState } from 'react';
import { StepNav } from '../App';
import { APPLICABILITY_MULT, E_POTENTIAL_COEF, FRONTIER_PENALTY, LABELS, LEVEL_PROFILE, REDESIGN, SIM, TYPE_PROFILE, automationCap } from '../engine/config';
import { eLevelOf, isStd, outsideFrontier } from '../engine/research';
import { envFactors, fmtMin } from '../engine/simulate';
import type { ComponentKey, RedesignToggle, TaskResult } from '../engine/types';
import { Delta, ScenarioBars, useReducedMotion, type Segment } from '../components/viz';
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
      <StepNav onPrev={() => d({ type: 'go', step: 1, sub: 2 })} /></section>;
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
      { label: '지금 방식', segments: beforeSegments(ra, k), wait: ra.before.wait / k },
      { label: 'AI만 적용', segments: afterSegments(ra, k), wait: ra.after.wait / k },
      { label: '업무 흐름까지 재설계', segments: [...afterSegments(rr, k), { key: 'overhead', label: '재설계 준비(체크리스트·템플릿)', value: redesignOverheadShare / k, color: COLORS.overhead }], wait: rr.after.wait / k, highlight: true },
    ]
    : [
      { label: '지금 방식', segments: sumTasks(after.tasks, beforeSegments), wait: after.totals.beforeWait },
      { label: 'AI만 적용', segments: sumTasks(after.tasks, afterSegments), wait: after.totals.afterWait },
      { label: '업무 흐름까지 재설계', segments: [...sumTasks(redesign.tasks, afterSegments), { key: 'overhead', label: '재설계 준비(체크리스트·템플릿)', value: redesign.totals.overhead, color: COLORS.overhead }], wait: redesign.totals.afterWait, highlight: true },
    ];
  // 막대는 의미 두 가지(사람이 하던 일 / AI 때문에 새로 생긴 일)로 묶어서 보여 줍니다. 세부 항목은 표로.
  const grouped = rows.map((r) => ({ ...r, segments: groupSegments(r.segments) }));

  const S = scope === 'task'
    ? {
      title: ra.task.name, unit: uLabel,
      before: rows[0] ? sumSeg(rows[0].segments) : 0, after: sumSeg(rows[1].segments), redesign: sumSeg(rows[2].segments),
      waits: [rows[0].wait, rows[1].wait, rows[2].wait],
      savingAfter, savingRedesign,
      quality: [ra.before.quality, rr.after.quality], risk: [ra.before.risk, rr.after.risk],
      extra: ra.after.volumeGrowth > 0.005 ? { pct: ra.after.volumeGrowth * 100, h: ra.after.extraVolumeLabor } : null,
    }
    : {
      title: '전체 업무 합계', unit: '주당',
      before: sumSeg(rows[0].segments), after: sumSeg(rows[1].segments), redesign: sumSeg(rows[2].segments),
      waits: [rows[0].wait, rows[1].wait, rows[2].wait],
      savingAfter: after.totals.savingRate, savingRedesign: redesign.totals.savingRate,
      quality: [redesign.totals.beforeQuality, redesign.totals.afterQuality], risk: [redesign.totals.beforeRisk, redesign.totals.afterRisk],
      extra: after.totals.extraVolumeLabor > 0.05 ? { pct: null as number | null, h: after.totals.extraVolumeLabor } : null,
    };
  const subject = scope === 'task' ? `'${ra.task.name}'` : '전체 업무';
  const verdict = S.before <= 0 ? null : (
    <>
      {S.savingAfter < 10
        ? <>AI가 초안을 빨리 만들어도 검토·재작업·관리 시간이 생겨서, {subject}의 실제 절감은 <b>{S.savingAfter.toFixed(1)}%</b>에 그쳐요. </>
        : <>AI만 적용해도 {subject}은 <b>{S.savingAfter.toFixed(1)}%</b> 줄어요. </>}
      {S.savingRedesign > S.savingAfter
        ? <>업무 흐름까지 재설계하면 <b>{S.savingRedesign.toFixed(1)}%</b>까지 커져요.</>
        : <>재설계 준비 시간이 아직 효과보다 커요. 아래 재설계 항목을 바꿔 보세요.</>}
      {S.extra && <> 다만 빨라진 만큼 요청이 {S.extra.pct !== null ? `약 ${S.extra.pct.toFixed(0)}% ` : ''}늘어 주당 {fmtMin(S.extra.h)}이 더 들 수 있어요.</>}
    </>
  );

  return (
    <section className="sim">
      <p className="eyebrow">STEP 4 · AI 도입 전후 생산성 시뮬레이션</p>
      <h1 className="h-screen">AI를 도입하면 내 업무는 얼마나 달라질까?</h1>
      <p className="fine">시간은 업무 비율 × 주 {s.profile.weeklyHours}시간 근무로 환산했습니다. 근무시간은 마지막 '미래의 나'에서 바꿔 볼 수 있어요.</p>

      <div className="sim-pick">
        <label htmlFor="simtask">시뮬레이션할 업무</label>
        <select id="simtask" value={taskId} disabled={scope === 'all'} onChange={(e) => d({ type: 'simTask', id: e.target.value })}>
          {after.tasks.map((r) => <option key={r.task.id} value={r.task.id}>{r.task.name}</option>)}
        </select>
        <div className="seg small" role="radiogroup" aria-label="비교 범위">
          <button className={scope === 'task' ? 'on' : ''} role="radio" aria-checked={scope === 'task'} onClick={() => setScope('task')}>이 업무</button>
          <button className={scope === 'all' ? 'on' : ''} role="radio" aria-checked={scope === 'all'} onClick={() => setScope('all')}>전체 업무</button>
        </div>
        {scope === 'task' && (
          <div className="seg small" role="radiogroup" aria-label="시간 단위">
            <button className={unit === 'week' ? 'on' : ''} aria-checked={unit === 'week'} role="radio" onClick={() => setUnit('week')}>주당</button>
            <button className={unit === 'each' ? 'on' : ''} aria-checked={unit === 'each'} role="radio" onClick={() => setUnit('each')}>건당</button>
          </div>
        )}
      </div>

      {/* 1. 결론 먼저: 지금 → AI만 → 재설계 */}
      <div className="card sim-summary">
        <div className="ss-head">
          <h2>{S.title}</h2>
          {scope === 'task'
            ? <p>{LABELS.type[ra.task.type]} · {LABELS.frequency[ra.task.frequency]}(주 {ra.occurrencesPerWeek}건) · 현재 AI {ra.task.aiLevel}단계 · 적용 가능성 {LABELS.applicability[ra.task.applicability].title}</p>
            : <p>입력한 업무 {after.tasks.length}개를 모두 더한 값이에요.</p>}
        </div>
        <ol className="ss-steps">
          <li>
            <span className="ss-label">지금 방식</span>
            <b className="num">{fmtMin(S.before)}</b>
            <small>{S.unit} 투입 · 대기 {fmtMin(S.waits[0])}</small>
          </li>
          <li>
            <span className="ss-label">AI만 적용</span>
            <b className="num">{fmtMin(S.after)}</b>
            <span className={`pill ${S.savingAfter >= 0 ? 'good' : 'bad'}`}>{S.savingAfter >= 0 ? '절감' : '증가'} {Math.abs(S.savingAfter).toFixed(1)}%</span>
            <small>{S.unit} 투입 · 대기 {fmtMin(S.waits[1])}</small>
          </li>
          <li className="hi">
            <span className="ss-label">업무 흐름까지 재설계</span>
            <b className="num">{fmtMin(S.redesign)}</b>
            <span className={`pill ${S.savingRedesign >= 0 ? 'good' : 'bad'}`}>{S.savingRedesign >= 0 ? '절감' : '증가'} {Math.abs(S.savingRedesign).toFixed(1)}%</span>
            <small>{S.unit} 투입 · 대기 {fmtMin(S.waits[2])}</small>
          </li>
        </ol>
        {verdict && <p className="insight">{verdict}</p>}
        <div className="ss-quality">
          <span>품질 점수 <b className="num">{S.quality[1].toFixed(0)}</b>점 <Delta value={S.quality[1] - S.quality[0]} goodWhen="up" decimals={0} unit="점" /> <small>높을수록 좋음</small></span>
          <span>오류 위험 점수 <b className="num">{S.risk[1].toFixed(0)}</b>점 <Delta value={S.risk[1] - S.risk[0]} goodWhen="down" decimals={0} unit="점" /> <small>낮을수록 좋음</small></span>
          <small>재설계 후 기준, 지금 방식과 비교</small>
        </div>
      </div>

      {/* 2. 어디서 줄고 어디서 늘었나 */}
      <div className="card">
        <h3>시간은 어디서 줄고, 어디서 늘었나요? <small>({S.unit} · {S.title})</small></h3>
        <ScenarioBars rows={grouped} note="AI가 직접 작업을 덜어 주는 대신 지시·결과 검토·재작업·관리 시간이 새로 생겨요. 빗금은 승인·대기로 흘러간 경과시간이라 투입 시간 합계에는 넣지 않았어요." />
        <details className="breakdown">
          <summary>항목별 시간 표로 보기</summary>
          <BreakdownTable rows={rows} />
        </details>
      </div>

      {/* 3. 재설계 항목 (바꾸면 위 결과가 바로 바뀜) */}
      <div className="card">
        <h3>업무 흐름 재설계 항목</h3>
        <p className="fine">켜고 끄면 위의 '업무 흐름까지 재설계' 결과가 바로 바뀌어요. 다음 단계의 상황 대응 선택도 여기에 더해집니다.</p>
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

      {/* 4. 업무 흐름으로 직접 보기 */}
      <div className="card">
        <h3>업무 흐름으로 보기 <small>· {ra.task.name}</small></h3>
        <p className="fine">버튼을 누르면 기존 방식과 AI 도입 후의 업무가 단계별로 처리되는 모습을 볼 수 있어요.</p>
        <FlowRunner ra={ra} k={k} uLabel={uLabel} savingAfter={savingAfter} />
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

const GROUP_COLORS = { human: '#A9B4CC', ai: '#4F86F7' };
const HUMAN_KEYS = ['direct', 'review'];

function groupSegments(segs: Segment[]): Segment[] {
  const sum = (f: (x: Segment) => boolean) => segs.filter(f).reduce((a, x) => a + x.value, 0);
  return [
    { key: 'human', label: '사람이 하던 일 (직접 작업·기존 검토)', value: sum((x) => HUMAN_KEYS.includes(x.key)), color: GROUP_COLORS.human },
    { key: 'ai', label: 'AI 때문에 새로 생긴 일 (지시·결과 검토·재작업·관리·재설계 준비)', value: sum((x) => !HUMAN_KEYS.includes(x.key)), color: GROUP_COLORS.ai },
  ];
}

/** 항목 × 세 가지 방식 표 */
function BreakdownTable({ rows }: { rows: { label: string; segments: Segment[]; wait: number }[] }) {
  const keys: { key: string; label: string }[] = [];
  rows.forEach((r) => r.segments.forEach((x) => { if (!keys.some((k) => k.key === x.key)) keys.push({ key: x.key, label: x.label }); }));
  const val = (r: { segments: Segment[] }, key: string) => r.segments.find((x) => x.key === key)?.value ?? 0;
  const total = (r: { segments: Segment[] }) => r.segments.reduce((a, x) => a + x.value, 0);
  const cell = (v: number) => (v > 0.0005 ? fmtMin(v) : '—');
  return (
    <div className="tbl-wrap">
      <table className="tbl breakdown-tbl">
        <thead><tr><th>항목</th>{rows.map((r) => <th key={r.label} className="r">{r.label}</th>)}</tr></thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.key} className={HUMAN_KEYS.includes(k.key) ? '' : 'ai-row'}>
              <td>{k.label}</td>
              {rows.map((r) => <td key={r.label} className="r num">{cell(val(r, k.key))}</td>)}
            </tr>
          ))}
          <tr className="sum"><td>투입 시간 합계</td>{rows.map((r) => <td key={r.label} className="r num">{fmtMin(total(r))}</td>)}</tr>
          <tr className="wait"><td>승인·대기 (경과시간, 합계 제외)</td>{rows.map((r) => <td key={r.label} className="r num">{cell(r.wait)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

function sumTasks(rs: TaskResult[], f: (r: TaskResult) => Segment[]): Segment[] {
  const base = rs[0] ? f(rs[0]).map((s) => ({ ...s, value: 0 })) : [];
  rs.forEach((r) => f(r).forEach((s, i) => { base[i].value += s.value; }));
  return base;
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
  const idle = p === 0 && !active; // 실행 전에는 0분 대신 전체 값을 미리 보여 줌
  const labor = nodes.reduce((x, n, i) => x + n.labor * (idle ? 1 : per[i]), 0);
  const wait = nodes.reduce((x, n, i) => x + n.wait * (idle ? 1 : per[i]), 0);
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
        <li>{isStd(r.task)
          ? <>잠재력 = 유형 상한 {automationCap(r.task.type).toFixed(2)} × 노출 계수 {E_POTENTIAL_COEF[eLevelOf(r.task)]}(연구 기준 {eLevelOf(r.task)}) → <b>{Math.round(r.potential * 100)}%</b></>
          : <>잠재력 = 유형 상한 {automationCap(r.task.type).toFixed(2)} × 적용 가능성 배수 {APPLICABILITY_MULT[r.task.applicability]} → <b>{Math.round(r.potential * 100)}%</b> <small>(직접 입력 업무 · 유형 추정)</small></>}</li>
        <li>실제 대체율 r = 잠재력 × (1 − 이미 실현한 비율 {lp.alreadyCaptured}) → <b>{Math.round(r.reduction * 100)}%</b> (상한 {SIM.maxReduction * 100}%)</li>
        <li>AI 입력·지시 = 대체된 직접작업 × {lp.promptRatio} = <b>{f(r.after.prompt)}h</b></li>
        <li>AI 결과 검토 = 대체된 직접작업 × 검토비율 {tp.verifyRatio}{r.task.difficulty === 'verify' ? ` + ${SIM.difficultyVerifyBonus}(검증 어려움)` : ''} = <b>{f(r.after.aiReview)}h</b></li>
        <li>오류 재작업 = 대체된 직접작업 × 오류율 {lp.errorRate}{outsideFrontier(r.task) ? ` × ${FRONTIER_PENALTY}(AI 능력 경계 밖 업무)` : ''} × 수정비용 {SIM.reworkCost} = <b>{f(r.after.rework)}h</b></li>
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
