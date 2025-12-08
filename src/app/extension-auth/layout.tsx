import Providers from '@/components/providers'

export default function ExtensionAuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      {children}
    </Providers>
  )
}
