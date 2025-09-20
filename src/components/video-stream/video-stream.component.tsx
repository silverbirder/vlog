import { useVideoStream } from "./video-stream.hook";

type Props = {
  stream: MediaStream | null;
  mirrored?: boolean;
};

export const VideoStream = ({ stream, mirrored }: Props) => {
  const { videoRef } = useVideoStream({ stream });
  return (
    <video
      autoPlay
      className={`live-preview${mirrored ? " mirrored" : ""}`}
      muted
      playsInline
      ref={videoRef}
    />
  );
};
