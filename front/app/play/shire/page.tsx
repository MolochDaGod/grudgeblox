import ShireGame from '@/components/shire/ShireGame'
import type { Metadata } from 'next'
export const metadata:Metadata={title:'The Shire · A place to call home',description:'Make a hillside home, grow a garden, meet your neighbours and explore the Shire.',icons:{icon:[{url:'/shire/icons/shire.svg',type:'image/svg+xml'},{url:'/shire/icons/shire-32.png',sizes:'32x32',type:'image/png'}],apple:'/shire/icons/shire-180.png'},manifest:'/shire/manifest.webmanifest'}
export default function ShirePage(){return <ShireGame/>}
