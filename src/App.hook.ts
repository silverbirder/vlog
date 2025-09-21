import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import type { MediaRecorderController } from "@/types";
import {
  ensureMacosMediaPermissions,
  ensureNotificationPermissionStatus,
  formatDuration,
  sendNotificationIfAllowed,
} from "@/utils";

type StopAllOptions = {
  auto?: boolean;
  durationSeconds?: number;
};

export const useApp = () => {
  const [enabledSources, setEnabledSources] = useState({
    audio: false,
    camera: true,
    screen: true,
  });
  const [isStartingAll, setIsStartingAll] = useState(false);
  const [autoStopMinutesInput, setAutoStopMinutesInput] = useState("15");
  const [autoStopSecondsInput, setAutoStopSecondsInput] = useState("0");
  const [scheduledAutoStopSecondsState, setScheduledAutoStopSecondsState] =
    useState<number | null>(null);
  const [autoStopDeadline, setAutoStopDeadline] = useState<Date | null>(null);
  const [autoStopMessage, setAutoStopMessage] = useState<string | null>(null);
  const [tauriNotificationPermission, setTauriNotificationPermission] =
    useState<"unknown" | "granted" | "denied">("unknown");
  const [mediaSupportStatus, setMediaSupportStatus] = useState<
    "pending" | "supported" | "unsupported"
  >("pending");
  const [mediaSupportMessage, setMediaSupportMessage] = useState("");
  const autoStopMinutesId = useId();
  const autoStopSecondsId = useId();

  useEffect(() => {
    if (mediaSupportStatus !== "pending") {
      return;
    }

    let disposed = false;

    const evaluateSupport = async () => {
      const navigatorAvailableInitially = Boolean(
        globalThis.navigator?.mediaDevices,
      );

      if (navigatorAvailableInitially) {
        if (!disposed) {
          setMediaSupportStatus("supported");
          setMediaSupportMessage("");
        }
        return;
      }

      const { microphoneGranted, cameraGranted, screenGranted } =
        await ensureMacosMediaPermissions();

      const navigatorAvailableAfter = Boolean(
        globalThis.navigator?.mediaDevices,
      );

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
              `${denied.join(
                "・",
              )}の権限が拒否されているため、一部の録画機能を利用できません。システム設定 > プライバシーとセキュリティ から許可してください。`,
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
          "権限は付与されていますが、ブラウザのメディア API が利用できません。アプリや OS を再起動して再度お試しください。",
        );
        return;
      }

      setMediaSupportStatus("unsupported");
      setMediaSupportMessage(
        "必要な権限が付与されていないため、録画機能を利用できません。システム設定 > プライバシーとセキュリティ でカメラ・マイク・画面収録を許可してください。",
      );
    };

    void evaluateSupport();

    return () => {
      disposed = true;
    };
  }, [mediaSupportStatus]);

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
    setAutoStopDeadline(null);
    setScheduledAutoStopSecondsState(null);
  }, []);

  const notifyAutoStop = useCallback(async (durationSeconds: number) => {
    const label = formatDuration(durationSeconds);
    const title = "録画を停止しました";
    const body = `指定した${label}が経過したため、自動停止しました。`;

    const result = await sendNotificationIfAllowed({ body, title });

    if (result.status === "denied") {
      setTauriNotificationPermission("denied");
    } else if (result.status === "error") {
      console.warn("Failed to send Tauri notification", result.error);
    }
  }, []);

  const ensureNotificationPermission = useCallback(async () => {
    try {
      const status = await ensureNotificationPermissionStatus();
      if (status !== "unknown") {
        setTauriNotificationPermission(status);
      }
    } catch (err) {
      console.warn("Failed to request Tauri notification permission", err);
    }
  }, []);

  const getScreenStream = useCallback(async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: { displaySurface: "monitor" },
    });

    if (
      screenStream.getAudioTracks().length === 0 &&
      navigator.mediaDevices.getUserMedia
    ) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        micStream.getAudioTracks().forEach((track) => {
          screenStream.addTrack(track);
        });
      } catch (err) {
        console.warn("マイクの追加に失敗しました", err);
      }
    }

    return screenStream;
  }, []);

  const getCameraStream = useCallback(async () => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { height: 720, width: 1280 },
    });
  }, []);

  const getAudioStream = useCallback(async () => {
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
        controller: screenRecorder,
        defaultDownloadName: "screen-recording",
        key: "screen",
      },
      {
        controller: cameraRecorder,
        defaultDownloadName: "camera-recording",
        key: "camera",
      },
      {
        controller: audioRecorder,
        defaultDownloadName: "audio-recording",
        key: "audio",
      },
    ],
    [audioRecorder, cameraRecorder, screenRecorder],
  );

  const isAnyRecording = controllerEntries.some(
    ({ controller }) => controller.isRecording,
  );
  const isAnyEnabled = Object.values(enabledSources).some(Boolean);
  const canResetAll = controllerEntries.some(
    ({ controller }) =>
      controller.mediaUrl !== null ||
      controller.status === "error" ||
      controller.status === "stopped",
  );
  const hasDownloads = controllerEntries.some(
    ({ controller }) => controller.mediaUrl,
  );

  const scheduledAutoStopSeconds =
    scheduledAutoStopSecondsState ?? autoStopDurationSeconds ?? null;

  useEffect(() => {
    if (!isAnyRecording) {
      clearAutoStopTimer();
    }
  }, [clearAutoStopTimer, isAnyRecording]);

  useEffect(() => {
    return () => {
      clearAutoStopTimer();
    };
  }, [clearAutoStopTimer]);

  const stopAll = useCallback(
    (options: StopAllOptions = {}) => {
      const secondsForNotification =
        options.durationSeconds ?? scheduledAutoStopSecondsState ?? null;

      clearAutoStopTimer();

      controllerEntries.forEach(({ controller }) => {
        if (controller.isRecording) {
          controller.stop();
        }
      });

      if (options.auto && secondsForNotification) {
        const label = formatDuration(secondsForNotification);
        const baseMessage = `指定した${label}が経過したため、自動的に停止しました。`;

        if (tauriNotificationPermission === "denied") {
          setAutoStopMessage(
            `${baseMessage} デスクトップアプリの通知権限が拒否されています。システムの通知設定を確認してください。`,
          );
        } else {
          setAutoStopMessage(baseMessage);
        }

        void notifyAutoStop(secondsForNotification);
      } else if (!options.auto) {
        setAutoStopMessage(null);
      }
    },
    [
      clearAutoStopTimer,
      controllerEntries,
      scheduledAutoStopSecondsState,
      tauriNotificationPermission,
      notifyAutoStop,
    ],
  );

  useEffect(() => {
    if (!autoStopDeadline || scheduledAutoStopSecondsState === null) {
      return;
    }

    const now = Date.now();
    const remaining = autoStopDeadline.getTime() - now;

    if (remaining <= 0) {
      stopAll({
        auto: true,
        durationSeconds: scheduledAutoStopSecondsState,
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      stopAll({
        auto: true,
        durationSeconds: scheduledAutoStopSecondsState,
      });
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoStopDeadline, scheduledAutoStopSecondsState, stopAll]);

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
      },
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

      if (didStartAny && autoStopDurationMs && autoStopDurationSeconds) {
        setScheduledAutoStopSecondsState(autoStopDurationSeconds);
        setAutoStopDeadline(new Date(Date.now() + autoStopDurationMs));
      }
    } finally {
      setIsStartingAll(false);
    }

    await notificationPermissionPromise;
  }, [
    autoStopDurationMs,
    autoStopDurationSeconds,
    clearAutoStopTimer,
    controllerEntries,
    enabledSources,
    isAnyEnabled,
    isAnyRecording,
    isStartingAll,
    ensureNotificationPermission,
  ]);

  const resetAll = useCallback(() => {
    clearAutoStopTimer();
    setAutoStopMessage(null);
    controllerEntries.forEach(({ controller }) => {
      controller.reset();
    });
  }, [clearAutoStopTimer, controllerEntries]);

  const downloadAll = useCallback(() => {
    controllerEntries.forEach(({ controller, defaultDownloadName }) => {
      if (controller.mediaUrl) {
        controller.download(defaultDownloadName);
      }
    });
  }, [controllerEntries]);

  return {
    audioRecorder,
    autoStopDeadline,
    autoStopMessage,
    autoStopMinutesId,
    autoStopMinutesInput,
    autoStopSecondsId,
    autoStopSecondsInput,
    cameraRecorder,
    canResetAll,
    downloadAll,
    enabledSources,
    hasDownloads,
    isAnyEnabled,
    isAnyRecording,
    isStartingAll,
    mediaSupportMessage,
    mediaSupportStatus,
    resetAll,
    scheduledAutoStopSeconds,
    screenRecorder,
    setAutoStopMinutesInput,
    setAutoStopSecondsInput,
    setEnabledSources,
    startAll,
    stopAll,
  } as const;
};

export type UseAppReturn = ReturnType<typeof useApp>;
