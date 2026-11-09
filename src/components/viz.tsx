// 시각화 컴포넌트 (라이브러리 없이 SVG/CSS로 구현)
import { useEffect, useRef, useState } from 'react';

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, []);
  return r;
}

/** 숫자 카운트업: 값이 바뀌면 이전 값에서 새 값으로 이동 */
export function CountUp({ value, decimals = 1, suffix = '', duration = 700 }: {
  value: number; decimals?: number; suffix?: string; duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, reduced, duration]);
  const f = Number.isFinite(shown) ? shown : 0;
  return <span className="num">{f.toFixed(decimals)}{suffix}</span>;
}

export interface Segment { key: string; label: string; value: number; color: string }

/** 시나리오별 가로 누적 막대 (노동시간) + 별도 표시되는 대기(경과)시간 */
export function ScenarioBars({ rows, unit = '시간', note }: {
  rows: { label: string; segments: Segment[]; wait: number; highlight?: boolean }[];
  unit?: string; note?: string;
}) {
  const max = Math.max(0.01, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0) + r.wait));
  const legend = new Map<string, Segment>();
  rows.forEach((r) => r.segments.forEach((s) => { if (s.value > 0.001) legend.set(s.key, s); }));
  return (
    <div className="sbars">
      {rows.map((r) => {
        const total = r.segments.reduce((s, x) => s + x.value, 0);
        return (
          <div key={r.label} className={`sbar-row${r.highlight ? ' hi' : ''}`}>
            <div className="sbar-head">
              <span className="sbar-label">{r.label}</span>
              <span className="sbar-total"><CountUp value={total} />{unit}
                <small> 투입 · 대기 <CountUp value={r.wait} />{unit}</small></span>
            </div>
            <div className="sbar-track" role="img" aria-label={`${r.label} 노동시간 ${total.toFixed(1)}${unit}, 대기 ${r.wait.toFixed(1)}${unit}`}>
              {r.segments.filter((s) => s.value > 0.001).map((s) => (
                <span key={s.key} className="sbar-seg" title={`${s.label} ${s.value.toFixed(2)}${unit}`}
                  style={{ width: `${(s.value / max) * 100}%`, background: s.color }} />
              ))}
              {r.wait > 0.001 && (
                <span className="sbar-seg wait" title={`승인·대기(경과시간) ${r.wait.toFixed(2)}${unit}`}
                  style={{ width: `${(r.wait / max) * 100}%` }} />
              )}
            </div>
          </div>
        );
      })}
      <div className="legend">
        {[...legend.values()].map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
        <span><i className="wait-swatch" />승인·대기(경과시간, 노동시간 아님)</span>
      </div>
      {note && <p className="fine">{note}</p>}
    </div>
  );
}

/** 도넛 차트 */
export function Donut({ segments, center, sub, size = 168 }: {
  segments: Segment[]; center: string; sub?: string; size?: number;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const R = 15.915; // 둘레 100
  let acc = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" width={size} height={size} role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value.toFixed(1)}`).join(', ')}>
        <circle cx="21" cy="21" r={R} fill="none" stroke="var(--line)" strokeWidth="5" />
        {segments.filter((s) => s.value > 0).map((s) => {
          const pct = (s.value / total) * 100;
          const el = (
            <circle key={s.key} cx="21" cy="21" r={R} fill="none" stroke={s.color} strokeWidth="5"
              strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={25 - acc} className="donut-seg">
              <title>{`${s.label} ${s.value.toFixed(1)}시간`}</title>
            </circle>
          );
          acc += pct;
          return el;
        })}
      </svg>
      <div className="donut-c"><b>{center}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

/** 100% 가로 구성 막대 */
export function Composition({ title, segments, total }: { title: string; segments: Segment[]; total: number }) {
  const t = total || 1;
  return (
    <div className="comp">
      <div className="comp-head"><span>{title}</span><span className="num">{total.toFixed(1)}시간</span></div>
      <div className="comp-track">
        {segments.filter((s) => s.value > 0.01).map((s) => (
          <span key={s.key} style={{ width: `${(s.value / t) * 100}%`, background: s.color }} title={`${s.label} ${s.value.toFixed(1)}시간`}>
            {s.value / t > 0.12 ? <em>{s.label}</em> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 0~100 점수 막대 */
export function Meter({ label, value, tone = 'accent', hint }: { label: string; value: number; tone?: 'accent' | 'good' | 'warn' | 'bad'; hint?: string }) {
  return (
    <div className="meter">
      <div className="meter-head"><span>{label}</span><b className="num">{Math.round(value)}</b></div>
      <div className="meter-track"><span className={`tone-${tone}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
      {hint && <small>{hint}</small>}
    </div>
  );
}

/** 변화량 표시 칩 */
export function Delta({ value, unit = '', goodWhen = 'down', decimals = 1 }: {
  value: number; unit?: string; goodWhen?: 'down' | 'up'; decimals?: number;
}) {
  const z = Math.abs(value) < 10 ** -decimals / 2;
  const good = z ? null : goodWhen === 'down' ? value < 0 : value > 0;
  return (
    <span className={`delta ${z ? 'flat' : good ? 'good' : 'bad'}`}>
      {z ? '변화 없음' : `${value > 0 ? '▲ +' : '▼ −'}${Math.abs(value).toFixed(decimals)}${unit}`}
    </span>
  );
}
