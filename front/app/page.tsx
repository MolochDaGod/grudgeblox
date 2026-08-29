import GameCard from '@/components/GameCard'
import Navbar from '@/components/Navbar'
import { ExternalLink, Github, Twitter } from 'lucide-react'
import Link from 'next/link'
import { GameInfo } from '../types'
import gameData from '../public/gameData.json'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'GrudgeBlox · Metaverse multiplayer · blox.grudge-studio.com',
    description:
      'Fleet character select, grudge6 avatars, weapon skills. Voxel + GRUDOX worlds on Grudge Studio DNS.',
    openGraph: {
      title: 'GrudgeBlox · Grudge Studio Metaverse',
      description:
        'Notblox-style play lobby with Mine-Loader character roster and weapon skill combat.',
      images: ['/PreviewTestGame.webp'],
      siteName: 'GrudgeBlox',
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: {
      canonical: 'https://blox.grudge-studio.com/',
    },
  }
}

export default async function Home() {
  const games = gameData as GameInfo[]
  return (
    <div className="space-y-8 flex flex-col items-center px-4 container">
      <Navbar />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {games &&
          games.map((game, index) => (
            <div
              className={`col-span-1 ${
                // Only make the last item span full width when total count is odd
                index === games.length - 1 && games.length % 2 !== 0 ? 'md:col-span-2' : ''
              }`}
              key={index}
            >
              <GameCard {...game} />
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 my-4">
        <Link
          href={'https://discord.gg/kPhgtj49U2'}
          className="flex py-2 items-center justify-center   px-8   font-medium   border border-transparent rounded-md hover:bg-gray-100   md:text-lg md:px-10"
        >
          <ExternalLink className="mr-2" />
          Project Discord
        </Link>
        <Link
          href={'https://twitter.com/iErcan_'}
          className="flex py-2 items-center justify-center  px-8   font-medium   border border-transparent rounded-md hover:bg-gray-100    md:text-lg md:px-10"
        >
          <Twitter className="mr-2" />
          Twitter
        </Link>
        <Link
          href={'https://blox.grudge-studio.com'}
          className="flex py-2 items-center justify-center   px-8   font-medium   border border-transparent rounded-md hover:bg-gray-100   md:text-lg md:px-10"
        >
          <ExternalLink className="mr-2" />
          Live · blox.grudge-studio.com
        </Link>
        <Link
          href={'https://github.com/MolochDaGod/grudgeblox'}
          className="flex py-2 items-center justify-center   px-8   font-medium  border border-transparent rounded-md hover:bg-gray-100   md:text-lg md:px-10"
        >
          <Github className="mr-2" />
          Source Code
        </Link>
      </div>
    </div>
  )
}
