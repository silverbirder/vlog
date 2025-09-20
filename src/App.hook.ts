import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import type { MediaRecorderController } from "@/types";
import { formatDuration } from "@/utils";

type TauriNotificationModule = typeof import("@tauri-apps/plugin-notification");
type TauriMacosPermissionsModule =
  typeof import("tauri-plugin-macos-permissions-api");

export const useApp = () => {
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
  >(globalThis.navigator?.mediaDevices ? "supported" : "pending");
  const [mediaSupportMessage, setMediaSupportMessage] = useState(
    globalThis.navigator?.mediaDevices
      ? ""
      : "このマシンはメディアデバイス API をサポートしていません。"
  );
  const autoStopMinutesId = useId();
  const autoStopSecondsId = useId();

  const loadTauriNotification =
    useCallback(async (): Promise<TauriNotificationModule | null> => {
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
      const navigatorAvailableInitially = Boolean(
        globalThis.navigator?.mediaDevices
      );

      if (navigatorAvailableInitially) {
        if (!disposed) {
          setMediaSupportStatus("supported");
          setMediaSupportMessage("");
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
        ((permissions as Record<string, unknown>)
          .checkScreenCapturePermission as
          | (() => Promise<boolean>)
          | undefined);
      const requestScreenPermission =
        permissions.requestScreenRecordingPermission ??
        ((permissions as Record<string, unknown>)
          .requestScreenCapturePermission as
          | (() => Promise<boolean>)
          | undefined);

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

      const navigatorAvailableAfter = Boolean(
        globalThis.navigator?.mediaDevices
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
                "・"
              )}の権限が拒否されているため、一部の録画機能を利用できません。システム設定 > プライバシーとセキュリティ から許可してください。`
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
    [loadTauriNotification]
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

        if (tauriNotificationPermission === "denied") {
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
  } as const;
};
