import type { ChangeEvent } from "react";
import { useCallback } from "react";
import type { UseAppReturn } from "@/App.hook";

type Props = Pick<
  UseAppReturn,
  | "setEnabledSources"
  | "setAutoStopMinutesInput"
  | "setAutoStopSecondsInput"
  | "isAnyEnabled"
  | "isAnyRecording"
  | "isStartingAll"
  | "canResetAll"
  | "hasDownloads"
  | "stopAll"
>;

type ToggleKey = keyof UseAppReturn["enabledSources"];

export const useControlPanel = ({
  setEnabledSources,
  setAutoStopMinutesInput,
  setAutoStopSecondsInput,
  isAnyEnabled,
  isAnyRecording,
  isStartingAll,
  canResetAll,
  hasDownloads,
  stopAll,
}: Props) => {
  const handleToggleSource = useCallback(
    (key: ToggleKey) => (event: ChangeEvent<HTMLInputElement>) => {
      const { checked } = event.target;
      setEnabledSources((prev) => ({
        ...prev,
        [key]: checked,
      }));
    },
    [setEnabledSources],
  );

  const handleAutoStopMinutesChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;

      if (value === "") {
        setAutoStopMinutesInput("");
        return;
      }

      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        return;
      }

      const normalized = Math.max(0, Math.floor(numeric));
      setAutoStopMinutesInput(String(normalized));
    },
    [setAutoStopMinutesInput],
  );

  const handleAutoStopSecondsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;

      if (value === "") {
        setAutoStopSecondsInput("");
        return;
      }

      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        return;
      }

      const clamped = Math.min(59, Math.max(0, Math.floor(numeric)));
      setAutoStopSecondsInput(String(clamped));
    },
    [setAutoStopSecondsInput],
  );

  const handleStopAll = useCallback(() => {
    stopAll();
  }, [stopAll]);

  const startDisabled = !isAnyEnabled || isAnyRecording || isStartingAll;
  const stopDisabled = !isAnyRecording;
  const resetDisabled = isAnyRecording || !canResetAll;
  const downloadDisabled = !hasDownloads;

  return {
    downloadDisabled,
    handleAutoStopMinutesChange,
    handleAutoStopSecondsChange,
    handleStopAll,
    handleToggleSource,
    resetDisabled,
    startDisabled,
    stopDisabled,
  } as const;
};
