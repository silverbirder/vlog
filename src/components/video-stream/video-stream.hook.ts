import { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
};

export const useVideoStream = ({ stream }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    if (stream) {
      element.srcObject = stream;
      const play = async () => {
        try {
          await element.play();
        } catch (err) {
          console.warn("Preview playback interrupted", err);
        }
      };
      play();
    } else {
      element.pause();
      element.srcObject = null;
    }
  }, [stream]);

  return { videoRef } as const;
};
