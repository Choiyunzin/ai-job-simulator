import { StepNav } from '../App';
import { ARCHETYPES } from '../engine/config';
import { jobLabel } from '../jobCatalog';
import { fmtH } from '../engine/simulate';
import type { ArchetypeId } from '../engine/types';
import { CountUp, Meter } from '../components/viz';
import { useApp } from '../state';
import { useResults } from '../useResults';
import { SavingsBand } from '../components/SavingsBand';
import { HOUR_BASES } from '../engine/config';

export default function Diagnosis() {
  const { s, d } = useApp();
  const { dx, after, bands } = useResults();
  const shareTotal = s.profile.tasks.reduce((x, t) => x + (t.share || 0), 0);
  const A = ARCHETYPES[dx.archetype];
  const job = jobLabel(s.profile);
  const currentAi = after.tasks.reduce((x, r) => x + r.before.currentAiHours, 0);
  const startSim = (id?: string) => {
    if (id) d({ type: 'simTask', id });
    d({ type: 'go', step: 3 });
  };

  return (
    <section className="dx">
      <p className="eyebrow">STEP 3 · 나의 AI 업무 유형 진단</p>
      <div className={`dx-hero t-${dx.archetype}`}>
        <div className="dx-icon" aria-hidden="true">{A.icon}</div>
        <div className="dx-main">
          <small>{job} · 나의 AI 업무 유형은</small>
          <h1>{A.name}</h1>
          <p className="dx-tag">{A.tagline}</p>
          <p className="dx-sentence">{dx.sentence}</p>
        </div>
      </div>

      <div className="grid2 gap">
        <div className="card soft"><h3>이 유형의 강점</h3><p>{A.strength}</p></div>
        <div className="card soft"><h3>개선 기회</h3><p>{A.growth}</p></div>
      </div>

      <SavingsBand bands={bands} />

      <div className="stats">
        <div className="stat"><span>입력한 업무 비율</span><b><CountUp value={shareTotal} decimals={0} />%</b>
          <small>{HOUR_BASES.map((h) => `주 ${h}h 기준 ${(Math.round(shareTotal * h) / 100).toFixed(1)}h`).join(' · ')}</small></div>
        <div className="stat"><span>평균 AI 활용 수준</span><b><CountUp value={dx.avgLevel} /> / 4</b>
          <small>업무시간 가중 평균</small></div>
        <div className="stat"><span>현재 AI 활용 시간(추정)</span><b><CountUp value={currentAi} />시간</b>
          <small>활용 단계별 가정 비율 적용</small></div>
        <div className="stat"><span>평균 AI 적용 잠재력</span><b><CountUp value={dx.avgPotential * 100} decimals={0} />%</b>
          <small>업무 유형 × 적용 가능성</small></div>
      </div>

      <div className="grid2 gap">
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
        <div className="card">
          <h3>AI 도입 시 주의해야 할 병목 TOP 2</h3>
          <ul className="bottleneck">
            {dx.bottlenecks.map((b) => (
              <li key={b.key}>
                <b>{b.label}</b><span className="num">주 {fmtH(b.hours)}</span>
                <small>{b.desc}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {dx.firstExperiment && (
        <div className="card exp">
          <div>
            <span className="eyebrow">가장 먼저 실험해볼 업무</span>
            <h3>{dx.firstExperiment.name}</h3>
            <p>{dx.firstExperiment.reason}</p>
          </div>
          <button className="btn primary" onClick={() => startSim(dx.firstExperiment!.id)}>이 업무로 시뮬레이션 →</button>
        </div>
      )}

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
          <li>품질 수호자 = 검증 부담 비중 × 45 + 품질 우려 × 9 + 품질·오류 성공기준 × 12</li>
        </ul>
      </details>

      <StepNav onPrev={() => d({ type: 'go', step: 1, sub: 4 })} onNext={() => startSim()} nextLabel="AI 도입 시뮬레이션 시작" />
    </section>
  );
}
