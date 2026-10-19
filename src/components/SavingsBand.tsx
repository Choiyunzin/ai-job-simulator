// "AI로 주 X시간 ~ Y시간 절감 가능" — 같은 업무 비율을 주 40시간·52시간 기준으로 환산한 범위
import type { HourBand } from '../useResults';

const h1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** 두 기준의 값을 "a ~ b" 형태로 (같으면 하나만) */
export function rangeOf(bands: HourBand[], pick: (b: HourBand) => number): string {
  const v = bands.map(pick);
  const lo = h1(Math.min(...v)); const hi = h1(Math.max(...v));
  return lo === hi ? lo : `${lo} ~ ${hi}`;
}

/** 리포트·내보내기용 한 줄 문장 */
export function savingsSentence(bands: HourBand[], pick: (b: HourBand) => number = (b) => b.redesignSaved): string {
  const v = bands.map(pick);
  const each = bands.map((b, i) => `주 ${b.base}시간 기준 ${h1(Math.abs(v[i]))}시간`).join(' ~ ');
  if (v.every((x) => x < 0)) return `AI 도입 후 오히려 ${each} 늘어날 수 있음`;
  return `AI로 ${each} 절감 가능`;
}

export function SavingsBand({ bands, title = 'AI로 절감 가능한 시간', compact }: { bands: HourBand[]; title?: string; compact?: boolean }) {
  const saved = bands.map((b) => b.redesignSaved);
  const negative = saved.every((x) => x < 0);
  const abs = (b: HourBand) => Math.abs(b.redesignSaved);
  return (
    <div className={`band${compact ? ' compact' : ''}${negative ? ' neg' : ''}`}>
      <span className="band-title">{negative ? 'AI 도입 후 늘어날 수 있는 시간' : title}</span>
      <b className="band-val num">주 {rangeOf(bands, abs)}<small>시간</small></b>
      <ul className="band-bases">
        {bands.map((b) => (
          <li key={b.base}>
            <span>주 {b.base}시간 근무 시</span>
            <b className="num">{h1(abs(b))}시간</b>
            <small className="num">기존 {h1(b.beforeLabor)}시간 중</small>
          </li>
        ))}
      </ul>
      {!compact && (
        <small className="band-note">
          업무 비율 × 기준 근무시간으로 환산 · 업무 흐름 재설계 반영 · 같은 업무량 기준
          {' '}(AI만 도입하면 주 {rangeOf(bands, (b) => b.aiSaved)}시간)
        </small>
      )}
    </div>
  );
}
