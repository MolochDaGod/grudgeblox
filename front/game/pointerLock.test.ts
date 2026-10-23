import assert from 'node:assert/strict'
import { test } from 'node:test'
import { requestBoundPointerLock } from './pointerLock'

test('calls requestPointerLock with unadjustedMovement', () => {
  const calls: Array<{ unadjustedMovement?: boolean } | undefined> = []
  requestBoundPointerLock((options) => {
    calls.push(options)
  })
  assert.deepEqual(calls, [{ unadjustedMovement: true }])
})

test('falls back without options when the options call throws', () => {
  const calls: Array<{ unadjustedMovement?: boolean } | undefined> = []
  requestBoundPointerLock((options) => {
    calls.push(options)
    if (options) throw new TypeError('Illegal invocation')
  })
  assert.deepEqual(calls, [{ unadjustedMovement: true }, undefined])
})

test('retries without options when the options call rejects', async () => {
  const calls: Array<{ unadjustedMovement?: boolean } | undefined> = []
  requestBoundPointerLock((options) => {
    calls.push(options)
    if (options) return Promise.reject(new TypeError('Illegal invocation'))
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(calls, [{ unadjustedMovement: true }, undefined])
})
