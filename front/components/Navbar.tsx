import React from 'react'
import Image from 'next/image'
import { Github } from 'lucide-react'
import Link from 'next/link'
import { FLEET } from '@/lib/fleetConfig'

export default function Navbar() {
  return (
    <section className="w-full">
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center space-x-2">
          <Image
            src="/LogoFlat.png"
            alt="GrudgeBlox"
            width={44}
            height={44}
            className="rounded-xl shadow-md border border-amber-800/30"
          />
          <div>
            <h2 className="text-2xl font-bold leading-none text-amber-50 select-none">
              <Link href="/">
                GrudgeBlox
                <span className="text-base text-amber-500/80 font-medium">.metaverse</span>
              </Link>
            </h2>
            <p className="text-[10px] text-stone-500 tracking-wide">
              blox.grudge-studio.com · fleet characters
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-4 text-sm">
          <a
            href={FLEET.mineLobby}
            className="text-sky-400/90 hover:text-sky-300"
            target="_blank"
            rel="noreferrer"
          >
            Mine lobby
          </a>
          <a
            href={FLEET.grudoxStudio}
            className="text-cyan-400/90 hover:text-cyan-300"
            target="_blank"
            rel="noreferrer"
          >
            Voxel Studio
          </a>
          <a
            href={FLEET.grudox}
            className="text-violet-400/90 hover:text-violet-300"
            target="_blank"
            rel="noreferrer"
          >
            GRUDOX
          </a>
          <a
            href={FLEET.productionLab}
            className="text-emerald-400/90 hover:text-emerald-300"
            target="_blank"
            rel="noreferrer"
          >
            Warlords lab
          </a>
          <a
            href="https://github.com/MolochDaGod/grudgeblox"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="h-5 w-5 text-stone-400 hover:text-amber-200" />
          </a>
        </div>
      </div>
    </section>
  )
}
