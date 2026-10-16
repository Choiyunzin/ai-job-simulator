// Vite 없이 esbuild만으로 '파일 하나짜리 HTML'을 만드는 스크립트
// 사용: node scripts/build-single.mjs  → dist/ai-job-simulator.html
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
// 같은 폴더에 job-list.js(사내 직무 목록)가 있으면 앱보다 먼저 읽습니다. 없으면 기본 목록으로 동작합니다.
const jobList = '<script src="job-list.js"></script>';
writeFileSync('dist/ai-job-simulator.html', `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${page.replace('<div id="root"></div>', `</head><body><div id="root"></div>\n${jobList}`)}
</body></html>`);
// 2) 페이지 본문만 있는 버전 (아티팩트 게시용)
writeFileSync('dist/artifact.html', page);
console.log('built', (readFileSync('dist/ai-job-simulator.html').length / 1024).toFixed(0) + 'KB');
