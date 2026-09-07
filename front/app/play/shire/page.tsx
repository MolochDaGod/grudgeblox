import ShireGame from '@/components/shire/ShireGame'
import type { Metadata } from 'next'
export const metadata:Metadata={title:'The Middle-earth · A home in the Shire',description:'Explore rolling countryside, build a home inside a hill, farm and raise animals in your local world.'}
export default function ShirePage(){return <ShireGame/>}
