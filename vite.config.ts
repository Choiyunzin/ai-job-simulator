import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// npm run build → dist/index.html 한 파일에 JS·CSS가 모두 들어갑니다(사내망 배포용)
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
});
