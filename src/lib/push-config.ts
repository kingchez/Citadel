/**
 * Public half of the web-push key pair (safe to ship to the browser by design).
 * The private half lives only inside the `send-push` Supabase edge function.
 * If the keys are ever rotated, update this value and have each phone tap "Enable notifications" again.
 */
export const VAPID_PUBLIC_KEY = "BJzPpybjYGPXdE6Sya5r8_BjDbipc39wS2KkUP64beXftNzmnvPMHqnywCcsGOS4jwwDD4hXTMxsSCXIRw5Ld4Y";
