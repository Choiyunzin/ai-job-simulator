// STEP 3 진단 리포트: 직무현황 · 태스크&스킬 · AI 영향분석 · 스킬 활용분석 · 업무패턴 · 실행 인사이트
import { useEffect, useMemo, useRef, useState } from 'react';
import { StepNav } from '../App';
import { AiImpact } from '../components/AiImpact';
import { ReadingGuide } from '../components/ReadingGuide';
import { careerLabel, jobLabel } from '../jobCatalog';
import { useApp } from '../state';
import { useResults } from '../useResults';
import type { Activity } from '../engine/types';
import {
  ACTIVITY, ACTIVITY_KEYS, QUADRANT_INFO, SKILL_LEVELS, Y_MID, buildInsights, computeWorkMap, levelDesc, useSkillCatalog,
  type Quadrant, type TaskMatch, type WorkMap,
} from '../workmap';
import { LAST_SUB, REFLECT } from './ProfileStep';

export const MODULES = [
  { key: 'status', no: '01', title: '직무현황', sub: '직무와 업무 구성' },
  { key: 'skill', no: '02', title: '태스크 & 스킬', sub: '업무별 활동과 스킬' },
  { key: 'ai', no: '03', title: 'AI 영향분석', sub: '업무별 AI 적용 가능성과 병목' },
  { key: 'use', no: '04', title: '스킬 활용분석', sub: '시간 비중 대비 스킬 수준' },
  { key: 'pattern', no: '05', title: '업무패턴', sub: '8가지 유형 기준 일하는 방식' },
  { key: 'next', no: '06', title: '실행 인사이트', sub: '진단 결과에 따른 다음 행동' },
] as const;

const pct = (v: number) => `${Math.round(v * 10) / 10}%`;
const h1 = (v: number) => `${Math.round(v * 10) / 10}시간`;
const lvName = (v: number | null) => (v === null ? '미선택' : SKILL_LEVELS[Math.min(4, Math.max(0, Math.round(v) - 1))].name);

export default function WorkReport() {
  const { s, d } = useApp();
  const catalog = useSkillCatalog();
  const { dx } = useResults();
  const m = useMemo(() => computeWorkMap(s.profile, catalog), [s.profile, catalog]);
  const insights = useMemo(() => buildInsights(m, dx.firstExperiment), [m, dx.firstExperiment]);
  const [mod, setMod] = useState(0);
  const [guide, setGuide] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const goMod = (i: number) => { setMod(i); top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const p = s.profile;
  const meta = [p.dept, p.teamSize && `팀 ${p.teamSize}`, careerLabel(p)].filter(Boolean).join(' · ');

  return (
    <section className="wr">
      <div className="wr-head card">
        <div>
          <h1>진단 리포트 · {jobLabel(p)}</h1>
          <small>{meta || '소속·경력 미입력'}</small>
          {p.reflect !== null && p.reflect <= 2 && (
            <p className="warn">응답 반영도 '{REFLECT[p.reflect - 1]}'. 결과는 참고용입니다.</p>
          )}
        </div>
        <button className="btn" onClick={() => setGuide(true)}>해석법</button>
      </div>

      <div ref={top} className="mod-nav" role="tablist" aria-label="진단 모듈">
        {MODULES.map((x, i) => (
          <button key={x.key} role="tab" aria-selected={mod === i} className={mod === i ? 'on' : ''} onClick={() => goMod(i)}>
            <span className="num">{x.no}</span>{x.title}
          </button>
        ))}
      </div>

      <div className="mod-body" key={mod}>
        <div className="mod-title">
          <span className="num">{MODULES[mod].no}</span>
          <div><h2>{MODULES[mod].title}</h2><p>{MODULES[mod].sub}</p></div>
        </div>
        {mod === 0 && <StatusModule m={m} />}
        {mod === 1 && <TaskSkillModule m={m} />}
        {mod === 2 && <AiImpact />}
        {mod === 3 && <SkillUseModule m={m} />}
        {mod === 4 && <PatternModule m={m} />}
        {mod === 5 && <NextModule insights={insights} />}
        <div className="mod-pager">
          {mod > 0 ? <button className="btn ghost" onClick={() => goMod(mod - 1)}>이전: {MODULES[mod - 1].title}</button> : <span />}
          {mod < MODULES.length - 1 && <button className="btn" onClick={() => goMod(mod + 1)}>다음: {MODULES[mod + 1].title}</button>}
        </div>
      </div>

      <StepNav onPrev={() => d({ type: 'go', step: 1, sub: LAST_SUB })} onNext={() => d({ type: 'go', step: 3 })} nextLabel="AI 도입 시뮬레이션 시작" />
      {guide && <ReadingGuide onClose={() => setGuide(false)} />}
    </section>
  );
}

/* ── 01 직무현황: 내 일은 이렇게 구성되어 있다 ── */
function StatusModule({ m }: { m: WorkMap }) {
  const { s } = useApp();
  const p = s.profile;
  const rows: [string, string][] = [
    ['소속 부서', p.dept || '—'], ['팀 인원', p.teamSize || '—'],
    ['직무', p.jobPath.length === 4 ? p.jobPath.join(' › ') : jobLabel(p)],
    ['직책', p.career.leader === 'yes' ? p.career.position || '직책자' : p.career.leader === 'no' ? '비직책자(팀원)' : '—'],
    ['근속기간', p.career.tenure || '—'], ['현 직무 경력', p.career.jobCareer || '—'],
  ];
  const rest = Math.max(0, 100 - m.totalShare);
  const maxShare = Math.max(1, ...m.tasks.map((t) => t.share), rest);
  return (
    <>
      <dl className="profile-grid">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="grid2 gap">
        <div className="card">
          <h3>태스크 구성 <small>업무 {m.tasks.length}개 · 전체 업무의 {pct(m.totalShare)}</small></h3>
          <ul className="hbars">
            {m.tasks.map((t, i) => (
              <li key={t.id} className={i === 0 ? 'top' : ''}>
                <span className="hb-label">{t.name}</span>
                <span className="hb-track"><i style={{ width: `${(t.share / maxShare) * 100}%` }} /></span>
                <b className="num">{pct(t.share)}</b>
              </li>
            ))}
            {rest > 0.05 && (
              <li className="muted">
                <span className="hb-label">회의·기타</span>
                <span className="hb-track"><i style={{ width: `${(rest / maxShare) * 100}%` }} /></span>
                <b className="num">{pct(rest)}</b>
              </li>
            )}
          </ul>
        </div>
        <div className="card">
          <h3>활동 구성 <small>입력한 업무 기준 · 업무별 주요 활동</small></h3>
          <ul className="hbars">
            {m.activities.map((a, i) => (
              <li key={a.key} className={i === 0 ? 'top' : ''}>
                <span className="hb-label">{ACTIVITY[a.key].label}</span>
                <span className="hb-track"><i style={{ width: `${a.share * 100}%` }} /></span>
                <b className="num">{pct(a.share * 100)}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card">
        <h3>스킬 수준 평균 <small>{m.skillAvg === null ? '스킬 수준 미입력' : `${m.skills.filter((x) => x.score !== null).length}개 스킬 기준`}</small></h3>
        <p><b className="num">{m.skillAvg === null ? '—' : m.skillAvg.toFixed(1)}</b> / 5{m.skillAvg !== null && ` · ${lvName(m.skillAvg)}`}</p>
      </div>
    </>
  );
}

/* ── 02 태스크 & 스킬 ── */
function TaskSkillModule({ m }: { m: WorkMap }) {
  return (
    <>
      <div className="card">
        <h3>업무별 연결 스킬 <small>숫자: 내 수준(1~5)</small></h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>업무</th><th className="r">비중</th><th>주요 활동</th><th>연결 스킬 · 내 수준</th></tr></thead>
            <tbody>
              {m.tasks.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.name}</b></td>
                  <td className="r num">{pct(t.share)}</td>
                  <td>{ACTIVITY[t.activity].label}</td>
                  <td>{t.skills.length
                    ? <span className="sk-pills">{t.skills.map((x) => <span key={x.name} className="sk-pill">{x.name}<em className="num">{x.score ?? '–'}</em></span>)}</span>
                    : <span className="fine">미연결</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>스킬 수준 <small>1 개념인지 · 2 가이드수행 · 3 독립수행 · 4 복잡대응 · 5 전문가</small></h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>스킬</th><th className="r">수준</th><th>단계</th><th>현재 단계 기준</th><th>연결 업무</th></tr></thead>
            <tbody>
              {m.skills.map((x) => (
                <tr key={x.def.name}>
                  <td><b>{x.def.name}</b></td>
                  <td className="r num">{x.score ?? '–'}</td>
                  <td>{x.score === null ? <span className="fine">미선택</span> : SKILL_LEVELS[x.score - 1].name}</td>
                  <td className={x.score === null ? 'dim' : ''}>{x.score !== null ? levelDesc(x.def, x.score) : x.def.def}</td>
                  <td>{x.linked.length ? x.linked.join(', ') : <span className="fine">없음</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── 04 스킬 활용분석 ── */
function SkillUseModule({ m }: { m: WorkMap }) {
  const { s } = useApp();
  const plotted = m.tasks.filter((t) => t.score !== null);
  const missing = m.tasks.filter((t) => t.score === null);
  return (
    <>
      <div className="card soft">
        <h3>태스크 비중 × 스킬 수준</h3>
        <p>비중이 큰 태스크에서 스킬 수준이 어느 정도인지 확인합니다. 스킬 보강이나 과업 조정 필요 여부를 판단하는 데 씁니다.</p>
        <ul className="axis-notes">
          <li><b>가로축(X)</b> 응답한 태스크별 비중 — 어떤 일에 시간을 얼마나 쓰는지</li>
          <li><b>세로축(Y)</b> 태스크에 연결된 스킬의 본인 평가 평균 — 해당 태스크의 스킬 수준</li>
          <li><b>매치 점수</b> 본인이 그 태스크를 하면서 스킬을 얼마나 능숙하게 활용하고 있는지 (1~5)</li>
          <li><b>원 크기</b> 시간 비중. 점에 마우스를 올리면 태스크 이름, 시간, 매치 점수 표시</li>
        </ul>
      </div>
      {plotted.length ? <SkillMatchChart tasks={plotted} xMid={m.xMid} weekly={s.profile.weeklyHours} /> : (
        <div className="card"><p className="fine">표시할 업무 없음. Q.B에서 업무별 스킬을 연결하고 Q.S에서 수준을 선택하세요.</p></div>
      )}
      <div className="quad-grid">
        {(['boost', 'core', 'adjust', 'expand'] as Quadrant[]).map((q) => {
          const list = plotted.filter((t) => t.quadrant === q);
          return (
            <div key={q} className={`card squad q-${q}${list.length ? '' : ' empty'}`}>
              <h3>{QUADRANT_INFO[q].title} <small className="num">{list.length}개</small></h3>
              <p>{QUADRANT_INFO[q].desc}</p>
              {list.length > 0 && <ul>{list.map((t) => <li key={t.id}>{t.name} <span className="num">{pct(t.share)} · {t.score!.toFixed(1)}점</span></li>)}</ul>}
            </div>
          );
        })}
      </div>
      {missing.length > 0 && <small>스킬 미연결·미평가로 제외: {missing.map((t) => t.name).join(', ')}</small>}
    </>
  );
}

function SkillMatchChart({ tasks, xMid, weekly }: { tasks: TaskMatch[]; xMid: number; weekly: number }) {
  const W = 600, H = 360, L = 52, R = 18, T = 18, B = 46;
  const maxShare = Math.max(...tasks.map((t) => t.share), xMid);
  const xMax = Math.min(100, Math.max(40, Math.ceil((maxShare + 8) / 10) * 10));
  const X = (v: number) => L + (v / xMax) * (W - L - R);
  const Y = (v: number) => T + ((5 - v) / 4) * (H - T - B);
  const rad = (share: number) => 7 + Math.sqrt(share) * 2.2;
  const [hover, setHover] = useState<string | null>(null);
  const hv = tasks.find((t) => t.id === hover);
  // 이름표: 기본은 원 위, 다른 이름표와 겹치면 원 아래 → 더 위로 옮겨 겹침을 피합니다.
  const labels = useMemo(() => {
    const placed: { id: string; x: number; y: number; text: string; w: number }[] = [];
    const hit = (x: number, y: number, w: number) => placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 4 && Math.abs(p.y - y) < 15);
    [...tasks].sort((a, b) => b.share - a.share).forEach((t) => {
      const text = t.name.length > 12 ? `${t.name.slice(0, 11)}…` : t.name;
      const w = text.length * 11.5;
      const cx = Math.min(W - R - w / 2, Math.max(L + w / 2, X(t.share)));
      const cy = Y(t.score!), r = rad(t.share);
      const tries = [cy - r - 6, cy + r + 15, cy - r - 22, cy + r + 31, cy - r - 38];
      const y = tries.find((ty) => !hit(cx, ty, w)) ?? tries[0];
      placed.push({ id: t.id, x: cx, y, text, w });
    });
    return placed;
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const xTicks = Array.from({ length: xMax / 10 + 1 }, (_, i) => i * 10).filter((v) => xMax <= 50 || v % 20 === 0);
  return (
    <div className="card chart-card">
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, maxWidth: "100%" }} role="img" aria-label="태스크 비중과 스킬 매치 점수 사분면">
          <rect x={X(xMid)} y={T} width={X(xMax) - X(xMid)} height={Y(Y_MID) - T} className="qbg core" />
          <rect x={X(xMid)} y={Y(Y_MID)} width={X(xMax) - X(xMid)} height={Y(1) - Y(Y_MID)} className="qbg boost" />
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" />
              <text x={L - 8} y={Y(v) + 4} textAnchor="end" className="tick">{v}</text>
            </g>
          ))}
          {xTicks.map((v) => <text key={v} x={X(v)} y={H - B + 18} textAnchor="middle" className="tick">{v}%</text>)}
          <line x1={X(xMid)} x2={X(xMid)} y1={T} y2={Y(1)} className="mid" />
          <line x1={L} x2={W - R} y1={Y(Y_MID)} y2={Y(Y_MID)} className="mid" />
          <text x={W - R - 6} y={T + 14} textAnchor="end" className="qlabel">핵심 강점</text>
          <text x={W - R - 6} y={Y(1) - 8} textAnchor="end" className="qlabel">스킬 보강 필요</text>
          <text x={L + 6} y={T + 14} className="qlabel">역량 확장 여지</text>
          <text x={L + 6} y={Y(1) - 8} className="qlabel">효율화·조정</text>
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="axis">태스크별 시간 비중 →</text>
          <text transform={`translate(14 ${(T + Y(1)) / 2}) rotate(-90)`} textAnchor="middle" className="axis">스킬 매치 점수 →</text>
          {tasks.map((t) => (
            <g key={t.id} className={`bub${hover === t.id ? ' on' : ''}`} tabIndex={0} role="button"
              aria-label={`${t.name}: 비중 ${pct(t.share)}, 매치 ${t.score!.toFixed(1)}점`}
              onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(t.id)} onBlur={() => setHover(null)}>
              <circle cx={X(t.share)} cy={Y(t.score!)} r={rad(t.share) + 6} className="hit" />
              <circle cx={X(t.share)} cy={Y(t.score!)} r={rad(t.share)} className="dot" />
            </g>
          ))}
          {labels.map((l) => <text key={l.id} x={l.x} y={l.y} textAnchor="middle" className="blabel">{l.text}</text>)}
        </svg>
        {hv && (
          <div className="tip" style={{ left: `${(X(hv.share) / W) * 100}%`, top: `${(Y(hv.score!) / H) * 100}%` }}>
            <b>{hv.name}</b>
            <span>시간 <b className="num">주 {h1(hv.hours)}</b> ({pct(hv.share)})</span>
            <span>매치 점수 <b className="num">{hv.score!.toFixed(1)}</b> / 5 · {lvName(hv.score)}</span>
          </div>
        )}
      </div>
      <small>세로 점선: 업무 평균 비중({pct(xMid)}) · 가로 점선: 독립수행(3점) · 시간은 주 {weekly}시간 근무 기준 환산</small>
    </div>
  );
}

/* ── 05 업무패턴 ── */
function PatternModule({ m }: { m: WorkMap }) {
  const P = m.primary ? ACTIVITY[m.primary] : null;
  const shareOf = (k: Activity) => m.activities.find((a) => a.key === k)?.share ?? 0;
  return (
    <>
      <div className="grid-pattern">
        <PatternMap m={m} />
        <div className="card">
          <span className="eyebrow">가장 가까운 유형</span>
          {P ? (
            <>
              <h3 className="pt-name">{P.pattern}
                {m.secondary && <small> · 다음으로 {ACTIVITY[m.secondary].pattern}</small>}</h3>
              <p>{P.interp}</p>
              <ul className="hbars compact">
                {m.activities.slice(0, 3).map((a, i) => (
                  <li key={a.key} className={i === 0 ? 'top' : ''}>
                    <span className="hb-label">{ACTIVITY[a.key].pattern}</span>
                    <span className="hb-track"><i style={{ width: `${a.share * 100}%` }} /></span>
                    <b className="num">{pct(a.share * 100)}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="fine">업무 미입력</p>}
        </div>
      </div>
      {P && (
        <div className="grid2 gap">
          <div className="card soft"><h3>강점</h3><ul className="dots">{P.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="card soft"><h3>주의 영역</h3><ul className="dots">{P.cautions.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      )}
      <details className="basis">
        <summary>8가지 업무 유형 모두 보기</summary>
        <ul className="pattern-all">
          {ACTIVITY_KEYS.map((k) => (
            <li key={k}><b>{ACTIVITY[k].pattern}</b>
              <span className="num">{pct(shareOf(k) * 100)}</span><small>{ACTIVITY[k].interp}</small></li>
          ))}
        </ul>
        <p className="fine">'나'의 위치는 업무별 주요 활동 좌표를 시간 비중으로 가중평균한 값이고, 유형은 시간 비중이 가장 큰 활동입니다. 어느 유형이 더 우수하다는 뜻이 아닙니다.</p>
      </details>
    </>
  );
}

function PatternMap({ m }: { m: WorkMap }) {
  const W = 520, H = 400, L = 56, R = 24, T = 40, B = 24;
  const X = (v: number) => L + v * (W - L - R);
  const Y = (v: number) => T + (1 - v) * (H - T - B);
  const [hover, setHover] = useState<Activity | null>(null);
  useEffect(() => setHover(null), [m.primary]);
  const shareOf = (k: Activity) => m.activities.find((a) => a.key === k)?.share ?? 0;
  return (
    <div className="card chart-card">
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, maxWidth: "100%" }} role="img" aria-label="8가지 업무 패턴 지도와 나의 위치">
          <rect x={L} y={T} width={W - L - R} height={H - T - B} className="plot" />
          <line x1={X(0.5)} x2={X(0.5)} y1={T} y2={H - B} className="grid" />
          <line x1={L} x2={W - R} y1={Y(0.5)} y2={Y(0.5)} className="grid" />
          <text x={L + 4} y={T - 14} className="axis strong">← 개념·전략</text>
          <text x={W - R - 4} y={T - 14} textAnchor="end" className="axis strong">실행·운영 →</text>
          <text transform={`translate(${L - 18} ${T + 6}) rotate(-90)`} textAnchor="end" className="axis strong">소통·관계 →</text>
          <text transform={`translate(${L - 18} ${H - B}) rotate(-90)`} className="axis strong">← 혼자·분석</text>
          {ACTIVITY_KEYS.map((k) => {
            const a = ACTIVITY[k];
            const on = k === m.primary;
            return (
              <g key={k} className={`pbub${on ? ' on' : ''}`} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
                <circle cx={X(a.x)} cy={Y(a.y)} r={24} />
                <text x={X(a.x)} y={Y(a.y) + 4} textAnchor="middle">{a.pattern}</text>
              </g>
            );
          })}
          {m.me && (
            <g className="me">
              <circle cx={X(m.me.x)} cy={Y(m.me.y)} r={8} />
              <text x={X(m.me.x)} y={Y(m.me.y) - 14} textAnchor="middle">나</text>
            </g>
          )}
        </svg>
        {hover && (
          <div className="tip" style={{ left: `${(X(ACTIVITY[hover].x) / W) * 100}%`, top: `${(Y(ACTIVITY[hover].y) / H) * 100}%` }}>
            <b>{ACTIVITY[hover].pattern}</b><span>{ACTIVITY[hover].desc}</span>
            <span>내 업무 중 <b className="num">{pct(shareOf(hover) * 100)}</b></span>
          </div>
        )}
      </div>
      <small>검은 점: 나의 위치(업무별 활동 좌표를 시간 비중으로 가중평균) · 파란 원: 시간 비중이 가장 큰 유형</small>
    </div>
  );
}

/* ── 06 실행 인사이트 ── */
function NextModule({ insights }: { insights: ReturnType<typeof buildInsights> }) {
  const { d } = useApp();
  return (
    <>
      <ol className="insights">
        {insights.map((x, i) => (
          <li key={x.title} className="card">
            <span className="num ins-no">{String(i + 1).padStart(2, '0')}</span>
            <div><em className="chip-tag">{x.tag}</em><h3>{x.title}</h3><p>{x.body}</p></div>
          </li>
        ))}
      </ol>
      {!insights.length && <p className="fine">업무·스킬 미입력</p>}
      <div className="card exp">
        <div>
          <h3>다음 단계: AI 적용 시뮬레이션</h3>
          <p>입력한 업무로 AI 적용 전후의 시간·품질·위험을 비교합니다.</p>
        </div>
        <button className="btn primary" onClick={() => d({ type: 'go', step: 3 })}>시뮬레이션 시작</button>
      </div>
    </>
  );
}
