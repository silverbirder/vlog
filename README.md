# Vlog Recorder

Vlog Recorder は、スクリーン・カメラを同時に記録できる macOS 向けデスクトップアプリです。ピクチャ・イン・ピクチャでの常時前面表示、自動停止や連続保存といった録画を助ける機能を備え、動画ブログやリモートワークに最適です。

![vlog-intro-1](./assets/vlog-intro-1.png)

## 対応プラットフォーム

- macOS 15 Sequoia 以降（Apple Silicon)

## 必要なもの

- Node.js 20 以上
- Rust (stable)

Tauri 公式ドキュメントの [必要事項 | Tauri](https://v2.tauri.app/ja/start/prerequisites/) も参照してください。

## インストール手順（macOS）

1. プロジェクトを取得します。

```bash
git clone https://github.com/silverbirder/vlog.git
cd vlog
```

2. 依存パッケージをインストールします。

```bash
npm install
```

3. macOS アプリをビルドしてバンドルを生成します。`npm run tauri:build` は `.app` や `.dmg` を含むバンドルを作成します。

```bash
npm run tauri:build
```

成果物は `src-tauri/target/release/bundle/macos/` に出力されます。

4. 生成した `.dmg` を開き、アプリを `Applications` フォルダへドラッグするとインストール完了です。

5. インストール後、アプリケーションフォルダから **Vlog** を起動し、保存先フォルダやデバイスを設定して録画を開始します。

## お問い合わせ

不明点があれば Issues や Pull Request でお知らせください。
