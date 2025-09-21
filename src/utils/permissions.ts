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
