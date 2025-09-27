import { useCallback, useEffect, useState } from "react";
import {
  type NotificationPermissionStatus,
  notificationPermissionStatus,
  ensureNotificationPermissionStatus,
  sendNotificationIfAllowed,
  mediaPermissionsStatus,
  ensureMicrophonePermissionStatus,
  ensureCameraPermissionStatus,
  ensureScreenPermissionStatus,
  type MediaPermissionStatus,
} from "@/utils";

export const useTop = () => {
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionStatus>("unknown");
  const [microphoneStatus, setMicrophoneStatus] =
    useState<MediaPermissionStatus>("denied");
  const [cameraStatus, setCameraStatus] =
    useState<MediaPermissionStatus>("denied");
  const [screenStatus, setScreenStatus] =
    useState<MediaPermissionStatus>("denied");

  useEffect(() => {
    const fetchPermissionStatus = async () => {
      const status = await notificationPermissionStatus();
      setNotificationPermission(status);
      const media = await mediaPermissionsStatus();
      setMicrophoneStatus(media.microphone);
      setCameraStatus(media.camera);
      setScreenStatus(media.screen);
    };
    fetchPermissionStatus();
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

  const requestMicrophone = useCallback(async () => {
    const s = await ensureMicrophonePermissionStatus();
    setMicrophoneStatus(s);
    return s;
  }, []);

  const requestCamera = useCallback(async () => {
    const s = await ensureCameraPermissionStatus();
    setCameraStatus(s);
    return s;
  }, []);

  const requestScreen = useCallback(async () => {
    const s = await ensureScreenPermissionStatus();
    setScreenStatus(s);
    return s;
  }, []);

  const stopStream = (stream?: MediaStream | null) => {
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
  };

  const validateMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      await sendNotificationIfAllowed({
        title: "マイク検証",
        body: "検証不可（未対応）",
      });
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      stopStream(stream);
      await sendNotificationIfAllowed({
        title: "マイク検証",
        body: "音声取得に成功しました",
      });
    } catch {
      stopStream(stream);
      await sendNotificationIfAllowed({
        title: "マイク検証",
        body: "取得に失敗しました",
      });
    }
  }, []);

  const validateCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      await sendNotificationIfAllowed({
        title: "カメラ検証",
        body: "検証不可（未対応）",
      });
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stopStream(stream);
      await sendNotificationIfAllowed({
        title: "カメラ検証",
        body: "映像取得に成功しました",
      });
    } catch {
      stopStream(stream);
      await sendNotificationIfAllowed({
        title: "カメラ検証",
        body: "取得に失敗しました",
      });
    }
  }, []);

  const validateScreen = useCallback(async () => {
    const getDisplayMedia = navigator.mediaDevices?.getDisplayMedia?.bind(
      navigator.mediaDevices
    );
    if (!getDisplayMedia) {
      await sendNotificationIfAllowed({
        title: "スクリーン検証",
        body: "検証不可（未対応）",
      });
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await getDisplayMedia({ video: true });
      stopStream(stream);
      await sendNotificationIfAllowed({
        title: "スクリーン検証",
        body: "画面取得に成功しました",
      });
    } catch {
      stopStream(stream);
      await sendNotificationIfAllowed({
        title: "スクリーン検証",
        body: "取得に失敗しました",
      });
    }
  }, []);

  return {
    notificationPermission,
    canRequest,
    requestNotificationPermission,
    sendTestNotification,
    microphoneStatus,
    cameraStatus,
    screenStatus,
    requestMicrophone,
    requestCamera,
    requestScreen,
    validateMicrophone,
    validateCamera,
    validateScreen,
  } as const;
};
