import { useCallback, useEffect, useState } from "react";
import {
  type NotificationPermissionStatus,
  notificationPermissionStatus,
  ensureNotificationPermissionStatus,
  sendNotificationIfAllowed,
} from "@/utils";

export const useTop = () => {
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionStatus>("unknown");

  useEffect(() => {
    const fetchPermissionStatus = async () => {
      const status = await notificationPermissionStatus();
      setNotificationPermission(status);
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

  return { notificationPermission, canRequest, requestNotificationPermission, sendTestNotification } as const;
};
