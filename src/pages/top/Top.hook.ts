import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  type NotificationPermissionStatus,
  notificationPermissionStatus,
  ensureNotificationPermissionStatus,
  sendNotificationIfAllowed,
} from "@/utils";

export const useTop = () => {
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionStatus>("unknown");
  const [saveDirectory, setSaveDirectory] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const SAVE_DIR_KEY = "vlog.saveDir" as const;

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
    fetchPermissionStatus();
    initSaveDir();
  }, []);

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
  const audioStreamRef = useRef<MediaStream | null>(null);

  const screenMrRef = useRef<MediaRecorder | null>(null);
  const cameraMrRef = useRef<MediaRecorder | null>(null);
  const audioMrRef = useRef<MediaRecorder | null>(null);

  const screenQueueRef = useRef<Uint8Array[]>([]);
  const cameraQueueRef = useRef<Uint8Array[]>([]);
  const audioQueueRef = useRef<Uint8Array[]>([]);
  const processing = useRef<{ [k: string]: boolean }>({});

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

  const pickSupportedAudioMime = (): string | null => {
    const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return null;
  };

  const processQueue = async (id: "screen" | "camera" | "audio") => {
    if (processing.current[id]) return;
    processing.current[id] = true;
    try {
      const queue =
        id === "screen"
          ? screenQueueRef.current
          : id === "camera"
          ? cameraQueueRef.current
          : audioQueueRef.current;
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
      const suffix = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

      // Screen
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      screenStreamRef.current = screenStream;
      const videoMime = pickSupportedVideoMime();
      await invoke("init_recording", {
        path: saveDirectory,
        mime: videoMime,
        id: "screen",
        suffix,
      });
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

      // Camera
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
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

      // Audio
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioStreamRef.current = audioStream;
      const audioMime = pickSupportedAudioMime();
      await invoke("init_recording", {
        path: saveDirectory,
        mime: audioMime,
        id: "audio",
        suffix,
      });
      const audioMr = new MediaRecorder(
        audioStream as MediaStream,
        audioMime ? { mimeType: audioMime } : {}
      );
      audioMr.ondataavailable = async (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          const ab = await ev.data.arrayBuffer();
          audioQueueRef.current.push(new Uint8Array(ab));
          void processQueue("audio");
        }
      };
      audioMrRef.current = audioMr;

      // Start all
      screenMr.start(1000);
      cameraMr.start(1000);
      audioMr.start(1000);
      setRecording(true);
    } catch (e) {
      console.error("startAll failed", e);
      alert("開始に失敗しました。権限や環境を確認してください。");
    }
  }, [saveDirectory]);

  const stopAll = useCallback(async () => {
    try {
      screenMrRef.current?.stop();
      cameraMrRef.current?.stop();
      audioMrRef.current?.stop();

      const waitFlush = async (id: "screen" | "camera" | "audio") => {
        const queue =
          id === "screen"
            ? screenQueueRef.current
            : id === "camera"
            ? cameraQueueRef.current
            : audioQueueRef.current;
        while (processing.current[id] || queue.length > 0) {
          await new Promise((r) => setTimeout(r, 100));
        }
        await invoke("finalize_recording", { id });
      };

      await waitFlush("screen");
      await waitFlush("camera");
      await waitFlush("audio");

      for (const s of [
        screenStreamRef.current,
        cameraStreamRef.current,
        audioStreamRef.current,
      ]) {
        try {
          s?.getTracks().forEach((t) => t.stop());
        } catch {}
      }
      screenStreamRef.current = null;
      cameraStreamRef.current = null;
      audioStreamRef.current = null;
      setRecording(false);
      alert("保存が完了しました。");
    } catch (e) {
      console.error("stopAll failed", e);
      alert("停止に失敗しました");
    }
  }, []);

  return {
    notificationPermission,
    canRequest,
    requestNotificationPermission,
    sendTestNotification,
    saveDirectory,
    chooseSaveDirectory,
    recording,
    startAll,
    stopAll,
  } as const;
};
