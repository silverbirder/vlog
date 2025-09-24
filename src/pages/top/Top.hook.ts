import { useEffect, useState } from "react";
import {
  type NotificationPermissionStatus,
  notificationPermissionStatus,
} from "@/utils";

export const useTop = () => {
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>("unknown");

  useEffect(() => {
    const fetchPermissionStatus = async () => {
      const status = await notificationPermissionStatus();
      setPermissionStatus(status);
    };
    fetchPermissionStatus();
  }, []);

  return { permissionStatus } as const;
};
