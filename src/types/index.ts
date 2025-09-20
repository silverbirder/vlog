type RecorderStatus = "idle" | "recording" | "stopped" | "error";

export type MediaRecorderController = {
  status: RecorderStatus;
  error: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  isRecording: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  download: (defaultName?: string) => void;
  stream: MediaStream | null;
};
