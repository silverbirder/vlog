import type { ChangeEvent } from "react";
import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  useMediaRecorder,
  MediaRecorderController,
} from "./hooks/useMediaRecorder";
import "./App.css";

type RecorderCardProps = {
  title: string;
  description: string;
  controller: MediaRecorderController;
  mediaKind: "video" | "audio";
  previewMirror?: boolean;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  toggleDisabled?: boolean;
  onDownload?: () => void;
  onReset?: () => void;
};

const hasMediaSupport =
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);

function VideoStream({
  stream,
  mirrored,
}: {
  stream: MediaStream | null;
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    if (stream) {
      element.srcObject = stream;
      const play = async () => {
        try {
          await element.play();
        } catch (err) {
          console.warn("Preview playback interrupted", err);
        }
      };
      play();
    } else {
      element.pause();
      element.srcObject = null;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className={`live-preview${mirrored ? " mirrored" : ""}`}
      muted
      autoPlay
      playsInline
    />
  );
}

function RecorderCard({
  title,
  description,
  controller,
  mediaKind,
  previewMirror,
  enabled,
  onToggle,
  toggleDisabled,
  onDownload,
  onReset,
}: RecorderCardProps) {
  const { status, error, mediaUrl, stream, download, reset, isRecording } =
    controller;

  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
        return "待機中";
      case "recording":
        return "録画中";
      case "stopped":
        return "完了";
      case "error":
        return "エラー";
      default:
        return status;
    }
  }, [status]);

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
    } else {
      download();
    }
  }, [download, onDownload]);

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    } else {
      reset();
    }
  }, [onReset, reset]);

  const canReset =
    !isRecording &&
    (mediaUrl !== null || status === "error" || status === "stopped");

  return (
    <section className="card">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <label className={`feature-toggle${enabled ? " active" : ""}`}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              const checked =
                (event.target instanceof HTMLInputElement && event.target.checked) || false;
              onToggle(checked);
            }}
            disabled={toggleDisabled}
          />
          <span>{enabled ? "使用中" : "無効"}</span>
        </label>
      </header>

      <div className="status-row">
        <span className={`indicator ${status}`}></span>
        <span>{statusLabel}</span>
        {isRecording && (
          <span className="muted">録画中は設定を変更できません</span>
        )}
      </div>

      {!enabled && (
        <p className="muted">この録画タイプは現在オフになっています。</p>
      )}

      {enabled && stream && mediaKind === "video" && (
        <VideoStream stream={stream} mirrored={previewMirror} />
      )}

      {mediaUrl &&
        (mediaKind === "audio" ? (
          <audio className="playback" controls src={mediaUrl} />
        ) : (
          <video className="playback" controls src={mediaUrl} />
        ))}

      <div className="card-actions">
        <button onClick={handleDownload} disabled={!mediaUrl}>
          保存
        </button>
        <button onClick={handleReset} disabled={!canReset}>
          個別リセット
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}

function App() {
  const [enabledSources, setEnabledSources] = useState({
    screen: true,
    camera: true,
    audio: false,
  });
  const [isStartingAll, setIsStartingAll] = useState(false);

  const getScreenStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error(
        "このプラットフォームでは画面録画がサポートされていません。"
      );
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "monitor" },
      audio: true,
    });

    if (
      screenStream.getAudioTracks().length === 0 &&
      navigator.mediaDevices.getUserMedia
    ) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        micStream
          .getAudioTracks()
          .forEach((track) => screenStream.addTrack(track));
      } catch (err) {
        console.warn("マイクの追加に失敗しました", err);
      }
    }

    return screenStream;
  }, []);

  const getCameraStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("カメラが利用できません。");
    }

    return navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
  }, []);

  const getAudioStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("マイクが利用できません。");
    }

    return navigator.mediaDevices.getUserMedia({ audio: true });
  }, []);

  const screenRecorder = useMediaRecorder(getScreenStream, "video");
  const cameraRecorder = useMediaRecorder(getCameraStream, "video");
  const audioRecorder = useMediaRecorder(getAudioStream, "audio");

  const controllerEntries: Array<{
    key: keyof typeof enabledSources;
    controller: MediaRecorderController;
    defaultDownloadName: string;
  }> = useMemo(
    () => [
      {
        key: "screen",
        controller: screenRecorder,
        defaultDownloadName: "screen-recording",
      },
      {
        key: "camera",
        controller: cameraRecorder,
        defaultDownloadName: "camera-recording",
      },
      {
        key: "audio",
        controller: audioRecorder,
        defaultDownloadName: "audio-recording",
      },
    ],
    [audioRecorder, cameraRecorder, screenRecorder]
  );

  const isAnyRecording = controllerEntries.some(
    ({ controller }) => controller.isRecording
  );
  const isAnyEnabled = Object.values(enabledSources).some(Boolean);
  const canResetAll = controllerEntries.some(
    ({ controller }) =>
      controller.mediaUrl !== null ||
      controller.status === "error" ||
      controller.status === "stopped"
  );
  const hasDownloads = controllerEntries.some(
    ({ controller }) => controller.mediaUrl
  );

  const startAll = useCallback(async () => {
    if (isStartingAll || isAnyRecording || !isAnyEnabled) {
      return;
    }

    setIsStartingAll(true);
    try {
      for (const { key, controller } of controllerEntries) {
        if (!enabledSources[key]) {
          controller.reset();
          continue;
        }

        try {
          await controller.start();
        } catch (err) {
          console.warn(`${String(key)} start failed`, err);
        }
      }
    } finally {
      setIsStartingAll(false);
    }
  }, [
    controllerEntries,
    enabledSources,
    isAnyEnabled,
    isAnyRecording,
    isStartingAll,
  ]);

  const stopAll = useCallback(() => {
    controllerEntries.forEach(({ controller }) => {
      if (controller.isRecording) {
        controller.stop();
      }
    });
  }, [controllerEntries]);

  const resetAll = useCallback(() => {
    controllerEntries.forEach(({ controller }) => controller.reset());
  }, [controllerEntries]);

  const downloadAll = useCallback(() => {
    controllerEntries.forEach(({ controller, defaultDownloadName }) => {
      if (controller.mediaUrl) {
        controller.download(defaultDownloadName);
      }
    });
  }, [controllerEntries]);

  if (!hasMediaSupport) {
    return (
      <main className="app">
        <h1>デバイスにアクセスできません</h1>
        <p>このマシンはメディアデバイス API をサポートしていません。</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Vlog Recorder</h1>
        <p>選択した対象（画面・カメラ・音声）を同時に録画 / 録音できます。</p>
      </header>

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

        <div className="global-controls">
          <button
            onClick={startAll}
            disabled={!isAnyEnabled || isAnyRecording || isStartingAll}
            className="primary"
          >
            まとめて開始
          </button>
          <button
            onClick={stopAll}
            disabled={!isAnyRecording}
            className="warning"
          >
            停止
          </button>
          <button onClick={resetAll} disabled={isAnyRecording || !canResetAll}>
            全リセット
          </button>
          <button onClick={downloadAll} disabled={!hasDownloads}>
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
