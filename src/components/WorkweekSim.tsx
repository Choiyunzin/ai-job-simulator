// '미래의 나' — "주당 근무시간이 ○○시간이라면?" 직접 바꿔 보는 시뮬레이터
// 업무 비율(%) × 근무시간으로 시간을 환산해, 근무시간에 따라 AI 절감 시간이 어떻게 달라지는지 보여줍니다.
import { useEffect, useState } from 'react';
import { HOUR_BASES } from '../engine/config';
import type { ScenarioResult } from '../engine/types';
import type { HourBand } from '../useResults';
import { CountUp } from './viz';

const h1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const MIN_H = 30;
const MAX_H = 68;

/** 리포트·내보내기용 한 줄 문장 (비교 기준: 주 40시간·52시간) */
export function savingsSentence(bands: HourBand[], pick: (b: HourBand) => number = (b) => b.redesignSaved): string {
  const v = bands.map(pick);
  const each = bands.map((b, i) => `주 ${b.base}시간이라면 ${h1(Math.abs(v[i]))}시간`).join(', ');
  if (v.every((x) => x < 0)) return `AI 도입 후 오히려 ${each} 늘어날 수 있음`;
  return `AI로 ${each} 절감 가능`;
}

export function WorkweekSim({ hours, onChange, redesign, after, bands }: {
  hours: number; onChange: (h: number) => void;
  redesign: ScenarioResult; after: ScenarioResult; bands: HourBand[];
}) {
  const T = redesign.totals;
  const saved = T.savedSameVolume;
  const negative = saved < 0;
  const set = (v: number) => onChange(Math.max(MIN_H, Math.min(MAX_H, Math.round(v) || 40)));

  return (
    <div className={`band whatif${negative ? ' neg' : ''}`}>
      <div className="whatif-q">
        <span className="band-title">직접 시뮬레이션해 보기</span>
        <h3>주당 근무시간이 <b className="num">{hours}</b>시간이라면?</h3>
        <div className="whatif-ctl">
          <div className="seg small" role="radiogroup" aria-label="주당 근무시간 빠른 선택">
            {HOUR_BASES.map((h) => (
              <button key={h} role="radio" aria-checked={hours === h} className={hours === h ? 'on' : ''} onClick={() => set(h)}>{h}시간</button>
            ))}
          </div>
          <input type="range" min={MIN_H} max={MAX_H} step={1} value={hours} aria-label="주당 근무시간"
            onChange={(e) => set(Number(e.target.value))} />
          <HoursInput hours={hours} onCommit={set} />
        </div>
      </div>

      <div className="whatif-a">
        <span className="band-title">{negative ? 'AI 도입 후 늘어날 수 있는 시간' : 'AI로 절감 가능한 시간'}</span>
        <b className="band-val num"><span>주 </span><CountUp value={Math.abs(saved)} /><small>시간</small></b>
        <small className="num">기존 업무 {h1(T.beforeLabor)}시간 중 · 절감률 {h1(T.savingRate)}% · AI만 도입하면 {h1(after.totals.savedSameVolume)}시간</small>
      </div>

      <ul className="band-bases" aria-label="근무시간별 비교">
        {bands.map((b) => (
          <li key={b.base} className={b.base === hours ? 'on' : ''}>
            <button onClick={() => set(b.base)}>
              <span>주 {b.base}시간이라면</span>
              <b className="num">{h1(Math.abs(b.redesignSaved))}시간 {b.redesignSaved < 0 ? '증가' : '절감'}</b>
            </button>
          </li>
        ))}
      </ul>
      <small className="band-note">시간 = 근무시간 × 업무 비율 · 업무 흐름 재설계 반영 · 같은 업무량 기준. 근무시간을 바꾸면 아래 숫자가 모두 다시 계산됩니다.</small>
    </div>
  );
}

/** 숫자 직접 입력: 타이핑 중에는 그대로 두고, 범위 안의 값이면 바로 반영 · 칸을 벗어나거나 Enter 시 범위로 맞춤 */
function HoursInput({ hours, onCommit }: { hours: number; onCommit: (h: number) => void }) {
  const [text, setText] = useState(String(hours));
  useEffect(() => { setText(String(hours)); }, [hours]);
  const commit = () => { const v = Number(text); if (text.trim() && Number.isFinite(v)) onCommit(v); else setText(String(hours)); };
  return (
    <input type="number" className="num-in" min={MIN_H} max={MAX_H} value={text} aria-label="주당 근무시간 숫자 입력"
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (Number.isInteger(v) && v >= MIN_H && v <= MAX_H) onCommit(v);
      }}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
  );
}
