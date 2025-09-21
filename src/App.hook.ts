import { useCallback, useEffect, useMemo, useState } from "react";
import { useAutoStop } from "@/hooks/useAutoStop";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import type {
  MediaRecorderController,
  MediaSupportStatus,
  TauriNotificationPermission,
} from "@/types";
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
    audio: true,
    camera: true,
    screen: true,
  });
  const [isStartingAll, setIsStartingAll] = useState(false);
  const [tauriNotificationPermission, setTauriNotificationPermission] =
    useState<TauriNotificationPermission>("unknown");
  const [mediaSupportStatus, setMediaSupportStatus] =
    useState<MediaSupportStatus>("pending");
  const [mediaSupportMessage, setMediaSupportMessage] = useState("");

  const {
    autoStopDeadline,
    autoStopDurationSeconds,
    autoStopMessage,
    autoStopMinutesId,
    autoStopMinutesInput,
    autoStopSecondsId,
    autoStopSecondsInput,
    clearAutoStop,
    scheduleAutoStop,
    scheduledAutoStopSeconds,
    scheduledAutoStopSecondsState,
    setAutoStopHandler,
    setAutoStopMessage,
    setAutoStopMinutesInput,
    setAutoStopSecondsInput,
  } = useAutoStop();

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
        return;
      }

      if (microphoneGranted || cameraGranted || screenGranted) {
        setMediaSupportStatus("supported");
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
  const hasDownloads = controllerEntries.some(
    ({ controller }) => controller.mediaUrl,
  );

  useEffect(() => {
    if (!isAnyRecording) {
      clearAutoStop();
    }
  }, [clearAutoStop, isAnyRecording]);

  useEffect(() => {
    return () => {
      clearAutoStop();
    };
  }, [clearAutoStop]);

  const stopAll = useCallback(
    (options: StopAllOptions = {}) => {
      const secondsForNotification =
        options.durationSeconds ?? scheduledAutoStopSecondsState ?? null;
      clearAutoStop();
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
      clearAutoStop,
      controllerEntries,
      scheduledAutoStopSecondsState,
      tauriNotificationPermission,
      setAutoStopMessage,
      notifyAutoStop,
    ],
  );

  useEffect(() => {
    setAutoStopHandler((durationSeconds) => {
      stopAll({ auto: true, durationSeconds });
    });
  }, [setAutoStopHandler, stopAll]);

  const startAll = useCallback(async () => {
    if (isStartingAll || isAnyRecording || !isAnyEnabled) {
      return;
    }
    clearAutoStop();
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
          continue;
        }

        try {
          await controller.start();
          didStartAny = true;
        } catch (err) {
          console.warn(`${String(key)} start failed`, err);
        }
      }

      if (didStartAny && autoStopDurationSeconds) {
        scheduleAutoStop(autoStopDurationSeconds);
      }
    } finally {
      setIsStartingAll(false);
    }

    await notificationPermissionPromise;
  }, [
    autoStopDurationSeconds,
    clearAutoStop,
    controllerEntries,
    enabledSources,
    isAnyEnabled,
    isAnyRecording,
    isStartingAll,
    ensureNotificationPermission,
    setAutoStopMessage,
    scheduleAutoStop,
  ]);

  const downloadAll = useCallback(async () => {
    const sharedTimestamp = new Date();

    for (const { controller, defaultDownloadName } of controllerEntries) {
      if (!controller.mediaUrl) {
        continue;
      }

      await controller.download(defaultDownloadName, {
        timestamp: sharedTimestamp,
      });
    }
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
    downloadAll,
    enabledSources,
    hasDownloads,
    isAnyEnabled,
    isAnyRecording,
    isStartingAll,
    mediaSupportMessage,
    mediaSupportStatus,
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
