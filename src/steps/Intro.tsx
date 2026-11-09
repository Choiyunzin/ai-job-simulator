import { useApp } from '../state';
import { STEPS } from '../App';

const STEP_DESC = [
  '진행 방법 안내',
  '직무·업무 비율·스킬 수준·AI 활용 현황 입력',
  '직무현황, 태스크·스킬, AI 영향, 스킬 활용, 업무패턴, 실행 인사이트',
  '업무별 AI 적용 전후 시간·품질·위험 비교',
  'AI 적용 시 생기는 상황별 대응 선택',
  '근무시간 기준 절감 시간, 재투자 계획, 리포트 내보내기',
];

export default function Intro() {
  const { s, d } = useApp();
  const resumed = s.profile.tasks.length > 0;
  return (
    <section className="intro">
      <h1>업무 진단과 AI 적용 시뮬레이션</h1>
      <p className="lead">직무와 업무 비율, 스킬 수준을 입력하면 업무 구성과 스킬 활용, 업무패턴, AI 적용 시 시간 변화를 계산합니다. 소요 시간 약 10분.</p>
      <table className="tbl intro-steps">
        <thead><tr><th className="r">단계</th><th>이름</th><th>내용</th></tr></thead>
        <tbody>
          {STEPS.map((x, i) => (
            <tr key={x}><td className="r num">{i + 1}</td><td>{x}</td><td>{STEP_DESC[i]}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="intro-cta">
        <button className="btn primary" onClick={() => d({ type: 'go', step: 1, sub: resumed ? s.sub : 0 })}>
          {resumed ? '이어서 하기' : '시작'}
        </button>
        <span className="fine">결과는 응답 시점의 자기 인식에 따른 추정이며 평가 자료로 쓰지 않습니다.</span>
      </div>
    </section>
  );
}
