import type { ChangeEvent } from "react";
import "./App.css";
import { RecorderCard } from "@/components";
import { formatDuration } from "@/utils";
import { useApp } from "./App.hook";

function App() {
  const {
    screenRecorder,
    cameraRecorder,
    audioRecorder,
    enabledSources,
    setEnabledSources,
    isStartingAll,
    autoStopMinutesInput,
    setAutoStopMinutesInput,
    autoStopSecondsInput,
    setAutoStopSecondsInput,
    autoStopDeadline,
    autoStopMessage,
    mediaSupportStatus,
    mediaSupportMessage,
    isAnyRecording,
    isAnyEnabled,
    canResetAll,
    hasDownloads,
    startAll,
    stopAll,
    resetAll,
    downloadAll,
    autoStopMinutesId,
    autoStopSecondsId,
    scheduledAutoStopSeconds,
  } = useApp();

  if (mediaSupportStatus === "pending") {
    return (
      <main className="app">
        <h1>メディアデバイスを確認中...</h1>
        <p>デスクトップアプリの権限状態を確認しています。</p>
      </main>
    );
  }

  if (mediaSupportStatus === "unsupported") {
    return (
      <main className="app">
        <h1>デバイスにアクセスできません</h1>
        <p>{mediaSupportMessage}</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Vlog Recorder</h1>
        <p>選択した対象（画面・カメラ・音声）を同時に録画 / 録音できます。</p>
      </header>

      {mediaSupportMessage && (
        <p className="auto-stop-message">{mediaSupportMessage}</p>
      )}

      <section className="control-panel">
        <div className="toggles">
          <label>
            <input
              type="checkbox"
              checked={enabledSources.screen}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEnabledSources((prev) => ({
                  ...prev,
                  screen: event.target.checked,
                }))
              }
              disabled={screenRecorder.isRecording}
            />
            スクリーン
          </label>
          <label>
            <input
              type="checkbox"
              checked={enabledSources.camera}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEnabledSources((prev) => ({
                  ...prev,
                  camera: event.target.checked,
                }))
              }
              disabled={cameraRecorder.isRecording}
            />
            カメラ
          </label>
          <label>
            <input
              type="checkbox"
              checked={enabledSources.audio}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEnabledSources((prev) => ({
                  ...prev,
                  audio: event.target.checked,
                }))
              }
              disabled={audioRecorder.isRecording}
            />
            マイク音声
          </label>
        </div>

        <div className="auto-stop-controls">
          <label htmlFor={autoStopMinutesId}>
            <span>自動停止タイマー（分）</span>
            <input
              id={autoStopMinutesId}
              type="number"
              min={0}
              step={1}
              value={autoStopMinutesInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.target;
                if (value === "") {
                  setAutoStopMinutesInput("");
                  return;
                }
                const numeric = Number(value);
                if (Number.isNaN(numeric)) {
                  return;
                }
                const normalized = Math.max(0, Math.floor(numeric));
                setAutoStopMinutesInput(String(normalized));
              }}
              disabled={isStartingAll}
            />
          </label>
          <label htmlFor={autoStopSecondsId}>
            <span>秒</span>
            <input
              id={autoStopSecondsId}
              type="number"
              min={0}
              max={59}
              step={1}
              value={autoStopSecondsInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.target;
                if (value === "") {
                  setAutoStopSecondsInput("");
                  return;
                }
                const numeric = Number(value);
                if (Number.isNaN(numeric)) {
                  return;
                }
                const clamped = Math.min(59, Math.max(0, Math.floor(numeric)));
                setAutoStopSecondsInput(String(clamped));
              }}
              disabled={isStartingAll}
            />
          </label>
          <span className="muted auto-stop-note">
            分・秒を両方 0 にすると無効。変更は次回の開始時に適用されます。
          </span>
        </div>

        {autoStopDeadline && scheduledAutoStopSeconds && (
          <p className="muted auto-stop-deadline">
            自動停止予定: {autoStopDeadline.toLocaleTimeString()}（
            {formatDuration(scheduledAutoStopSeconds)}後）
          </p>
        )}

        {autoStopMessage && (
          <p className="auto-stop-message">{autoStopMessage}</p>
        )}

        <div className="global-controls">
          <button
            type="button"
            onClick={startAll}
            disabled={!isAnyEnabled || isAnyRecording || isStartingAll}
            className="primary"
          >
            まとめて開始
          </button>
          <button
            type="button"
            onClick={() => stopAll()}
            disabled={!isAnyRecording}
            className="warning"
          >
            停止
          </button>
          <button
            type="button"
            onClick={resetAll}
            disabled={isAnyRecording || !canResetAll}
          >
            全リセット
          </button>
          <button type="button" onClick={downloadAll} disabled={!hasDownloads}>
            全て保存
          </button>
        </div>
        <p className="muted">
          録画開始時に選択されている対象のみが同時にスタートします。停止すると各カードから個別保存やリセットが可能です。
        </p>
      </section>

      <div className="cards">
        <RecorderCard
          title="スクリーン録画"
          description="画面とシステム音声（利用可能な場合）をキャプチャします。"
          controller={screenRecorder}
          mediaKind="video"
          enabled={enabledSources.screen}
          onToggle={(value) =>
            !screenRecorder.isRecording &&
            setEnabledSources((prev) => ({ ...prev, screen: value }))
          }
          toggleDisabled={screenRecorder.isRecording}
          onDownload={() => screenRecorder.download("screen-recording")}
          onReset={screenRecorder.reset}
        />
        <RecorderCard
          title="カメラ録画"
          description="Web カメラとマイクを使って動画を撮影します。"
          controller={cameraRecorder}
          mediaKind="video"
          previewMirror
          enabled={enabledSources.camera}
          onToggle={(value) =>
            !cameraRecorder.isRecording &&
            setEnabledSources((prev) => ({ ...prev, camera: value }))
          }
          toggleDisabled={cameraRecorder.isRecording}
          onDownload={() => cameraRecorder.download("camera-recording")}
          onReset={cameraRecorder.reset}
        />
        <RecorderCard
          title="音声録音"
          description="マイク入力のみを収録します。"
          controller={audioRecorder}
          mediaKind="audio"
          enabled={enabledSources.audio}
          onToggle={(value) =>
            !audioRecorder.isRecording &&
            setEnabledSources((prev) => ({ ...prev, audio: value }))
          }
          toggleDisabled={audioRecorder.isRecording}
          onDownload={() => audioRecorder.download("audio-recording")}
          onReset={audioRecorder.reset}
        />
      </div>

      <footer className="app-footer">
        <ul>
          <li>
            録画中は別アプリに切り替えてもウィンドウを閉じないでください。
          </li>
          <li>
            macOS / Windows
            で初回利用時は画面・カメラ・マイクの許可ダイアログを承認してください。
          </li>
          <li>
            保存ファイルはブラウザのダウンロードフォルダーに出力されます。
          </li>
        </ul>
      </footer>
    </main>
  );
}

export default App;
