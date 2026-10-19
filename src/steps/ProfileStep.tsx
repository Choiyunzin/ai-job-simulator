import { useEffect, useRef, useState } from 'react';
import { StepNav } from '../App';
import { EDU_EXAMPLES, ENV, LABELS, TYPE_PROFILE } from '../engine/config';
import type {
  AiLevel, AiTool, Applicability, ApprovalSteps, LearningTime, PersonalData, TeamCulture, Concern, Criterion, Difficulty, Frequency, Importance, JobId, Task, TaskType,
} from '../engine/types';
import { useApp } from '../state';
import { LEVELS, isEduPath, optionsAt, useJobCatalog } from '../jobCatalog';

const SUBS = ['직무', '업무 정의', 'AI 활용 수준', 'AI 적용 가능성', '성공 기준·걱정', '승인·자료', 'AI 활용 환경', '나의 이야기'];
const CODES = ['QA', 'QB', 'QC', 'QD', 'QE·F', 'QG', 'QH', 'QI'];

export const taskError = (t: Task): string | null => {
  if (!t.name.trim()) return '업무명을 입력해 주세요.';
  if (!(t.share > 0)) return '업무 비율은 0%보다 커야 합니다.';
  if (t.share > 100) return '업무 비율은 100% 이하로 입력해 주세요.';
  return null;
};

export default function ProfileStep() {
  const { s, d } = useApp();
  const sub = Math.min(s.sub, SUBS.length - 1);
  const go = (n: number) => d({ type: 'sub', sub: n });
  const tasks = s.profile.tasks;
  const shareTotal = tasks.reduce((x, t) => x + (t.share || 0), 0);
  const tasksOk = tasks.length > 0 && tasks.every((t) => !taskError(t)) && shareTotal <= 100 + 1e-9;
  const subNav = useRef<HTMLDivElement>(null);
  useEffect(() => { // 모바일에서 현재 질문 탭이 보이도록 가로 스크롤
    const el = subNav.current?.querySelector<HTMLElement>('.now');
    const box = subNav.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [sub]);

  const catalog = useJobCatalog();
  const useList = catalog.rows.length > 0;
  const bodies = [<QJob key="a" catalog={catalog} />, <QTasks key="b" />, <QLevel key="c" />, <QApplicability key="d" />, <QCriteria key="e" />,
    <QApproval key="g" />, <QAiEnv key="h" />, <QStory key="i" />];
  const jobOk = useList ? s.profile.jobPath.length === 4 : s.profile.job !== 'other' || !!s.profile.jobOther.trim();
  const canNext = sub === 1 ? tasksOk : sub === 0 ? jobOk : true;
  const hint = sub === 1 && !tasksOk
    ? (tasks.length === 0 ? '업무를 1개 이상 추가해 주세요.' : shareTotal > 100 ? '업무 비율 합계가 100%를 넘지 않게 조정해 주세요.' : '빨간 표시가 있는 업무를 확인해 주세요.')
    : sub === 0 && !canNext ? (useList ? '직군부터 직무까지 차례로 골라 주세요.' : '직무를 직접 입력해 주세요.') : undefined;

  return (
    <section className="profile">
      <div className="sub-progress" aria-label="질문 진행" ref={subNav}>
        {SUBS.map((x, i) => (
          <button key={x} className={i === sub ? 'now' : i < sub ? 'done' : ''}
            disabled={i > 1 && !tasksOk} onClick={() => go(i)}>
            <span className="num">{CODES[i]}</span>{x}
          </button>
        ))}
      </div>
      <div className="qwrap" key={sub}>{bodies[sub]}</div>
      <StepNav
        onPrev={() => (sub === 0 ? d({ type: 'go', step: 0 }) : go(sub - 1))}
        onNext={() => (sub === SUBS.length - 1 ? d({ type: 'go', step: 2 }) : go(sub + 1))}
        nextLabel={sub === SUBS.length - 1 ? '나의 업무 분석하기' : '다음 질문'}
        disabled={!canNext} hint={hint}
      />
    </section>
  );
}

function QHead({ code, title, desc }: { code: string; title: string; desc?: string }) {
  return (
    <div className="qhead">
      <span className="qcode num">{code}</span>
      <h2>{title}</h2>
      {desc && <p>{desc}</p>}
    </div>
  );
}

type Catalog = ReturnType<typeof useJobCatalog>;

function QJob({ catalog }: { catalog: Catalog }) {
  const { s, d } = useApp();
  const p = s.profile;
  const useList = catalog.rows.length > 0;
  // 목록이 바뀌어 예전 선택이 목록에 없으면 처음부터 다시 고르게 합니다.
  const pathValid = p.jobPath.length === 0 || catalog.rows.some((r) => p.jobPath.every((v, k) => r[k] === v));
  useEffect(() => {
    if (!pathValid || (!useList && p.jobPath.length)) d({ type: 'profile', patch: { jobPath: [], job: 'edu', jobOther: '' } });
  }, [pathValid, useList]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (level: number, value: string) => {
    const path = value ? [...p.jobPath.slice(0, level), value] : p.jobPath.slice(0, level);
    const done = path.length === 4;
    d({ type: 'profile', patch: {
      jobPath: path,
      job: done && isEduPath(path) ? 'edu' : 'other',
      jobOther: done ? path[3] : '',
    } });
  };

  return (
    <div className="qcard">
      <QHead code="Q.A" title="나의 직무는 무엇인가요?"
        desc={useList ? '직군부터 차례로 고르면 다음 칸에 해당하는 항목만 나옵니다. 직무는 결과 문구를 맞춤화하는 데만 씁니다.'
          : '직무는 결과 문구를 맞춤화하는 데만 씁니다. 업무 내용은 다음 질문에서 직접 정의합니다.'} />
      {useList ? (
        <div className="cascade">
          {LEVELS.map((name, level) => {
            const opts = level <= p.jobPath.length ? optionsAt(catalog.rows, p.jobPath, level) : [];
            const locked = level > p.jobPath.length;
            return (
              <div className="field" key={name}>
                <label htmlFor={`jp${level}`}>
                  <span><span className="num step-no">{level + 1}</span>{name}</span>
                  {!locked && <small className="num">{opts.length}개</small>}
                </label>
                <select id={`jp${level}`} value={p.jobPath[level] ?? ''} disabled={locked}
                  onChange={(e) => pick(level, e.target.value)}>
                  <option value="">{locked ? `${LEVELS[level - 1]}을(를) 먼저 골라 주세요` : `${name} 선택`}</option>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            );
          })}
          {p.jobPath.length === 4 && <p className="ok">✓ {p.jobPath.join(' › ')}</p>}
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="job">직무</label>
            <select id="job" value={p.job} onChange={(e) => d({ type: 'profile', patch: { job: e.target.value as JobId } })}>
              {(Object.keys(LABELS.job) as JobId[]).map((k) => <option key={k} value={k}>{LABELS.job[k]}</option>)}
            </select>
          </div>
          {p.job === 'other' && (
            <div className="field">
              <label htmlFor="jobOther">직무 직접 입력</label>
              <input id="jobOther" value={p.jobOther} maxLength={30} placeholder="예: 안전환경 교육"
                onChange={(e) => d({ type: 'profile', patch: { jobOther: e.target.value } })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange, name }: {
  value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; name: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''}
          onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

function QTasks() {
  const { s, d } = useApp();
  const tasks = s.profile.tasks;
  const total = tasks.reduce((x, t) => x + (t.share || 0), 0);
  const over = total > 100 + 1e-9;
  const rest = Math.max(0, 100 - total);
  const [open, setOpen] = useState<string | null>(tasks[tasks.length - 1]?.id ?? null);
  const names = new Set(tasks.map((t) => t.name));
  const examples = EDU_EXAMPLES.filter((e) => !names.has(e.name));

  return (
    <div className="qcard wide">
      <QHead code="Q.B" title="나의 실제 업무를 직접 정의해 보세요" desc="전체 업무를 100%로 볼 때, 비중이 큰 업무부터 최대 5개까지 비율을 적어주세요. 예시는 참고용이며 자유롭게 고치거나 지울 수 있습니다." />

      <div className={`hours-meter${over ? ' over' : ''}`}>
        <div className="hm-head">
          <span>입력한 업무 비율 합계</span>
          <b className="num">{fmtPct(total)} / 100%</b>
        </div>
        <div className="hm-track"><span style={{ width: `${Math.min(100, total)}%` }} /></div>
        {over
          ? <p className="warn">⚠ 합계가 100%보다 {fmtPct(total - 100)} 많습니다. 업무 비율을 줄여 주세요.</p>
          : <small>비율은 추정치여도 괜찮습니다. 나머지 {fmtPct(rest)}는 회의·기타 업무로 봅니다. 시간 환산은 마지막 단계에서 근무시간을 바꿔 가며 해볼 수 있어요.</small>}
      </div>

      {s.profile.job === 'edu' && examples.length > 0 && tasks.length < 5 && (
        <div className="examples">
          <span className="ex-label">교육기획 예시 업무</span>
          <div className="chips">
            {examples.map((e) => (
              <button key={e.name} className="chip add" onClick={() => d({ type: 'addTask', task: e })}>+ {e.name}</button>
            ))}
            {tasks.length === 0 && <button className="chip solid" onClick={() => d({ type: 'loadExamples' })}>예시 5개 한 번에 불러오기</button>}
          </div>
        </div>
      )}

      <div className="task-list">
        {tasks.map((t, i) => {
          const err = taskError(t);
          const isOpen = open === t.id;
          return (
            <article key={t.id} className={`task-card${isOpen ? ' open' : ''}${err ? ' err' : ''}`}>
              <button className="task-sum" onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen}>
                <span className="tnum num">{i + 1}</span>
                <span className="tname">{t.name || '새 업무'}</span>
                <span className="tmeta">{LABELS.type[t.type]} · {fmtPct(t.share || 0)}</span>
                <span className="caret">{isOpen ? '▴' : '▾'}</span>
              </button>
              {err && <p className="err-msg">{err}</p>}
              {isOpen && <TaskEditor t={t} onRemove={() => d({ type: 'removeTask', id: t.id })} />}
            </article>
          );
        })}
      </div>
      {tasks.length < 5 ? (
        <button className="btn dashed" onClick={() => { d({ type: 'addTask' }); setOpen(null); }}>+ 업무 직접 추가 ({tasks.length}/5)</button>
      ) : <p className="fine">업무는 최대 5개까지 입력할 수 있습니다.</p>}
    </div>
  );
}

function TaskEditor({ t, onRemove }: { t: Task; onRemove: () => void }) {
  const { d } = useApp();
  const set = (patch: Partial<Task>) => d({ type: 'task', id: t.id, patch });
  const id = (k: string) => `${t.id}-${k}`;
  return (
    <div className="task-edit">
      <div className="field">
        <label htmlFor={id('name')}>업무명</label>
        <input id={id('name')} value={t.name} maxLength={30} placeholder="예: 교육 만족도 분석" autoFocus={!t.name}
          onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={id('share')}>전체 업무 중 비율 <b className="num">{fmtPct(t.share || 0)}</b></label>
        <div className="range-row">
          <input id={id('share')} type="range" min={1} max={100} step={1} value={Math.min(100, t.share || 0)}
            onChange={(e) => set({ share: Number(e.target.value) })} />
          <input type="number" className="num-in" min={0} max={100} step={0.5} value={t.share} aria-label="업무 비율(%) 숫자 입력"
            onChange={(e) => set({ share: Number(e.target.value) })} />
        </div>
      </div>
      <div className="field">
        <span className="flabel">업무 빈도</span>
        <Seg name="업무 빈도" value={t.frequency} onChange={(v: Frequency) => set({ frequency: v })}
          options={(Object.keys(LABELS.frequency) as Frequency[]).map((v) => ({ v, l: LABELS.frequency[v] }))} />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor={id('type')}>업무 유형</label>
          <select id={id('type')} value={t.type} onChange={(e) => set({ type: e.target.value as TaskType })}>
            {(Object.keys(LABELS.type) as TaskType[]).map((k) => <option key={k} value={k}>{LABELS.type[k]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id('diff')}>가장 어려운 점</label>
          <select id={id('diff')} value={t.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
            {(Object.keys(LABELS.difficulty) as Difficulty[]).map((k) => <option key={k} value={k}>{LABELS.difficulty[k]}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <span className="flabel">중요도</span>
        <Seg name="중요도" value={t.importance} onChange={(v: Importance) => set({ importance: v })}
          options={(Object.keys(LABELS.importance) as Importance[]).map((v) => ({ v, l: LABELS.importance[v] }))} />
      </div>
      <button className="btn tiny danger-ghost" onClick={onRemove}>이 업무 삭제</button>
    </div>
  );
}

function QLevel() {
  const { s, d } = useApp();
  return (
    <div className="qcard wide">
      <QHead code="Q.C" title="지금 각 업무에서 AI를 얼마나 활용하고 있나요?"
        desc="현재 활용 수준은 '이미 얻고 있는 효과'와 '남은 개선 여지'를 계산하는 데 쓰입니다. 높은 단계가 곧 높은 생산성을 뜻하지는 않습니다." />
      <div className="per-task">
        {s.profile.tasks.map((t) => (
          <div key={t.id} className="pt-row">
            <div className="pt-name"><b>{t.name}</b><small>{LABELS.type[t.type]}</small></div>
            <div className="levels" role="radiogroup" aria-label={`${t.name} AI 활용 수준`}>
              {LABELS.aiLevel.map((l, i) => (
                <button key={l.title} role="radio" aria-checked={t.aiLevel === i}
                  className={`lv${t.aiLevel === i ? ' on' : ''}`} onClick={() => d({ type: 'task', id: t.id, patch: { aiLevel: i as AiLevel } })}>
                  <span className="lv-bar">{[0, 1, 2, 3].map((k) => <i key={k} className={k < i ? 'f' : ''} />)}</span>
                  <b>{l.title}</b>
                </button>
              ))}
            </div>
            <p className="pt-desc">{LABELS.aiLevel[t.aiLevel].desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QApplicability() {
  const { s, d } = useApp();
  return (
    <div className="qcard wide">
      <QHead code="Q.D" title="각 업무에 AI를 적용할 수 있는 정도는?"
        desc="직접 판단해 주세요. '추천' 표시는 업무 유형을 참고한 값일 뿐 확정된 판단이 아닙니다." />
      <div className="per-task">
        {s.profile.tasks.map((t) => {
          const rec = TYPE_PROFILE[t.type].recommended;
          return (
            <div key={t.id} className="pt-row">
              <div className="pt-name"><b>{t.name}</b><small>{LABELS.type[t.type]}</small></div>
              <div className="app-opts" role="radiogroup" aria-label={`${t.name} AI 적용 가능성`}>
                {(Object.keys(LABELS.applicability) as Applicability[]).map((k) => (
                  <button key={k} role="radio" aria-checked={t.applicability === k}
                    className={`app-opt a-${k}${t.applicability === k ? ' on' : ''}`}
                    onClick={() => d({ type: 'task', id: t.id, patch: { applicability: k } })}>
                    <b>{LABELS.applicability[k].title}{k === rec && <em className="rec">추천</em>}</b>
                    <small>{LABELS.applicability[k].desc}</small>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QCriteria() {
  const { s, d } = useApp();
  const p = s.profile;
  return (
    <div className="qcard wide">
      <QHead code="Q.E" title="업무에서 가장 중요한 성공 기준은?" desc={`최대 2개까지 고를 수 있습니다. (${p.criteria.length}/2)`} />
      <div className="choice-grid">
        {(Object.keys(LABELS.criteria) as Criterion[]).map((c) => {
          const on = p.criteria.includes(c);
          const full = !on && p.criteria.length >= 2;
          return (
            <button key={c} className={`pick${on ? ' on' : ''}`} aria-pressed={on} disabled={full}
              onClick={() => d({ type: 'toggleCriterion', c })}>
              <span className="box">{on ? '✓' : ''}</span>{LABELS.criteria[c]}
            </button>
          );
        })}
      </div>
      <div className="divider" />
      <QHead code="Q.F" title="AI 도입 시 가장 걱정되는 것은?" desc="여러 개 고를 수 있습니다. 이 답에 따라 뒤에서 만날 상황이 달라집니다." />
      <div className="choice-grid">
        {(Object.keys(LABELS.concerns) as Concern[]).map((c) => {
          const on = p.concerns.includes(c);
          return (
            <button key={c} className={`pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => d({ type: 'toggleConcern', c })}>
              <span className="box">{on ? '✓' : ''}</span>{LABELS.concerns[c]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OptionCards<T extends string>({ name, value, options, onChange }: {
  name: string; value: T; options: Record<T, { title: string; desc: string }>; onChange: (v: T) => void;
}) {
  return (
    <div className="app-opts three" role="radiogroup" aria-label={name}>
      {(Object.keys(options) as T[]).map((k) => (
        <button key={k} role="radio" aria-checked={value === k} className={`app-opt${value === k ? ' on' : ''}`} onClick={() => onChange(k)}>
          <b>{options[k].title}</b><small>{options[k].desc}</small>
        </button>
      ))}
    </div>
  );
}

function QApproval() {
  const { s, d } = useApp();
  const env = s.profile.env;
  return (
    <div className="qcard wide">
      <QHead code="Q.G" title="결과물은 보통 어떻게 확정되나요?" desc="승인 단계가 많을수록 AI로 초안이 빨라져도 기다리는 시간이 남습니다." />
      <OptionCards<ApprovalSteps> name="승인 단계" value={env.approval} options={ENV.approval}
        onChange={(v) => d({ type: 'env', patch: { approval: v } })} />
      <div className="divider" />
      <QHead code="Q.G-2" title="업무 자료에 개인정보가 얼마나 포함되나요?" desc="교육생 명단, 사번, 평가 결과 같은 정보를 떠올려 보세요. 결과의 위험 점수와 주의사항에 반영됩니다." />
      <OptionCards<PersonalData> name="개인정보 포함 정도" value={env.personalData} options={ENV.personalData}
        onChange={(v) => d({ type: 'env', patch: { personalData: v } })} />
    </div>
  );
}

function QAiEnv() {
  const { s, d } = useApp();
  const env = s.profile.env;
  return (
    <div className="qcard wide">
      <QHead code="Q.H" title="회사에서 쓸 수 있는 AI 도구는 무엇인가요?" desc="여러 개 고를 수 있습니다. 쓸 수 있는 도구가 없으면 도입 준비 시간이 더 크게 잡힙니다." />
      <div className="choice-grid">
        {(Object.keys(ENV.tools) as AiTool[]).map((t) => {
          const on = env.tools.includes(t);
          return (
            <button key={t} className={`pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => d({ type: 'toggleTool', t })}>
              <span className="box">{on ? '✓' : ''}</span>{ENV.tools[t]}
            </button>
          );
        })}
      </div>
      <div className="divider" />
      <QHead code="Q.H-2" title="우리 팀은 AI를 어떻게 쓰고 있나요?" desc="함께 쓰는 팀일수록 지시문을 다시 만들고 도구를 익히는 시간이 줄어듭니다." />
      <OptionCards<TeamCulture> name="팀의 AI 활용 방식" value={env.culture} options={ENV.culture}
        onChange={(v) => d({ type: 'env', patch: { culture: v } })} />
      <div className="divider" />
      <QHead code="Q.H-3" title="일주일에 AI를 익히는 데 쓸 수 있는 시간은?" desc="꾸준히 익힐수록 AI 결과물을 고치는 시간이 줄어든다고 가정합니다." />
      <OptionCards<LearningTime> name="AI 학습 가능 시간" value={env.learning} options={ENV.learning}
        onChange={(v) => d({ type: 'env', patch: { learning: v } })} />
    </div>
  );
}

function QStory() {
  const { s, d } = useApp();
  const n = s.profile.notes;
  return (
    <div className="qcard wide">
      <QHead code="Q.I" title="마지막으로, 나의 이야기를 들려주세요" desc="선택 문항입니다. 적은 내용은 최종 리포트에 함께 담기고, 소모임에서 나눌 이야깃거리가 됩니다." />
      <div className="field">
        <label htmlFor="note-pain">AI의 도움을 가장 먼저 받고 싶은 업무 고민</label>
        <textarea id="note-pain" rows={3} maxLength={300} value={n.pain}
          placeholder="예: 과정이 끝날 때마다 만족도 주관식 응답을 하나하나 읽고 분류하는 데 반나절이 걸려요."
          onChange={(e) => d({ type: 'notes', patch: { pain: e.target.value } })} />
        <small>{n.pain.length}/300</small>
      </div>
      <div className="field">
        <label htmlFor="note-tips">사내에서 자주 쓰는 AI 도구나 나만의 활용 팁</label>
        <textarea id="note-tips" rows={3} maxLength={300} value={n.tips}
          placeholder="예: 사내 GPT로 회의록을 요약하고, Copilot으로 메일 초안을 써요."
          onChange={(e) => d({ type: 'notes', patch: { tips: e.target.value } })} />
        <small>{n.tips.length}/300</small>
      </div>
    </div>
  );
}

const fmtPct = (v: number) => `${Math.round(v * 10) / 10}%`;
