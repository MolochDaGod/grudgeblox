import { EntityManager } from '@shared/system/EntityManager'
import { EventSystem } from '@shared/system/EventSystem'

/** Retire client entities while retaining the singleton event queue itself. */
export function resetClientSession() {
  const events = EventSystem.getInstance()
  for (const entity of [...EntityManager.getInstance().getAllEntities()]) {
    if (entity === events.eventQueue.entity) continue
    entity.removeAllComponents()
    EntityManager.removeEntity(entity)
  }
  events.afterUpdate([])
}
