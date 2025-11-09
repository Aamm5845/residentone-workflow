import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import DesignConceptWorkspaceV2 from '@/components/design/v2/DesignConceptWorkspaceV2'

interface Props {
  params: Promise<{
    id: string
  }>
}

export default async function DesignConceptV2Page({ params }: Props) {
  const { id: stageId } = await params
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  // Fetch stage with room and project info
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      room: {
        include: {
          project: {
            include: {
              client: true,
            },
          },
        },
      },
    },
  })

  if (!stage) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Stage Not Found</h2>
          <p className="text-gray-600">This stage does not exist.</p>
        </div>
      </div>
    )
  }

  return (
    <DesignConceptWorkspaceV2 
      stageId={stageId}
      roomId={stage.roomId}
      projectId={stage.room.projectId}
    />
  )
}
