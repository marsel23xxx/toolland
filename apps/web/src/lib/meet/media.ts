/** Batasan getUserMedia untuk Rapat Video: 720p bila ada, pengurangan gema dan derau aktif. */
export function mediaConstraints(camId: string, micId: string) {
  const video: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    ...(camId ? { deviceId: { exact: camId } } : { facingMode: 'user' }),
  };
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    ...(micId ? { deviceId: { exact: micId } } : {}),
  };
  return { video, audio };
}
