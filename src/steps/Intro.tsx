import { useApp } from '../state';
import { STEPS } from '../App';

const STEP_DESC = [
  '어떻게 진행되는지 살펴봐요',
  '직무, 하는 일의 비율, 스킬 수준, AI 활용 현황을 입력해요',
  '내 일의 구성, 스킬 활용, 일하는 방식, AI 영향을 한눈에 봐요',
  '업무별로 AI를 쓰기 전과 후의 시간·품질·위험을 비교해요',
  'AI와 일하다 생기는 상황에서 어떻게 대응할지 골라요',
  '아낀 시간을 어디에 쓸지 정하고 리포트로 저장해요',
];

export default function Intro() {
  const { s, d } = useApp();
  const resumed = s.profile.tasks.length > 0;
  return (
    <section className="intro">
      <div className="intro-head">
        <h1>내 일을 데이터로 들여다보고, AI와 함께 일하는 모습을 그려 봐요</h1>
        <p className="lead">하는 일과 스킬 수준을 입력하면 내 일이 어떻게 짜여 있는지, AI와 함께라면 무엇이 달라지는지 보여 드려요. 10분 정도 걸려요.</p>
        <div className="intro-cta">
          <button className="btn primary big" onClick={() => d({ type: 'go', step: 1, sub: resumed ? s.sub : 0 })}>
            {resumed ? '이어서 하기' : '시작하기'}
          </button>
          <span className="fine">입력한 내용은 이 브라우저에만 저장돼요.</span>
        </div>
      </div>
      <ol className="intro-steps">
        {STEPS.map((x, i) => (
          <li key={x}><span className="num">{i + 1}</span><div><b>{x}</b><p>{STEP_DESC[i]}</p></div></li>
        ))}
      </ol>
    </section>
  );
}
