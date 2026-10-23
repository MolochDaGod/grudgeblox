// app/play/[slug]/page.tsx
import gameData from '../../../public/gameData.json'
import { GameInfo } from '@/types'
import { Metadata } from 'next'
import GameContent from '@/components/GameContent'

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const games = gameData as GameInfo[]

  return games.map((game) => ({
    slug: game.slug,
  }))
}

function getGamesBySlug(slug: string): GameInfo {
  const game = gameData.find((game) => game.slug === slug)
  if (!game) {
    throw new Error(`Game with slug "${slug}" not found`)
  }
  return game
}

// https://nextjs.org/docs/app/building-your-application/upgrading/version-15#params--searchparams
type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const gameInfo = getGamesBySlug(slug)

  return {
    title: `Play ${gameInfo.title} · GrudgeBlox`,
    description: gameInfo.metaDescription,
    openGraph: {
      title: `Play ${gameInfo.title} · GrudgeBlox`,
      description: gameInfo.metaDescription,
      images: gameInfo.images ?? [],
      siteName: 'GrudgeBlox Metaverse',
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: {
      canonical: `https://blox.grudge-studio.com/play/${gameInfo.slug}`,
    },
  }
}

type Search = Promise<{ era?: string }>

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Params
  searchParams?: Search
}) {
  const { slug } = await params
  const gameInfo = getGamesBySlug(slug)
  const query = searchParams ? await searchParams : {}
  const initialEra = typeof query.era === 'string' ? query.era : undefined

  return <GameContent gameInfo={gameInfo} initialEra={initialEra} />
}
