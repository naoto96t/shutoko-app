# shutoko-app

首都高周回ドライブ向けの Next.js アプリです。

機能
- 入口 IC を選んで最安出口候補を表示
- 通常ルートを表示
- PA スポットを指定して周回ルートを探索

開発
```bash
npm install
npm run dev
```

ブラウザ
- `http://localhost:3000`

必要なデータ
- `public/plans.json`
- `public/graph.json`
- `public/allowed_turns_port.csv`
- `public/connections_port.csv`
- `public/special_switches_port.csv`
- `public/route_sequence_v2.csv`
- `public/ic_tags.csv`

今は `public` 配下に必要データを実ファイルとして入れているので、単独 clone でもそのまま動きます。
