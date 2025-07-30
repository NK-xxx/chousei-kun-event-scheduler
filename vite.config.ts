import path from 'path';
import { defineConfig, loadEnv } from 'vite';
// ① React プラグインを追加読み込み
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // .env ファイル読み込み
  const env = loadEnv(mode, '.', '');
  return {
    // ② GitHub Pages での公開先パス（リポジトリ名）
    base: '/chousei-kun-event-scheduler/',
    // ① ここで React プラグインを有効化
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
