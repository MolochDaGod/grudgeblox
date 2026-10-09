/** Delivery revisions are immutable; settings changes keep the source clip/model identity. */
export function workbenchModelUrl(entry: { model: string; revision?: string; sha256?: string }) {
  const file = '/workbench/' + entry.model.split('/').map(encodeURIComponent).join('/')
  const revision = entry.revision || entry.sha256
  return file + (revision ? '?revision=' + encodeURIComponent(revision) : '')
}
