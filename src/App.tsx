import { useEffect, useRef, useState } from 'react';
import { useApp } from './state';
import Intro from './steps/Intro';
import ProfileStep from './steps/ProfileStep';
import Diagnosis from './steps/Diagnosis';
import Simulation from './steps/Simulation';
import Events from './steps/Events';
import Future from './steps/Future';

export const STEPS = ['인트로', '업무 프로파일', '유형 진단', '생산성 시뮬레이션', '상황 대응', '미래의 나'];

export const profileReady = (tasks: { name: string; hours: number }[]) =>
  tasks.some((t) => t.name.trim() && t.hours > 0);

export default function App() {
  const { s, d } = useApp();
  const [confirm, setConfirm] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const ready = profileReady(s.profile.tasks);

  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); }, [s.step, s.sub]);

  const Screen = [Intro, ProfileStep, Diagnosis, Simulation, Events, Future][s.step] ?? Intro;

  return (
    <div className="app" ref={top}>
      <header className="topbar">
        <div className="brand" onClick={() => d({ type: 'go', step: 0 })} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && d({ type: 'go', step: 0 })}>
          <span className="brand-mark" aria-hidden="true">◎</span>
          <span><b>AI와 함께 일하기 시뮬레이터</b><small>AI와 함께라면, 내 일은 어떻게 달라질까?</small></span>
        </div>
        <div className="top-actions">
          {confirm ? (
            <span className="confirm">
              입력한 내용을 모두 지울까요?
              <button className="btn tiny danger" onClick={() => { d({ type: 'reset' }); setConfirm(false); }}>초기화</button>
              <button className="btn tiny ghost" onClick={() => setConfirm(false)}>취소</button>
            </span>
          ) : (
            <button className="btn tiny ghost" onClick={() => setConfirm(true)}>↺ 처음부터</button>
          )}
        </div>
        <nav className="progress" aria-label="진행 단계">
          <div className="progress-bar"><span style={{ width: `${(s.step / (STEPS.length - 1)) * 100}%` }} /></div>
          <ol>
            {STEPS.map((label, i) => {
              const reachable = i <= 1 || ready;
              const state = i < s.step ? 'done' : i === s.step ? 'now' : 'todo';
              return (
                <li key={label} className={state}>
                  <button disabled={!reachable} aria-current={i === s.step ? 'step' : undefined}
                    onClick={() => d({ type: 'go', step: i })}>
                    <i>{state === 'done' ? '✓' : i + 1}</i><span>{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>
      <main key={s.step} className={`screen screen-${s.step}`}>
        <Screen />
      </main>
      <footer className="foot">
        모든 수치는 입력값과 가정에 기반한 교육용 추정치이며 실제 성과 예측이 아닙니다. 입력값은 이 브라우저에만 저장됩니다.
      </footer>
    </div>
  );
}

export function StepNav({ onPrev, onNext, nextLabel = '다음', disabled, hint }: {
  onPrev?: () => void; onNext?: () => void; nextLabel?: string; disabled?: boolean; hint?: string;
}) {
  return (
    <div className="stepnav">
      {onPrev ? <button className="btn ghost" onClick={onPrev}>← 이전</button> : <span />}
      <div className="stepnav-r">
        {hint && <span className="hint">{hint}</span>}
        {onNext && <button className="btn primary" onClick={onNext} disabled={disabled}>{nextLabel} →</button>}
      </div>
    </div>
  );
}
