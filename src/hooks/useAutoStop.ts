import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type AutoStopHandler = (durationSeconds: number) => void;

const normalizePositiveSeconds = (value: number): number | null => {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
};

export const useAutoStop = () => {
  const autoStopMinutesId = useId();
  const autoStopSecondsId = useId();
  const [autoStopMinutesInput, setAutoStopMinutesInput] = useState("15");
  const [autoStopSecondsInput, setAutoStopSecondsInput] = useState("0");
  const [autoStopDeadline, setAutoStopDeadline] = useState<Date | null>(null);
  const [autoStopMessage, setAutoStopMessage] = useState<string | null>(null);
  const [scheduledAutoStopSecondsState, setScheduledAutoStopSecondsState] =
    useState<number | null>(null);

  const autoStopDurationSeconds = useMemo(() => {
    const minutesRaw = Number(autoStopMinutesInput);
    const secondsRaw = Number(autoStopSecondsInput);

    if (
      Number.isNaN(minutesRaw) ||
      minutesRaw < 0 ||
      !Number.isFinite(minutesRaw) ||
      Number.isNaN(secondsRaw) ||
      secondsRaw < 0 ||
      !Number.isFinite(secondsRaw)
    ) {
      return null;
    }

    const minutes = Math.floor(minutesRaw);
    const seconds = Math.floor(secondsRaw);

    if (seconds >= 60) {
      return normalizePositiveSeconds(minutes * 60 + 59);
    }

    return normalizePositiveSeconds(minutes * 60 + seconds);
  }, [autoStopMinutesInput, autoStopSecondsInput]);

  const scheduledAutoStopSeconds = useMemo(() => {
    return scheduledAutoStopSecondsState ?? autoStopDurationSeconds ?? null;
  }, [scheduledAutoStopSecondsState, autoStopDurationSeconds]);

  const clearAutoStop = useCallback(() => {
    setAutoStopDeadline(null);
    setScheduledAutoStopSecondsState(null);
  }, []);

  const scheduleAutoStop = useCallback(
    (durationSeconds: number) => {
      const normalized = normalizePositiveSeconds(durationSeconds);
      if (normalized === null) {
        clearAutoStop();
        return;
      }

      setScheduledAutoStopSecondsState(normalized);
      setAutoStopDeadline(new Date(Date.now() + normalized * 1000));
    },
    [clearAutoStop],
  );

  const handlerRef = useRef<AutoStopHandler | null>(null);

  const setAutoStopHandler = useCallback((handler: AutoStopHandler | null) => {
    handlerRef.current = handler;
  }, []);

  useEffect(() => {
    if (!autoStopDeadline || scheduledAutoStopSecondsState === null) {
      return;
    }

    const remaining = autoStopDeadline.getTime() - Date.now();

    if (remaining <= 0) {
      handlerRef.current?.(scheduledAutoStopSecondsState);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handlerRef.current?.(scheduledAutoStopSecondsState);
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoStopDeadline, scheduledAutoStopSecondsState]);

  useEffect(() => {
    return () => {
      handlerRef.current = null;
    };
  }, []);

  return {
    autoStopDeadline,
    autoStopDurationSeconds,
    autoStopMessage,
    autoStopMinutesId,
    autoStopMinutesInput,
    autoStopSecondsId,
    autoStopSecondsInput,
    clearAutoStop,
    scheduleAutoStop,
    scheduledAutoStopSeconds,
    scheduledAutoStopSecondsState,
    setAutoStopHandler,
    setAutoStopMessage,
    setAutoStopMinutesInput,
    setAutoStopSecondsInput,
  } as const;
};

export type UseAutoStopReturn = ReturnType<typeof useAutoStop>;
