import { useApp } from '../state';
import { STEPS } from '../App';

export default function Intro() {
  const { s, d } = useApp();
  const resumed = s.profile.tasks.length > 0;
  return (
    <section className="intro">
      <div className="intro-copy">
        <p className="eyebrow">AI와 함께 일하기 · 6 STAGES</p>
        <h1>AI와 함께라면,<br />내 일은 어떻게<br />달라질까?</h1>
        <p className="lead">AI가 덜어줄 일과 새로 생길 일,<br />내 업무로 직접 확인해 봐요.</p>
        <p className="body">
          평소 하는 업무를 바탕으로 AI와 함께 일하는 모습을 미리 그려봅니다. 몇 가지 질문에 답하면
          나의 AI 업무 유형, 달라지는 업무 시간, 미리 챙겨야 할 부분, 앞으로의 업무 모습을 확인할 수 있습니다.
        </p>
        <div className="intro-cta">
          <button className="btn primary big" onClick={() => d({ type: 'go', step: 1, sub: resumed ? s.sub : 0 })}>
            {resumed ? '이어서 하기' : '시작하기'} →
          </button>
          <span className="meta">⏱ 약 5~8분 · 총 6단계</span>
        </div>
        <ol className="stage-list">
          {STEPS.map((x, i) => <li key={x}><b className="num">{String(i + 1).padStart(2, '0')}</b>{x}</li>)}
        </ol>
      </div>
      <IntroArt />
    </section>
  );
}

/** 사람(가운데)과 AI 업무 노드가 연결된 일러스트 — 선을 따라 작업 신호가 흐름 */
function IntroArt() {
  const nodes = [
    { x: 70, y: 70, t: '자료 조사' }, { x: 330, y: 60, t: '초안 작성' },
    { x: 360, y: 230, t: '데이터 분류' }, { x: 60, y: 250, t: '검토·승인' }, { x: 210, y: 330, t: '요청 처리' },
  ];
  const cx = 210, cy = 175;
  return (
    <div className="intro-art" aria-hidden="true">
      <svg viewBox="0 0 420 380" width="100%">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r="150" fill="url(#glow)" />
        <circle cx={cx} cy={cy} r="118" fill="none" stroke="var(--line)" strokeDasharray="2 6" />
        {nodes.map((n, i) => (
          <g key={n.t}>
            <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="var(--line-strong)" strokeWidth="1.2" />
            <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="var(--blue)" strokeWidth="2.2"
              strokeDasharray="6 120" className="pulse" style={{ animationDelay: `${i * 0.45}s` }} />
          </g>
        ))}
        {nodes.map((n, i) => (
          <g key={n.t + 'n'} className="node-float" style={{ animationDelay: `${i * 0.3}s` }}>
            <rect x={n.x - 46} y={n.y - 17} width="92" height="34" rx="10" fill="var(--surface-2)" stroke="var(--blue)" strokeOpacity="0.6" />
            <circle cx={n.x - 32} cy={n.y} r="4" fill="var(--blue)" className="blink" style={{ animationDelay: `${i * 0.5}s` }} />
            <text x={n.x - 22} y={n.y + 4.5} fontSize="12" fill="var(--fg)" fontFamily="var(--font-body)">{n.t}</text>
          </g>
        ))}
        {/* 사람 + 책상 */}
        <g>
          <circle cx={cx} cy={cy} r="54" fill="var(--surface)" stroke="var(--violet)" strokeWidth="2" />
          <circle cx={cx} cy={cy - 18} r="13" fill="var(--fg-dim)" />
          <path d={`M${cx - 24} ${cy + 18} q24 -26 48 0 v6 h-48z`} fill="var(--fg-dim)" />
          <rect x={cx - 30} y={cy + 20} width="60" height="5" rx="2" fill="var(--violet)" />
          <rect x={cx - 14} y={cy + 4} width="28" height="16" rx="2" fill="var(--blue)" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
