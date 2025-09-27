import {
  checkCameraPermission,
  checkMicrophonePermission,
  checkScreenRecordingPermission,
  requestCameraPermission,
  requestMicrophonePermission,
  requestScreenRecordingPermission,
} from "tauri-plugin-macos-permissions-api";

type PermissionCheck = () => Promise<unknown>;
type PermissionRequest = () => Promise<unknown>;

type NormalizeResult = boolean;

type MacosMediaPermissionsResult = {
  microphoneGranted: boolean;
  cameraGranted: boolean;
  screenGranted: boolean;
};

const normalizePermissionResult = (value: unknown): NormalizeResult => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return [
      "granted",
      "authorized",
      "authorizedalways",
      "authorizedwheninuse",
      "promptallowed",
    ].includes(normalized);
  }

  return false;
};

const ensurePermission = async (
  check?: PermissionCheck,
  request?: PermissionRequest,
): Promise<boolean> => {
  try {
    if (check) {
      const granted = await check();
      if (normalizePermissionResult(granted)) {
        return true;
      }
    }

    if (request) {
      return normalizePermissionResult(await request());
    }
  } catch (err) {
    console.warn("Failed to ensure macOS permission", err);
  }

  return false;
};

export const ensureMacosMediaPermissions =
  async (): Promise<MacosMediaPermissionsResult> => {
    const [microphoneGranted, cameraGranted, screenGranted] = await Promise.all(
      [
        ensurePermission(
          checkMicrophonePermission,
          requestMicrophonePermission,
        ),
        ensurePermission(checkCameraPermission, requestCameraPermission),
        ensurePermission(
          checkScreenRecordingPermission,
          requestScreenRecordingPermission,
        ),
      ],
    );

    return { cameraGranted, microphoneGranted, screenGranted };
  };

// ---- Additional helpers for granular status/request (no auto-prompt on status) ----

export type MediaPermission = "microphone" | "camera" | "screen";
export type MediaPermissionStatus = "granted" | "denied";

const statusFrom = (granted: boolean): MediaPermissionStatus =>
  granted ? "granted" : "denied";

export const mediaPermissionsStatus = async (): Promise<{
  microphone: MediaPermissionStatus;
  camera: MediaPermissionStatus;
  screen: MediaPermissionStatus;
}> => {
  const [mic, cam, scr] = await Promise.all([
    checkMicrophonePermission(),
    checkCameraPermission(),
    checkScreenRecordingPermission(),
  ]);
  return {
    camera: statusFrom(normalizePermissionResult(cam)),
    microphone: statusFrom(normalizePermissionResult(mic)),
    screen: statusFrom(normalizePermissionResult(scr)),
  };
};

export const ensureMicrophonePermissionStatus = async (): Promise<MediaPermissionStatus> => {
  const granted = await ensurePermission(
    checkMicrophonePermission,
    requestMicrophonePermission,
  );
  return statusFrom(granted);
};

export const ensureCameraPermissionStatus = async (): Promise<MediaPermissionStatus> => {
  const granted = await ensurePermission(
    checkCameraPermission,
    requestCameraPermission,
  );
  return statusFrom(granted);
};

export const ensureScreenPermissionStatus = async (): Promise<MediaPermissionStatus> => {
  const granted = await ensurePermission(
    checkScreenRecordingPermission,
    requestScreenRecordingPermission,
  );
  return statusFrom(granted);
};
