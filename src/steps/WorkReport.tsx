// STEP 3 진단 리포트: 직무현황 · 태스크&스킬 · AI 영향분석 · 스킬 활용분석 · 업무패턴 · 실행 인사이트
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StepNav } from '../App';
import { AiImpact } from '../components/AiImpact';
import { ResearchCard } from '../components/ResearchCard';
import { researchDiagnosis } from '../engine/research';
import { ReadingGuide } from '../components/ReadingGuide';
import { careerLabel, jobLabel } from '../jobCatalog';
import { useApp } from '../state';
import { useResults } from '../useResults';
import type { Activity } from '../engine/types';
import {
  ACTIVITY, ACTIVITY_KEYS, AI_MID, QUADRANT_INFO, SKILL_LEVELS, Y_MID, buildInsights, computeWorkMap, levelDesc, useSkillCatalog,
  type Quadrant, type TaskMatch, type WorkMap,
} from '../workmap';
import { LAST_SUB } from './ProfileStep';

/** 진단 영역 ① 업무현황 · ② AI 영향진단 (③ 생산성 시뮬레이터, ④ 실행 인사이트는 다음 단계) */
export const AREAS = [
  { key: 'work', no: '①', title: '업무현황', sub: '직무 기준으로 정리한 개인별 업무 수행 특성 (기준정보·직무·업무·비중·활동)' },
  { key: 'ai', no: '②', title: 'AI 영향진단', sub: '지금 하는 일 기준의 AI 영향도, 업무별 AI 도구 가용성, AI 위임 가능 업무, AI 활용 가이드' },
] as const;
export const MODULES = [
  { key: 'status', area: 'work', no: '01', title: '직무현황', sub: '직무가 어떻게 이루어져 있나' },
  { key: 'skill', area: 'work', no: '02', title: '태스크 & 스킬', sub: '어떤 태스크와 스킬로 일하고 있나' },
  { key: 'pattern', area: 'work', no: '03', title: '업무패턴', sub: '8가지 업무 유형으로 보는 일하는 방식' },
  { key: 'ai', area: 'ai', no: '04', title: 'AI 영향도', sub: '할 수 있는가 · 얼마의 가치가 예상되는가 · 실제로 하고 있는가' },
  { key: 'tools', area: 'ai', no: '05', title: '업무별 AI 도구 가용성', sub: '지금 회사 도구로 실제 가능한 업무는 무엇인가' },
  { key: 'use', area: 'ai', no: '06', title: 'AI 위임 가능 업무', sub: 'AI 적용 가능성 × 스킬 수준으로 보는 위임 범위와 스킬 방향' },
  { key: 'guide', area: 'ai', no: '07', title: 'AI 활용 가이드', sub: '업무별로 AI를 어떻게 쓰면 좋을까' },
] as const;

/** 리포트 첫 줄: 입력한 데이터로 만든 한 문장 요약 */
function headline(m: WorkMap): string {
  const top = m.tasks[0];
  if (!top) return '업무를 입력하면 진단 결과가 나와요';
  const pattern = m.primary ? `, 일하는 방식은 ${ACTIVITY[m.primary].pattern}에 가까워요` : '';
  return `${top.name}에 가장 많은 시간(${Math.round(top.share)}%)을 쓰고 있고${pattern}`;
}

const pct = (v: number) => `${Math.round(v * 10) / 10}%`;
const h1 = (v: number) => `${Math.round(v * 10) / 10}시간`;
const lvName = (v: number | null) => (v === null ? '미선택' : SKILL_LEVELS[Math.min(4, Math.max(0, Math.round(v) - 1))].name);

export default function WorkReport() {
  const { s, d } = useApp();
  const catalog = useSkillCatalog();
  const m = useMemo(() => computeWorkMap(s.profile, catalog), [s.profile, catalog]);
  const [guide, setGuide] = useState(false);
  const p = s.profile;
  const meta = [p.dept, p.teamSize && `팀 ${p.teamSize}`, careerLabel(p)].filter(Boolean).join(' · ');
  const { active, topH, jump, navRef } = useBookmarks(MODULES.map((x) => `wm-${x.key}`));

  const bodies: Record<(typeof MODULES)[number]['key'], ReactNode> = {
    status: <StatusModule m={m} />,
    skill: <TaskSkillModule m={m} />,
    ai: <AiImpact />,
    tools: <ToolsModule />,
    guide: <GuideModule m={m} />,
    use: <SkillUseModule m={m} />,
    pattern: <PatternModule m={m} />,
  };

  return (
    <section className="wr">
      <p className="eyebrow">STEP 3 · ① 업무현황 · ② AI 영향진단</p>
      <div className="wr-head card">
        <div>
          <small>{[jobLabel(p), meta].filter(Boolean).join(' · ')}</small>
          <h1>{headline(m)}</h1>
        </div>
        <button className="btn ghost" onClick={() => setGuide(true)}>해석법 보기</button>
      </div>

      {/* 책갈피: 누르면 그 모듈 위치로 이동, 스크롤하면 지금 읽는 모듈이 표시됨 */}
      <nav ref={navRef} className="bm-nav" aria-label="리포트 책갈피" style={{ top: topH }}>
        {MODULES.map((x, i) => (
          <a key={x.key} href={`#wm-${x.key}`} className={`bm${active === i ? ' on' : ''}${i > 0 && MODULES[i - 1].area !== x.area ? ' gap' : ''}`} aria-current={active === i ? 'location' : undefined}
            onClick={(e) => { e.preventDefault(); jump(i); }}>
            {(i === 0 || MODULES[i - 1].area !== x.area) && <em className="bm-area">{AREAS.find((a) => a.key === x.area)!.no} {AREAS.find((a) => a.key === x.area)!.title}</em>}
            <span className="num">{x.no}</span>{x.title}
          </a>
        ))}
      </nav>

      {MODULES.map((x, i) => (
        <section key={x.key} id={`wm-${x.key}`} className="mod-sec mod-body" aria-labelledby={`wm-${x.key}-h`}>
          {(i === 0 || MODULES[i - 1].area !== x.area) && (() => { const A = AREAS.find((a) => a.key === x.area)!; return (
            <div className="area-head"><span>{A.no}</span><div><b>{A.title}</b><small>{A.sub}</small></div></div>
          ); })()}
          <div className="mod-title">
            <span className="num">{x.no}</span>
            <div><h2 id={`wm-${x.key}-h`}>{x.title}</h2><p>{x.sub}</p></div>
          </div>
          {bodies[x.key]}
        </section>
      ))}

      <StepNav onPrev={() => d({ type: 'go', step: 1, sub: LAST_SUB })} onNext={() => d({ type: 'go', step: 3 })} nextLabel="③ 생산성 시뮬레이터로" />
      {guide && <ReadingGuide onClose={() => setGuide(false)} />}
    </section>
  );
}

/** 책갈피 내비: 상단 고정 바 높이를 재서 그 아래에 붙고, 스크롤 위치로 현재 모듈을 표시 */
function useBookmarks(ids: string[]) {
  const [active, setActive] = useState(0);
  const [topH, setTopH] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const offset = () => topH + (navRef.current?.offsetHeight ?? 0) + 12;
  useEffect(() => {
    const measure = () => setTopH(document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  useEffect(() => {
    const onScroll = () => {
      const off = offset() + 8;
      let cur = 0;
      ids.forEach((id, i) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top - off <= 0) cur = i; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = ids.length - 1;
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [topH]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // 휴대폰처럼 책갈피가 가로로 넘칠 때, 현재 책갈피가 보이도록 가로 스크롤
    const nav = navRef.current; const el = nav?.querySelector<HTMLElement>('.bm.on');
    if (nav && el && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: el.offsetLeft - nav.clientWidth / 2 + el.clientWidth / 2 });
  }, [active]);
  const jump = (i: number) => {
    const el = document.getElementById(ids[i]);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset(), behavior: reduce ? 'auto' : 'smooth' });
    setActive(i);
  };
  return { active, topH, jump, navRef };
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
      <h3 className="mod-sub">내 일은 이렇게 구성되어 있다</h3>
      <div className="stats three">
        <div className="stat"><span>정의한 업무</span><b>{m.tasks.length}개</b><small>전체 업무의 {pct(m.totalShare)}</small></div>
        <div className="stat"><span>가장 많이 하는 활동</span><b>{m.primary ? ACTIVITY[m.primary].label : '—'}</b>
          <small>{m.primary ? `입력한 업무의 ${pct(m.activities[0].share * 100)}` : '업무를 입력해 주세요'}</small></div>
        <div className="stat"><span>스킬 수준 평균</span><b>{m.skillAvg === null ? '—' : `${m.skillAvg.toFixed(1)} / 5`}</b>
          <small>{m.skillAvg === null ? '스킬 수준을 고르지 않았어요' : `${lvName(m.skillAvg)} 수준 · ${m.skills.filter((x) => x.score !== null).length}개 스킬`}</small></div>
      </div>
      <div className="grid2 gap">
        <div className="card">
          <h3>어떤 태스크들이 많은 비중을 차지하고 있나?</h3>
          <ul className="hbars">
            {m.tasks.map((t) => (
              <li key={t.id}>
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
          <h3>어떤 활동을 많이 수행하고 있나?</h3>
          <ul className="hbars">
            {m.activities.map((a) => (
              <li key={a.key}>
                <span className="hb-label"><i className="dot" style={{ background: ACTIVITY[a.key].color }} />{ACTIVITY[a.key].label}</span>
                <span className="hb-track"><i style={{ width: `${a.share * 100}%`, background: ACTIVITY[a.key].color }} /></span>
                <b className="num">{pct(a.share * 100)}</b>
              </li>
            ))}
          </ul>
          <small>입력한 업무 안에서의 비율 · 업무마다 고른 '주요 활동' 기준</small>
        </div>
      </div>
    </>
  );
}

/* ── 02 태스크 & 스킬 ── */
function TaskSkillModule({ m }: { m: WorkMap }) {
  return (
    <>
      <div className="card">
        <h3>업무별로 쓰는 스킬</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>업무</th><th className="r">비중</th><th>주요 활동</th><th>연결 스킬 · 내 수준</th></tr></thead>
            <tbody>
              {m.tasks.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.name}</b></td>
                  <td className="r num">{pct(t.share)}</td>
                  <td><span className="act-tag"><i className="dot" style={{ background: ACTIVITY[t.activity].color }} />{ACTIVITY[t.activity].label}</span></td>
                  <td>{t.skills.length
                    ? <span className="sk-pills">{t.skills.map((x) => <span key={x.name} className="sk-pill">{x.name}<em className="num">{x.score ?? '–'}</em></span>)}</span>
                    : <span className="fine">연결된 스킬 없음</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>나의 스킬 수준 <small>1 개념인지 · 2 가이드수행 · 3 독립수행 · 4 복잡대응 · 5 전문가</small></h3>
        <ul className="skill-bars">
          {m.skills.map((x) => (
            <li key={x.def.name}>
              <div className="sb-head"><b>{x.def.name}</b>
                <span>{x.score === null ? <span className="fine">미선택</span> : <><b className="num">{x.score}</b> {SKILL_LEVELS[x.score - 1].name}</>}</span>
              </div>
              <div className="sb-track" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((k) => <i key={k} className={x.score !== null && k <= x.score ? 'f' : ''} />)}
              </div>
              <small>{x.score !== null ? levelDesc(x.def, x.score) : x.def.def}
                {x.linked.length > 0 && <> · 연결 업무: {x.linked.join(', ')}</>}</small>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ── 04 스킬 활용분석 ── */
function SkillUseModule({ m }: { m: WorkMap }) {
  const { s } = useApp();
  const plotted = m.tasks.filter((t) => t.score !== null);
  const missing = m.tasks.filter((t) => t.score === null);
  const aiHigh = m.tasks.filter((t) => t.ai >= AI_MID).length;
  const ready = m.aiTool && m.aiTool.score !== null ? m.aiTool.score : null;
  return (
    <>
      <div className="card soft">
        <h3>AI와 함께 일할 때, 어떤 스킬을 넘기고 어떤 스킬을 키울까?</h3>
        <p>업무마다 <b>AI가 얼마나 할 수 있는지</b>와 <b>그 업무에 쓰는 내 스킬 수준</b>을 함께 놓고 봅니다. AI에 맡길 업무, AI를 코치 삼아 배울 업무, 아낀 시간을 재투자할 업무, 직접 키워야 할 업무가 나뉘어요.</p>
        <ul className="axis-notes">
          <li><b>가로축(X)</b> 업무의 AI 적용 가능성 — AI 영향분석·시뮬레이션과 같은 값 (업무 유형 × 적용 가능성, 표준 업무는 연구 기준)</li>
          <li><b>세로축(Y)</b> 그 업무에 연결한 스킬의 내 수준 평균 (1 개념인지 ~ 5 전문가)</li>
          <li><b>원 크기</b> 시간 비중 · 점에 마우스를 올리면 업무 이름, 시간, AI 적용 가능성, 스킬 수준이 보여요</li>
        </ul>
      </div>
      {m.aiTool && (
        <div className={`card ai-ready${ready !== null && ready <= 2 && aiHigh ? ' low' : ''}`}>
          <h3>AI 준비도 · {m.aiTool.name} <small>{ready === null ? '미선택' : `${ready}단계 ${SKILL_LEVELS[ready - 1].name}`}</small></h3>
          <p>{ready === null
            ? `AI에 맡길 수 있는 업무를 실제로 맡길 수 있는지는 '${m.aiTool.name}' 수준에 달려 있어요. 스킬 수준(Q.S)에서 골라 주세요.`
            : ready <= 2 && aiHigh
              ? `AI 적용 가능성이 높은 업무가 ${aiHigh}개 있지만, '${m.aiTool.name}'이 ${SKILL_LEVELS[ready - 1].name} 단계라 지금은 실제로 맡기기 어려워요. 이 스킬을 먼저 올리는 게 가장 빠른 길이에요.`
              : aiHigh
                ? `AI 적용 가능성이 높은 업무 ${aiHigh}개를 실제로 AI에 맡길 수 있는 수준이에요. 아래 'AI에 맡기고 검증하는 업무'부터 시작해 보세요.`
                : `AI 적용 가능성이 높은 업무가 많지 않아요. AI는 보조 도구로 쓰고, 사람 고유의 강점 업무에 집중하는 편이 효과적이에요.`}</p>
          <small>업무 시간 기준 평균 AI 적용 가능성 {Math.round(m.aiAvg * 100)}%</small>
        </div>
      )}
      {plotted.length ? <SkillMatchChart tasks={plotted} weekly={s.profile.weeklyHours} /> : (
        <div className="card"><p className="fine">스킬이 연결되고 수준이 선택된 업무가 아직 없어요. 업무 구체화(Q.B-2)에서 업무마다 스킬을 연결하고, 스킬 수준(Q.S)을 골라 주세요.</p></div>
      )}
      <div className="quad-grid">
        {(['delegate', 'learn', 'core', 'grow'] as Quadrant[]).map((q) => {
          const list = plotted.filter((t) => t.quadrant === q);
          return (
            <div key={q} className={`card squad q-${q}${list.length ? '' : ' empty'}`}>
              <h3>{QUADRANT_INFO[q].title} <small className="num">{list.length}개 · {QUADRANT_INFO[q].dir}</small></h3>
              <p>{QUADRANT_INFO[q].desc}</p>
              {list.length > 0 && <ul>{list.map((t) => <li key={t.id}>{t.name} <span className="num">AI {Math.round(t.ai * 100)}% · 스킬 {t.score!.toFixed(1)} · 비중 {pct(t.share)}</span></li>)}</ul>}
            </div>
          );
        })}
      </div>
      {missing.length > 0 && <small>스킬 미연결·미평가로 그래프에서 빠진 업무: {missing.map((t) => t.name).join(', ')}</small>}
    </>
  );
}

function SkillMatchChart({ tasks, weekly }: { tasks: TaskMatch[]; weekly: number }) {
  const W = 600, H = 360, L = 52, R = 18, T = 18, B = 46;
  const xMax = 100, xMid = AI_MID * 100;
  const X = (v: number) => L + (v / xMax) * (W - L - R);
  const Y = (v: number) => T + ((5 - v) / 4) * (H - T - B);
  const xv = (t: TaskMatch) => t.ai * 100;
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
      const cx = Math.min(W - R - w / 2, Math.max(L + w / 2, X(xv(t))));
      const cy = Y(t.score!), r = rad(t.share);
      const tries = [cy - r - 6, cy + r + 15, cy - r - 22, cy + r + 31, cy - r - 38];
      const y = tries.find((ty) => !hit(cx, ty, w)) ?? tries[0];
      placed.push({ id: t.id, x: cx, y, text, w });
    });
    return placed;
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const xTicks = [0, 20, 40, 60, 80, 100];
  return (
    <div className="card chart-card">
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, maxWidth: "100%" }} role="img" aria-label="업무별 AI 적용 가능성과 스킬 수준 사분면">
          <rect x={X(xMid)} y={T} width={X(xMax) - X(xMid)} height={Y(1) - T} className="qbg ai" />
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" />
              <text x={L - 8} y={Y(v) + 4} textAnchor="end" className="tick">{v}</text>
            </g>
          ))}
          {xTicks.map((v) => <text key={v} x={X(v)} y={H - B + 18} textAnchor="middle" className="tick">{v}%</text>)}
          <line x1={X(xMid)} x2={X(xMid)} y1={T} y2={Y(1)} className="mid" />
          <line x1={L} x2={W - R} y1={Y(Y_MID)} y2={Y(Y_MID)} className="mid" />
          <text x={W - R - 6} y={T + 14} textAnchor="end" className="qlabel">AI에 맡기고 검증</text>
          <text x={W - R - 6} y={Y(1) - 8} textAnchor="end" className="qlabel">AI로 배우며</text>
          <text x={L + 6} y={T + 14} className="qlabel">사람 고유 강점</text>
          <text x={L + 6} y={Y(1) - 8} className="qlabel">직접 키울 업무</text>
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="axis">업무의 AI 적용 가능성 →</text>
          <text transform={`translate(14 ${(T + Y(1)) / 2}) rotate(-90)`} textAnchor="middle" className="axis">내 스킬 수준 →</text>
          {tasks.map((t) => (
            <g key={t.id} className={`bub${hover === t.id ? ' on' : ''}`} tabIndex={0} role="button"
              aria-label={`${t.name}: AI 적용 가능성 ${Math.round(t.ai * 100)}%, 스킬 ${t.score!.toFixed(1)}, 비중 ${pct(t.share)}`}
              onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(t.id)} onBlur={() => setHover(null)}>
              <circle cx={X(xv(t))} cy={Y(t.score!)} r={rad(t.share) + 6} className="hit" />
              <circle cx={X(xv(t))} cy={Y(t.score!)} r={rad(t.share)} className="dot" />
            </g>
          ))}
          {labels.map((l) => <text key={l.id} x={l.x} y={l.y} textAnchor="middle" className="blabel">{l.text}</text>)}
        </svg>
        {hv && (
          <div className="tip" style={{ left: `${(X(xv(hv)) / W) * 100}%`, top: `${(Y(hv.score!) / H) * 100}%` }}>
            <b>{hv.name}</b>
            <span>시간 <b className="num">주 {h1(hv.hours)}</b> ({pct(hv.share)})</span>
            <span>AI 적용 가능성 <b className="num">{Math.round(hv.ai * 100)}%</b></span>
            <span>스킬 수준 <b className="num">{hv.score!.toFixed(1)}</b> / 5 · {lvName(hv.score)}</span>
          </div>
        )}
      </div>
      <small>세로 점선: AI 적용 가능성 {xMid}%(초기 가정) · 가로 점선: 독립수행(3점) · 원 크기: 시간 비중(주 {weekly}시간 근무 기준)</small>
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
          <span className="eyebrow">내가 일하는 방식은 어떤 유형에 가까운가</span>
          {P ? (
            <>
              <h3 className="pt-name"><i className="dot lg" style={{ background: P.color }} />{P.pattern}
                {m.secondary && <small> · 다음으로 {ACTIVITY[m.secondary].pattern}</small>}</h3>
              <p>{P.interp}</p>
              <ul className="hbars compact">
                {m.activities.slice(0, 3).map((a) => (
                  <li key={a.key}>
                    <span className="hb-label">{ACTIVITY[a.key].pattern}</span>
                    <span className="hb-track"><i style={{ width: `${a.share * 100}%`, background: ACTIVITY[a.key].color }} /></span>
                    <b className="num">{pct(a.share * 100)}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="fine">업무를 입력하면 유형이 나타나요.</p>}
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
            <li key={k}><b><i className="dot" style={{ background: ACTIVITY[k].color }} />{ACTIVITY[k].pattern}</b>
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
                <circle cx={X(a.x)} cy={Y(a.y)} r={24} style={{ fill: a.color, stroke: a.color }} />
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
      <small><i className="dot" style={{ background: 'var(--violet)' }} /> 본인 위치(활동·시간 비중 기반) · 옅은 색 원: 8유형 좌표 (본인 유형은 진하게)</small>
    </div>
  );
}

/* ── 06 실행 인사이트 ── */
/** 실행 인사이트 목록 (④ 실행 인사이트 단계에서 사용) */
export function InsightList() {
  const { s } = useApp();
  const catalog = useSkillCatalog();
  const { dx } = useResults();
  const m = useMemo(() => computeWorkMap(s.profile, catalog), [s.profile, catalog]);
  const insights = useMemo(() => buildInsights(m, dx.firstExperiment), [m, dx.firstExperiment]);
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
      {!insights.length && <p className="fine">업무와 스킬을 입력하면 다음 행동이 제안됩니다.</p>}
    </>
  );
}

/** ② 업무별 AI 도구 가용성: 연구 기준 노출 등급과 사내 도구 실현 가능 여부 */
function ToolsModule() {
  const { s } = useApp();
  return (
    <>
      <div className="card soft">
        <h3>지금 회사 도구로 실제로 AI를 쓸 수 있는 업무는?</h3>
        <p>연구상 AI로 시간을 줄일 수 있는 업무라도, 지금 쓸 수 있는 AI 도구·권한이 없으면 실제로는 활용하기 어려워요. 업무마다 <b>연구 기준 등급</b>(E1 바로 가능 · E2 도구가 있으면 가능 · E0 어려움)과 <b>사내 실현 가능 여부</b>를 함께 봅니다. 사용 가능한 도구는 AI 활용 환경(Q.H) 응답 기준이에요.</p>
      </div>
      <ResearchCard profile={s.profile} />
    </>
  );
}

/** ② AI 활용 가이드: 업무마다 추천 활용 방식과 바로 써 볼 방법 */
function GuideModule({ m }: { m: WorkMap }) {
  const { s } = useApp();
  const rows = researchDiagnosis(s.profile, 'beta').rows;
  const list = m.tasks.map((t) => ({ t, g: guideFor(t, rows.find((r) => r.id === t.id)) }));
  return (
    <>
      <p className="fine">AI 적용 가능성, 사내 도구 가용성, 내 스킬 수준을 함께 보고 업무마다 추천 활용 방식을 정리했어요. 생산성 시뮬레이터에서 이 방식으로 바꿨을 때의 시간 변화를 확인해 보세요.</p>
      <div className="tbl-wrap">
        <table className="tbl guide-tbl">
          <thead><tr><th>업무</th><th className="r">AI 적용 가능성</th><th>사내 도구</th><th>위임 판단</th><th>추천 활용 방식</th><th>이렇게 써 보세요</th></tr></thead>
          <tbody>
            {list.map(({ t, g }) => (
              <tr key={t.id} className={`g-${g.level}`}>
                <td><b>{t.name}</b><small className="fine"> · {pct(t.share)}</small></td>
                <td className="r num">{Math.round(t.ai * 100)}%</td>
                <td>{g.tool}</td>
                <td>{g.judge}</td>
                <td><span className={`mode-tag ${g.level}`}>{g.mode}</span></td>
                <td>{g.how}{g.warn && <small className="warn"> ⚠ {g.warn}</small>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type GuideRow = { tool: string; judge: string; mode: string; how: string; level: 'delegate' | 'with' | 'assist' | 'blocked'; warn?: string };
function guideFor(t: TaskMatch, r: { feasible: number; e: string; frontier: boolean } | undefined): GuideRow {
  const tool = !r ? '—' : r.feasible === 1 ? '가능' : r.feasible === 0.5 ? '일부 가능' : '어려움';
  const warn = r?.frontier ? 'AI가 잘 못하는 업무에 많이 쓰고 있어요. 활용 범위를 줄이고 결과를 꼭 확인하세요.' : undefined;
  if (r && r.feasible === 0 && t.ai >= AI_MID) {
    return { tool, judge: '도구 확보 필요', mode: '도구·권한 확인 먼저', level: 'blocked', warn,
      how: '연구상 AI로 줄일 수 있는 업무지만 지금 도구로는 어려워요. 팀에 쓸 수 있는 도구·권한을 확인하거나 요청하세요.' };
  }
  switch (t.quadrant) {
    case 'delegate': return { tool, judge: 'AI 위임 가능', mode: '맡기기 (자동화형)', level: 'delegate', warn,
      how: '초안·정리·반복 처리는 AI에 맡기고, 나는 기준표(체크리스트)로 결과를 검증해요. 잘 된 지시문은 팀과 공유하세요.' };
    case 'learn': return { tool, judge: '부분 위임 · 학습 병행', mode: '배우기·검토받기 (증강형)', level: 'with', warn,
      how: 'AI에게 "왜 이렇게 했는지" 설명을 요청하며 함께 작성하고, 결과는 선배나 기준 자료로 꼭 확인해요.' };
    case 'core': return { tool, judge: '사람 중심 · AI 보조', mode: '함께 다듬기 (증강형)', level: 'assist', warn,
      how: '자료 조사·초안 보조에만 AI를 쓰고 판단과 결정은 직접 해요. AI로 아낀 시간을 이 업무에 더 써 보세요.' };
    case 'grow': return { tool, judge: '사람 중심 · 육성 우선', mode: '배우기 (증강형)', level: 'assist', warn,
      how: '개념 학습이나 연습 상대로 AI를 쓰고, 실무 판단은 코칭과 함께 키워요.' };
    default:
      if (t.ai >= 0.5) return { tool, judge: 'AI 위임 후보', mode: '맡기기 (자동화형)', level: 'delegate', warn, how: '초안을 AI에 맡기고 검토하는 방식부터 시작해 보세요. 스킬을 연결하면 위임 판단이 더 정확해져요.' };
      if (t.ai >= 0.3) return { tool, judge: '부분 활용', mode: '함께 다듬기 (증강형)', level: 'with', warn, how: '아이디어·초안을 AI와 주고받으며 함께 다듬어 보세요.' };
      return { tool, judge: '사람 중심', mode: '보조로만 활용', level: 'assist', warn, how: '자료 찾기·요약 같은 보조 작업에만 AI를 써 보세요.' };
  }
}
