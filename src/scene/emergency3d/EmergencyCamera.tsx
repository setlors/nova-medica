import { useEffect } from "react";
import { usePda } from "../../core/store";

// When Emergency starts without a zone (the SOS button), fly to the chest.
// An automatic alarm already sets cameraTarget in the store, so it is left alone.
// CameraRig does the actual flight.
export function EmergencyCamera() {
  const mode = usePda((s) => s.mode);

  useEffect(() => {
    if (mode !== "emergency") return;
    const s = usePda.getState();
    if (s.cameraTarget === null || s.cameraTarget === "overview") {
      s.setCameraTarget("heart");
    }
  }, [mode]);

  return null;
}
