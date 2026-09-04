'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Game } from '@/game/Game'
import MetaverseHud from '@/components/MetaverseHud'
import LoadingScreen from '@/components/LoadingScreen'
import WeaponSkillBar from '@/components/WeaponSkillBar'
import { MessageComponent } from '@shared/component/MessageComponent'
import { GameInfo } from '@/types'
import type { FleetCharacter } from '@/lib/fleetCharacters'
import type { WeaponSkillDef } from '@/lib/weaponSkillsCombat'
import { CurrentPlayerComponent } from '@/game/ecs/component/CurrentPlayerComponent'
import { MeshComponent } from '@/game/ecs/component/MeshComponent'
import type { LoadedAvatar } from '@/lib/grudgeAvatar'
import { findClip, fxForSkillStyle } from '@/lib/fourCharacterKit'
import {
  FlyingProjectile,
  baseDamageForSkill,
  raycastProjectile,
} from '@/lib/avatarCombat'
import type { FootIkLite } from '@/lib/footIkLite'
import { METAVERSE_FIGHT_LINKS } from '@/lib/dangerRoomSkills'
import { EntityManager } from '@shared/system/EntityManager'
import { RENDER_LAYER, collectLayerMeshes, raycastLayersFor } from '@/game/renderLayers'
import { HUD_Z, hudLayerVisible } from '@/game/hudLayers'
import type { PlayHudState } from '@/game/InputManager'
import * as THREE from 'three'

interface GamePlayerProps extends GameInfo {
  playerName?: string
  character?: FleetCharacter | null
}

export default function GamePlayer({
  playerName,
  character,
  combatEnabled = true,
  ...gameInfo
}: GamePlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [messages, setMessages] = useState<MessageComponent[]>([])
  const [gameInstance, setGameInstance] = useState<Game | null>(null)
  const [avatarReady, setAvatarReady] = useState(false)
  const [hp] = useState(100)
  const [kills, setKills] = useState(0)
  const [killFeed, setKillFeed] = useState<Array<{ id: number; text: string }>>([])
  const [softAim, setSoftAim] = useState(false)
  const [playHud, setPlayHud] = useState<PlayHudState>({
    pointerLocked: false,
    gamepadConnected: false,
    prompt: null,
    hudMode: 'full',
  })
  const [stamina, setStamina] = useState(100)
  const [guarding, setGuarding] = useState(false)
  const [combatAction, setCombatAction] = useState<string | null>(null)
  const refContainer = useRef(null)
  const avatarTried = useRef(false)
  const loadedAvatar = useRef<LoadedAvatar | null>(null)
  const projectiles = useRef<FlyingProjectile[]>([])
  const raycaster = useRef(new THREE.Raycaster())
  const playerMeshRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    let active = true

    async function initializeGame() {
      setIsLoading(true)
      setConnectionError(null)
      Game.resetInstance()
      const game = Game.getInstance(gameInfo.websocketPort, refContainer, gameInfo.websocketUrl)
      game.setAvatarWorldSlug(gameInfo.slug)
      game.setWorldMapId(gameInfo.mapId)
      game.hud.passChatState(setMessages)
      setGameInstance(game)
      try {
        await game.start()
        if (character?.id) {
          game.setFleetCharacter?.(character)
        } else if (playerName && playerName.trim()) {
          game.setPlayerName(playerName.trim())
        }
        if (active) setIsLoading(false)
      } catch (error) {
        console.error('Error connecting to WebSocket:', error)
        if (active) {
          setIsLoading(false)
          setConnectionError(
            error instanceof Error ? error.message : 'Could not reach the game server.'
          )
        }
      }
    }

    void initializeGame()
    return () => {
      active = false
    }
  }, [
    gameInfo.websocketPort,
    gameInfo.websocketUrl,
    gameInfo.slug,
    gameInfo.mapId,
    playerName,
    character,
    connectionAttempt,
  ])

  const retryConnection = useCallback(() => {
    setConnectionAttempt((attempt) => attempt + 1)
  }, [])

  useEffect(() => {
    if (!gameInstance || isLoading) return
    const id = window.setInterval(() => {
      setPlayHud(gameInstance.inputManager.hudState())
    }, 160)
    return () => window.clearInterval(id)
  }, [gameInstance, isLoading])

  useEffect(() => {
    if (!combatEnabled) return
    const id = window.setInterval(() => {
      setStamina((value) => Math.min(100, value + (guarding ? 1.2 : 2.8)))
    }, 140)
    return () => window.clearInterval(id)
  }, [combatEnabled, guarding])

  // Soft aim RMB (three-player-controller soft aim)
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button === 2) setSoftAim(true)
    }
    const up = (e: MouseEvent) => {
      if (e.button === 2) setSoftAim(false)
    }
    const ctx = (e: Event) => e.preventDefault()
    window.addEventListener('mousedown', down)
    window.addEventListener('mouseup', up)
    window.addEventListener('contextmenu', ctx)
    return () => {
      window.removeEventListener('mousedown', down)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('contextmenu', ctx)
    }
  }, [])

  // Observe the avatar loaded by PlayerAvatarSystem (the single mixer owner).
  useEffect(() => {
    if (isLoading || !character || avatarTried.current) return
    let cancelled = false
    let attempts = 0

    const tryApply = async () => {
      attempts += 1
      const entities = EntityManager.getInstance().getAllEntities()
      for (const e of entities) {
        if (!e.getComponent(CurrentPlayerComponent)) continue
        const meshC = e.getComponent(MeshComponent)
        if (!meshC?.mesh) continue
        playerMeshRef.current = meshC.mesh
        const loaded = meshC.mesh.userData.loadedAvatar as LoadedAvatar | undefined
        if (
          loaded &&
          meshC.mesh.userData.kitSig === avatarAppearanceSig(character)
        ) {
          avatarTried.current = true
          if (!cancelled) {
            loadedAvatar.current = loaded
            setAvatarReady(true)
          }
          return
        }
      }
      if (attempts < 40 && !cancelled) {
        window.setTimeout(tryApply, 250)
      }
    }

    void tryApply()
    return () => {
      cancelled = true
    }
  }, [isLoading, character, gameInfo.slug])

  // Foot IK + projectile update loop
  useEffect(() => {
    if (!gameInstance || isLoading) return
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const scene = gameInstance.renderer?.scene
      if (scene) {
        // Foot IK against world meshes
        const footIk = loadedAvatar.current?.footIk as FootIkLite | undefined
        if (footIk) {
          const colliders = collectLayerMeshes(scene, raycastLayersFor('foot-ik'), {
            visibleOnly: true,
          })
          footIk.setGrounded(true)
          footIk.update(colliders.slice(0, 80), dt)
        }

        // Projectiles: world solids + avatar hitboxes, never VFX or skins
        const targets = projectiles.current.length
          ? collectLayerMeshes(scene, raycastLayersFor('projectile'))
          : []
        for (const p of [...projectiles.current]) {
          const hit = p.update(dt, raycaster.current, targets)
          if (hit) {
            // Impact flash
            const flash = new THREE.Mesh(
              new THREE.SphereGeometry(0.2, 6, 6),
              new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.8 }),
            )
            flash.layers.set(RENDER_LAYER.FX)
            flash.position.copy(hit.point)
            scene.add(flash)
            window.setTimeout(() => {
              scene.remove(flash)
              flash.geometry.dispose()
            }, 120)
            if (hit.isAvatar) {
              setKills((k) => k + 1)
              setKillFeed((f) => [
                { id: Date.now(), text: `${playerName || 'You'} → ${hit.part || 'hit'} ×${hit.dmgMult}` },
                ...f.slice(0, 4),
              ])
            }
          }
          if (p.done) {
            p.dispose(scene)
            projectiles.current = projectiles.current.filter((x) => x !== p)
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gameInstance, isLoading, playerName])

  const playLocalSkillClip = useCallback((skill: WeaponSkillDef, phase: string) => {
    const loaded = loadedAvatar.current
    if (!loaded?.clips.length) return
    const wanted =
      skill.id === 'guard'
        ? ['block', 'shield', 'guard', 'idle']
        : skill.id === 'smash'
          ? ['sword_combo_finisher', 'attack4', 'heavy', 'overhead', 'attack']
          : skill.id === 'bolt'
            ? ['castSpell', 'magic', 'attack', 'unarmed_uppercut']
            : skill.id === 'shot'
              ? ['shoot', 'rifle', 'attack']
              : phase === 'windup'
                ? ['draw', 'equip', 'attack']
                : ['sword_attack_a', 'attack', 'slash', 'unarmed_uppercut']
    const clip = findClip(loaded.clips, wanted) as THREE.AnimationClip | undefined
    if (!clip) return
    const action = loaded.mixer.clipAction(clip)
    action.reset()
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = skill.id === 'guard'
    action.fadeIn(0.05)
    action.play()
  }, [])

  const fxIdForSkill = useCallback((skill: WeaponSkillDef) => {
    if (skill.id === 'smash') return 'slashes'
    return fxForSkillStyle(skill.style, skill.projectile)
  }, [])

  const onCast = useCallback(
    (
      skill: WeaponSkillDef,
      phase: 'windup' | 'active' | 'projectile' | 'recovery' | 'ready',
    ) => {
      if (!gameInstance) return
      const scene = gameInstance.renderer?.scene
      const meshRoot = playerMeshRef.current
      const collider = loadedAvatar.current?.weaponCollider

      try {
        if (phase === 'windup') {
          const cost = skill.id === 'smash' ? 40 : skill.id === 'guard' ? 8 : skill.projectile ? 16 : 12
          setStamina((value) => Math.max(0, value - cost))
          setCombatAction(skill.label.toUpperCase())
          setGuarding(skill.id === 'guard')
          playLocalSkillClip(skill, phase)
          if (meshRoot) meshRoot.scale.setScalar(1.03)
          if (collider) collider.visible = false
          gameInstance.sendPlayerFx?.(fxIdForSkill(skill))
        } else if (phase === 'active') {
          playLocalSkillClip(skill, phase)
          if (meshRoot) meshRoot.scale.setScalar(1)
          // Melee: enable weapon collider for active window
          if (collider && !skill.projectile) {
            collider.visible = true
            window.setTimeout(() => {
              if (collider) collider.visible = false
            }, skill.active * 1000)
          }
          // Melee sphere check near hand
          if (!skill.projectile && meshRoot && scene) {
            const origin = new THREE.Vector3()
            if (collider) collider.getWorldPosition(origin)
            else {
              meshRoot.getWorldPosition(origin)
              origin.y += 1.2
            }
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(meshRoot.quaternion)
            const targets = collectLayerMeshes(scene, raycastLayersFor('melee'))
            const hit = raycastProjectile(
              raycaster.current,
              origin,
              forward,
              targets,
              skill.range,
            )
            if (hit) {
              setKills((k) => k + 1)
              setKillFeed((f) => [
                {
                  id: Date.now(),
                  text: `${skill.label} ${hit.part || ''} (${Math.round(baseDamageForSkill(skill.id) * hit.dmgMult)})`,
                },
                ...f.slice(0, 4),
              ])
            }
          }
        } else if (phase === 'projectile' && scene && meshRoot) {
          playLocalSkillClip(skill, phase)
          if (meshRoot) meshRoot.scale.setScalar(1)
          const from = new THREE.Vector3()
          if (collider) collider.getWorldPosition(from)
          else {
            meshRoot.getWorldPosition(from)
            from.y += 1.35
          }
          const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(meshRoot.quaternion)
          // Soft aim: pull toward camera forward (three-player soft aim)
          if (softAim && gameInstance.renderer?.camera) {
            const camDir = new THREE.Vector3()
            gameInstance.renderer.camera.getWorldDirection(camDir)
            dir.lerp(camDir, 0.85).normalize()
          } else {
            // Aim cone when not soft aiming
            const spread = 0.04
            dir.x += (Math.random() - 0.5) * spread
            dir.y += (Math.random() - 0.5) * spread * 0.5
            dir.z += (Math.random() - 0.5) * spread
            dir.normalize()
          }
          const proj = new FlyingProjectile({
            from,
            dir,
            speed: skill.projectileSpeed,
            color: skill.color,
            damage: baseDamageForSkill(skill.id),
            maxLife: skill.range / Math.max(skill.projectileSpeed, 1) + 0.3,
          })
          scene.add(proj.mesh)
          projectiles.current.push(proj)
        } else if (phase === 'recovery') {
          if (meshRoot) meshRoot.scale.setScalar(1)
          if (collider) collider.visible = false
          setGuarding(false)
          setCombatAction(null)
        }
      } catch {
        /* ignore */
      }
    },
    [fxIdForSkill, gameInstance, playLocalSkillClip, softAim],
  )

  return (
    <div className="fixed inset-0 w-full h-full">
      {(isLoading || connectionError) && (
        <LoadingScreen
          error={connectionError}
          isRetrying={isLoading && connectionAttempt > 0}
          onRetry={retryConnection}
        />
      )}
      {gameInstance && (
        <div ref={refContainer} className="contents">
          <MetaverseHud
            messages={messages}
            sendMessage={gameInstance.hud.sendMessageToServer}
            gameInstance={gameInstance}
            character={character}
            worldTitle={gameInfo.title}
            hp={hp}
            maxHp={100}
            kills={kills}
            killFeed={killFeed}
            softAim={softAim}
            stamina={stamina}
            maxStamina={100}
            guarding={guarding}
            combatAction={combatAction}
            fightLinks={METAVERSE_FIGHT_LINKS}
            worldSlug={gameInfo.slug}
            pointerLocked={playHud.pointerLocked}
            gamepadConnected={playHud.gamepadConnected}
            prompt={playHud.prompt}
            hudMode={playHud.hudMode}
          />
          <WeaponSkillBar
            enabled={combatEnabled !== false && !isLoading}
            visible={hudLayerVisible('SKILLBAR', playHud.hudMode)}
            onCast={onCast}
            consumeSkillSlot={() => gameInstance.inputManager.consumeSkillSlot()}
          />
          {/* Crosshair (three-player-controller) */}
          {combatEnabled !== false && !isLoading && hudLayerVisible('CROSSHAIR', playHud.hudMode) && (
            <div
              className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                zIndex: HUD_Z.CROSSHAIR,
                width: softAim ? 4 : 6,
                height: softAim ? 4 : 6,
                borderRadius: '50%',
                background: softAim ? '#6dce5a' : '#fff',
                boxShadow: '0 0 4px #000',
              }}
            />
          )}
          {character && !avatarReady && hudLayerVisible('PANELS', playHud.hudMode) && (
            <div
              className="pointer-events-none absolute top-20 left-3 px-3 py-1.5 rounded-lg bg-black/60 border border-amber-800/40 text-[11px] text-amber-100/70"
              style={{ zIndex: HUD_Z.PANELS }}
            >
              Loading fleet avatar + hitboxes…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
