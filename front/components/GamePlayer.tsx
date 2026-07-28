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
import { applyAvatarToMesh, type LoadedAvatar } from '@/lib/grudgeAvatar'
import {
  FlyingProjectile,
  baseDamageForSkill,
  raycastProjectile,
} from '@/lib/avatarCombat'
import type { FootIkLite } from '@/lib/footIkLite'
import { METAVERSE_FIGHT_LINKS } from '@/lib/dangerRoomSkills'
import { EntityManager } from '@shared/system/EntityManager'
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
  const [messages, setMessages] = useState<MessageComponent[]>([])
  const [gameInstance, setGameInstance] = useState<Game | null>(null)
  const [avatarReady, setAvatarReady] = useState(false)
  const [hp, setHp] = useState(100)
  const [kills, setKills] = useState(0)
  const [killFeed, setKillFeed] = useState<Array<{ id: number; text: string }>>([])
  const [softAim, setSoftAim] = useState(false)
  const refContainer = useRef(null)
  const avatarTried = useRef(false)
  const loadedAvatar = useRef<LoadedAvatar | null>(null)
  const projectiles = useRef<FlyingProjectile[]>([])
  const raycaster = useRef(new THREE.Raycaster())
  const playerMeshRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    async function initializeGame() {
      const game = Game.getInstance(gameInfo.websocketPort, refContainer)
      game.hud.passChatState(setMessages)
      setGameInstance(game)
      try {
        await game.start()
        if (playerName && playerName.trim()) {
          game.setPlayerName(playerName.trim())
        }
        if (character?.id) {
          game.setFleetCharacter?.(character)
        }
        setIsLoading(false)
      } catch (error) {
        console.error('Error connecting to WebSocket:', error)
      }
    }

    initializeGame()
  }, [gameInfo.websocketPort, playerName, character])

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

  // Apply fleet avatar + hitboxes + weapon collider + foot IK
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
        avatarTried.current = true
        playerMeshRef.current = meshC.mesh
        const loaded = await applyAvatarToMesh(meshC.mesh, character)
        if (!cancelled) {
          loadedAvatar.current = loaded
          setAvatarReady(!!loaded)
        }
        return
      }
      if (attempts < 40 && !cancelled) {
        window.setTimeout(tryApply, 250)
      }
    }

    void tryApply()
    return () => {
      cancelled = true
    }
  }, [isLoading, character])

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
          const colliders: THREE.Object3D[] = []
          scene.traverse((o) => {
            if ((o as THREE.Mesh).isMesh && o.visible && !o.userData.isHitbox) {
              colliders.push(o)
            }
          })
          footIk.setGrounded(true)
          footIk.update(colliders.slice(0, 80), dt)
        }

        // Projectiles
        const targets: THREE.Object3D[] = []
        scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) targets.push(o)
        })
        for (const p of [...projectiles.current]) {
          const hit = p.update(dt, raycaster.current, targets)
          if (hit) {
            // Impact flash
            const flash = new THREE.Mesh(
              new THREE.SphereGeometry(0.2, 6, 6),
              new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.8 }),
            )
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

  const onCast = useCallback(
    (skill: WeaponSkillDef, phase: 'windup' | 'active' | 'projectile') => {
      if (!gameInstance) return
      const scene = gameInstance.renderer?.scene
      const meshRoot = playerMeshRef.current
      const collider = loadedAvatar.current?.weaponCollider

      try {
        if (phase === 'windup') {
          if (meshRoot) meshRoot.scale.setScalar(1.03)
          if (collider) collider.visible = false
        } else if (phase === 'active') {
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
            meshRoot.getWorldPosition(origin)
            origin.y += 1.2
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(meshRoot.quaternion)
            const targets: THREE.Object3D[] = []
            scene.traverse((o) => {
              if ((o as THREE.Mesh).isMesh && o.userData.isHitbox) targets.push(o)
            })
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
          if (meshRoot) meshRoot.scale.setScalar(1)
          const from = new THREE.Vector3()
          meshRoot.getWorldPosition(from)
          from.y += 1.35
          let dir = new THREE.Vector3(0, 0, 1).applyQuaternion(meshRoot.quaternion)
          // Soft aim: pull toward camera forward (three-player soft aim)
          if (softAim && gameInstance.renderer?.camera) {
            const camDir = new THREE.Vector3()
            gameInstance.renderer.camera.getWorldDirection(camDir)
            dir.lerp(camDir, 0.85).normalize()
          }
          // Aim cone tighten when soft aiming
          if (!softAim) {
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
        }
      } catch {
        /* ignore */
      }
    },
    [gameInstance, softAim],
  )

  return (
    <div className="fixed inset-0 w-full h-full">
      {isLoading && <LoadingScreen />}
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
            fightLinks={METAVERSE_FIGHT_LINKS}
          />
          <WeaponSkillBar enabled={combatEnabled !== false && !isLoading} onCast={onCast} />
          {/* Crosshair (three-player-controller) */}
          {combatEnabled !== false && !isLoading && (
            <div
              className="pointer-events-none fixed top-1/2 left-1/2 z-[60] -translate-x-1/2 -translate-y-1/2"
              style={{
                width: softAim ? 4 : 6,
                height: softAim ? 4 : 6,
                borderRadius: '50%',
                background: softAim ? '#6dce5a' : '#fff',
                boxShadow: '0 0 4px #000',
              }}
            />
          )}
          {character && !avatarReady && (
            <div className="pointer-events-none absolute top-20 left-3 z-40 px-3 py-1.5 rounded-lg bg-black/60 border border-amber-800/40 text-[11px] text-amber-100/70">
              Loading fleet avatar + hitboxes…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
