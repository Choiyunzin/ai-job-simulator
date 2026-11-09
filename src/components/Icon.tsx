// 아이콘: 한 가지 선 굵기(1.75)로 그린 SVG. 글자 기호(✓ ▾) 대신 씁니다.
const PATHS = {
  check: 'M4 10.5l4 4 8-9',
  down: 'M5 8l5 5 5-5',
  up: 'M5 12l5-5 5 5',
} as const;

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
