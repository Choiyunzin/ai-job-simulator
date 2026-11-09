import { ARCHETYPES } from '../engine/config';
import { jobLabel } from '../jobCatalog';
import { fmtH } from '../engine/simulate';
import type { ArchetypeId } from '../engine/types';
import { CountUp, Meter } from '../components/viz';
import { useApp } from '../state';
import { useResults } from '../useResults';
import { pct, researchDiagnosis } from '../engine/research';

/** AI 영향분석 모듈 (진단 리포트 3번): AI 업무 유형 · 연구 기준 진단 · 잠재력 TOP · 병목 */
export function AiImpact() {
  const { s } = useApp();
  const { dx, after } = useResults();
  const shareTotal = s.profile.tasks.reduce((x, t) => x + (t.share || 0), 0);
  const A = ARCHETYPES[dx.archetype];
  const rs = researchDiagnosis(s.profile, 'beta');
  const potBadge = rs.stdShare >= 0.5 ? '연구 기준' : '유형 추정';
  const job = jobLabel(s.profile);
  const currentAi = after.tasks.reduce((x, r) => x + r.before.currentAiHours, 0);

  return (
    <div className="dx">
      <div className={`dx-hero t-${dx.archetype}`}>
        <div className="dx-icon" aria-hidden="true">{A.icon}</div>
        <div className="dx-main">
          <small>{job} · 나의 AI 업무 유형은</small>
          <h1>{A.name}</h1>
          <p className="dx-tag">{A.tagline}</p>
          <p className="dx-sentence">{dx.sentence}{dx.archetype === 'explorer' && rs.quadrant === 'priority' && ' 연구 기준으로도 AI 활용 여지가 큰 상태입니다.'}</p>
        </div>
      </div>

      <div className="grid2 gap">
        <div className="card soft"><h3>이 유형의 강점</h3><p>{A.strength}</p></div>
        <div className="card soft"><h3>개선 기회</h3><p>{A.growth}</p></div>
      </div>

      <div className="stats">
        <div className="stat"><span>입력한 업무 비율</span><b><CountUp value={shareTotal} decimals={0} />%</b>
          <small>시간은 주 {s.profile.weeklyHours}시간 근무 기준으로 환산</small></div>
        <div className="stat"><span>평균 AI 활용 수준</span><b><CountUp value={dx.avgLevel} /> / 4</b>
          <small>업무시간 가중 평균</small></div>
        <div className="stat"><span>현재 AI 활용 시간(추정)</span><b><CountUp value={currentAi} />시간</b>
          <small>활용 단계별 가정 비율 적용</small></div>
        <div className="stat"><span>평균 AI 적용 잠재력 <em className={`src-badge ${potBadge === '연구 기준' ? 'res' : 'est'}`}>{potBadge}</em></span><b><CountUp value={dx.avgPotential * 100} decimals={0} />%</b>
          <small>{potBadge === '연구 기준' ? '유형 상한 × 연구 등급 계수' : '업무 유형 × 적용 가능성'}</small></div>
      </div>

      <AiLenses />

      <div className="card">
        <h3>AI 적용 잠재력이 높은 업무 TOP {dx.topTasks.length}</h3>
        <ol className="rank">
          {dx.topTasks.map((t, i) => (
            <li key={t.id}>
              <span className="rk num">{i + 1}</span>
              <span className="rn">{t.name}<small>직접작업의 {Math.round(t.reduction * 100)}%를 AI가 맡을 수 있다고 가정</small></span>
              <b className={`num ${t.savedHours >= 0 ? 'pos' : 'neg'}`}>{t.savedHours >= 0 ? '−' : '+'}{fmtH(Math.abs(t.savedHours))}/주</b>
            </li>
          ))}
        </ol>
      </div>

      <details className="basis">
        <summary>유형 판정 근거 보기</summary>
        <p className="fine">아래 네 점수 중 가장 높은 유형이 선택됩니다. 이 분류는 실제 심리검사가 아니라 교육용 게임을 위한 가상 분류이며, 어느 유형이 더 우수하다는 뜻이 아닙니다.</p>
        <div className="meters">
          {(Object.keys(ARCHETYPES) as ArchetypeId[]).map((k) => (
            <Meter key={k} label={`${ARCHETYPES[k].icon} ${ARCHETYPES[k].name}`} value={dx.scores[k]} tone={k === dx.archetype ? 'accent' : 'good'} />
          ))}
        </div>
        <ul className="factors">
          {dx.factors.map((f) => <li key={f.label}><span>{f.label}</span><b className="num">{f.value}</b></li>)}
        </ul>
        <ul className="formula">
          <li>탐험가 = 잠재력 × (1 − 활용수준/4) × 160</li>
          <li>실무 파트너 = 100 − |활용수준 − 2| × 40 − (문서·조사·분석 업무 미활용 비중) × 25</li>
          <li>오케스트레이터 = 3단계 이상 비중 × 80 + (서로 다른 유형 2개 이상 +15) + (4단계 업무 +10)</li>
          <li>품질 수호자 = 검증 부담 비중 × 45 + 품질 우려 × 9 + 품질·오류 성공기준 × 12 + (개인정보 많음 +10) + AI 능력 경계 밖 활용 비중 × 40</li>
          <li>잠재력: 표준 업무는 유형 상한 × 연구 등급 계수, 직접 입력 업무는 유형 상한 × 적용 가능성 배수</li>
        </ul>
      </details>
    </div>
  );
}

/** AI 영향도를 세 가지 근거로 읽기: 할 수 있는가(GPTs are GPTs) · 얼마의 가치(McKinsey) · 실제로 하고 있는가(Anthropic Economic Index) */
export function AiLenses() {
  const { s } = useApp();
  const { dx, redesign } = useResults();
  const r = researchDiagnosis(s.profile, 'beta');
  const T = redesign.totals;
  const eCount = (e: string) => r.rows.filter((x) => x.e === e).length;
  return (
    <div className="lenses3">
      <div className="lens">
        <span className="lens-q">① 할 수 있는가?</span>
        <b className="num">{pct(r.exposure)}</b>
        <p>AI로 시간을 크게 줄일 수 있는 업무 비중 <small>(연구 기준 노출도 β)</small></p>
        <small>바로 가능(E1) {eCount('E1')}개 · 도구가 있으면 가능(E2) {eCount('E2')}개 · 어려움(E0) {eCount('E0')}개</small>
        <em className="lens-src">근거: Eloundou et al., "GPTs are GPTs"</em>
      </div>
      <div className="lens">
        <span className="lens-q">② 얼마의 가치·변화가 예상되는가?</span>
        <b className="num">{Math.round(dx.avgPotential * 100)}%</b>
        <p>업무별 AI 적용 잠재력 평균 · 재설계 시 주 <b className="num">{fmtH(Math.max(0, T.savedSameVolume))}</b> 절감({T.savingRate.toFixed(1)}%) 예상</p>
        <small>업무 유형별 자동화 잠재력 × 적용 가능성으로 추정</small>
        <em className="lens-src">근거: McKinsey, "The economic potential of generative AI"</em>
      </div>
      <div className="lens">
        <span className="lens-q">③ 실제로 하고 있는가?</span>
        <b className="num">{pct(r.usage)}</b>
        <p>지금 실제로 AI를 쓰는 업무 비중 <small>(현재 활용도)</small></p>
        <small>{r.autoShare !== null
          ? `AI에 맡기는 자동화형 ${pct(r.autoShare)} · 함께 일하는 증강형 ${pct(1 - r.autoShare)}`
          : '활용 방식을 고른 업무가 없어요'}</small>
        <em className="lens-src">근거: Anthropic Economic Index</em>
      </div>
    </div>
  );
}
