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
import { applyAvatarToMesh } from '@/lib/grudgeAvatar'
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
  const refContainer = useRef(null)
  const avatarTried = useRef(false)

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

  // Apply fleet avatar once local player mesh exists
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
        const ok = await applyAvatarToMesh(meshC.mesh, character)
        if (!cancelled) setAvatarReady(ok)
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

  const onCast = useCallback(
    (skill: WeaponSkillDef, phase: 'windup' | 'active' | 'projectile') => {
      if (!gameInstance) return
      // Simple client VFX: flash on current player mesh
      try {
        const entities = EntityManager.getInstance().getAllEntities()
        for (const e of entities) {
          if (!e.getComponent(CurrentPlayerComponent)) continue
          const meshC = e.getComponent(MeshComponent)
          if (!meshC?.mesh) continue
          if (phase === 'windup') {
            meshC.mesh.scale.setScalar(1.05)
          } else if (phase === 'active' || phase === 'projectile') {
            meshC.mesh.scale.setScalar(1)
            // Spawn a brief bolt marker in front of player
            if (skill.projectile && gameInstance.renderer?.scene) {
              const ball = new THREE.Mesh(
                new THREE.SphereGeometry(0.15, 8, 8),
                new THREE.MeshBasicMaterial({ color: skill.color }),
              )
              const p = meshC.mesh.position
              const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(meshC.mesh.quaternion)
              ball.position.copy(p).add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(forward, 0.5)
              gameInstance.renderer.scene.add(ball)
              const start = performance.now()
              const speed = skill.projectileSpeed
              const tick = () => {
                const t = (performance.now() - start) / 1000
                ball.position.addScaledVector(forward, speed * 0.016)
                if (t < skill.range / Math.max(speed, 1)) requestAnimationFrame(tick)
                else gameInstance.renderer.scene.remove(ball)
              }
              requestAnimationFrame(tick)
            }
          } else {
            meshC.mesh.scale.setScalar(1)
          }
        }
      } catch {
        /* ignore */
      }
    },
    [gameInstance],
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
          />
          <WeaponSkillBar enabled={combatEnabled !== false && !isLoading} onCast={onCast} />
          {character && !avatarReady && (
            <div className="pointer-events-none absolute top-20 left-3 z-40 px-3 py-1.5 rounded-lg bg-black/60 border border-amber-800/40 text-[11px] text-amber-100/70">
              Loading fleet avatar mesh…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
