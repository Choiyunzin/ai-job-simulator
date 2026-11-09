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
  '내 일은 이렇게 구성되어 있다 — 어떤 업무와 활동이 많은 비중을 차지하는지',
  '내 일에 스킬을 어떻게 활용하고 있는가 — 업무 비중과 스킬 수준의 매칭',
  '내 일은 AI의 영향을 어떻게 받을까 — AI 적용 잠재력과 주의할 병목',
  '내가 일하는 방식은 어떤 유형에 가까운가 — 8가지 업무 패턴',
  '무엇부터 시작해 볼까 — 실행 인사이트',
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
          본 결과는 정답을 말하지 않습니다. 본인의 일을 데이터로 들여다보고,
          지금 하는 일의 의미와 인사이트를 찾아가는 <b>출발점</b>입니다. 세 가지 시선으로 읽어 보세요.
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
