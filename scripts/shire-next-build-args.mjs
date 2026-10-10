import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function shireNextBuildArguments(version) {
  if (typeof version !== 'string') throw Error('The installed Next package must declare a version.')
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(version)
  const major = match && Number(match[1])
  if (!match || !Number.isSafeInteger(major) || major < 1) throw Error('The installed Next version is invalid.')
  // Next 16 defaults to Turbopack; Shire retains its existing webpack configuration.
  // Earlier Next releases use webpack by default and do not accept this flag.
  return major >= 16 ? ['build', '--webpack'] : ['build']
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw Error('Supply the staged installed Next package.json path.')
    const package_ = JSON.parse(await readFile(process.argv[2], 'utf8'))
    if (package_.name !== 'next') throw Error('The selected package metadata is not Next.')
    process.stdout.write(JSON.stringify(shireNextBuildArguments(package_.version)) + '\n')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
