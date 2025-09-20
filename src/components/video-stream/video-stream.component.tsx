import { useVideoStream } from "./video-stream.hook";

type Props = {
  stream: MediaStream | null;
  mirrored?: boolean;
};

export const VideoStream = ({ stream, mirrored }: Props) => {
  const { videoRef } = useVideoStream({ stream });
  return (
    <video
      ref={videoRef}
      className={`live-preview${mirrored ? " mirrored" : ""}`}
      muted
      autoPlay
      playsInline
    />
  );
};
