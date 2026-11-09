// 진단 결과 해석법 팝업: 응답을 마치면 리포트 전에 한 번 보여주고, 리포트에서 다시 열 수 있습니다.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const LENSES = [
  {
    no: '01', title: '사실로 읽기',
    body: '숫자와 그래프는 내가 답한 그대로예요. 좋고 나쁨을 따지기 전에 "내 일이 이렇게 짜여 있구나"부터 확인해 보세요.',
  },
  {
    no: '02', title: '의미로 읽기',
    body: '왜 이런 결과가 나왔을까요? 내 역할, 팀 상황, 요즘 하는 일을 떠올리면 같은 숫자도 다르게 보여요.',
  },
  {
    no: '03', title: '가능성으로 읽기',
    body: '스킬 보강, 업무 조정, AI 활용 중에서 바로 해 볼 수 있는 작은 행동 하나면 충분해요.',
  },
];

export const REPORT_PARTS = [
  '직무현황 — 내 일은 이렇게 구성되어 있어요',
  '태스크 & 스킬 — 어떤 일을 어떤 스킬로 하고 있는지',
  'AI 영향분석 — 지금 하는 일이 AI의 영향을 어떻게 받을지',
  '스킬 활용분석 — 시간을 많이 쓰는 일에서 스킬 수준은 어떤지',
  '업무패턴 — 8가지 유형으로 본 내가 일하는 방식',
  '실행 인사이트 — 무엇부터 시작해 볼지',
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
        <h2 id="guide-title">AI와 함께 일하기 시뮬레이터 해석법</h2>
        <p className="guide-lead">
          이 결과는 정답을 말하지 않아요. 내 일을 데이터로 들여다보고, 지금 하는 일의 의미와 인사이트를 찾아가는 출발점이에요. 세 가지 시선으로 읽어 보세요.
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
        <p className="fine">응답한 시점의 생각을 바탕으로 한 추정이고, 평가나 인사 자료로 쓰이지 않아요.</p>
        <div className="modal-actions">
          {onConfirm
            ? <><button className="btn ghost" onClick={onClose}>응답 다시 보기</button>
              <button ref={btn} className="btn primary" onClick={onConfirm}>{confirmLabel}</button></>
            : <button ref={btn} className="btn primary" onClick={onClose}>확인</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
