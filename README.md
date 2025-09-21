# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Appium を使ったローカルE2Eテスト

最小構成の Appium テスト (`src/tests/appium/basic.e2e.ts`) を追加しています。macOS 上でローカル実行する際の手順は以下です。

1. 依存パッケージを取得し、デバッグビルドを用意
   ```bash
   npm install
   npm run tauri:build
   ```
2. 1回だけ Appium 本体 (v3 以上) と Mac2 ドライバをセットアップ
   ```bash
   npx appium driver install mac2
   ```
3. 別ターミナルで Appium サーバーを起動
   ```bash
   npx appium --port 4723
   ```
4. テストを実行（ヘッダー表示→開始ボタン押下→停止ボタンでの停止まで確認）
   ```bash
   npm run appium:test
   ```

デフォルトでは `src-tauri/target/debug/bundle/macos/vlog.app` を起動対象とします。異なるパスを使いたい場合は `APP_PATH=/path/to/app.app npm run appium:test` のように環境変数で上書きしてください。バンドルIDを変更している場合は `BUNDLE_ID` も同様に指定できます。また、古いバージョンの Appium がグローバルに入っている場合は `npx appium@latest …` あるいはプロジェクトローカルの `node_modules/.bin/appium` を直接指定して実行してください。
