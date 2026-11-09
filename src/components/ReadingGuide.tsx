// 진단 결과 해석법 팝업: 응답을 마치면 리포트 전에 한 번 보여주고, 리포트에서 다시 열 수 있습니다.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const LENSES = [
  {
    no: '01', title: '사실로 읽기',
    body: '수치와 그래프는 응답 그대로입니다. 판단하기 전에 업무가 어떻게 구성되어 있는지 확인합니다.',
  },
  {
    no: '02', title: '의미로 읽기',
    body: '결과가 나온 이유를 역할, 팀 상황, 시기와 함께 해석합니다.',
  },
  {
    no: '03', title: '가능성으로 읽기',
    body: '스킬 보강, 업무 조정, AI 활용 중 바로 시작할 수 있는 행동 하나를 정합니다.',
  },
];

export const REPORT_PARTS = [
  '01 직무현황 — 태스크·활동 비중, 스킬 수준 평균',
  '02 태스크 & 스킬 — 업무별 활동과 연결 스킬',
  '03 AI 영향분석 — AI 적용 잠재력과 병목',
  '04 스킬 활용분석 — 태스크 비중 × 스킬 수준 사분면',
  '05 업무패턴 — 8가지 유형 기준 일하는 방식',
  '06 실행 인사이트 — 다음 행동',
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
          결과는 정답이 아닙니다. 응답한 업무를 데이터로 정리한 것이며, 업무의 의미와 개선점을 찾는 출발점으로 씁니다. 세 가지 관점으로 읽습니다.
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
        <p className="fine">응답 시점의 자기 인식에 따른 추정입니다. 평가·인사 자료로 쓰지 않습니다.</p>
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
