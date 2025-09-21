import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

type NotificationPayload = Parameters<typeof sendNotification>[0];

export type NotificationPermissionStatus = "unknown" | "granted" | "denied";

export const ensureNotificationPermissionStatus =
  async (): Promise<NotificationPermissionStatus> => {
    if (await isPermissionGranted()) {
      return "granted";
    }

    const permission = await requestPermission();

    if (permission === "granted") {
      return "granted";
    }

    if (permission === "denied") {
      return "denied";
    }

    return "unknown";
  };

export type SendNotificationResult =
  | { status: "sent" }
  | { status: "denied" }
  | { status: "error"; error: unknown };

export const sendNotificationIfAllowed = async (
  payload: NotificationPayload,
): Promise<SendNotificationResult> => {
  try {
    if (!(await isPermissionGranted())) {
      return { status: "denied" };
    }

    await sendNotification(payload);
    return { status: "sent" };
  } catch (error) {
    return { error, status: "error" };
  }
};
