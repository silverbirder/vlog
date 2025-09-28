import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
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
  const [monitorAudio, setMonitorAudio] = useState(false);
  const [autoMinutes, setAutoMinutes] = useState<number>(15);
  const [autoSeconds, setAutoSeconds] = useState<number>(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
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
  const screenQueueRef = useRef<Uint8Array[]>([]);
  const cameraQueueRef = useRef<Uint8Array[]>([]);
  const processing = useRef<{ [k: string]: boolean }>({});
  const autoStopTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const autoStopAtRef = useRef<number | null>(null);

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

  const processQueue = async (id: "screen" | "camera") => {
    if (processing.current[id]) return;
    processing.current[id] = true;
    try {
      const queue = id === "screen" ? screenQueueRef.current : cameraQueueRef.current;
      while (queue.length > 0) {
        const chunk = queue.shift();
        if (!chunk) continue;
        try {
          await invoke("append_chunk", { data: Array.from(chunk), id });
        } catch (e) {
          console.error(`append_chunk failed (${id})`, e);
        }
      }
    } finally {
      processing.current[id] = false;
    }
  };

  const startAll = useCallback(async () => {
    try {
      if (!saveDirectory) {
        alert("保存先を設定してください。");
        return;
      }
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const suffix = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
        now.getDate()
      )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(
        now.getSeconds()
      )}`;
      const videoMime = pickSupportedVideoMime();

      // Pre Screen
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Camera
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
      const cameraStream = await navigator.mediaDevices.getUserMedia(
        cameraConstraints
      );
      cameraStreamRef.current = cameraStream;
      await invoke("init_recording", {
        path: saveDirectory,
        mime: videoMime,
        id: "camera",
        suffix,
      });
      const cameraMr = new MediaRecorder(
        cameraStream,
        videoMime ? { mimeType: videoMime } : {}
      );
      cameraMr.ondataavailable = async (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          const ab = await ev.data.arrayBuffer();
          cameraQueueRef.current.push(new Uint8Array(ab));
          void processQueue("camera");
        }
      };
      cameraMrRef.current = cameraMr;

      // Screen with Audio
      try {
        const hasScreenAudio = screenStream.getAudioTracks().length > 0;
        if (!hasScreenAudio) {
          cameraStream.getAudioTracks().forEach((t) => {
            try {
              screenStream.addTrack(t.clone());
            } catch {
              screenStream.addTrack(t);
            }
          });
        }
      } catch (e) {
        console.warn("Failed to attach mic audio to screen stream", e);
      }

      // Post Screen
      await invoke("init_recording", {
        path: saveDirectory,
        mime: videoMime,
        id: "screen",
        suffix,
      });
      screenStreamRef.current = screenStream;
      const screenMr = new MediaRecorder(
        screenStream,
        videoMime ? { mimeType: videoMime } : {}
      );
      screenMr.ondataavailable = async (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          const ab = await ev.data.arrayBuffer();
          screenQueueRef.current.push(new Uint8Array(ab));
          void processQueue("screen");
        }
      };
      screenMrRef.current = screenMr;

      // Start all
      screenMr.start(1000);
      cameraMr.start(1000);
      setRecording(true);

      const mins =
        Number.isFinite(autoMinutes) && autoMinutes >= 0 ? autoMinutes : 15;
      const secs =
        Number.isFinite(autoSeconds) && autoSeconds >= 0 ? autoSeconds : 0;
      const totalMs = (mins * 60 + secs) * 1000;
      const durationMs = totalMs > 0 ? totalMs : 15 * 60 * 1000;

      const endAt = Date.now() + durationMs;
      autoStopAtRef.current = endAt;
      setRemainingMs(durationMs);

      if (autoStopTimeoutRef.current)
        window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = window.setTimeout(() => {
        void stopAll("auto");
      }, durationMs);

      if (countdownIntervalRef.current)
        window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const rem = Math.max(0, endAt - now);
        setRemainingMs(rem);
      }, 250);
    } catch (e) {
      console.error("startAll failed", e);
      alert("開始に失敗しました。権限や環境を確認してください。");
    }
  }, [
    saveDirectory,
    autoMinutes,
    autoSeconds,
    selectedCameraId,
    selectedMicId,
  ]);

  const stopAll = useCallback(async (reason: "manual" | "auto" = "manual") => {
    try {
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

      const waitFlush = async (id: "screen" | "camera") => {
        const queue = id === "screen" ? screenQueueRef.current : cameraQueueRef.current;
        while (processing.current[id] || queue.length > 0) {
          await new Promise((r) => setTimeout(r, 100));
        }
        await invoke("finalize_recording", { id });
      };

      await waitFlush("screen");
      await waitFlush("camera");

      for (const s of [screenStreamRef.current, cameraStreamRef.current]) {
        try {
          s?.getTracks().forEach((t) => t.stop());
        } catch {}
      }
      screenStreamRef.current = null;
      cameraStreamRef.current = null;
      setRecording(false);
      setRemainingMs(null);
      alert("保存が完了しました。");
      if (reason === "auto") {
        void sendNotificationIfAllowed({
          title: "録画を自動停止しました",
          body: "設定した時間に達したため、録画を自動停止しました。",
        });
      }
    } catch (e) {
      console.error("stopAll failed", e);
      alert("停止に失敗しました");
    }
  }, []);

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

  const attachAudioRef = useCallback(
    (el: HTMLAudioElement | null) => {
      if (!el) return;
      el.srcObject = recording ? cameraStreamRef.current : null;
      el.muted = !monitorAudio;
      if (recording && el.srcObject && monitorAudio)
        void el.play().catch(() => {});
    },
    [recording, monitorAudio]
  );

  return {
    notificationPermission,
    canRequest,
    requestNotificationPermission,
    sendTestNotification,
    saveDirectory,
    chooseSaveDirectory,
    recording,
    monitorAudio,
    setMonitorAudio,
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
    setAutoMinutes,
    setAutoSeconds,
    remainingMs,
    attachScreenRef,
    attachCameraRef,
    attachAudioRef,
    startAll,
    stopAll,
  } as const;
};
