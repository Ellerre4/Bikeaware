export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermission(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function playSoftCue(tone: 'milestone' | 'interval' = 'interval'): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(tone === 'milestone' ? 660 : 520, ctx.currentTime);
    if (tone === 'milestone') {
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    }
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export function dispatchPushNotification(
  title: string,
  body: string,
  options?: { sound?: boolean; tone?: 'milestone' | 'interval' }
): boolean {
  if (options?.sound) {
    playSoftCue(options.tone ?? 'milestone');
  }
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        tag: `bikeaware-${Date.now()}`,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
