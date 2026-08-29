import { PlayerComponent } from '@shared/component/PlayerComponent.js'
import { ProximityPromptComponent } from '@shared/component/ProximityPromptComponent.js'
import { TextComponent } from '@shared/component/TextComponent.js'
import { ComponentAddedEvent } from '@shared/component/events/ComponentAddedEvent.js'
import { ComponentRemovedEvent } from '@shared/component/events/ComponentRemovedEvent.js'
import { Entity } from '@shared/entity/Entity.js'
import { SerializedMessageType } from '@shared/network/server/serialized.js'
import { EntityManager } from '@shared/system/EntityManager.js'
import { EventSystem } from '@shared/system/EventSystem.js'
import { ColorEvent } from '../ecs/component/events/ColorEvent.js'
import { MessageEvent } from '../ecs/component/events/MessageEvent.js'
import { WorldActionEvent } from '../ecs/component/events/WorldActionEvent.js'
import { ChatComponent } from '../ecs/component/tag/TagChatComponent.js'
import { ScriptableSystem } from '../ecs/system/ScriptableSystem.js'

type Currency = 'BUDZ' | 'SOL'
type BenchPhase = 'empty' | 'growing' | 'ready'

interface PlayerProgress {
  budz: number
  sol: number
  rep: number
  harvests: number
  missionsCompleted: number
  ownedLots: Set<number>
  activeMission?: {
    title: string
    terminalId: number
    reward: number
  }
}

interface LotRuntime {
  index: number
  district: string
  currency: Currency
  price: number
  baseColor: string
  entity: Entity
  prompt: ProximityPromptComponent
  label: TextComponent
  ownerId?: number
  ownerName?: string
}

interface BenchRuntime {
  id: number
  district: string
  entity: Entity
  prompt: ProximityPromptComponent
  phase: BenchPhase
  planterId?: number
  readyAt?: number
}

interface TerminalRuntime {
  id: number
  title: string
  reward: number
}

interface RuntimeConfig {
  startingBudz: number
  startingSol: number
  growCost: number
  growReward: number
  growMs: number
}

function readNumber(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name])
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function readConfig(): RuntimeConfig {
  return {
    startingBudz: readNumber('DOPEBUDZ_STARTING_BUDZ', 500, 0, 1_000_000),
    startingSol: readNumber('DOPEBUDZ_STARTING_SOL', 1.5, 0, 10_000),
    growCost: readNumber('DOPEBUDZ_GROW_COST', 20, 0, 100_000),
    growReward: readNumber('DOPEBUDZ_GROW_REWARD', 80, 0, 1_000_000),
    growMs: readNumber('DOPEBUDZ_GROW_SECONDS', 45, 3, 86_400) * 1000,
  }
}

export class DopeBudzRuntime {
  private readonly config = readConfig()
  private readonly progressByPlayer = new Map<number, PlayerProgress>()
  private readonly lots = new Map<number, LotRuntime>()
  private readonly benches = new Map<number, BenchRuntime>()
  private readonly terminals = new Map<number, TerminalRuntime>()

  registerLot(lot: LotRuntime): void {
    this.lots.set(lot.index, lot)
  }

  registerBench(bench: BenchRuntime): void {
    this.benches.set(bench.id, bench)
  }

  registerTerminal(terminal: TerminalRuntime): void {
    this.terminals.set(terminal.id, terminal)
  }

  install(): void {
    ScriptableSystem.update = (_dt, entities) => this.update(entities)
  }

  interactWithLot(index: number, player: Entity): void {
    const lot = this.lots.get(index)
    if (!lot) return

    const progress = this.getProgress(player)
    const playerName = this.getPlayerName(player)

    if (lot.ownerId === player.id) {
      this.sendToPlayer(
        player.id,
        `Lot ${index + 1} in ${lot.district} is yours. Balance: ${this.formatBalance(progress)}.`
      )
      return
    }

    if (lot.ownerId !== undefined) {
      this.sendToPlayer(player.id, `Lot ${index + 1} is held by ${lot.ownerName ?? 'another player'}.`)
      return
    }

    const balance = lot.currency === 'SOL' ? progress.sol : progress.budz
    if (balance < lot.price) {
      this.sendToPlayer(
        player.id,
        `Lot ${index + 1} costs ${this.formatAmount(lot.price, lot.currency)}. Your balance is ${this.formatBalance(progress)}.`
      )
      return
    }

    if (lot.currency === 'SOL') progress.sol -= lot.price
    else progress.budz -= lot.price

    progress.ownedLots.add(index)
    lot.ownerId = player.id
    lot.ownerName = playerName
    this.setLotClaimed(lot)
    this.sendToPlayer(
      player.id,
      `Claimed Lot ${index + 1} in ${lot.district}. Balance: ${this.formatBalance(progress)}.`
    )
  }

  interactWithBench(id: number, player: Entity): void {
    const bench = this.benches.get(id)
    if (!bench) return

    const progress = this.getProgress(player)
    if (progress.ownedLots.size === 0) {
      this.sendToPlayer(player.id, 'Claim a deed lot before using a grow bench.')
      return
    }

    if (bench.phase === 'empty') {
      if (progress.budz < this.config.growCost) {
        this.sendToPlayer(
          player.id,
          `Planting costs ${this.config.growCost} BUDZ. Your balance is ${this.formatBalance(progress)}.`
        )
        return
      }

      progress.budz -= this.config.growCost
      bench.phase = 'growing'
      bench.planterId = player.id
      bench.readyAt = Date.now() + this.config.growMs
      this.updateBench(bench, '#6fbf63', `Growing · ${Math.ceil(this.config.growMs / 1000)}s`)
      this.sendToPlayer(
        player.id,
        `Crop planted in ${bench.district}. Return when it is ready. Balance: ${this.formatBalance(progress)}.`
      )
      return
    }

    if (bench.planterId !== player.id) {
      this.sendToPlayer(player.id, 'This bench is currently assigned to another player.')
      return
    }

    if (bench.phase === 'growing') {
      const seconds = Math.max(1, Math.ceil(((bench.readyAt ?? Date.now()) - Date.now()) / 1000))
      this.sendToPlayer(player.id, `Crop is still growing. About ${seconds}s remaining.`)
      return
    }

    progress.budz += this.config.growReward
    progress.rep += 2
    progress.harvests += 1
    this.resetBench(bench)
    this.sendToPlayer(
      player.id,
      `Harvest complete: +${this.config.growReward} BUDZ and +2 REP. ${this.formatStatus(progress)}`
    )
  }

  interactWithTerminal(id: number, player: Entity): void {
    const terminal = this.terminals.get(id)
    if (!terminal) return

    const progress = this.getProgress(player)
    const active = progress.activeMission

    if (!active) {
      progress.activeMission = {
        title: terminal.title,
        terminalId: terminal.id,
        reward: terminal.reward,
      }
      this.sendToPlayer(
        player.id,
        `${terminal.title} accepted. Reach a different mission terminal to complete the route.`
      )
      return
    }

    if (active.terminalId === terminal.id) {
      this.sendToPlayer(
        player.id,
        `${active.title} is active. Reach a different mission terminal to finish it.`
      )
      return
    }

    progress.budz += active.reward
    progress.rep += 5
    progress.missionsCompleted += 1
    progress.activeMission = undefined
    this.sendToPlayer(
      player.id,
      `${active.title} completed at ${terminal.title}: +${active.reward} BUDZ and +5 REP. ${this.formatStatus(progress)}`
    )
  }

  private update(entities: Entity[]): void {
    this.refreshBenches()

    for (const event of EventSystem.getEvents(WorldActionEvent)) {
      const player = EntityManager.getEntityById(entities, event.entityId)
      if (player) this.handleAction(event.action, player)
    }

    for (const event of EventSystem.getEvents(MessageEvent)) {
      if (event.messageType !== SerializedMessageType.GLOBAL_CHAT) continue
      const player = EntityManager.getEntityById(entities, event.entityId)
      if (!player) continue
      const command = event.content.trim().toLowerCase()
      if (command === '/street' || command === '/status') this.handleAction('dopebudz:status', player)
      if (command === '/lots') this.handleAction('dopebudz:lots', player)
      if (command === '/missions') this.handleAction('dopebudz:missions', player)
    }

    const playerAddedEvents = EventSystem.getEventsWrapped(ComponentAddedEvent, PlayerComponent)
    for (const event of playerAddedEvents) {
      const player = EntityManager.getEntityById(entities, event.entityId)
      if (!player) continue
      const progress = this.getProgress(player)
      this.sendToPlayer(
        player.id,
        `Welcome to Dope Budz Streets. Claim a lot, grow a crop, or run a terminal route. ${this.formatStatus(progress)}`
      )
    }

    const playerRemovedEvents = EventSystem.getEventsWrapped(ComponentRemovedEvent, PlayerComponent)
    for (const event of playerRemovedEvents) this.releasePlayerSession(event.entityId)
  }

  private handleAction(action: string, player: Entity): void {
    const progress = this.getProgress(player)
    if (action === 'dopebudz:status') {
      this.sendToPlayer(player.id, this.formatStatus(progress))
      return
    }
    if (action === 'dopebudz:lots') {
      const lots = [...progress.ownedLots].sort((a, b) => a - b).map((index) => index + 1)
      this.sendToPlayer(player.id, lots.length > 0 ? `Owned lots: ${lots.join(', ')}.` : 'No lots claimed yet.')
      return
    }
    if (action === 'dopebudz:missions') {
      this.sendToPlayer(
        player.id,
        progress.activeMission
          ? `Active job: ${progress.activeMission.title}. Reach a different terminal to complete it.`
          : `No active job. Use any of the ${this.terminals.size} mission terminals to start one.`
      )
    }
  }

  private getProgress(player: Entity): PlayerProgress {
    let progress = this.progressByPlayer.get(player.id)
    if (!progress) {
      progress = {
        budz: this.config.startingBudz,
        sol: this.config.startingSol,
        rep: 0,
        harvests: 0,
        missionsCompleted: 0,
        ownedLots: new Set(),
      }
      this.progressByPlayer.set(player.id, progress)
    }
    return progress
  }

  private releasePlayerSession(playerId: number): void {
    for (const lot of this.lots.values()) {
      if (lot.ownerId !== playerId) continue
      this.resetLot(lot)
    }
    for (const bench of this.benches.values()) {
      if (bench.planterId === playerId) this.resetBench(bench)
    }
    this.progressByPlayer.delete(playerId)
  }

  private refreshBenches(): void {
    const now = Date.now()
    for (const bench of this.benches.values()) {
      if (bench.phase !== 'growing' || !bench.readyAt || bench.readyAt > now) continue
      bench.phase = 'ready'
      this.updateBench(bench, '#80c95f', 'Ready to harvest')
      if (bench.planterId !== undefined) {
        this.sendToPlayer(bench.planterId, `Your crop in ${bench.district} is ready to harvest.`)
      }
    }
  }

  private setLotClaimed(lot: LotRuntime): void {
    EventSystem.addEvent(new ColorEvent(lot.entity.id, '#2f5a32'))
    lot.label.text = `LOT ${lot.index + 1} · ${lot.ownerName ?? 'CLAIMED'}`
    lot.label.updated = true
    lot.prompt.textComponent.text = `E · Lot ${lot.index + 1} · ${lot.ownerName ?? 'claimed'}`
    lot.prompt.updated = true
  }

  private resetLot(lot: LotRuntime): void {
    const progress = lot.ownerId === undefined ? undefined : this.progressByPlayer.get(lot.ownerId)
    progress?.ownedLots.delete(lot.index)
    lot.ownerId = undefined
    lot.ownerName = undefined
    EventSystem.addEvent(new ColorEvent(lot.entity.id, lot.baseColor))
    lot.label.text = `LOT ${lot.index + 1}`
    lot.label.updated = true
    lot.prompt.textComponent.text = `E · Deed ${lot.index + 1} · ${this.formatAmount(lot.price, lot.currency)}`
    lot.prompt.updated = true
  }

  private updateBench(bench: BenchRuntime, color: string, promptText: string): void {
    EventSystem.addEvent(new ColorEvent(bench.entity.id, color))
    bench.prompt.textComponent.text = `E · ${promptText}`
    bench.prompt.updated = true
  }

  private resetBench(bench: BenchRuntime): void {
    bench.phase = 'empty'
    bench.planterId = undefined
    bench.readyAt = undefined
    this.updateBench(bench, '#3d4a38', 'Plant crop')
  }

  private sendToPlayer(playerId: number, message: string): void {
    const entities = EntityManager.getInstance().getAllEntities()
    if (!EntityManager.getEntityById(entities, playerId)) return
    const chatEntity = EntityManager.getFirstEntityWithComponent(entities, ChatComponent)
    if (!chatEntity) return

    EventSystem.addEvent(
      new MessageEvent(
        chatEntity.id,
        '🌿 Streets',
        message,
        SerializedMessageType.TARGETED_NOTIFICATION,
        [playerId]
      )
    )
  }

  private getPlayerName(player: Entity): string {
    return player.getComponent(PlayerComponent)?.name ?? `Player ${player.id}`
  }

  private formatStatus(progress: PlayerProgress): string {
    const active = progress.activeMission ? ` Job: ${progress.activeMission.title}.` : ''
    return `${this.formatBalance(progress)} · REP ${progress.rep} · ${progress.ownedLots.size} lots · ${progress.harvests} harvests · ${progress.missionsCompleted} jobs.${active}`
  }

  private formatBalance(progress: PlayerProgress): string {
    return `${Math.round(progress.budz)} BUDZ / ${progress.sol.toFixed(2)} SOL`
  }

  private formatAmount(amount: number, currency: Currency): string {
    return currency === 'SOL' ? `${amount.toFixed(2)} SOL` : `${Math.round(amount)} BUDZ`
  }
}
