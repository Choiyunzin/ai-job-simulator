import { useEffect, useRef, useState } from 'react';
import { StepNav } from '../App';
import { AI_MODE, CAREER, EDU_EXAMPLES, ENV, E_LEVEL_DESC, LABELS, LEADER_POSITIONS, NON_LEADER, ROLE_SCALE, TYPE_PROFILE } from '../engine/config';
import { PERCEPTION_LABEL, eLevelOf, eSourceLabel, isStd, perceptionOf, recommendedFromE, toolsUnknown } from '../engine/research';
import { stdTasksFor, type StdTask } from '../taskCatalog';
import type {
  Activity, AiLevel, AiMode, AiTool, Applicability, LearningTime, TeamCulture, Difficulty, Frequency, Importance, JobId, Task, TaskType,
} from '../engine/types';
import { useApp } from '../state';
import { LEVELS, isEduPath, optionsAt, useJobCatalog } from '../jobCatalog';
import { ACTIVITY, ACTIVITY_KEYS, SKILL_LEVELS, activityOf, levelDesc, skillsFor, useSkillCatalog } from '../workmap';
import { ReadingGuide } from '../components/ReadingGuide';
import { currentRoles, isLeader, useRoleCatalog, type RoleRating } from '../roleCatalog';

const SUBS = ['직무', '나의 역할', '업무 고르기', '업무 구체화', '스킬 수준', 'AI 활용 수준', 'AI 적용 가능성', 'AI 활용 환경', '응답 반영도'];
const CODES = ['QA', 'QR', 'QB1', 'QB2', 'QS', 'QC', 'QD', 'QH', 'QI'];
/** 화면 번호 */
export const SUB = { job: 0, roles: 1, pick: 2, detail: 3 } as const;
export const LAST_SUB = SUBS.length - 1;

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
  const pickOk = tasks.length > 0 && tasks.every((t) => t.name.trim());
  const subNav = useRef<HTMLDivElement>(null);
  useEffect(() => { // 모바일에서 현재 질문 탭이 보이도록 가로 스크롤
    const el = subNav.current?.querySelector<HTMLElement>('.now');
    const box = subNav.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [sub]);

  const catalog = useJobCatalog();
  const [guide, setGuide] = useState(false);
  const useList = catalog.rows.length > 0;
  const bodies = [<QJob key="a" catalog={catalog} />, <QRoles key="r" />, <QTasks key="b" />, <QTaskDetail key="b2" />, <QSkills key="s" />, <QLevel key="c" />, <QApplicability key="d" />,
    <QAiEnv key="h" />, <QStory key="i" />];
  const jobOk = useList ? s.profile.jobPath.length === 4 : s.profile.job !== 'other' || !!s.profile.jobOther.trim();
  const c = s.profile.career;
  const positionOk = c.leader === 'no' || (c.leader === 'yes' && LEADER_POSITIONS.includes(c.position));
  const canNext = sub === SUB.pick ? pickOk : sub === SUB.detail ? tasksOk : sub === 0 ? jobOk && positionOk : true;
  const hint = sub === SUB.pick && !pickOk
    ? (tasks.length === 0 ? '업무를 1개 이상 골라 주세요.' : '이름이 비어 있는 업무가 있어요.')
    : sub === SUB.detail && !tasksOk
    ? (shareTotal > 100 ? '업무 비율 합계가 100%를 넘지 않게 조정해 주세요.' : '빨간 표시가 있는 업무를 확인해 주세요.')
    : sub === 0 && !jobOk ? (useList ? '직군부터 직무까지 차례로 골라 주세요.' : '직무를 직접 입력해 주세요.')
    : sub === 0 && !positionOk ? (c.leader === 'yes' ? '팀장·실장 중 직책을 골라 주세요.' : '직책자 여부를 골라 주세요. 직책자는 다음 질문에서 리더 역할도 체크합니다.') : undefined;

  return (
    <section className="profile">
      <div className="sub-progress" aria-label="질문 진행" ref={subNav}>
        {SUBS.map((x, i) => (
          <button key={x} className={i === sub ? 'now' : i < sub ? 'done' : ''}
            disabled={(i >= SUB.detail && !pickOk) || (i > SUB.detail && !tasksOk)} onClick={() => go(i)}>
            <span className="num">{CODES[i]}</span>{x}
          </button>
        ))}
      </div>
      <div className="qwrap" key={sub}>{bodies[sub]}</div>
      <StepNav
        onPrev={() => (sub === 0 ? d({ type: 'go', step: 0 }) : go(sub - 1))}
        onNext={() => (sub === SUBS.length - 1 ? setGuide(true) : go(sub + 1))}
        nextLabel={sub === SUBS.length - 1 ? '진단 결과 보기' : '다음 질문'}
        disabled={!canNext} hint={hint}
      />
      {guide && <ReadingGuide onClose={() => setGuide(false)} onConfirm={() => { setGuide(false); d({ type: 'go', step: 2 }); }} />}
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

/** 직책자 여부 → 직책, 직급·Pay Grade·근속기간·직무경력 */
function CareerFields() {
  const { s, d } = useApp();
  const c = s.profile.career;
  const set = (patch: Partial<typeof c>) => d({ type: 'profile', patch: { career: { ...c, ...patch } } });
  const pickSel = (id: string, label: string, value: string, opts: readonly string[], onChange: (v: string) => void, empty = '선택 안 함') => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  return (
    <div className="career">
      <div className="divider" />
      <span className="flabel">직책·경력</span>
      <div className="cascade">
        <div className="field">
          <label htmlFor="leader">직책자 여부</label>
          <select id="leader" value={c.leader}
            onChange={(e) => {
              const v = e.target.value as typeof c.leader;
              set({ leader: v, position: v === 'no' ? NON_LEADER : v === 'yes' && LEADER_POSITIONS.includes(c.position) ? c.position : '' });
            }}>
            <option value="">선택</option>
            <option value="yes">직책자</option>
            <option value="no">비직책자(팀원)</option>
          </select>
        </div>
        {c.leader === 'yes' ? (
          <div className="field">
            <label htmlFor="position">직책</label>
            <select id="position" value={LEADER_POSITIONS.includes(c.position) ? c.position : ''} onChange={(e) => set({ position: e.target.value })}>
              <option value="">직책 선택</option>
              {CAREER.leaderPositions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {LEADER_POSITIONS.includes(c.position) && <small className="ok">✓ 다음 질문에서 직무 역할과 함께 <b>리더 역할</b>을 체크합니다.</small>}
          </div>
        ) : pickSel('rank', '직급', c.rank, CAREER.rank, (v) => set({ rank: v }))}
        {c.leader === 'yes' && pickSel('rank', '직급', c.rank, CAREER.rank, (v) => set({ rank: v }))}
        {pickSel('paygrade', 'Pay Grade', c.payGrade, CAREER.payGrade, (v) => set({ payGrade: v }))}
        {pickSel('tenure', '근속기간', c.tenure, CAREER.tenure, (v) => set({ tenure: v }))}
        {pickSel('jobcareer', '현 직무 경력', c.jobCareer, CAREER.jobCareer, (v) => set({ jobCareer: v }))}
      </div>
    </div>
  );
}

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
        desc={useList ? '소속과 직무를 알려 주세요. 직군부터 차례로 고르면 다음 칸에 해당하는 항목만 나옵니다.'
          : '소속과 직무를 알려 주세요. 업무 내용은 다음 질문에서 직접 정의합니다.'} />
      <div className="cascade">
        <div className="field">
          <label htmlFor="dept">소속 부서명</label>
          <input id="dept" value={p.dept ?? ''} maxLength={30} placeholder="예: 성장디자인팀"
            onChange={(e) => d({ type: 'profile', patch: { dept: e.target.value } })} />
        </div>
        <div className="field">
          <label htmlFor="team-size">팀 인원 <small>본인 포함</small></label>
          <select id="team-size" value={p.teamSize ?? ''} onChange={(e) => d({ type: 'profile', patch: { teamSize: e.target.value } })}>
            <option value="">선택 안 함</option>
            {CAREER.teamSize.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="divider" />
      {useList ? (
        <div className="cascade">
          {LEVELS.map((name, level) => {
            const opts = level <= p.jobPath.length ? optionsAt(catalog.rows, p.jobPath, level) : [];
            const locked = level > p.jobPath.length;
            return (
              <div className="field" key={name}>
                <label htmlFor={`jp${level}`}>
                  <span><span className="num step-no">{level + 1}</span>{name}</span>
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
      <CareerFields />
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

/** Q.R 역할 진단: 직무 역할(+ 팀장·실장은 리더 역할)을 5점 척도로 체크 */
function QRoles() {
  const { s, d } = useApp();
  const rows = useRoleCatalog();
  const p = s.profile;
  const list = currentRoles(p, rows);
  const [draft, setDraft] = useState('');
  const rate = (role: string, score: number) => {
    const next = { ...p.roleRatings };
    if (next[role] === score) delete next[role]; else next[role] = score;
    d({ type: 'profile', patch: { roleRatings: next } });
  };
  const custom = p.customRoles ?? [];
  const canAdd = draft.trim().length > 0 && custom.length < 8 && !list.some((r) => r.role === draft.trim());
  const add = () => { if (canAdd) { d({ type: 'profile', patch: { customRoles: [...custom, draft.trim()] } }); setDraft(''); } };
  const remove = (role: string) => {
    const next = { ...p.roleRatings }; delete next[role];
    d({ type: 'profile', patch: { customRoles: custom.filter((x) => x !== role), roleRatings: next } });
  };
  const job = list.filter((r) => r.group === 'job');
  const leader = list.filter((r) => r.group === 'leader');
  const mine = list.filter((r) => r.group === 'custom');
  const rated = list.filter((r) => r.score !== null).length;
  const jobName = p.jobPath.length === 4 ? p.jobPath[3] : p.job === 'other' ? (p.jobOther || '내 직무') : LABELS.job[p.job];

  return (
    <div className="qcard wide">
      <QHead code="Q.R" title="내 역할을 얼마나 잘하고 있나요?"
        desc={`직무의 핵심 역할마다 지금 내 수준을 골라 주세요.${isLeader(p) ? ' 팀장·실장은 리더 역할도 함께 체크합니다.' : ''} 정답은 없으며, 결과는 리포트의 강점·보완 역할로 정리됩니다.`} />
      <div className="role-legend" aria-hidden="true">
        {ROLE_SCALE.map((l, i) => <span key={l}><b className="num">{i + 1}</b>{l}</span>)}
        <small className="num">{rated} / {list.length}개 체크</small>
      </div>

      <RoleGroup title="직무 역할" sub={jobName} items={job} onRate={rate}
        empty="이 직무의 역할 목록이 아직 없어요. 아래에 내 역할을 직접 추가해 체크해 보세요." />
      {leader.length > 0 && <RoleGroup title="리더 역할" sub={p.career.position} items={leader} onRate={rate} />}
      {mine.length > 0 && <RoleGroup title="직접 추가한 역할" items={mine} onRate={rate} onRemove={remove} />}

      <div className="field">
        <label htmlFor="role-add">역할 직접 추가 <small>목록에 없는 내 역할 (최대 8개)</small></label>
        <div className="range-row">
          <input id="role-add" value={draft} maxLength={40} placeholder="예: 사내 강사 양성 프로그램 운영"
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <button className="btn" disabled={!canAdd} onClick={add}>추가</button>
        </div>
      </div>
      <small>체크는 선택 사항입니다. 체크한 역할은 다음 질문에서 업무로 바로 불러올 수 있어요. 같은 점수를 다시 누르면 지워집니다.</small>
    </div>
  );
}

function RoleGroup({ title, sub, items, onRate, onRemove, empty }: {
  title: string; sub?: string; items: RoleRating[]; onRate: (role: string, score: number) => void;
  onRemove?: (role: string) => void; empty?: string;
}) {
  return (
    <div className="role-group">
      <h3>{title}{sub && <small> · {sub}</small>}</h3>
      {items.length === 0 && empty && <p className="fine">{empty}</p>}
      <ul className="role-list">
        {items.map((r) => (
          <li key={r.role} className={r.score !== null ? 'rated' : ''}>
            <span className="role-name">{r.role}
              {onRemove && <button className="btn tiny ghost" aria-label={`${r.role} 삭제`} onClick={() => onRemove(r.role)}>삭제</button>}
            </span>
            <span className="role-scale" role="radiogroup" aria-label={`${r.role} 수준`}>
              {ROLE_SCALE.map((label, i) => (
                <button key={label} role="radio" aria-checked={r.score === i + 1} title={label}
                  className={r.score === i + 1 ? 'on' : ''} onClick={() => onRate(r.role, i + 1)}>
                  <b className="num">{i + 1}</b><small>{label}</small>
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** QB1 업무 고르기: 표준 업무·역할·예시에서 체크하거나 직접 추가 (개수 제한 없음) */
function QTasks() {
  const { s, d } = useApp();
  const tasks = s.profile.tasks;
  const names = new Set(tasks.map((t) => t.name));
  const roleRows = useRoleCatalog();
  const roleList = currentRoles(s.profile, roleRows);
  const [draft, setDraft] = useState('');
  /** 체크 목록: 같은 이름의 업무가 있으면 빼고, 없으면 추가 */
  const toggleByName = (name: string, task: Partial<Task>) => {
    const ex = tasks.find((t) => t.name === name);
    if (ex) d({ type: 'removeTask', id: ex.id });
    else d({ type: 'addTask', task });
  };
  const std = stdTasksFor(s.profile);
  const pickedStd = tasks.filter((t) => t.taskId && std.some((x) => x.id === t.taskId)).length;
  const toggleStd = (x: StdTask) => {
    const ex = tasks.find((t) => t.taskId === x.id);
    if (ex) { d({ type: 'removeTask', id: ex.id }); return; }
    d({ type: 'addTask', task: {
      name: x.text, type: x.type, share: 10, taskId: x.id, eLevel: x.eLevel, mckActivity: x.mckActivity,
      onetCode: x.onetCode, matchLevel: x.matchLevel, aeiAutoShare: x.aeiAutoShare,
    } });
  };
  const name = draft.trim().slice(0, 30);
  const canAdd = !!name && !names.has(name);
  const add = () => { if (canAdd) { d({ type: 'addTask', task: { name, share: 10 } }); setDraft(''); } };

  return (
    <div className="qcard wide">
      <QHead code="Q.B-1" title="내가 하는 업무를 모두 골라 주세요"
        desc={std.length
          ? '내 직무의 표준 업무에서 먼저 고르고, 목록에 없는 업무는 아래에서 직접 추가하세요. 개수 제한은 없어요. 비율·빈도·유형은 다음 화면에서 정합니다.'
          : '역할과 예시 업무에서 고르거나 직접 추가하세요. 개수 제한은 없어요. 비율·빈도·유형은 다음 화면에서 정합니다.'} />

      {std.length > 0 && (
        <div className="std-pick">
          <div className="std-head">
            <b>내 직무의 표준 업무에서 고르기</b>
            <small>업무시간의 5% 이상을 차지하는 업무 위주로 고르세요 · <span className="num">{pickedStd}/{std.length}</span></small>
          </div>
          <ul>
            {std.map((x) => {
              const on = tasks.some((t) => t.taskId === x.id);
              return (
                <li key={x.id}>
                  <button role="checkbox" aria-checked={on} className={`std-item${on ? ' on' : ''}`} onClick={() => toggleStd(x)}>
                    <span className="box">{on ? '✓' : ''}</span>
                    <span className="std-text">{x.text}<small>{LABELS.type[x.type]}</small></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {roleList.length > 0 && (
        <PickList title="나의 역할에서 불러오기" note="체크하면 업무로 추가되고, 해제하면 빠져요"
          items={roleList.map((r) => ({
            key: r.role, label: r.role, on: names.has(r.role.slice(0, 30)),
            meta: [r.group === 'leader' ? '리더 역할' : r.group === 'custom' ? '직접 추가한 역할' : '직무 역할', r.score !== null ? `${r.score}점 · ${ROLE_SCALE[r.score - 1]}` : '점수 없음'].join(' · '),
          }))}
          onToggle={(key) => toggleByName(key.slice(0, 30), { name: key.slice(0, 30), share: 10 })} />
      )}

      {s.profile.job === 'edu' && (
        <PickList title="교육기획 예시 업무" note="자주 하는 일과 비슷하면 체크하세요. 이름은 다음 화면에서 고칠 수 있어요"
          items={EDU_EXAMPLES.map((e) => ({ key: e.name, label: e.name, on: names.has(e.name), meta: `${LABELS.type[e.type]} · 예시 비율 ${e.share}%` }))}
          onToggle={(key) => { const e = EDU_EXAMPLES.find((x) => x.name === key); if (e) toggleByName(e.name, e); }} />
      )}

      <div className="field">
        <label htmlFor="task-add">목록에 없는 업무 직접 추가</label>
        <div className="range-row">
          <input id="task-add" value={draft} maxLength={30} placeholder="예: 사내 강사 양성 프로그램 운영"
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <button className="btn" disabled={!canAdd} onClick={add}>추가</button>
        </div>
      </div>

      <div className="picked">
        <div className="pl-head"><b>고른 업무</b><small><span className="num">{tasks.length}</span>개 · 다음 화면에서 하나씩 구체화해요</small></div>
        {tasks.length === 0
          ? <p className="fine">아직 고른 업무가 없어요.</p>
          : (
            <ol className="picked-list">
              {tasks.map((t, i) => (
                <li key={t.id}>
                  <span className="num">{i + 1}</span>
                  <span className="pk-name">{t.name || <em>이름 없음</em>}</span>
                  <em className={`src-badge ${isStd(t) ? 'res' : 'est'}`}>{eSourceLabel(t)}</em>
                  <button className="btn tiny ghost" aria-label={`${t.name} 빼기`} onClick={() => d({ type: 'removeTask', id: t.id })}>빼기</button>
                </li>
              ))}
            </ol>
          )}
      </div>
    </div>
  );
}

/** QB2 업무 구체화: 고른 업무마다 비율·빈도·유형·어려운 점·활동·스킬·중요도 */
function QTaskDetail() {
  const { s, d } = useApp();
  const tasks = s.profile.tasks;
  const total = tasks.reduce((x, t) => x + (t.share || 0), 0);
  const over = total > 100 + 1e-9;
  const rest = Math.max(0, 100 - total);
  /** 비율을 지금 비율대로 유지하면서 합계 100%로 맞추기 (0.5% 단위) */
  const fit = () => {
    if (!(total > 0)) return;
    tasks.forEach((t) => d({ type: 'task', id: t.id, patch: { share: Math.max(0.5, Math.round(((t.share || 0) / total) * 200) / 2) } }));
  };
  return (
    <div className="qcard wide">
      <QHead code="Q.B-2" title="고른 업무를 하나씩 구체화해 주세요"
        desc="업무마다 전체 업무 중 비율, 빈도, 유형, 어려운 점, 주요 활동, 쓰는 스킬을 골라 주세요. 비율은 추정치여도 괜찮아요." />

      <div className={`hours-meter sticky-meter${over ? ' over' : ''}`}>
        <div className="hm-head">
          <span>입력한 업무 비율 합계 · 업무 {tasks.length}개</span>
          <b className="num">{fmtPct(total)} / 100%</b>
        </div>
        <div className="hm-track"><span style={{ width: `${Math.min(100, total)}%` }} /></div>
        <div className="hm-foot">
          {over
            ? <p className="warn">⚠ 합계가 100%보다 {fmtPct(total - 100)} 많습니다. 업무 비율을 줄이거나 자동으로 맞춰 주세요.</p>
            : <small>나머지 {fmtPct(rest)}는 회의·기타 업무로 봅니다.</small>}
          {tasks.length > 1 && <button className="btn tiny" onClick={fit}>비율 유지하며 합계 100%로 맞추기</button>}
        </div>
      </div>

      {tasks.length === 0 && <p className="fine">고른 업무가 없어요. 이전 화면에서 업무를 골라 주세요.</p>}
      <div className="detail-list">
        {tasks.map((t, i) => {
          const err = taskError(t);
          return (
            <article key={t.id} className={`task-card open detail${err ? ' err' : ''}`}>
              <header className="task-sum static">
                <span className="tnum num">{i + 1}</span>
                <span className="tname">{t.name || '새 업무'}</span>
                <span className="tmeta">{LABELS.type[t.type]} · {fmtPct(t.share || 0)}
                  <em className={`src-badge ${isStd(t) ? 'res' : 'est'}`}>{eSourceLabel(t)}</em></span>
              </header>
              {err && <p className="err-msg">{err}</p>}
              <TaskEditor t={t} onRemove={() => d({ type: 'removeTask', id: t.id })} />
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** 세로 체크 목록: 한 줄에 항목 하나, 체크 = 업무로 추가 */
function PickList({ title, note, items, onToggle }: {
  title: string; note?: string;
  items: { key: string; label: string; meta?: string; on: boolean }[]; onToggle: (key: string) => void;
}) {
  const picked = items.filter((x) => x.on).length;
  return (
    <div className="pick-list">
      <div className="pl-head">
        <b>{title}</b>
        <small>{note}{note && ' · '}<span className="num">{picked}/{items.length}</span> 선택</small>
      </div>
      <ul>
        {items.map((x) => (
          <li key={x.key}>
            <button role="checkbox" aria-checked={x.on} className={`pl-item${x.on ? ' on' : ''}`}
              onClick={() => onToggle(x.key)}>
              <span className="box">{x.on ? '✓' : ''}</span>
              <span className="pl-text">{x.label}{x.meta && <small>{x.meta}</small>}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskEditor({ t, onRemove }: { t: Task; onRemove: () => void }) {
  const { s, d } = useApp();
  const set = (patch: Partial<Task>) => d({ type: 'task', id: t.id, patch });
  const id = (k: string) => `${t.id}-${k}`;
  const skillDefs = skillsFor(s.profile, useSkillCatalog());
  const linked = (t.skills ?? []).filter((x) => skillDefs.some((k) => k.name === x));
  const toggleSkill = (name: string) => {
    if (linked.includes(name)) set({ skills: linked.filter((x) => x !== name) });
    else if (linked.length < 3) set({ skills: [...linked, name] });
  };
  const act = activityOf(t);
  return (
    <div className="task-edit">
      {isStd(t) ? (
        <div className="field">
          <span className="flabel">업무명 <small>표준 업무 · 업무명과 업무 유형은 고정돼요</small></span>
          <p className="std-name">{t.name}<small> · {LABELS.type[t.type]}</small></p>
        </div>
      ) : (
        <div className="field">
          <label htmlFor={id('name')}>업무명</label>
          <input id={id('name')} value={t.name} maxLength={30} placeholder="예: 교육 만족도 분석" autoFocus={!t.name}
            onChange={(e) => set({ name: e.target.value })} />
        </div>
      )}
      <div className="field">
        <label htmlFor={id('share')}>전체 업무 중 비율 <b className="num">{fmtPct(t.share || 0)}</b></label>
        <div className="range-row">
          <div className="tick-range">
            <input id={id('share')} type="range" min={0} max={100} step={1} value={Math.min(100, t.share || 0)}
              onChange={(e) => set({ share: Number(e.target.value) })} />
            <div className="ticks" aria-hidden="true">
              {[0, 25, 50, 75, 100].map((v) => <span key={v} style={{ left: `calc(8px + (100% - 16px) * ${v / 100})` }}><i /><b className="num">{v}</b></span>)}
            </div>
          </div>
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
          <select id={id('type')} value={t.type} disabled={isStd(t)} onChange={(e) => set({ type: e.target.value as TaskType })}>
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
        <label htmlFor={id('act')}>주요 활동 <small>이 업무에서 가장 많이 하는 활동 · 업무패턴 분석에 쓰여요</small></label>
        <select id={id('act')} value={act} onChange={(e) => set({ activity: e.target.value as Activity })}>
          {ACTIVITY_KEYS.map((k) => <option key={k} value={k}>{ACTIVITY[k].label} — {ACTIVITY[k].desc}</option>)}
        </select>
      </div>
      <div className="field">
        <span className="flabel">이 업무에 쓰는 스킬 <small>최대 3개 · 스킬 활용분석에 쓰여요 ({linked.length}/3)</small></span>
        <div className="chips">
          {skillDefs.map((k) => {
            const on = linked.includes(k.name);
            return (
              <button key={k.name} className={`chip pickable${on ? ' on' : ''}`} aria-pressed={on} title={k.def}
                disabled={!on && linked.length >= 3} onClick={() => toggleSkill(k.name)}>
                {on ? '✓ ' : '+ '}{k.name}
              </button>
            );
          })}
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

/** Q.S 스킬 수준: 개념인지 → 가이드수행 → 독립수행 → 복잡대응 → 전문가 */
function QSkills() {
  const { s, d } = useApp();
  const p = s.profile;
  const defs = skillsFor(p, useSkillCatalog());
  const linkedBy = (name: string) => p.tasks.filter((t) => (t.skills ?? []).includes(name)).map((t) => t.name);
  const sorted = [...defs].sort((a, b) => (linkedBy(b.name).length > 0 ? 1 : 0) - (linkedBy(a.name).length > 0 ? 1 : 0));
  const rated = defs.filter((k) => typeof p.skillRatings?.[k.name] === 'number').length;
  return (
    <div className="qcard wide">
      <QHead code="Q.S" title="각 스킬을 어느 수준으로 활용하고 있나요?"
        desc="지금 내가 실제로 해낼 수 있는 수준을 골라 주세요. 단계를 고르면 그 단계의 기준이 아래에 보여요. 업무에 연결한 스킬이 먼저 나옵니다." />
      <div className="role-legend" aria-hidden="true">
        {SKILL_LEVELS.map((l, i) => <span key={l.name}><b className="num">{i + 1}</b>{l.name}</span>)}
        <small className="num">{rated} / {defs.length}개 선택</small>
      </div>
      <ul className="skill-list">
        {sorted.map((k) => {
          const v = p.skillRatings?.[k.name];
          const tasks = linkedBy(k.name);
          return (
            <li key={k.name} className={typeof v === 'number' ? 'rated' : ''}>
              <div className="skill-head">
                <b>{k.name}</b>
                {tasks.length > 0 && <em className="chip-tag">업무 {tasks.length}개 연결</em>}
                {k.def && <small>{k.def}</small>}
              </div>
              <div className="skill-scale" role="radiogroup" aria-label={`${k.name} 수준`}>
                {SKILL_LEVELS.map((l, i) => (
                  <button key={l.name} role="radio" aria-checked={v === i + 1} title={levelDesc(k, i + 1)}
                    className={v === i + 1 ? 'on' : ''} onClick={() => d({ type: 'rateSkill', skill: k.name, score: i + 1 })}>
                    <b className="num">{i + 1}</b><small>{l.name}</small>
                  </button>
                ))}
              </div>
              <p className="skill-desc">{typeof v === 'number'
                ? <><b>{SKILL_LEVELS[v - 1].name}</b> {levelDesc(k, v)}</>
                : <span className="fine">단계 위에 마우스를 올리면 기준을 볼 수 있어요.</span>}</p>
            </li>
          );
        })}
      </ul>
      <small>같은 단계를 다시 누르면 지워집니다. 스킬 목록은 HTML 맨 위 '스킬 목록' 칸에서 사내 스킬셋으로 바꿀 수 있어요.</small>
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
            {t.aiLevel >= 1 && (
              <div className="mode-q">
                <span className="flabel">이 업무에서 AI를 주로 어떻게 쓰나요? <small>선택 · 하나만</small></span>
                <div className="mode-opts" role="radiogroup" aria-label={`${t.name} AI 활용 방식`}>
                  {(Object.keys(AI_MODE) as AiMode[]).map((m) => (
                    <button key={m} role="radio" aria-checked={t.aiMode === m} className={`mode-opt ${AI_MODE[m].group}${t.aiMode === m ? ' on' : ''}`}
                      onClick={() => d({ type: 'task', id: t.id, patch: { aiMode: t.aiMode === m ? null : m } })}>
                      <em>{AI_MODE[m].group === 'auto' ? '자동화형' : '증강형'}</em>
                      <b>{AI_MODE[m].label}</b><small>{AI_MODE[m].desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
        desc="직접 판단해 주세요. 직접 입력한 업무는 이 답으로 잠재력을 계산하고, 표준 업무는 연구 기준 등급으로 계산한 뒤 내 판단과의 차이를 보여줘요." />
      <div className="per-task">
        {s.profile.tasks.map((t) => {
          const rec = isStd(t) ? recommendedFromE[eLevelOf(t)] : TYPE_PROFILE[t.type].recommended;
          const pc = perceptionOf(t);
          return (
            <div key={t.id} className="pt-row">
              <div className="pt-name"><b>{t.name}</b><small>{LABELS.type[t.type]}</small>
                <em className={`src-badge ${isStd(t) ? 'res' : 'est'}`}>{eSourceLabel(t)}</em></div>
              {isStd(t) && (
                <p className="pt-desc">연구 기준 {eLevelOf(t)} · {E_LEVEL_DESC[eLevelOf(t)]}
                  {pc && <span className={`perc ${pc}`}> → 내 판단: {PERCEPTION_LABEL[pc]}</span>}</p>
              )}
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
      {toolsUnknown(env)
        ? <small className="warn">쓸 수 있는 도구를 모르면 연구 기준 진단에서 '사내 실현 가능'을 절반만 반영해요. 팀에 사용 가능 도구를 확인해 보세요.</small>
        : <small>고른 도구에 따라 STEP 3에서 '연구상 AI로 가능한 업무' 중 지금 회사 도구로 실제 가능한 비중을 계산해요.</small>}
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

/** 마지막 질문: 응답 반영도 */
function QStory() {
  const { s, d } = useApp();
  return (
    <div className="qcard wide">
      <QHead code="Q.I" title="이번 진단 응답이 나의 업무를 얼마나 잘 반영하나요?" desc="진단 결과를 읽을 때 참고하고, 진단 문항을 개선하는 데 씁니다." />
      <div className="seg reflect" role="radiogroup" aria-label="응답 반영 정도">
        {REFLECT.map((l, i) => (
          <button key={l} role="radio" aria-checked={s.profile.reflect === i + 1} className={s.profile.reflect === i + 1 ? 'on' : ''}
            onClick={() => d({ type: 'profile', patch: { reflect: s.profile.reflect === i + 1 ? null : i + 1 } })}>
            <b className="num">{i + 1}</b> {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export const REFLECT = ['전혀 반영 못함', '별로 반영 못함', '보통', '잘 반영함', '매우 잘 반영함'];

const fmtPct = (v: number) => `${Math.round(v * 10) / 10}%`;
