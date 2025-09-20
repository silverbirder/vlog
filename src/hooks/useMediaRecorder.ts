import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaRecorderController } from "@/types";

type RecorderStatus = "idle" | "recording" | "stopped" | "error";

type MimeKind = "video" | "audio";

type GetStream = () => Promise<MediaStream>;

const VIDEO_MIME_CANDIDATES = [
  "video/mp4;codecs=h264,aac",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

const AUDIO_MIME_CANDIDATES = [
  "audio/mpeg",
  "audio/mp4;codecs=aac",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

function pickSupportedMime(kind: MimeKind): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  const candidates =
    kind === "video" ? VIDEO_MIME_CANDIDATES : AUDIO_MIME_CANDIDATES;

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return null;
}

export function useMediaRecorder(
  getStream: GetStream,
  kind: MimeKind,
): MediaRecorderController {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string | null>(pickSupportedMime(kind));

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const revokeUrl = useCallback(() => {
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }
  }, [mediaUrl]);

  useEffect(
    () => () => {
      revokeUrl();
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    },
    [revokeUrl],
  );

  const start = useCallback(async () => {
    if (status === "recording") {
      return;
    }

    revokeUrl();
    setMediaUrl(null);
    setError(null);

    try {
      const streamResult = await getStream();
      streamRef.current = streamResult;
      setStream(streamResult);

      const options: MediaRecorderOptions = {};
      if (mimeRef.current) {
        options.mimeType = mimeRef.current;
      }

      const recorder = new MediaRecorder(streamResult, options);
      mimeRef.current =
        recorder.mimeType || options.mimeType || mimeRef.current;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        const message = event.error?.message ?? "Recording error";
        setError(message);
        setStatus("error");
      };

      streamResult.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (
            recorderRef.current &&
            recorderRef.current.state === "recording"
          ) {
            recorderRef.current.stop();
          }
        });
      });

      recorder.onstop = () => {
        const resolvedMime =
          recorder.mimeType ||
          mimeRef.current ||
          (kind === "audio" ? "audio/mpeg" : "video/mp4");
        mimeRef.current = resolvedMime;
        const blob = new Blob(chunksRef.current, {
          type: resolvedMime,
        });
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        setStatus((prev) => (prev === "error" ? prev : "stopped"));
        setStream(null);

        streamRef.current?.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
    }
  }, [getStream, kind, revokeUrl, status]);

  const stop = useCallback(() => {
    if (recorderRef.current && status === "recording") {
      recorderRef.current.stop();
    }
  }, [status]);

  const reset = useCallback(() => {
    stop();
    revokeUrl();
    setMediaUrl(null);
    setStatus("idle");
    setError(null);
  }, [revokeUrl, stop]);

  const download = useCallback(
    (
      defaultName = kind === "audio" ? "audio-recording" : "video-recording",
    ) => {
      if (!mediaUrl) {
        return;
      }
      const a = document.createElement("a");
      a.href = mediaUrl;
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
        now.getHours(),
      ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
        now.getSeconds(),
      ).padStart(2, "0")}`;
      const resolvedMime =
        mimeRef.current ??
        recorderRef.current?.mimeType ??
        (kind === "audio" ? "audio/mpeg" : "video/mp4");

      let extension = kind === "audio" ? "mp3" : "mp4";
      const subtype = resolvedMime.split("/")[1]?.split(";")[0] ?? null;

      if (kind === "video") {
        if (!resolvedMime.includes("mp4")) {
          extension = subtype ?? "webm";
        }
      } else {
        if (resolvedMime.includes("mpeg")) {
          extension = "mp3";
        } else if (resolvedMime.includes("mp4")) {
          extension = "m4a";
        } else if (subtype) {
          extension = subtype;
        }
      }

      a.download = `${defaultName}_${timestamp}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [kind, mediaUrl],
  );

  return {
    status,
    error,
    mediaUrl,
    mimeType: mimeRef.current,
    isRecording: status === "recording",
    start,
    stop,
    reset,
    download,
    stream,
  };
}
