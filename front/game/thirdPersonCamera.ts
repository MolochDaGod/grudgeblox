/** Third-person chase-camera math. Keep this module DOM-free so unit tests can run in Node. */

export const THIRD_PERSON = {
  distance: 4.6,
  minDistance: 0.85,
  lookHeight: 1.55,
  shoulder: 0.42,
  minPitch: -0.45,
  maxPitch: 1.15,
  defaultYaw: Math.PI / 2,
  defaultPitch: 0.28,
  mouseSensitivity: 0.0024,
  stickSensitivity: 2.6,
  minZoom: 2.4,
  maxZoom: 9,
  wheelZoom: 0.45,
} as const

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampPitch(
  pitch: number,
  min: number = THIRD_PERSON.minPitch,
  max: number = THIRD_PERSON.maxPitch
): number {
  return clamp(pitch, min, max)
}

export function applyMouseLook(
  yaw: number,
  pitch: number,
  movementX: number,
  movementY: number,
  sensitivity: number = THIRD_PERSON.mouseSensitivity
): { yaw: number; pitch: number } {
  return {
    yaw: yaw - movementX * sensitivity,
    pitch: clampPitch(pitch + movementY * sensitivity),
  }
}

export function applyStickLook(
  yaw: number,
  pitch: number,
  stickX: number,
  stickY: number,
  dtSeconds: number,
  sensitivity: number = THIRD_PERSON.stickSensitivity
): { yaw: number; pitch: number } {
  return {
    yaw: yaw - stickX * sensitivity * dtSeconds,
    pitch: clampPitch(pitch + stickY * sensitivity * dtSeconds),
  }
}

/**
 * Existing Notblox convention: yaw toward the camera, then MovementSystem
 * inverts it so W walks away from the camera.
 */
export function lookingYAngle(
  cameraX: number,
  cameraZ: number,
  targetX: number,
  targetZ: number
): number {
  return Math.atan2(cameraZ - targetZ, cameraX - targetX)
}

export function chaseOffset(
  yaw: number,
  pitch: number,
  distance: number,
  shoulder: number = THIRD_PERSON.shoulder
): { x: number; y: number; z: number } {
  const horizontal = Math.cos(pitch) * distance
  const rightX = -Math.sin(yaw)
  const rightZ = Math.cos(yaw)
  return {
    x: Math.cos(yaw) * horizontal + rightX * shoulder,
    y: Math.sin(pitch) * distance,
    z: Math.sin(yaw) * horizontal + rightZ * shoulder,
  }
}

export function pullCameraDistance(
  desiredDistance: number,
  hitDistance: number | null,
  minDistance: number = THIRD_PERSON.minDistance
): number {
  if (hitDistance == null || !Number.isFinite(hitDistance)) return desiredDistance
  return clamp(hitDistance - 0.22, minDistance, desiredDistance)
}

/** Keep the camera on the look→desired ray so shoulder offset cannot sit behind a wall. */
export function pullAlongRay(
  origin: { x: number; y: number; z: number },
  desired: { x: number; y: number; z: number },
  hitDistance: number | null
): { x: number; y: number; z: number } {
  const dx = desired.x - origin.x
  const dy = desired.y - origin.y
  const dz = desired.z - origin.z
  const span = Math.hypot(dx, dy, dz)
  const pulled = pullCameraDistance(span, hitDistance)
  if (pulled >= span || span < 1e-6) return desired
  const t = pulled / span
  return { x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t }
}

export function clampZoom(distance: number): number {
  return clamp(distance, THIRD_PERSON.minZoom, THIRD_PERSON.maxZoom)
}

/** Camera never drops below this far above the plane the player stands on. */
export const CAMERA_MIN_ABOVE_FEET = 0.35

/**
 * Keep the chase camera above the player's feet. A negative pitch at long
 * zoom can otherwise put the camera under the pad the player is standing on,
 * where backface culling makes the world look empty until the next look input.
 */
export function clampAboveFeet(
  desiredY: number,
  lookTargetY: number,
  lookHeight: number = THIRD_PERSON.lookHeight,
  minAboveFeet: number = CAMERA_MIN_ABOVE_FEET
): number {
  const feetY = lookTargetY - lookHeight
  return Math.max(desiredY, feetY + minAboveFeet)
}
