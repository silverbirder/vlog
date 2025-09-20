import { useCallback, useMemo } from "react";
import type { MediaRecorderController } from "@/types";

type Props = {
  controller: MediaRecorderController;
  onDownload?: () => void;
  onReset?: () => void;
};

export const useRecorderCard = ({ controller, onDownload, onReset }: Props) => {
  const { status, mediaUrl, download, reset, isRecording } = controller;
  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
        return "待機中";
      case "recording":
        return "録画中";
      case "stopped":
        return "完了";
      case "error":
        return "エラー";
      default:
        return status;
    }
  }, [status]);

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
    } else {
      download();
    }
  }, [download, onDownload]);

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    } else {
      reset();
    }
  }, [onReset, reset]);

  const canReset =
    !isRecording &&
    (mediaUrl !== null || status === "error" || status === "stopped");

  return {
    canReset,
    handleDownload,
    handleReset,
    statusLabel,
  } as const;
};
