type RecorderStatus = "idle" | "recording" | "stopped" | "error";

export type TauriNotificationPermission = "unknown" | "granted" | "denied";

export type MediaSupportStatus = "pending" | "supported" | "unsupported";

export type MediaRecorderController = {
  status: RecorderStatus;
  error: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  isRecording: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  download: (
    defaultName?: string,
    options?: {
      timestamp?: Date;
    },
  ) => Promise<void>;
  stream: MediaStream | null;
};
