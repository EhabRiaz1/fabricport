import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.png'

export interface BrandLogoProps {
  className?: string
  imgClassName?: string
}

export function BrandLogo({ className, imgClassName }: BrandLogoProps) {
  return (
    <Link to="/" className={cn('inline-flex shrink-0 items-center', className)}>
      <img
        src={logo}
        alt="FabricPort"
        className={cn('h-7 w-auto', imgClassName)}
      />
    </Link>
  )
}

export default BrandLogo
