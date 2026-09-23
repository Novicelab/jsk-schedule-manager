import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// 정적 파일 제공
app.use(
  express.static(join(__dirname, 'frontend/dist'), {
    setHeaders: (res, filePath) => {
      // express.static의 mime 테이블에 .webmanifest가 없어 octet-stream으로 나간다.
      // 이 경우 iOS가 매니페스트를 무시해 '홈 화면에 추가'가 standalone으로 뜨지 않고,
      // 결과적으로 웹 푸시 수신 조건(홈 화면 설치)이 충족되지 않는다.
      if (filePath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
      // Service Worker는 매 요청 재검증해야 새 버전이 즉시 반영된다
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// SPA 라우팅: 모든 요청 → index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'frontend/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
