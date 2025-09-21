import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Capabilities } from "@wdio/types";
import { remote } from "webdriverio";

const DEFAULT_APP_PATH = join(
  process.cwd(),
  "src-tauri",
  "target",
  "debug",
  "bundle",
  "macos",
  "vlog.app",
);

const rawAppPath = process.env.APP_PATH;
const appPath = rawAppPath ? resolve(rawAppPath) : DEFAULT_APP_PATH;
const bundleId = process.env.BUNDLE_ID ?? "com.silverbirder.vlog";
const appExists = existsSync(appPath);

if (!appExists) {
  console.warn(`\n⚠️  テスト対象のアプリが見つかりません: ${appPath}`);
  console.warn(
    "    先に `npm run tauri:build` でデバッグビルドを生成するか、APP_PATH を上書きしてください。\n",
  );
}

type Mac2Capabilities = WebdriverIO.Capabilities & {
  platformName: "mac";
  "appium:automationName": "Mac2";
  "appium:bundleId": string;
  "appium:noReset": boolean;
  "appium:newCommandTimeout": number;
  "appium:app"?: string;
};

const capabilities: Mac2Capabilities = {
  "appium:automationName": "Mac2",
  "appium:bundleId": bundleId,
  "appium:newCommandTimeout": 240,
  "appium:noReset": true,
  platformName: "mac",
};

if (appExists) {
  capabilities["appium:app"] = appPath;
}

const remoteOptions: Capabilities.WebdriverIOConfig = {
  capabilities,
  connectionRetryCount: 2,
  connectionRetryTimeout: 120_000,
  hostname: process.env.APPIUM_HOST ?? "127.0.0.1",
  logLevel: "warn",
  path: process.env.APPIUM_PATH ?? "/",
  port: Number(process.env.APPIUM_PORT ?? 4723),
};

async function main() {
  console.log("ℹ️  Appium セッションを初期化します...");

  const client = await remote(remoteOptions);

  try {
    await client.executeScript("macos: activateApp", [{ bundleId }]);

    const state = Number(
      await client.executeScript("macos: queryAppState", [{ bundleId }]),
    );
    if (state !== 4) {
      throw new Error(
        `アプリがフォアグラウンドで実行されていません (state=${state})`,
      );
    }
    console.log("✅ アプリが起動しフォアグラウンドにいます");

    const header = await client.$(
      "xpath://XCUIElementTypeStaticText[contains(@label,'Vlog Recorder') or contains(@value,'Vlog Recorder') or contains(@title,'Vlog Recorder')]",
    );
    await header.waitForExist({ timeout: 15_000 });
    console.log('✅ 画面上に "Vlog Recorder" ヘッダーが確認できました');

    const startButton = await client.$(
      "xpath://XCUIElementTypeButton[contains(@label,'まとめて開始') or contains(@title,'まとめて開始')]",
    );
    await startButton.waitForExist({ timeout: 10_000 });
    if (!(await startButton.isEnabled())) {
      throw new Error("まとめて開始ボタンが無効のままです");
    }
    console.log("✅ まとめて開始ボタンは操作可能です");

    const stopButton = await client.$(
      "xpath://XCUIElementTypeButton[contains(@label,'停止') or contains(@title,'停止')]",
    );
    await stopButton.waitForExist({ timeout: 10_000 });
    if (await stopButton.isEnabled()) {
      throw new Error("停止ボタンは初期状態では無効であるべきです");
    }
    console.log("✅ 停止ボタンは初期状態で無効になっています");

    console.log("ℹ️ まとめて開始ボタンをクリックします");
    await startButton.click();

    await stopButton.waitForEnabled({ timeout: 20_000 });
    console.log("✅ 録画開始後に停止ボタンが有効化されました");

    try {
      const recordingLabel = await client.$(
        "xpath://XCUIElementTypeStaticText[@label='録画中' or @value='録画中']",
      );
      await recordingLabel.waitForExist({ timeout: 5_000 });
      console.log("✅ 少なくとも1つのカードで録画中ステータスを確認しました");
    } catch {
      console.warn(
        "⚠️ 録画中ステータスの検出に失敗しました (権限未付与の可能性)",
      );
    }

    console.log("ℹ️ 停止ボタンをクリックします");
    await stopButton.click();
    await stopButton.waitForEnabled({ reverse: true, timeout: 10_000 });
    await startButton.waitForEnabled({ timeout: 10_000 });
    console.log("✅ 停止後にボタン状態が初期状態へ戻りました");
  } finally {
    console.log("ℹ️  セッションをクリーンアップします");
    await client.deleteSession();
  }
}

main().catch((error) => {
  console.error("\n❌ E2E テスト失敗");
  console.error(error);
  process.exitCode = 1;
});
