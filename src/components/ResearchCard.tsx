// F-22 글로벌 연구 기준 진단 카드 (STEP 3)
import { useState } from 'react';
import {
  AEI_GLOBAL, AI_MODE, E_POTENTIAL_COEF, FRONTIER_PENALTY, LABELS, QUADRANT, RESEARCH_DATA_DATE, RESEARCH_E_SCORE,
  RESEARCH_SOURCES, SCENARIO_LABEL, TYPE_DEFAULT_E,
} from '../engine/config';
import {
  CONFIDENCE_LABEL, QUADRANT_INFO, pct, researchSentence, type Quadrant, type ResearchResult,
} from '../engine/research';
import type { AiMode, ExposureScenario, Profile } from '../engine/types';
import { researchDiagnosis } from '../engine/research';
import { readTaskList, taskMasterVersion } from '../taskCatalog';

export const RESEARCH_NOTICE = '해외 연구(미국 직무 기준)를 우리 업무에 적용한 교육용 추정치입니다. 노출도는 일자리 대체율이 아닙니다.';

export function ResearchCard({ profile }: { profile: Profile }) {
  const [scn, setScn] = useState<ExposureScenario>('beta');
  const r = researchDiagnosis(profile, scn);
  if (!r.rows.length) return null;
  const errors = readTaskList().errors;
  const version = taskMasterVersion();

  return (
    <section className="card research" aria-labelledby="research-title">
      <div className="card-head">
        <h3 id="research-title">글로벌 연구 기준 진단
          <em className={`conf ${r.confidence}`}>신뢰도 {CONFIDENCE_LABEL[r.confidence]}</em>
          {r.stdShare === 0 && <em className="src-badge est">유형 추정 기반</em>}
        </h3>
        <div className="seg small" role="radiogroup" aria-label="노출도 시나리오">
          {(Object.keys(SCENARIO_LABEL) as ExposureScenario[]).map((k) => (
            <button key={k} role="radio" aria-checked={scn === k} className={scn === k ? 'on' : ''} onClick={() => setScn(k)}>{SCENARIO_LABEL[k]}</button>
          ))}
        </div>
      </div>
      <p className="fine">입력한 업무 {Math.round(r.inputShare)}% 기준 · AI가 할 수 있는 만큼 쓰고 있는지, 못 쓴다면 도구 문제인지 역량 문제인지 해외 연구 기준으로 다시 읽었어요.</p>

      <div className="r-nums">
        <div><span>연구 기준 노출도</span><b className="num">{pct(r.exposure)}</b><small>AI로 시간을 크게 줄일 수 있는 업무 비중</small></div>
        <div><span>사내 실현 가능</span><b className="num">{pct(r.feasibleExposure)}</b><small>지금 회사 도구·권한으로 가능한 비중</small></div>
        <div><span>현재 활용도</span><b className="num">{pct(r.usage)}</b><small>지금 실제로 AI를 쓰는 비중</small></div>
      </div>

      <GapBar r={r} />
      <p className="r-sentence">{researchSentence(r)}</p>

      <div className="r-split">
        <QuadrantMini r={r} />
        <div className="r-reco">
          <h4>{QUADRANT_INFO[r.quadrant].name}</h4>
          <p>{QUADRANT_INFO[r.quadrant].desc}</p>
          <h4>추천 방향</h4>
          <p>{r.recommendation}</p>
          {r.autoShare !== null && (
            <p className="fine">AI 활용 방식: 자동화형 {pct(r.autoShare)} · 증강형 {pct(1 - r.autoShare)} <small>(활용 방식을 고른 업무 기준)</small>
              {r.aeiCompare && <> · 같은 업무의 전 세계 사용자 자동화형 {pct(r.aeiCompare.global)} (내 {pct(r.aeiCompare.mine)})</>}
              {AEI_GLOBAL.autoShare !== null && <> · Anthropic 전체 기준 자동화형 {pct(AEI_GLOBAL.autoShare)}</>}
            </p>
          )}
          {r.toolsUnknown && <p className="warn">사용 가능 도구를 모른다고 답해 '사내 실현 가능'을 절반만 반영했어요. 사용 가능 도구를 확인하세요.</p>}
        </div>
      </div>

      <div className="r-table-wrap">
        <table className="r-table">
          <thead><tr><th>업무</th><th>비율</th><th>연구 등급</th><th>실현 가능</th><th>활용 단계</th><th>활용 방식</th><th>출처</th></tr></thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.id} className={x.frontier ? 'frontier' : ''}>
                <td>{x.name}{x.frontier && <small className="warn"> AI 능력 경계 밖 사용</small>}</td>
                <td className="num">{Math.round(x.share)}%</td>
                <td className="num">{x.e}</td>
                <td className="num">{x.feasible === 1 ? '가능' : x.feasible === 0.5 ? '일부' : '어려움'}</td>
                <td className="num">{x.level}단계</td>
                <td>{x.mode === 'none' ? '–' : x.mode ? AI_MODE[x.mode as AiMode].label : '미응답'}</td>
                <td><em className={`src-badge ${x.source === '연구 기준' ? 'res' : 'est'}`}>{x.source}</em></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="basis">
        <summary>계산 근거 보기</summary>
        <ul className="formula">
          <li>가중치 w = 업무 비율 ÷ 입력한 업무 비율 합({Math.round(r.inputShare)}%)</li>
          <li>연구 기준 노출도 = Σ w × e, e = E0 {RESEARCH_E_SCORE[scn].E0} · E1 {RESEARCH_E_SCORE[scn].E1} · E2 {RESEARCH_E_SCORE[scn].E2} ({SCENARIO_LABEL[scn]}) → α {pct(r.exposureAlpha)} · β {pct(r.exposureBeta)} · ζ {pct(r.exposureZeta)}</li>
          <li>사내 실현 가능 노출도 = Σ w × e × 실현 가능(E1: 생성형 AI 보유 시 1 / E2: 생성형 AI + 자동화 도구 1, 생성형 AI만 0.5 / E0: 0 / 도구 모름 0.5 / 민감 자료 + 외부 AI뿐이면 최대 0.5)</li>
          <li>현재 활용도 = Σ w × 활용 단계별 현재 AI 사용 비율(0단계 0% ~ 4단계 35%)</li>
          <li>인프라 갭 = 노출도 − 실현 가능 = <b>{pct(r.infraGap)}</b> (조직 과제) · 역량 갭 = max(0, 실현 가능 − 활용도) = <b>{pct(r.skillGap)}</b> (교육 과제)</li>
          <li>경계 밖 사용 신호 = E0 업무 중 2단계 이상 활용 비중 = <b>{pct(r.frontierSignal)}</b> — 해당 업무 AI 오류율 × {FRONTIER_PENALTY} (Dell'Acqua et al. 2023)</li>
          <li>4분면 기준선: 노출도 {pct(QUADRANT.x)}, 활용도 {pct(QUADRANT.y)} <em className="tag-assume">사내 보정 필요</em></li>
          <li>시뮬레이션 잠재력(표준 Task) = 유형 자동화 상한 × 노출 계수(E1 {E_POTENTIAL_COEF.E1} · E2 {E_POTENTIAL_COEF.E2} · E0 {E_POTENTIAL_COEF.E0}) <em className="tag-assume">초기 가정값</em></li>
          <li>신뢰도: 표준 Task 업무 비중 {pct(r.stdShare)} (70% 이상 높음 · 30~70% 보통 · 30% 미만 낮음)</li>
          <li>직접 입력 업무 등급은 업무 유형 기본값으로 추정: {Object.entries(TYPE_DEFAULT_E).map(([k, v]) => `${LABELS.type[k as keyof typeof LABELS.type]} ${v}`).join(' · ')}</li>
        </ul>
        <p className="fine">출처: {RESEARCH_SOURCES.join(' / ')} · 연구 데이터 기준: {RESEARCH_DATA_DATE}{version && ` · 표준 Task 마스터 기준일 ${version}`}</p>
        {errors.length > 0 && <p className="warn">표준 Task 목록에서 형식이 맞지 않아 무시한 줄: {errors.length}줄 (예: {errors[0].line}번째 줄 — {errors[0].reason})</p>}
      </details>
      <p className="fine r-notice">{RESEARCH_NOTICE}</p>
    </section>
  );
}

function GapBar({ r }: { r: ResearchResult }) {
  const using = Math.min(r.usage, r.feasibleExposure);
  const segs = [
    { k: 'use', label: '활용 중', v: using },
    { k: 'skill', label: '역량 갭(교육 과제)', v: r.skillGap },
    { k: 'infra', label: '인프라 갭(도구·권한 과제)', v: r.infraGap },
    { k: 'over', label: '실현 가능치 초과 활용', v: r.overUse },
  ].filter((x) => x.v > 0.0005);
  const scale = Math.max(1, segs.reduce((a, b) => a + b.v, 0));
  return (
    <div className="gapbar">
      <div className="gapbar-track" role="img" aria-label={segs.map((x) => `${x.label} ${pct(x.v)}`).join(', ')}>
        {segs.map((x) => <span key={x.k} className={`g-${x.k}`} style={{ width: `${(x.v / scale) * 100}%` }} title={`${x.label} ${pct(x.v)}`} />)}
      </div>
      <div className="legend">
        {segs.map((x) => <span key={x.k}><i className={`g-${x.k}`} />{x.label} <b className="num">{pct(x.v)}</b></span>)}
      </div>
    </div>
  );
}

function QuadrantMini({ r }: { r: ResearchResult }) {
  const W = 220, H = 200, pad = 28, yMax = 0.5;
  const X = (v: number) => pad + Math.min(1, v) * (W - pad - 8);
  const Y = (v: number) => H - pad - Math.min(yMax, v) / yMax * (H - pad - 8);
  const cells: [Quadrant, number, number][] = [['check', X(0), Y(yMax)], ['spread', X(QUADRANT.x), Y(yMax)], ['watch', X(0), Y(QUADRANT.y)], ['priority', X(QUADRANT.x), Y(QUADRANT.y)]];
  return (
    <svg className="quad" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`4분면: ${QUADRANT_INFO[r.quadrant].name}`}>
      {cells.map(([q, x, y]) => {
        const w = q === 'check' || q === 'watch' ? X(QUADRANT.x) - X(0) : X(1) - X(QUADRANT.x);
        const h = q === 'check' || q === 'spread' ? Y(QUADRANT.y) - Y(yMax) : Y(0) - Y(QUADRANT.y);
        return (
          <g key={q}>
            <rect x={x} y={y} width={w} height={h} className={`q-cell${q === r.quadrant ? ' on' : ''}`} />
            <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" className={`q-label${q === r.quadrant ? ' on' : ''}`}>{QUADRANT_INFO[q].name}</text>
          </g>
        );
      })}
      <circle cx={X(r.exposure)} cy={Y(r.usage)} r="6" className="q-dot" />
      <text x={X(0.5)} y={H - 6} textAnchor="middle" className="q-axis">연구 기준 노출도 →</text>
      <text x={10} y={Y(yMax / 2)} textAnchor="middle" className="q-axis" transform={`rotate(-90 10 ${Y(yMax / 2)})`}>현재 활용도 →</text>
    </svg>
  );
}
