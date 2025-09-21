import { useCallback, useMemo } from "react";
import type { MediaRecorderController } from "@/types";

type Props = {
  controller: MediaRecorderController;
  onDownload?: () => Promise<void> | void;
};

export const useRecorderCard = ({ controller, onDownload }: Props) => {
  const { status, download } = controller;
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
      void onDownload();
    } else {
      void download();
    }
  }, [download, onDownload]);

  return {
    handleDownload,
    statusLabel,
  } as const;
};
