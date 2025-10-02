import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import {
  type NotificationPermissionStatus,
  notificationPermissionStatus,
  ensureNotificationPermissionStatus,
  sendNotificationIfAllowed,
  ensureMacosMediaPermissions,
} from "@/utils";

export const useTop = () => {
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionStatus>("unknown");
  const [saveDirectory, setSaveDirectory] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [autoMinutes, setAutoMinutes] = useState<number>(15);
  const [autoSeconds, setAutoSeconds] = useState<number>(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const AUTO_CONTINUE_KEY = "vlog.autoContinue" as const;
  const [autoContinue, setAutoContinueState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_CONTINUE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>(
    []
  );
  const [selectedCameraId, setSelectedCameraId] = useState<string | "default">(
    "default"
  );
  const [selectedMicId, setSelectedMicId] = useState<string | "default">(
    "default"
  );

  const SAVE_DIR_KEY = "vlog.saveDir" as const;
  const CAMERA_ID_KEY = "vlog.cameraId" as const;
  const MIC_ID_KEY = "vlog.micId" as const;
  const PIP_ENABLED_KEY = "vlog.pipEnabled" as const;
  const [pipEnabled, setPipEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PIP_ENABLED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [pipActive, setPipActiveState] = useState(false);
  const pipWindowStateRef = useRef<{
    size: { width: number; height: number };
    position: { x: number; y: number };
    decorations: boolean;
    alwaysOnTop: boolean;
  } | null>(null);
  const pipActiveRef = useRef(false);
  const appWindowRef = useRef(getCurrentWindow());
  const recordingRef = useRef(recording);
  const pipTransitionTokenRef = useRef(0);

  const handlePipPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const appWindow = appWindowRef.current;
      if (!appWindow) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-no-drag]")) return;
      event.preventDefault();
      appWindow
        .startDragging()
        .catch((error) => console.warn("startDragging failed", error));
    },
    []
  );

  useEffect(() => {
    const fetchPermissionStatus = async () => {
      const status = await notificationPermissionStatus();
      setNotificationPermission(status);
    };
    const initSaveDir = async () => {
      try {
        const stored = localStorage.getItem(SAVE_DIR_KEY);
        if (stored && stored.length > 0) {
          setSaveDirectory(stored);
          return;
        }
        const desktop = (await invoke<string>("get_desktop_path")) ?? null;
        if (desktop) {
          setSaveDirectory(desktop);
          localStorage.setItem(SAVE_DIR_KEY, desktop);
        }
      } catch {}
    };
    const initSelectedDevices = () => {
      try {
        const cam = localStorage.getItem(CAMERA_ID_KEY);
        if (cam && cam !== "default" && cam.length > 0) {
          setSelectedCameraId(cam as string);
        } else {
          setSelectedCameraId("default");
          localStorage.setItem(CAMERA_ID_KEY, "default");
        }
        const mic = localStorage.getItem(MIC_ID_KEY);
        if (mic && mic !== "default" && mic.length > 0) {
          setSelectedMicId(mic as string);
        } else {
          setSelectedMicId("default");
          localStorage.setItem(MIC_ID_KEY, "default");
        }
      } catch {
        setSelectedCameraId("default");
        setSelectedMicId("default");
      }
    };
    fetchPermissionStatus();
    initSaveDir();
    initSelectedDevices();
  }, []);

  const refreshDevices = useCallback(async (requestAccess = false) => {
    try {
      if (requestAccess) {
        try {
          await ensureMacosMediaPermissions();
        } catch {}
        try {
          const tmp = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          tmp.getTracks().forEach((t) => t.stop());
        } catch (e) {
          console.warn("temporary getUserMedia failed", e);
        }
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameraDevices(devices.filter((d) => d.kind === "videoinput"));
      setMicrophoneDevices(devices.filter((d) => d.kind === "audioinput"));
    } catch (e) {
      console.warn("enumerateDevices failed", e);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
    };
  }, [refreshDevices]);

  useEffect(() => {
    if (
      selectedCameraId !== "default" &&
      !cameraDevices.some((d) => d.deviceId === selectedCameraId)
    ) {
      setSelectedCameraId("default");
    }
    if (
      selectedMicId !== "default" &&
      !microphoneDevices.some((d) => d.deviceId === selectedMicId)
    ) {
      setSelectedMicId("default");
    }
  }, [cameraDevices, microphoneDevices]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const requestNotificationPermission = useCallback(async () => {
    const status = await ensureNotificationPermissionStatus();
    setNotificationPermission(status);
    return status;
  }, []);

  const canRequest = notificationPermission !== "granted";

  const sendTestNotification = useCallback(async () => {
    await sendNotificationIfAllowed({
      title: "テスト通知",
      body: "これはテスト通知です。",
    });
  }, []);

  const chooseSaveDirectory = useCallback(async () => {
    try {
      const dir = await open({ directory: true });
      if (!dir) return null;
      const selected = Array.isArray(dir) ? dir[0] : dir;
      setSaveDirectory(selected);
      localStorage.setItem(SAVE_DIR_KEY, selected);
      return selected;
    } catch {
      return null;
    }
  }, []);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenMrRef = useRef<MediaRecorder | null>(null);
  const cameraMrRef = useRef<MediaRecorder | null>(null);
  const chunkQueueRef = useRef<{
    screen: Array<{ data: Uint8Array; writerId: string }>;
    camera: Array<{ data: Uint8Array; writerId: string }>;
  }>({ screen: [], camera: [] });
  const queueProcessingRef = useRef<{ screen: boolean; camera: boolean }>({
    screen: false,
    camera: false,
  });
  const processingWriterRef = useRef<{
    screen: string | null;
    camera: string | null;
  }>({ screen: null, camera: null });
  const writerIdRef = useRef<{ screen: string | null; camera: string | null }>({
    screen: null,
    camera: null,
  });
  const sessionCounterRef = useRef<{ screen: number; camera: number }>({
    screen: 0,
    camera: 0,
  });
  const autoStopTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const autoStopAtRef = useRef<number | null>(null);
  const autoContinueRef = useRef<boolean>(autoContinue);
  const onAutoStopRef = useRef<() => void>(() => {});

  const pickSupportedVideoMime = (): string | null => {
    const candidates = [
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=h264",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return null;
  };

  const processQueue = useCallback(async (id: "screen" | "camera") => {
    if (queueProcessingRef.current[id]) return;
    queueProcessingRef.current[id] = true;
    try {
      const queue = chunkQueueRef.current[id];
      while (queue.length > 0) {
        const chunk = queue.shift();
        if (!chunk) continue;
        processingWriterRef.current[id] = chunk.writerId;
        try {
          await invoke("append_chunk", {
            data: Array.from(chunk.data),
            id: chunk.writerId,
          });
        } catch (e) {
          console.error(`append_chunk failed (${id})`, e);
        } finally {
          processingWriterRef.current[id] = null;
        }
      }
    } finally {
      queueProcessingRef.current[id] = false;
      processingWriterRef.current[id] = null;
    }
  }, []);

  const waitForFlush = useCallback(
    async (id: "screen" | "camera", writerId: string | null) => {
      if (!writerId) return;
      const queue = chunkQueueRef.current[id];
      const hasPending = () =>
        processingWriterRef.current[id] === writerId ||
        queue.some((chunk) => chunk.writerId === writerId);
      while (hasPending()) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await invoke("finalize_recording", { id: writerId });
    },
    []
  );

  const generateSuffix = useCallback(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }, []);

  const calcDurationMs = useCallback(() => {
    const mins =
      Number.isFinite(autoMinutes) && autoMinutes >= 0 ? autoMinutes : 15;
    const secs =
      Number.isFinite(autoSeconds) && autoSeconds >= 0 ? autoSeconds : 0;
    const totalMs = (mins * 60 + secs) * 1000;
    return totalMs > 0 ? totalMs : 15 * 60 * 1000;
  }, [autoMinutes, autoSeconds]);

  const scheduleAutoStop = useCallback((durationMs: number) => {
    const endAt = Date.now() + durationMs;
    autoStopAtRef.current = endAt;
    setRemainingMs(durationMs);
    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
    }
    autoStopTimeoutRef.current = window.setTimeout(() => {
      onAutoStopRef.current();
    }, durationMs);
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
    }
    countdownIntervalRef.current = window.setInterval(() => {
      const nowTs = Date.now();
      const rem = Math.max(0, endAt - nowTs);
      setRemainingMs(rem);
    }, 250);
  }, []);

  const setAutoContinue = useCallback((value: boolean) => {
    autoContinueRef.current = value;
    setAutoContinueState(value);
    try {
      localStorage.setItem(AUTO_CONTINUE_KEY, value ? "true" : "false");
    } catch {}
  }, []);

  const setPipEnabled = useCallback((value: boolean) => {
    setPipEnabledState(value);
    try {
      localStorage.setItem(PIP_ENABLED_KEY, value ? "true" : "false");
    } catch {}
  }, []);

  const captureWindowState = useCallback(async () => {
    const appWindow = appWindowRef.current;
    try {
      const [position, size, decorations, alwaysOnTop, scaleFactor] =
        await Promise.all([
          appWindow.outerPosition(),
          appWindow.innerSize(),
          appWindow.isDecorated(),
          appWindow.isAlwaysOnTop(),
          appWindow.scaleFactor(),
        ]);
      pipWindowStateRef.current = {
        position: {
          x: position.x / scaleFactor,
          y: position.y / scaleFactor,
        },
        size: {
          width: size.width / scaleFactor,
          height: size.height / scaleFactor,
        },
        decorations,
        alwaysOnTop,
      };
    } catch (error) {
      console.warn("captureWindowState failed", error);
      pipWindowStateRef.current = null;
    }
  }, []);

  const enterPipMode = useCallback(async () => {
    if (!pipEnabled || pipActiveRef.current) return;
    if (typeof window === "undefined") return;
    if (!recordingRef.current) return;
    const token = (pipTransitionTokenRef.current += 1);
    const appWindow = appWindowRef.current;
    try {
      if (!pipWindowStateRef.current) {
        await captureWindowState();
      }
      if (!pipWindowStateRef.current) return;

      const pipWidth = 360;
      const pipHeight = 202;
      const margin = 16;

      const screenObj = window.screen as Screen & {
        availLeft?: number;
        availTop?: number;
      };
      const availWidth = screenObj?.availWidth ?? window.innerWidth;
      const availHeight = screenObj?.availHeight ?? window.innerHeight;
      const availLeft =
        typeof screenObj?.availLeft === "number" ? screenObj.availLeft : 0;
      const availTop =
        typeof screenObj?.availTop === "number" ? screenObj.availTop : 0;

      const targetX = availLeft + availWidth - pipWidth - margin;
      const targetY = availTop + availHeight - pipHeight - margin;

      await appWindow.setDecorations(false);
      await appWindow.setAlwaysOnTop(true);
      await appWindow.setSize(new LogicalSize(pipWidth, pipHeight));
      await appWindow.setPosition(
        new LogicalPosition(
          Math.max(margin, targetX),
          Math.max(margin, targetY)
        )
      );

      if (
        pipTransitionTokenRef.current !== token ||
        !recordingRef.current ||
        !pipWindowStateRef.current
      ) {
        return;
      }

      pipActiveRef.current = true;
      setPipActiveState(true);
    } catch (error) {
      console.error("enterPipMode failed", error);
      pipActiveRef.current = false;
      pipWindowStateRef.current = null;
      try {
        await appWindow.setAlwaysOnTop(false);
      } catch {}
      try {
        await appWindow.setDecorations(true);
      } catch {}
    }
  }, [captureWindowState, pipEnabled]);

  const exitPipMode = useCallback(async () => {
    pipTransitionTokenRef.current += 1;
    if (!pipActiveRef.current && !pipWindowStateRef.current) return;
    const appWindow = appWindowRef.current;
    const original = pipWindowStateRef.current;
    pipActiveRef.current = false;
    setPipActiveState(false);
    try {
      if (original) {
        try {
          await appWindow.setDecorations(original.decorations);
        } catch {}
        try {
          await appWindow.setSize(
            new LogicalSize(original.size.width, original.size.height)
          );
        } catch {}
        try {
          await appWindow.setPosition(
            new LogicalPosition(original.position.x, original.position.y)
          );
        } catch {}
        try {
          await appWindow.setAlwaysOnTop(original.alwaysOnTop);
        } catch {}
      } else {
        try {
          await appWindow.setDecorations(true);
        } catch {}
        try {
          await appWindow.setAlwaysOnTop(false);
        } catch {}
      }
    } catch (error) {
      console.error("exitPipMode failed", error);
    } finally {
      pipWindowStateRef.current = null;
    }
  }, []);

  const startRecorder = useCallback(
    async (
      id: "screen" | "camera",
      stream: MediaStream,
      videoMime: string | null,
      suffix: string
    ) => {
      if (!saveDirectory) throw new Error("保存先が設定されていません");
      sessionCounterRef.current[id] += 1;
      const writerId = `${id}-${suffix}-${sessionCounterRef.current[id]}`;
      writerIdRef.current[id] = writerId;
      await invoke("init_recording", {
        path: saveDirectory,
        mime: videoMime,
        id: writerId,
        suffix,
      });
      const recorder = new MediaRecorder(
        stream,
        videoMime ? { mimeType: videoMime } : {}
      );
      recorder.ondataavailable = async (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          const ab = await ev.data.arrayBuffer();
          const queue = chunkQueueRef.current[id];
          const activeWriterId = writerIdRef.current[id] ?? writerId;
          queue.push({ data: new Uint8Array(ab), writerId: activeWriterId });
          void processQueue(id);
        }
      };
      if (id === "screen") {
        screenMrRef.current = recorder;
      } else {
        cameraMrRef.current = recorder;
      }
      recorder.start(1000);
    },
    [processQueue, saveDirectory]
  );

  const stopAll = useCallback(
    async (
      reason: "manual" | "auto" = "manual",
      options?: { suppressAlert?: boolean }
    ) => {
      try {
        const currentScreenWriter = writerIdRef.current.screen;
        const currentCameraWriter = writerIdRef.current.camera;

        screenMrRef.current?.stop();
        cameraMrRef.current?.stop();

        if (autoStopTimeoutRef.current) {
          window.clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        await waitForFlush("screen", currentScreenWriter ?? null);
        await waitForFlush("camera", currentCameraWriter ?? null);

        writerIdRef.current.screen = null;
        writerIdRef.current.camera = null;
        chunkQueueRef.current.screen = [];
        chunkQueueRef.current.camera = [];

        for (const s of [screenStreamRef.current, cameraStreamRef.current]) {
          try {
            s?.getTracks().forEach((t) => t.stop());
          } catch {}
        }
        screenStreamRef.current = null;
        cameraStreamRef.current = null;
        screenMrRef.current = null;
        cameraMrRef.current = null;
        autoStopAtRef.current = null;
        setRecording(false);
        setRemainingMs(null);
        if (!options?.suppressAlert) {
          alert("保存が完了しました。");
        }
        if (reason === "auto") {
          void sendNotificationIfAllowed({
            title: "録画を自動停止しました",
            body: "設定した時間に達したため、録画を自動停止しました。",
          });
        }
      } catch (e) {
        console.error("stopAll failed", e);
        if (!options?.suppressAlert) {
          alert("停止に失敗しました");
        }
      } finally {
        await exitPipMode();
      }
    },
    [exitPipMode, sendNotificationIfAllowed, waitForFlush]
  );

  const rotateRecording = useCallback(async () => {
    try {
      const screenStream = screenStreamRef.current;
      const cameraStream = cameraStreamRef.current;
      const screenMr = screenMrRef.current;
      const cameraMr = cameraMrRef.current;
      if (!screenStream || !cameraStream || !screenMr || !cameraMr) {
        await stopAll("auto", { suppressAlert: true });
        return;
      }

      const previousScreenWriter = writerIdRef.current.screen;
      const previousCameraWriter = writerIdRef.current.camera;

      if (autoStopTimeoutRef.current) {
        window.clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      const waitForStop = (recorder: MediaRecorder | null) =>
        new Promise<void>((resolve) => {
          if (!recorder || recorder.state === "inactive") {
            resolve();
            return;
          }
          const handleStop = () => {
            recorder.removeEventListener("stop", handleStop);
            resolve();
          };
          recorder.addEventListener("stop", handleStop, { once: true });
          recorder.stop();
        });

      await Promise.all([waitForStop(screenMr), waitForStop(cameraMr)]);

      const videoMime = pickSupportedVideoMime();
      const suffix = generateSuffix();

      await startRecorder("camera", cameraStream, videoMime, suffix);
      await startRecorder("screen", screenStream, videoMime, suffix);

      const durationMs = calcDurationMs();
      scheduleAutoStop(durationMs);

      await Promise.all([
        waitForFlush("screen", previousScreenWriter ?? null),
        waitForFlush("camera", previousCameraWriter ?? null),
      ]);

      void sendNotificationIfAllowed({
        title: "録画を自動保存しました",
        body: "設定時間に達したため保存し、録画を継続しています。",
      });
    } catch (e) {
      console.error("rotateRecording failed", e);
      alert("録画の継続に失敗したため、録画を停止しました。");
      await stopAll("manual", { suppressAlert: true });
    }
  }, [
    calcDurationMs,
    generateSuffix,
    scheduleAutoStop,
    startRecorder,
    stopAll,
    waitForFlush,
    sendNotificationIfAllowed,
  ]);

  useEffect(() => {
    onAutoStopRef.current = () => {
      if (autoContinueRef.current) {
        void rotateRecording();
      } else {
        void stopAll("auto");
      }
    };
  }, [rotateRecording, stopAll]);

  const startAll = useCallback(async () => {
    let screenStream: MediaStream | null = null;
    let cameraStream: MediaStream | null = null;
    try {
      if (!saveDirectory) {
        alert("保存先を設定してください。");
        return;
      }
      if (!pipWindowStateRef.current) {
        await captureWindowState();
      }
      chunkQueueRef.current.screen = [];
      chunkQueueRef.current.camera = [];
      writerIdRef.current.screen = null;
      writerIdRef.current.camera = null;
      const videoMime = pickSupportedVideoMime();

      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const cameraConstraints: MediaStreamConstraints = {
        video:
          selectedCameraId && selectedCameraId !== "default"
            ? { deviceId: { exact: selectedCameraId } }
            : true,
        audio:
          selectedMicId && selectedMicId !== "default"
            ? { deviceId: { exact: selectedMicId } }
            : true,
      };
      cameraStream = await navigator.mediaDevices.getUserMedia(
        cameraConstraints
      );

      cameraStreamRef.current = cameraStream;
      screenStreamRef.current = screenStream;

      if (screenStream) {
        const targetScreen = screenStream;
        try {
          const hasScreenAudio = targetScreen.getAudioTracks().length > 0;
          if (!hasScreenAudio) {
            cameraStream.getAudioTracks().forEach((t) => {
              try {
                targetScreen.addTrack(t.clone());
              } catch {
                targetScreen.addTrack(t);
              }
            });
          }
        } catch (e) {
          console.warn("Failed to attach mic audio to screen stream", e);
        }
      }

      const suffix = generateSuffix();

      await startRecorder("camera", cameraStream, videoMime, suffix);
      await startRecorder("screen", screenStream, videoMime, suffix);

      setRecording(true);

      if (pipEnabled) {
        await enterPipMode();
      } else {
        await exitPipMode();
      }

      const durationMs = calcDurationMs();
      scheduleAutoStop(durationMs);
    } catch (e) {
      console.error("startAll failed", e);
      screenStream?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      cameraStream?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      screenStreamRef.current = null;
      cameraStreamRef.current = null;
      screenMrRef.current = null;
      cameraMrRef.current = null;
      alert("開始に失敗しました。権限や環境を確認してください。");
    }
  }, [
    calcDurationMs,
    captureWindowState,
    enterPipMode,
    exitPipMode,
    generateSuffix,
    pipEnabled,
    saveDirectory,
    scheduleAutoStop,
    selectedCameraId,
    selectedMicId,
    startRecorder,
  ]);

  // Live preview attachers (used as callback refs in JSX)
  const attachScreenRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return;
      el.srcObject = recording ? screenStreamRef.current : null;
      if (recording && el.srcObject) void el.play().catch(() => {});
    },
    [recording]
  );

  const attachCameraRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return;
      el.srcObject = recording ? cameraStreamRef.current : null;
      if (recording && el.srcObject) void el.play().catch(() => {});
    },
    [recording]
  );

  useEffect(() => {
    if (!recording) {
      void exitPipMode();
      return;
    }
    if (pipEnabled) {
      void enterPipMode();
    } else {
      void exitPipMode();
    }
  }, [enterPipMode, exitPipMode, pipEnabled, recording]);

  useEffect(() => {
    return () => {
      void exitPipMode();
    };
  }, [exitPipMode]);

  return {
    notificationPermission,
    canRequest,
    requestNotificationPermission,
    sendTestNotification,
    saveDirectory,
    chooseSaveDirectory,
    recording,
    cameraDevices,
    microphoneDevices,
    selectedCameraId,
    setSelectedCameraId: (id: string | "default") => {
      setSelectedCameraId(id);
      try {
        if (id === "default") localStorage.removeItem(CAMERA_ID_KEY);
        else localStorage.setItem(CAMERA_ID_KEY, id);
      } catch {}
    },
    selectedMicId,
    setSelectedMicId: (id: string | "default") => {
      setSelectedMicId(id);
      try {
        if (id === "default") localStorage.removeItem(MIC_ID_KEY);
        else localStorage.setItem(MIC_ID_KEY, id);
      } catch {}
    },
    refreshDevices,
    autoMinutes,
    autoSeconds,
    autoContinue,
    setAutoMinutes,
    setAutoSeconds,
    setAutoContinue,
    remainingMs,
    pipEnabled,
    setPipEnabled,
    pipActive,
    handlePipPointerDown,
    attachScreenRef,
    attachCameraRef,
    startAll,
    stopAll,
  } as const;
};
