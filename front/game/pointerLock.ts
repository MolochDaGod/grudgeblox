/** Pointer-lock helper. Keep `this` bound to the canvas — extracting
 * `element.requestPointerLock` and calling it unbound throws Illegal invocation. */

export type PointerLockRequest = (options?: { unadjustedMovement?: boolean }) => unknown

export function requestBoundPointerLock(request: PointerLockRequest): void {
  try {
    const result = request({ unadjustedMovement: true })
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      void (result as Promise<unknown>).catch(() => fallbackLock(request))
    }
  } catch {
    fallbackLock(request)
  }
}

function fallbackLock(request: PointerLockRequest): void {
  try {
    const result = request()
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      void (result as Promise<unknown>).catch(() => {
        /* lock denied or canvas gone */
      })
    }
  } catch {
    /* Canvas may have been removed */
  }
}
