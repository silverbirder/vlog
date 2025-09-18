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

type TauriNotificationModule = typeof import("@tauri-apps/plugin-notification");
type TauriMacosPermissionsModule = typeof import(
  "tauri-plugin-macos-permissions-api"
);

function isTauriEnvironment() {
  if (typeof window === "undefined") {
    return false;
  }
  const globalWindow = window as unknown as {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(globalWindow.__TAURI__ || globalWindow.__TAURI_INTERNALS__);
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0秒";
  }

  const roundedSeconds = Math.round(totalSeconds);

  if (roundedSeconds < 60) {
    return `${roundedSeconds}秒`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  if (seconds === 0) {
    return `${minutes}分`;
  }

  return `${minutes}分${seconds}秒`;
}

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
                (event.target instanceof HTMLInputElement &&
                  event.target.checked) ||
                false;
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
  const [autoStopMinutesInput, setAutoStopMinutesInput] = useState("15");
  const [autoStopSecondsInput, setAutoStopSecondsInput] = useState("0");
  const autoStopTimerRef = useRef<number | null>(null);
  const autoStopDurationSecondsRef = useRef<number | null>(null);
  const [autoStopDeadline, setAutoStopDeadline] = useState<Date | null>(null);
  const [autoStopMessage, setAutoStopMessage] = useState<string | null>(null);
  const [tauriNotificationPermission, setTauriNotificationPermission] =
    useState<"unknown" | "granted" | "denied">("unknown");
  const [mediaSupportStatus, setMediaSupportStatus] = useState<
    "pending" | "supported" | "unsupported"
  >(
    typeof navigator !== "undefined" && navigator.mediaDevices
      ? "supported"
      : "pending"
  );
  const [mediaSupportMessage, setMediaSupportMessage] = useState(
    typeof navigator !== "undefined" && navigator.mediaDevices
      ? ""
      : "このマシンはメディアデバイス API をサポートしていません。"
  );

  const loadTauriNotification =
    useCallback(async (): Promise<TauriNotificationModule | null> => {
      if (!isTauriEnvironment()) {
        return null;
      }
      try {
        const module = await import("@tauri-apps/plugin-notification");
        return module;
      } catch (err) {
        console.warn("Failed to load Tauri notification plugin", err);
        return null;
      }
    }, []);

  const loadTauriMacosPermissions =
    useCallback(async (): Promise<TauriMacosPermissionsModule | null> => {
      if (!isTauriEnvironment()) {
        return null;
      }
      try {
        const module = await import("tauri-plugin-macos-permissions-api");
        return module;
      } catch (err) {
        console.warn("Failed to load Tauri macOS permissions plugin", err);
        return null;
      }
    }, []);

  useEffect(() => {
    if (mediaSupportStatus !== "pending") {
      return;
    }

    let disposed = false;

    const evaluateSupport = async () => {
      const navigatorAvailableInitially =
        typeof navigator !== "undefined" && navigator.mediaDevices;

      if (navigatorAvailableInitially) {
        if (!disposed) {
          setMediaSupportStatus("supported");
          setMediaSupportMessage("");
        }
        return;
      }

      if (!isTauriEnvironment()) {
        if (!disposed) {
          setMediaSupportStatus("unsupported");
          setMediaSupportMessage(
            "このマシンはメディアデバイス API をサポートしていません。"
          );
        }
        return;
      }

      const permissions = await loadTauriMacosPermissions();
      if (!permissions) {
        if (!disposed) {
          setMediaSupportStatus("unsupported");
          setMediaSupportMessage(
            "メディア関連の権限プラグインを読み込めませんでした。アプリを再起動してください。"
          );
        }
        return;
      }

      const normalizePermissionResult = (value: unknown): boolean => {
        if (typeof value === "boolean") {
          return value;
        }
        if (typeof value === "string") {
          const normalized = value.toLowerCase();
          return [
            "granted",
            "authorized",
            "authorizedalways",
            "authorizedwheninuse",
            "promptallowed",
          ].includes(normalized);
        }
        return false;
      };

      const ensurePermission = async (
        check?: () => Promise<unknown>,
        request?: () => Promise<unknown>
      ): Promise<boolean> => {
        try {
          if (check) {
            const granted = await check();
            if (normalizePermissionResult(granted)) {
              return true;
            }
          }
          if (request) {
            return normalizePermissionResult(await request());
          }
        } catch (err) {
          console.warn("Failed to ensure macOS permission", err);
        }
        return false;
      };

      const checkScreenPermission =
        permissions.checkScreenRecordingPermission ??
        ((permissions as Record<string, unknown>)[
          "checkScreenCapturePermission"
        ] as (() => Promise<boolean>) | undefined);
      const requestScreenPermission =
        permissions.requestScreenRecordingPermission ??
        ((permissions as Record<string, unknown>)[
          "requestScreenCapturePermission"
        ] as (() => Promise<boolean>) | undefined);

      const [microphoneGranted, cameraGranted, screenGranted] =
        await Promise.all([
          ensurePermission(
            permissions.checkMicrophonePermission
              ? () => permissions.checkMicrophonePermission()
              : undefined,
            permissions.requestMicrophonePermission
              ? () => permissions.requestMicrophonePermission()
              : undefined
          ),
          ensurePermission(
            permissions.checkCameraPermission
              ? () => permissions.checkCameraPermission()
              : undefined,
            permissions.requestCameraPermission
              ? () => permissions.requestCameraPermission()
              : undefined
          ),
          ensurePermission(
            checkScreenPermission ? () => checkScreenPermission() : undefined,
            requestScreenPermission
              ? () => requestScreenPermission()
              : undefined
          ),
        ]);

      const navigatorAvailableAfter =
        typeof navigator !== "undefined" && navigator.mediaDevices;

      if (disposed) {
        return;
      }

      if (navigatorAvailableAfter) {
        setMediaSupportStatus("supported");
        if (!microphoneGranted || !cameraGranted || !screenGranted) {
          const denied = [
            !microphoneGranted ? "マイク" : null,
            !cameraGranted ? "カメラ" : null,
            !screenGranted ? "画面収録" : null,
          ].filter(Boolean);
          if (denied.length > 0) {
            setMediaSupportMessage(
              `${denied.join("・")}の権限が拒否されているため、一部の録画機能を利用できません。システム設定 > プライバシーとセキュリティ から許可してください。`
            );
          } else {
            setMediaSupportMessage("");
          }
        } else {
          setMediaSupportMessage("");
        }
        return;
      }

      if (microphoneGranted || cameraGranted || screenGranted) {
        setMediaSupportStatus("supported");
        setMediaSupportMessage(
          "権限は付与されていますが、ブラウザのメディア API が利用できません。アプリや OS を再起動して再度お試しください。"
        );
        return;
      }

      setMediaSupportStatus("unsupported");
      setMediaSupportMessage(
        "必要な権限が付与されていないため、録画機能を利用できません。システム設定 > プライバシーとセキュリティ でカメラ・マイク・画面収録を許可してください。"
      );
    };

    void evaluateSupport();

    return () => {
      disposed = true;
    };
  }, [loadTauriMacosPermissions, mediaSupportStatus]);

  const autoStopDurationSeconds = useMemo(() => {
    const minutesRaw = Number(autoStopMinutesInput);
    const secondsRaw = Number(autoStopSecondsInput);

    if (
      Number.isNaN(minutesRaw) ||
      minutesRaw < 0 ||
      !Number.isFinite(minutesRaw) ||
      Number.isNaN(secondsRaw) ||
      secondsRaw < 0 ||
      !Number.isFinite(secondsRaw)
    ) {
      return null;
    }

    const minutes = Math.floor(minutesRaw);
    const seconds = Math.floor(secondsRaw);

    if (seconds >= 60) {
      return minutes * 60 + 59;
    }

    const totalSeconds = minutes * 60 + seconds;

    return totalSeconds > 0 ? totalSeconds : null;
  }, [autoStopMinutesInput, autoStopSecondsInput]);

  const autoStopDurationMs = useMemo(() => {
    if (!autoStopDurationSeconds) {
      return null;
    }
    return autoStopDurationSeconds * 1000;
  }, [autoStopDurationSeconds]);

  const clearAutoStopTimer = useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      const timeoutId = autoStopTimerRef.current;
      if (typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
      }
      autoStopTimerRef.current = null;
    }
    autoStopDurationSecondsRef.current = null;
    setAutoStopDeadline(null);
  }, []);

  const notifyAutoStop = useCallback(
    async (durationSeconds: number) => {
      const label = formatDuration(durationSeconds);
      const title = "録画を停止しました";
      const body = `指定した${label}が経過したため、自動停止しました。`;

      const showFallbackAlert = () => {
        if (
          typeof window !== "undefined" &&
          typeof window.alert === "function"
        ) {
          window.alert(body);
        }
      };

      const tauriNotification = await loadTauriNotification();
      if (tauriNotification) {
        try {
          const granted = await tauriNotification.isPermissionGranted();
          if (granted) {
            await tauriNotification.sendNotification({ title, body });
            return;
          }
          setTauriNotificationPermission("denied");
        } catch (err) {
          console.warn("Failed to send Tauri notification", err);
        }
      }

      if (typeof window === "undefined" || !("Notification" in window)) {
        showFallbackAlert();
        return;
      }

      if (Notification.permission === "granted") {
        new Notification(title, { body });
        return;
      }

      if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(title, { body });
          } else {
            showFallbackAlert();
          }
        });
        return;
      }

      showFallbackAlert();
    },
    [loadTauriNotification, setTauriNotificationPermission]
  );

  const ensureNotificationPermission = useCallback(async () => {
    const tauriNotification = await loadTauriNotification();
    if (tauriNotification) {
      try {
        if (await tauriNotification.isPermissionGranted()) {
          setTauriNotificationPermission("granted");
          return;
        }
        const permission = await tauriNotification.requestPermission();
        if (permission === "granted") {
          setTauriNotificationPermission("granted");
        } else if (permission === "denied") {
          setTauriNotificationPermission("denied");
        }
        return;
      } catch (err) {
        console.warn("Failed to request Tauri notification permission", err);
      }
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn("Failed to request browser notification permission", err);
      }
    }
  }, [loadTauriNotification]);

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

  const scheduledAutoStopSeconds =
    autoStopDurationSecondsRef.current ?? autoStopDurationSeconds ?? null;

  useEffect(() => {
    if (!isAnyRecording && autoStopTimerRef.current !== null) {
      clearAutoStopTimer();
    }
  }, [clearAutoStopTimer, isAnyRecording]);

  useEffect(() => {
    return () => {
      clearAutoStopTimer();
    };
  }, [clearAutoStopTimer]);

  const stopAll = useCallback(
    (options?: { auto?: boolean; durationSeconds?: number }) => {
      const secondsForNotification =
        options?.durationSeconds ?? autoStopDurationSecondsRef.current ?? null;

      clearAutoStopTimer();

      controllerEntries.forEach(({ controller }) => {
        if (controller.isRecording) {
          controller.stop();
        }
      });

      if (options?.auto && secondsForNotification) {
        const label = formatDuration(secondsForNotification);
        const baseMessage = `指定した${label}が経過したため、自動的に停止しました。`;

        if (tauriNotificationPermission === "denied" && isTauriEnvironment()) {
          setAutoStopMessage(
            `${baseMessage} デスクトップアプリの通知権限が拒否されています。システムの通知設定を確認してください。`
          );
        } else if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "denied"
        ) {
          setAutoStopMessage(
            `${baseMessage} ブラウザの通知がブロックされています。通知を受け取りたい場合はブラウザ設定で許可してください。`
          );
        } else {
          setAutoStopMessage(baseMessage);
        }

        void notifyAutoStop(secondsForNotification);
      } else if (!options?.auto) {
        setAutoStopMessage(null);
      }
    },
    [
      autoStopDurationSecondsRef,
      clearAutoStopTimer,
      controllerEntries,
      tauriNotificationPermission,
      notifyAutoStop,
    ]
  );

  const startAll = useCallback(async () => {
    if (isStartingAll || isAnyRecording || !isAnyEnabled) {
      return;
    }

    clearAutoStopTimer();
    setAutoStopMessage(null);
    setIsStartingAll(true);

    const notificationPermissionPromise = ensureNotificationPermission().catch(
      (err) => {
        console.warn("Notification permission check failed", err);
      }
    );

    try {
      let didStartAny = false;

      for (const { key, controller } of controllerEntries) {
        if (!enabledSources[key]) {
          controller.reset();
          continue;
        }

        try {
          await controller.start();
          didStartAny = true;
        } catch (err) {
          console.warn(`${String(key)} start failed`, err);
        }
      }

      if (
        didStartAny &&
        autoStopDurationMs &&
        autoStopDurationSeconds &&
        typeof window !== "undefined"
      ) {
        autoStopDurationSecondsRef.current = autoStopDurationSeconds;
        const timeoutId = window.setTimeout(() => {
          stopAll({ auto: true, durationSeconds: autoStopDurationSeconds });
        }, autoStopDurationMs);
        autoStopTimerRef.current = timeoutId;
        setAutoStopDeadline(new Date(Date.now() + autoStopDurationMs));
      }
    } finally {
      setIsStartingAll(false);
    }

    await notificationPermissionPromise;
  }, [
    autoStopDurationMs,
    autoStopDurationSeconds,
    autoStopDurationSecondsRef,
    clearAutoStopTimer,
    controllerEntries,
    enabledSources,
    isAnyEnabled,
    isAnyRecording,
    isStartingAll,
    ensureNotificationPermission,
    stopAll,
  ]);

  const resetAll = useCallback(() => {
    clearAutoStopTimer();
    setAutoStopMessage(null);
    controllerEntries.forEach(({ controller }) => controller.reset());
  }, [clearAutoStopTimer, controllerEntries]);

  const downloadAll = useCallback(() => {
    controllerEntries.forEach(({ controller, defaultDownloadName }) => {
      if (controller.mediaUrl) {
        controller.download(defaultDownloadName);
      }
    });
  }, [controllerEntries]);

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
          <label htmlFor="auto-stop-minutes">
            <span>自動停止タイマー（分）</span>
            <input
              id="auto-stop-minutes"
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
          <label htmlFor="auto-stop-seconds">
            <span>秒</span>
            <input
              id="auto-stop-seconds"
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
            onClick={startAll}
            disabled={!isAnyEnabled || isAnyRecording || isStartingAll}
            className="primary"
          >
            まとめて開始
          </button>
          <button
            onClick={() => stopAll()}
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
