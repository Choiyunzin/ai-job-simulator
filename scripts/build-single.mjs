// Vite 없이 esbuild만으로 '파일 하나짜리 HTML'을 만드는 스크립트
// 사용: node scripts/build-single.mjs  → dist/ai-job-simulator.html (직무 목록 칸은 비어 있음)
//      node scripts/build-single.mjs --list 목록.tsv [--roles 역할.tsv] [--tasks 표준Task.tsv] --out 사내용.html  → 직무·역할 목록을 넣은 사내 배포용 HTML
//      (사내용 파일은 저장소에 올리지 마세요)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const listFile = arg('--list');
const rolesFile = arg('--roles');
const tasksFile = arg('--tasks');
const outFile = arg('--out') ?? 'dist/ai-job-simulator.html';

const result = await build({
  entryPoints: ['src/main.tsx'],
  bundle: true, minify: true, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false, outdir: 'out',
});
const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = result.outputFiles.find((f) => f.path.endsWith('.css')).text;

const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Orbit&display=swap">';
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const page = `<title>AI 업무혁신 시뮬레이터</title>
${fonts}
<style>${css}</style>
<div id="root"></div>
<script>${safeJs}</script>`;

mkdirSync('dist', { recursive: true });
// 1) 브라우저로 바로 여는 완전한 HTML (사내망 배포·메일 첨부용)
// 맨 위에 '직무 목록' 칸을 둡니다. 메모장으로 열어 이 칸만 고치면 직군→직종→직렬→직무 선택지가 바뀝니다.
const header = '직군\t직종\t직렬\t직무';
const rows = listFile
  ? readFileSync(listFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !/^직군\s/.test(l))
  : [];
const roleRows = rolesFile
  ? readFileSync(rolesFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !/^직무\s+역할/.test(l))
  : [];
const TASK_HEADER = ['직무', 'Task ID', 'Task 문장', '업무 유형', 'McKinsey 활동 유형', 'O*NET 직업 코드', 'O*NET Task/DWA', '대응 수준', '노출 등급', '채점 근거', '채점 방식', 'Anthropic 자동화형 비중', '기준일'].join('\t');
const taskRows = tasksFile
  ? readFileSync(tasksFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !/^직무\s+Task/i.test(l))
  : [];
// 템플릿 문자열 안에서 깨지지 않도록 역슬래시·백틱·${ 를 무력화
const esc = (t) => t.replace(/\\/g, '\\\\').replace(/`/g, "'").replace(/\$\{/g, '$ {');
const listBlock = `<!-- ▼▼▼ 직무 목록: 이 사이만 고치면 됩니다 ▼▼▼
  · 한 줄에 직무 하나: 직군, 직종, 직렬, 직무 순서 (탭으로 구분 — 엑셀에서 네 칸을 복사해 붙여넣으면 됩니다)
  · 줄을 추가·수정·삭제한 뒤 저장하고 브라우저에서 다시 열면 반영됩니다.
  · 목록 안에 백틱(\`) 문자는 쓰지 마세요. 목록이 비어 있으면 기본 직무 목록으로 동작합니다. -->
<script>window.JOB_LIST = \`
${[header, ...rows.map(esc)].join('\n')}
\`;</script>
<!-- ▲▲▲ 직무 목록 끝 ▲▲▲ -->
<!-- ▼▼▼ 역할 목록: 이 사이만 고치면 됩니다 ▼▼▼
  · 한 줄에 역할 하나: 직무, 역할 순서 (탭으로 구분). 직무 칸은 위 직무 목록의 '직무' 이름 그대로 (또는 '직렬' 이름).
  · 직무 칸을 '리더'로 적으면 팀장·실장이 체크하는 리더 역할을 바꿀 수 있습니다.
  · 비어 있으면 교육 직무는 기본 교육기획 역할, 팀장·실장은 기본 리더 역할을 씁니다. -->
<script>window.ROLE_LIST = \`
${['직무\t역할', ...roleRows.map(esc)].join('\n')}
\`;</script>
<!-- ▲▲▲ 역할 목록 끝 ▲▲▲ -->
<!-- ▼▼▼ 표준 Task 목록: 이 사이만 고치면 됩니다 ▼▼▼
  · 한 줄에 Task 하나, 탭으로 구분한 13칸: 직무 / Task ID / Task 문장 / 업무 유형 / McKinsey 활동 유형 / O*NET 직업 코드 /
    O*NET Task·DWA / 대응 수준(일치·유사·없음) / 노출 등급(E0·E1·E2) / 채점 근거 / 채점 방식 / Anthropic 자동화형 비중(예: 43%) / 기준일
  · 직무 칸은 위 직무 목록의 '직무' 이름과 같아야 합니다. 업무 유형은 시뮬레이터의 8종 이름 그대로 적습니다.
  · 형식이 맞지 않는 줄은 무시되고, 브라우저 개발자 도구(콘솔)와 STEP 3 '계산 근거 보기'에 오류 줄 수가 표시됩니다.
  · 비어 있으면 모든 업무가 '유형 추정'으로 동작합니다. -->
<script>window.TASK_LIST = \`
${[TASK_HEADER, ...taskRows.map(esc)].join('\n')}
\`;</script>
<!-- ▲▲▲ 표준 Task 목록 끝 ▲▲▲ -->`;
mkdirSync('dist', { recursive: true });
writeFileSync(outFile, `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${listBlock}
${page.replace('<div id="root"></div>', '</head><body><div id="root"></div>')}
</body></html>`);
// 2) 페이지 본문만 있는 버전 (아티팩트 게시용)
writeFileSync('dist/artifact.html', page);
console.log('built', outFile, (readFileSync(outFile).length / 1024).toFixed(0) + 'KB', `직무 ${rows.length}줄 · 역할 ${roleRows.length}줄 · 표준 Task ${taskRows.length}줄`);
