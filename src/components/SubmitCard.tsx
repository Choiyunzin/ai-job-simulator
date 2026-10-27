// 결과 제출 카드 (STEP 6): 제출 주소가 설정된 경우에만 표시
import { useState } from 'react';
import type { AppState } from '../state';
import type { buildReport } from '../report';
import { buildSubmission, lastSubmit, sendSubmission, submitUrl, type SendResult } from '../submit';

export function SubmitCard({ state, report }: { state: AppState; report: ReturnType<typeof buildReport> }) {
  const url = submitUrl();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(SendResult & { id?: string }) | null>(null);
  const [last, setLast] = useState(lastSubmit());
  if (!url) return null;

  const submit = async () => {
    setBusy(true); setResult(null);
    const payload = buildSubmission(state, report);
    const r = await sendSubmission(url, payload);
    setBusy(false);
    setResult({ ...r, id: payload.submissionId });
    if (r.ok) setLast(lastSubmit());
  };

  return (
    <div className="card submit-card">
      <h3>결과 제출하기</h3>
      <p className="lead-s">교육 운영 부서가 직무별 AI 활용 현황을 파악하고 교육을 설계하는 데 쓰입니다. 제출은 선택이에요.</p>
      <ul className="submit-what">
        <li><b>보내는 정보</b> 직무·직급·직책·Pay Grade·연차 구간, 업무별 비율과 AI 활용 응답, 진단·시뮬레이션 결과, 역할 진단, 나의 이야기(적은 경우)</li>
        <li><b>보내지 않는 정보</b> 이름·사번·연락처 등 나를 알아볼 수 있는 정보</li>
      </ul>
      <label className="agree">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>위 내용을 익명으로 교육 운영 부서에 제출하는 데 동의합니다.</span>
      </label>
      <div className="ex-btns">
        <button className="btn primary" disabled={!agree || busy} onClick={submit}>{busy ? '보내는 중…' : last ? '다시 제출하기' : '결과 제출하기'}</button>
      </div>
      {result && (result.ok
        ? <p className="ok" role="status">{result.confirmed ? '✓ 제출됐어요.' : '✓ 제출 요청을 보냈어요. (접수 확인 응답은 받지 못했어요)'} 제출 번호 <span className="num">{result.id?.slice(0, 8)}</span></p>
        : <p className="warn" role="alert">제출하지 못했어요. {result.reason} 잠시 후 다시 시도해 주세요.</p>)}
      {!result && last && <p className="fine">마지막 제출: {new Date(last.at).toLocaleString('ko-KR')} · 다시 제출하면 새 응답으로 한 줄 더 쌓이고, 분석 시 최신 제출을 씁니다.</p>}
    </div>
  );
}
