import { useMemo, useState } from 'react';
import { StepNav } from '../App';
import { ARCHETYPES, REINVEST } from '../engine/config';
import { jobLabel } from '../jobCatalog';
import { cautions, nextExperiment } from '../engine/diagnose';
import { fmtH } from '../engine/simulate';
import { Composition, CountUp, Delta, Donut, type Segment } from '../components/viz';
import { buildReport, toCSV, toText } from '../report';
import { useApp } from '../state';
import { COLORS, useResults } from '../useResults';

const sgn = (v: number) => (v > 0.0049 ? '+' : v < -0.0049 ? '−' : '±');
const TASK_COLORS = ['#4F86F7', '#8A6CF0', '#3FB09C', '#E0A458', '#E57373'];
const INVEST_COLORS = ['#8CC63F', '#3FBFAD', '#F2B33D', '#E77FAA', '#6F9BFF', '#A98BF0'];

export default function Future() {
  const { s, d } = useApp();
  const res = useResults();
  const { after, redesign, dx, contrib } = res;
  const T = redesign.totals;
  const free = Math.max(0, T.freeTime);
  const items = REINVEST[s.profile.job === 'edu' ? 'edu' : 'general'];
  const allocated = items.reduce((x, it) => x + (s.reinvest[it.key] ?? 0), 0);
  const overAlloc = allocated > free + 1e-6;
  const best = contrib[0];
  const expTask = s.profile.tasks.find((t) => t.id === dx.firstExperiment?.id) ?? s.profile.tasks[0];
  const tips = cautions(s.profile);
  const A = ARCHETYPES[dx.archetype];

  const report = useMemo(() => buildReport(s, res), [s, res]);

  const donut: Segment[] = [
    { key: 'direct', label: '직접 작업', value: redesign.tasks.reduce((x, r) => x + r.after.manualDirect + r.before.review, 0), color: COLORS.direct },
    { key: 'ai', label: 'AI 지시·관리', value: redesign.tasks.reduce((x, r) => x + r.after.prompt + r.after.maintenance, 0) + T.overhead, color: COLORS.prompt },
    { key: 'verify', label: '검토·재작업', value: redesign.tasks.reduce((x, r) => x + r.after.aiReview + r.after.rework, 0), color: COLORS.aiReview },
    { key: 'extra', label: '늘어난 요청', value: T.extraVolumeLabor, color: COLORS.extra },
    ...items.map((it, i) => ({ key: it.key, label: it.label, value: s.reinvest[it.key] ?? 0, color: INVEST_COLORS[i] })),
  ];

  const beforeComp: Segment[] = after.tasks.map((r, i) => ({ key: r.task.id, label: r.task.name, value: r.before.labor, color: TASK_COLORS[i % 5] }));
  const futureComp: Segment[] = [
    ...redesign.tasks.map((r, i) => ({ key: r.task.id, label: r.task.name, value: r.after.labor + r.after.extraVolumeLabor, color: TASK_COLORS[i % 5] })),
    { key: 'ov', label: '재설계 준비', value: T.overhead, color: COLORS.overhead },
    ...items.map((it, i) => ({ key: it.key, label: it.label, value: Math.min(s.reinvest[it.key] ?? 0, free), color: INVEST_COLORS[i] })),
  ];

  return (
    <section className="future">
      <p className="eyebrow">STEP 6 · AI와 함께 일하는 미래의 나</p>
      <h1 className="h-screen">AI와 함께 일하는 미래의 나</h1>

      <div className="dash">
        <Tile label="AI 도입 전" value={T.beforeLabor} note="주당 업무시간" />
        <Tile label="AI 도입 후" value={after.totals.afterLabor} note={`같은 업무량 기준 · 요청 증가 시 +${fmtH(after.totals.extraVolumeLabor)}`} />
        <Tile label="업무 흐름 재설계 후" value={T.afterLabor + T.overhead} note={`같은 업무량 기준 · 요청 증가 시 +${fmtH(T.extraVolumeLabor)}`} accent />
        <Tile label="순절감 시간" value={T.savedSameVolume} note="같은 업무량 기준" />
        <Tile label="절감률" value={T.savingRate} suffix="%" note="(기존 − 변경 후) ÷ 기존 × 100" />
        <div className="tile">
          <span>예상 품질 변화</span>
          <b><CountUp value={T.afterQuality} decimals={0} />점</b>
          <Delta value={T.afterQuality - T.beforeQuality} unit="점" goodWhen="up" decimals={0} />
        </div>
        <div className="tile">
          <span>오류·재작업 위험</span>
          <b><CountUp value={T.afterRisk} decimals={0} />점</b>
          <Delta value={T.afterRisk - T.beforeRisk} unit="점" goodWhen="down" decimals={0} />
        </div>
        <div className="tile">
          <span>승인 대기(경과시간)</span>
          <b><CountUp value={T.afterWait} />시간</b>
          <Delta value={T.afterWait - T.beforeWait} unit="시간" goodWhen="down" />
        </div>
      </div>

      <div className="card split">
        <div className="split-l">
          <h3>절감한 시간은 어디로 갔을까?</h3>
          <ul className="flowcalc">
            <li><span>같은 업무량 기준 절감</span><b className="num">{fmtH(T.savedSameVolume)}</b></li>
            <li><span>늘어난 요청 처리(처리량 +{T.volumeGrowth.toFixed(1)}%)</span><b className="num neg">−{fmtH(T.extraVolumeLabor)}</b></li>
            <li className="sum"><span>재투자할 수 있는 시간</span><b className="num">{fmtH(T.freeTime)}</b></li>
          </ul>
          {T.freeTime <= 0.05 && (
            <p className="warn">늘어난 요청과 관리 시간이 절감분을 모두 가져갔습니다. 상황 대응이나 재설계 항목을 바꿔 다시 시뮬레이션해 보세요.</p>
          )}
        </div>
        <Donut segments={donut} center={fmtH(T.actualLabor + allocated)} sub="미래의 주당 시간" />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>확보한 시간 재투자하기</h3>
          <span className={`pill ${overAlloc ? 'bad' : 'good'}`}><span className="num">{allocated.toFixed(1)} / {free.toFixed(1)}</span>시간</span>
        </div>
        {overAlloc && <p className="warn">⚠ 확보한 시간보다 {(allocated - free).toFixed(1)}시간 더 배분했습니다. 슬라이더를 줄여 주세요.</p>}
        <div className="invest">
          {items.map((it, i) => {
            const v = s.reinvest[it.key] ?? 0;
            const id = `inv-${it.key}`;
            return (
              <div key={it.key} className="inv">
                <label htmlFor={id}><i style={{ background: INVEST_COLORS[i] }} />{it.label}</label>
                <input id={id} type="range" min={0} max={Math.max(0.5, Math.ceil(free * 2) / 2)} step={0.5} value={v}
                  onChange={(e) => d({ type: 'reinvest', key: it.key, v: Number(e.target.value) })} disabled={free <= 0} />
                <span className="num">{v.toFixed(1)}h</span>
              </div>
            );
          })}
        </div>
        <div className="comps">
          <Composition title="지금의 주간 업무 구성" segments={beforeComp} total={T.beforeLabor} />
          <Composition title="재설계·재투자 후 업무 구성" segments={futureComp} total={futureComp.reduce((x, y) => x + y.value, 0)} />
        </div>
      </div>

      <div className="report-card" id="report">
        <div className="rc-head">
          <span className="rc-icon" aria-hidden="true">{A.icon}</span>
          <div>
            <small>나의 AI 업무혁신 리포트 · {jobLabel(s.profile)}</small>
            <h2>{A.name}</h2>
            <p>{dx.sentence}</p>
          </div>
        </div>
        <div className="rc-grid">
          <div>
            <h4>AI 도입 잠재력 TOP 3</h4>
            <ol>{dx.topTasks.map((t) => <li key={t.id}>{t.name} <span className="num">({t.savedHours >= 0 ? '−' : '+'}{fmtH(Math.abs(t.savedHours))}/주)</span></li>)}</ol>
          </div>
          <div>
            <h4>주의해야 할 병목 TOP 2</h4>
            <ol>{dx.bottlenecks.map((b) => <li key={b.key}>{b.label} <span className="num">(주 {fmtH(b.hours)})</span></li>)}</ol>
          </div>
          <div>
            <h4>시뮬레이션상 절감 가능 시간</h4>
            <p className="big num">{fmtH(T.savedSameVolume)}<small> / 주 ({T.savingRate.toFixed(1)}%)</small></p>
          </div>
          <div>
            <h4>가장 효과적이었던 재설계 선택 <small>(성공 기준 가중)</small></h4>
            <p>{best && best.score > 0.01 ? <>{best.label}<small className="num"> · 노동 {sgn(-best.hours)}{fmtH(Math.abs(best.hours))} · 대기 {sgn(-best.wait)}{fmtH(Math.abs(best.wait))} · 품질 {sgn(best.quality)}{Math.abs(best.quality).toFixed(1)}점 · 위험 {sgn(-best.risk)}{Math.abs(best.risk).toFixed(1)}점</small></> : '아직 효과를 낸 재설계 선택이 없습니다.'}</p>
          </div>
          <div className="wide">
            <h4>다음 주에 시도해볼 작은 실험</h4>
            <p>{nextExperiment(expTask, s.profile)}</p>
          </div>
          {(s.profile.notes.pain.trim() || s.profile.notes.tips.trim()) && (
            <div className="wide story">
              <h4>나의 이야기</h4>
              {s.profile.notes.pain.trim() && <p><b>AI로 덜고 싶은 고민</b> {s.profile.notes.pain}</p>}
              {s.profile.notes.tips.trim() && <p><b>나의 활용 팁</b> {s.profile.notes.tips}</p>}
            </div>
          )}
          <div className="wide">
            <h4>품질·보안 주의사항</h4>
            <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
        <p className="fine">가정에 기반한 교육용 추정치입니다. 생성 시각 {report.generatedAt}</p>
      </div>

      <Exports json={JSON.stringify(report, null, 2)} csv={toCSV(report)} text={toText(report)} />

      <details className="basis">
        <summary>최종 결과 계산 근거 보기</summary>
        <ul className="formula">
          <li>AI 도입 전 = 업무별 (직접 작업 + 기존 검토) 합계 = <b>{fmtH(T.beforeLabor, 2)}</b></li>
          <li>재설계 후(같은 업무량) = 업무별 (AI 지시 + 남은 직접 작업 + 기존 검토 + AI 결과 검토 + 재작업 + 유지관리) × 재설계 배수 + 재설계 준비 {fmtH(T.overhead, 2)} = <b>{fmtH(T.afterLabor + T.overhead, 2)}</b></li>
          <li>절감률 = ({fmtH(T.beforeLabor, 2)} − {fmtH(T.afterLabor + T.overhead, 2)}) ÷ {fmtH(T.beforeLabor, 2)} × 100 = <b>{T.savingRate.toFixed(1)}%</b></li>
          <li>늘어난 요청 처리 = 업무별 (유지관리 제외 노동시간 × 요청 증가율) = <b>{fmtH(T.extraVolumeLabor, 2)}</b> → 절감률과 분리해 표시</li>
          <li>승인 대기는 경과시간이라 노동시간 합계에 넣지 않습니다: {fmtH(T.beforeWait, 2)} → {fmtH(T.afterWait, 2)}</li>
          <li>품질·위험 점수는 시간과 별개 지표이며 중요도 가중 평균입니다.</li>
        </ul>
        <h4>적용된 재설계 선택과 기여도</h4>
        <ul className="factors">
          {contrib.map((c) => <li key={c.key}><span>{c.label}</span><b className="num">노동 {c.hours >= 0 ? '−' : '+'}{Math.abs(c.hours).toFixed(2)}h · 대기 {c.wait >= 0 ? '−' : '+'}{Math.abs(c.wait).toFixed(2)}h · 품질 {c.quality >= 0 ? '+' : ''}{c.quality.toFixed(1)}</b></li>)}
          {!contrib.length && <li><span>적용된 재설계 선택이 없습니다.</span></li>}
        </ul>
      </details>

      <div className="endbar">
        <button className="btn ghost" onClick={() => { d({ type: 'nextRound' }); d({ type: 'go', step: 4 }); }}>🎲 다른 상황으로 다시 해보기</button>
        <button className="btn ghost" onClick={() => d({ type: 'go', step: 3 })}>↻ 시뮬레이션 다시 보기</button>
        <button className="btn ghost" onClick={() => d({ type: 'go', step: 1, sub: 1 })}>✎ 업무 수정하기</button>
      </div>
      <StepNav onPrev={() => d({ type: 'go', step: 4 })} />
    </section>
  );
}

function Tile({ label, value, note, suffix = '시간', accent }: { label: string; value: number; note: string; suffix?: string; accent?: boolean }) {
  return (
    <div className={`tile${accent ? ' accent' : ''}`}>
      <span>{label}</span>
      <b><CountUp value={value} suffix={suffix} /></b>
      <small>{note}</small>
    </div>
  );
}

const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();

function download(name: string, content: string, type: string) {
  const blob = new Blob(['﻿' + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Exports({ json, csv, text }: { json: string; csv: string; text: string }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState<'' | 'json' | 'csv' | 'text'>('');
  const copy = async (v: string, label: string) => {
    try { await navigator.clipboard.writeText(v); setMsg(`${label}을(를) 복사했습니다.`); }
    catch { setShow(label === '요약' ? 'text' : label === 'CSV' ? 'csv' : 'json'); setMsg('아래 상자의 내용을 선택해 복사해 주세요.'); }
  };
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <div className="card exports">
      <h3>결과 저장하기</h3>
      <div className="ex-btns">
        {!framed && <>
          <button className="btn" onClick={() => window.print()}>🖨 인쇄 / PDF 저장</button>
          <button className="btn" onClick={() => download(`ai-simulator-${stamp}.json`, json, 'application/json')}>JSON 내려받기</button>
          <button className="btn" onClick={() => download(`ai-simulator-${stamp}.csv`, csv, 'text/csv')}>CSV 내려받기</button>
        </>}
        <button className="btn" onClick={() => copy(text, '요약')}>리포트 요약 복사</button>
        <button className="btn" onClick={() => copy(csv, 'CSV')}>CSV 복사</button>
        <button className="btn" onClick={() => copy(json, 'JSON')}>JSON 복사</button>
      </div>
      {framed && <p className="fine">이 화면에서는 파일 내려받기와 인쇄가 막혀 있습니다. 복사 버튼을 쓰거나, 함께 받은 HTML 파일을 브라우저에서 직접 열면 내려받기·인쇄가 됩니다.</p>}
      {msg && <p className="ok" role="status">{msg}</p>}
      {show && <textarea className="dump" readOnly value={show === 'json' ? json : show === 'csv' ? csv : text} onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
