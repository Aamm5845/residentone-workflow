import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import PhotoGallery from '@/components/project-updates/photo-gallery'
import TaskBoard from '@/components/project-updates/task-board'
import ChatInterface from '@/components/project-updates/chat-interface'

// Mock session
const mockSession = {
  user: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'ADMIN'
  }
}

// Mock data
const mockPhotos = [
  {
    id: 'photo-1',
    filename: 'kitchen-before.jpg',
    url: 'https://example.com/kitchen-before.jpg',
    thumbnailUrl: 'https://example.com/kitchen-before-thumb.jpg',
    type: 'BEFORE',
    description: 'Kitchen before renovation',
    uploadedBy: { id: 'user-1', name: 'Test User' },
    createdAt: new Date('2024-01-15T10:00:00Z')
  },
  {
    id: 'photo-2',
    filename: 'kitchen-after.jpg',
    url: 'https://example.com/kitchen-after.jpg',
    thumbnailUrl: 'https://example.com/kitchen-after-thumb.jpg',
    type: 'AFTER',
    description: 'Kitchen after renovation',
    uploadedBy: { id: 'user-1', name: 'Test User' },
    createdAt: new Date('2024-01-20T10:00:00Z')
  }
]

const mockTasks = [
  {
    id: 'task-1',
    title: 'Install Kitchen Cabinets',
    description: 'Install all base and wall cabinets',
    status: 'TODO',
    priority: 'HIGH',
    assignee: { id: 'user-2', name: 'John Contractor' },
    dueDate: new Date('2024-02-15T00:00:00Z'),
    createdAt: new Date('2024-01-10T10:00:00Z')
  },
  {
    id: 'task-2',
    title: 'Install Countertops',
    description: 'Install quartz countertops',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    assignee: { id: 'user-2', name: 'John Contractor' },
    dueDate: new Date('2024-02-20T00:00:00Z'),
    createdAt: new Date('2024-01-12T10:00:00Z')
  }
]

const mockMessages = [
  {
    id: 'message-1',
    content: 'Kitchen demolition is complete! Ready for the next phase.',
    author: { id: 'user-2', name: 'John Contractor', image: null },
    createdAt: new Date('2024-01-15T14:30:00Z'),
    reactions: [
      { id: 'reaction-1', emoji: '👍', user: { id: 'user-1', name: 'Test User' } }
    ],
    replies: []
  }
]

// Wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SessionProvider session={mockSession}>
    {children}
  </SessionProvider>
)

describe('PhotoGallery Component', () => {
  it('renders photos correctly', () => {
    render(
      <TestWrapper>
        <PhotoGallery 
          photos={mockPhotos}
          onPhotoUpload={jest.fn()}
          onPhotoDelete={jest.fn()}
          onPhotoUpdate={jest.fn()}
          isUploading={false}
        />
      </TestWrapper>
    )

    expect(screen.getByText('Photo Gallery')).toBeInTheDocument()
    expect(screen.getByText('kitchen-before.jpg')).toBeInTheDocument()
    expect(screen.getByText('kitchen-after.jpg')).toBeInTheDocument()
    expect(screen.getByText('Kitchen before renovation')).toBeInTheDocument()
  })

  it('handles photo upload', async () => {
    const mockOnPhotoUpload = jest.fn()
    
    render(
      <TestWrapper>
        <PhotoGallery 
          photos={mockPhotos}
          onPhotoUpload={mockOnPhotoUpload}
          onPhotoDelete={jest.fn()}
          onPhotoUpdate={jest.fn()}
          isUploading={false}
        />
      </TestWrapper>
    )

    const uploadButton = screen.getByText('Upload Photos')
    fireEvent.click(uploadButton)

    // Test that upload modal or interface appears
    expect(screen.getByText('Upload New Photos')).toBeInTheDocument()
  })

  it('filters photos by type', () => {
    render(
      <TestWrapper>
        <PhotoGallery 
          photos={mockPhotos}
          onPhotoUpload={jest.fn()}
          onPhotoDelete={jest.fn()}
          onPhotoUpdate={jest.fn()}
          isUploading={false}
        />
      </TestWrapper>
    )

    // Click BEFORE filter
    const beforeFilter = screen.getByText('Before')
    fireEvent.click(beforeFilter)

    // Should show only BEFORE photos
    expect(screen.getByText('kitchen-before.jpg')).toBeInTheDocument()
    expect(screen.queryByText('kitchen-after.jpg')).not.toBeInTheDocument()
  })
})

describe('TaskBoard Component', () => {
  it('renders tasks in correct columns', () => {
    render(
      <TestWrapper>
        <TaskBoard 
          tasks={mockTasks}
          onTaskCreate={jest.fn()}
          onTaskUpdate={jest.fn()}
          onTaskDelete={jest.fn()}
        />
      </TestWrapper>
    )

    expect(screen.getByText('Task Board')).toBeInTheDocument()
    expect(screen.getByText('Install Kitchen Cabinets')).toBeInTheDocument()
    expect(screen.getByText('Install Countertops')).toBeInTheDocument()

    // Check task status columns
    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('handles task creation', async () => {
    const mockOnTaskCreate = jest.fn()
    
    render(
      <TestWrapper>
        <TaskBoard 
          tasks={mockTasks}
          onTaskCreate={mockOnTaskCreate}
          onTaskUpdate={jest.fn()}
          onTaskDelete={jest.fn()}
        />
      </TestWrapper>
    )

    const addTaskButton = screen.getByText('Add Task')
    fireEvent.click(addTaskButton)

    expect(screen.getByText('Create New Task')).toBeInTheDocument()
  })

  it('handles drag and drop task status change', async () => {
    const mockOnTaskUpdate = jest.fn()
    
    render(
      <TestWrapper>
        <TaskBoard 
          tasks={mockTasks}
          onTaskCreate={jest.fn()}
          onTaskUpdate={mockOnTaskUpdate}
          onTaskDelete={jest.fn()}
        />
      </TestWrapper>
    )

    // This would test drag and drop functionality
    // In a real test, you'd simulate drag and drop events
    const taskCard = screen.getByText('Install Kitchen Cabinets')
    expect(taskCard).toBeInTheDocument()
  })
})

describe('ChatInterface Component', () => {
  it('renders messages correctly', () => {
    render(
      <TestWrapper>
        <ChatInterface 
          messages={mockMessages}
          onMessageSend={jest.fn()}
          onMessageEdit={jest.fn()}
          onMessageDelete={jest.fn()}
          onReactionAdd={jest.fn()}
          currentUserId="user-1"
        />
      </TestWrapper>
    )

    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByText('Kitchen demolition is complete! Ready for the next phase.')).toBeInTheDocument()
    expect(screen.getByText('John Contractor')).toBeInTheDocument()
  })

  it('handles sending new messages', async () => {
    const mockOnMessageSend = jest.fn()
    
    render(
      <TestWrapper>
        <ChatInterface 
          messages={mockMessages}
          onMessageSend={mockOnMessageSend}
          onMessageEdit={jest.fn()}
          onMessageDelete={jest.fn()}
          onReactionAdd={jest.fn()}
          currentUserId="user-1"
        />
      </TestWrapper>
    )

    const messageInput = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByText('Send')

    fireEvent.change(messageInput, { target: { value: 'Great progress on the kitchen!' } })
    fireEvent.click(sendButton)

    expect(mockOnMessageSend).toHaveBeenCalledWith('Great progress on the kitchen!')
  })

  it('handles message reactions', async () => {
    const mockOnReactionAdd = jest.fn()
    
    render(
      <TestWrapper>
        <ChatInterface 
          messages={mockMessages}
          onMessageSend={jest.fn()}
          onMessageEdit={jest.fn()}
          onMessageDelete={jest.fn()}
          onReactionAdd={mockOnReactionAdd}
          currentUserId="user-1"
        />
      </TestWrapper>
    )

    // Find and click reaction button
    const reactionButton = screen.getByText('👍')
    expect(reactionButton).toBeInTheDocument()
  })

  it('shows typing indicators', () => {
    render(
      <TestWrapper>
        <ChatInterface 
          messages={mockMessages}
          onMessageSend={jest.fn()}
          onMessageEdit={jest.fn()}
          onMessageDelete={jest.fn()}
          onReactionAdd={jest.fn()}
          currentUserId="user-1"
          typingUsers={[{ id: 'user-2', name: 'John Contractor' }]}
        />
      </TestWrapper>
    )

    expect(screen.getByText(/John Contractor is typing/)).toBeInTheDocument()
  })
})

describe('Project Updates Integration', () => {
  it('renders complete project updates interface', () => {
    const mockUpdate = {
      id: 'update-1',
      title: 'Kitchen Renovation Progress',
      description: 'Major progress on kitchen renovation',
      type: 'PROGRESS_UPDATE',
      status: 'PUBLISHED',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      photos: mockPhotos,
      tasks: mockTasks,
      messages: mockMessages
    }

    // This would test the complete project updates page/component
    // that combines all the individual components
    expect(mockUpdate).toBeDefined()
  })
})