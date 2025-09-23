import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((MediaRecorder as any).isTypeSupported(m)) return m;
    } catch {
      // ignore
    }
  }
  return null;
}

export const Test = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => {
          t.stop();
        });
      }
    };
  }, [stream]);

  const startCapture = async () => {
    try {
      const s = await (navigator.mediaDevices as MediaDevices).getDisplayMedia({
        audio: true,
        video: true,
      });
      setStream(s as MediaStream);
      if (videoRef.current) videoRef.current.srcObject = s;

      const selected = pickSupportedMime();
      const options: MediaRecorderOptions = selected
        ? { mimeType: selected }
        : {};
      const mr = new MediaRecorder(
        s as MediaStream,
        options as MediaRecorderOptions,
      );

      mr.ondataavailable = async (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          // Read blob as ArrayBuffer and send to backend
          const ab = await ev.data.arrayBuffer();
          const u8 = new Uint8Array(ab);
          // send chunk to Rust backend
          try {
            await invoke("append_chunk", { data: Array.from(u8) });
          } catch (e) {
            console.error("invoke append_chunk failed", e);
          }
        }
      };

      mr.onstop = async () => {
        try {
          await invoke("finalize_recording");
        } catch (e) {
          console.error("finalize_recording failed", e);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start(1000); // deliver data every second
      setRecording(true);
    } catch (e) {
      console.error("startCapture failed", e);
    }
  };

  const stopCapture = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.stop();
      });
      setStream(null);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Screen Recording (MVP)</h2>
      <div style={{ display: "flex", gap: 12 }}>
        <button disabled={recording} onClick={startCapture} type="button">
          Start
        </button>
        <button disabled={!recording} onClick={stopCapture} type="button">
          Stop
        </button>
        <button
          onClick={async () => {
            try {
              const path = await save({ defaultPath: "vlog_recording.mp4" });
              if (path) {
                const p = Array.isArray(path) ? path[0] : path;
                // request bytes from backend
                const bytes = (await invoke("read_recording")) as number[];
                if (!bytes || bytes.length === 0) {
                  alert("No recording data available");
                  return;
                }
                // write using plugin-fs
                await writeFile(p as string, new Uint8Array(bytes));
                alert(`Saved: ${p}`);
              }
            } catch (e) {
              console.error("save failed", e);
            }
          }}
          type="button"
        >
          Save
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <video
          autoPlay
          muted
          playsInline
          ref={videoRef}
          style={{ maxHeight: 480, width: "100%" }}
        />
      </div>
      <p style={{ marginTop: 8 }}>
        This MVP streams webm chunks to the Rust backend which will append them
        to a file.
      </p>
    </div>
  );
};
