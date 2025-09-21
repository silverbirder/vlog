import "./App.css";
import { ControlPanel, RecorderCard } from "@/components";
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
    hasDownloads,
    startAll,
    stopAll,
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

      <ControlPanel
        audioRecorder={audioRecorder}
        autoStopDeadline={autoStopDeadline}
        autoStopMessage={autoStopMessage}
        autoStopMinutesId={autoStopMinutesId}
        autoStopMinutesInput={autoStopMinutesInput}
        autoStopSecondsId={autoStopSecondsId}
        autoStopSecondsInput={autoStopSecondsInput}
        cameraRecorder={cameraRecorder}
        downloadAll={downloadAll}
        enabledSources={enabledSources}
        hasDownloads={hasDownloads}
        isAnyEnabled={isAnyEnabled}
        isAnyRecording={isAnyRecording}
        isStartingAll={isStartingAll}
        scheduledAutoStopSeconds={scheduledAutoStopSeconds}
        screenRecorder={screenRecorder}
        setAutoStopMinutesInput={setAutoStopMinutesInput}
        setAutoStopSecondsInput={setAutoStopSecondsInput}
        setEnabledSources={setEnabledSources}
        startAll={startAll}
        stopAll={stopAll}
      />

      <div className="cards">
        <RecorderCard
          controller={screenRecorder}
          description="画面とシステム音声（利用可能な場合）をキャプチャします。"
          enabled={enabledSources.screen}
          mediaKind="video"
          onDownload={() => screenRecorder.download("screen-recording")}
          onToggle={(value) =>
            !screenRecorder.isRecording &&
            setEnabledSources((prev) => ({ ...prev, screen: value }))
          }
          title="スクリーン録画"
          toggleDisabled={screenRecorder.isRecording}
        />
        <RecorderCard
          controller={cameraRecorder}
          description="Web カメラとマイクを使って動画を撮影します。"
          enabled={enabledSources.camera}
          mediaKind="video"
          onDownload={() => cameraRecorder.download("camera-recording")}
          onToggle={(value) =>
            !cameraRecorder.isRecording &&
            setEnabledSources((prev) => ({ ...prev, camera: value }))
          }
          previewMirror
          title="カメラ録画"
          toggleDisabled={cameraRecorder.isRecording}
        />
        <RecorderCard
          controller={audioRecorder}
          description="マイク入力のみを収録します。"
          enabled={enabledSources.audio}
          mediaKind="audio"
          onDownload={() => audioRecorder.download("audio-recording")}
          onToggle={(value) =>
            !audioRecorder.isRecording &&
            setEnabledSources((prev) => ({ ...prev, audio: value }))
          }
          title="音声録音"
          toggleDisabled={audioRecorder.isRecording}
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
        </ul>
      </footer>
    </main>
  );
}

export default App;
