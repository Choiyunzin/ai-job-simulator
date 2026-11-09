// 진단 결과 해석법 팝업: 응답을 마치면 리포트 전에 한 번 보여주고, 리포트에서 다시 열 수 있습니다.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const LENSES = [
  {
    no: '01', title: '사실로 읽기',
    body: '숫자와 그래프는 내가 응답한 그대로의 모습입니다. 좋고 나쁨을 판단하기 전에 "내 일이 실제로 이렇게 구성되어 있구나"를 먼저 확인해 보세요.',
  },
  {
    no: '02', title: '의미로 읽기',
    body: '왜 이런 결과가 나왔는지 생각해 보세요. 내 역할, 팀의 상황, 지금 시기의 업무를 떠올리면 같은 숫자도 다른 의미를 가집니다.',
  },
  {
    no: '03', title: '가능성으로 읽기',
    body: '결과를 바탕으로 무엇을 바꿔 볼 수 있을지 찾아보세요. 스킬 보강, 업무 조정, AI와 함께 일하기 중 바로 시작할 수 있는 작은 행동 하나면 충분합니다.',
  },
];

export const REPORT_PARTS = [
  '① 업무현황 — 내 일은 어떤 업무·비중·활동으로 이루어져 있는지',
  '② AI 영향진단 — 할 수 있는가 · 얼마의 가치가 예상되는가 · 실제로 하고 있는가, 업무별 AI 도구 가용성과 AI 위임 가능 업무',
  '③ 생산성 시뮬레이터 — 업무 흐름을 재설계하면 생산성이 얼마나 달라지는지',
  '④ 실행 인사이트 — AI 활용 가능 영역과 혁신 방향, 주의할 점, 활용 상황 미리 겪어 보기',
];

export function ReadingGuide({ onClose, onConfirm, confirmLabel = '진단 결과 보기' }: {
  onClose: () => void; onConfirm?: () => void; confirmLabel?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" aria-label="닫기" onClick={onClose}>×</button>
        <span className="eyebrow">How to read</span>
        <h2 id="guide-title">AI와 함께 일하기 시뮬레이터 해석법</h2>
        <p className="guide-lead">
          이 결과는 정답이나 평가가 아닙니다. 내 일을 데이터로 비춰 보며 지금 하는 일의 의미를 되짚고,
          다음에 해 볼 일을 찾는 <b>출발점</b>입니다. 아래 세 가지 시선으로 읽어 보세요.
        </p>
        <ol className="lenses">
          {LENSES.map((l) => (
            <li key={l.no}><span className="num">{l.no}</span><div><b>{l.title}</b><p>{l.body}</p></div></li>
          ))}
        </ol>
        <div className="guide-parts">
          <b>리포트 구성</b>
          <ul>{REPORT_PARTS.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <p className="fine">결과는 응답 시점의 자기 인식을 바탕으로 한 추정이며, 평가나 인사 자료로 쓰이지 않습니다.</p>
        <div className="modal-actions">
          {onConfirm
            ? <><button className="btn ghost" onClick={onClose}>응답 다시 보기</button>
              <button ref={btn} className="btn primary" onClick={onConfirm}>{confirmLabel} →</button></>
            : <button ref={btn} className="btn primary" onClick={onClose}>확인</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
