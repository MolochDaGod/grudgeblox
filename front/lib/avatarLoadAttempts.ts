/** One in-flight load per mesh, with three bounded attempts per appearance. */
export class AvatarLoadAttempts {
  private states = new WeakMap<object, { desired: string; pending: object | null; attempts: number; retryAt: number }>()

  begin(key: object, signature: string, now: number) {
    let state = this.states.get(key)
    if (!state) {
      state = { desired: signature, pending: null, attempts: 0, retryAt: 0 }
      this.states.set(key, state)
    }
    if (state.desired !== signature) {
      state.desired = signature
      state.attempts = 0
      state.retryAt = 0
    }
    if (state.pending || state.attempts >= 3 || now < state.retryAt) return null
    const token = {}
    state.pending = token
    return {
      isCurrent: () => state.pending === token && state.desired === signature,
      finish: (success: boolean, finishedAt: number) => {
        if (state.pending !== token) return
        state.pending = null
        if (state.desired !== signature) return
        state.attempts = success ? 0 : state.attempts + 1
        state.retryAt = success ? 0 : finishedAt + 500 * 2 ** (state.attempts - 1)
      },
    }
  }
}
