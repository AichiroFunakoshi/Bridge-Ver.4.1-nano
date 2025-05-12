# リアルタイム音声翻訳 PWA

日本語と英語を **GPT‑4o mini‑transcribe** + **GPT‑4o realtime‑preview** でリアルタイムに通訳する Progressive Web App です。  
iPhone（最新 iOS）Safari でホーム画面に追加すればネイティブアプリのように動作します。

---

## 機能

* **瞬時文字起こし**: `gpt-4o-mini-transcribe` を主モデル、失敗時 `gpt-4o-transcribe` に自動フェイルオーバー  
* **即時翻訳**: `gpt-4o-realtime-preview` がストリームで翻訳テキストを返却  
* **UI**: 自字幕 + 翻訳字幕 2 段表示、ダークテーマ自動対応  
* **PWA**: オフラインキャッシュ（Service Worker）／スタンドアロン表示  
* **設定**: OpenAI API Key の入力保存

> **TTS（音声合成）は未実装** – 将来対応予定。

---

## 必要なファイル構成

```
/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── sw.js
└── images
    └── icons
        ├── apple-touch-icon-180x180.png
        ├── icon-120x120.png
        ├── icon-152x152.png
        ├── icon-167x167.png
        ├── icon-192x192.png
        └── icon-512x512.png
```

> アイコン PNG はご自身で `/images/icons/` にアップロードしてください。名前は上記と **完全一致** させてください。

---

## セットアップ手順

1. `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js` を同一ディレクトリに配置  
2. 任意の静的ホスティング（GitHub Pages など）にデプロイ  
3. ブラウザでアクセス → **設定 (⚙️)** から OpenAI API Key (`sk-...`) を保存  
4. 「🎤 日本語」 or 「🎤 English」をタップして計測開始  
5. 字幕（自分の発話）と翻訳字幕がリアルタイムに表示されます

---

## ビルド不要

純粋なフロントエンド実装なので Node.js ビルド手順はありません。  
バンドラーを導入したい場合は以下を推奨します。

```bash
npm install --save-dev vite
```

---

## 更新履歴

- 2025/05/12: エラー処理と UI フィードバックを強化、Service Worker を実装

---

## ライセンス

MIT