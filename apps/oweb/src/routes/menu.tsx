import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useHomeMenu } from '../hooks/useHomeMenu'

function MenuPage() {
  const navigate = useNavigate()
  const { open } = useHomeMenu()

  useEffect(() => {
    open()
    navigate({ to: '/' })
  }, [open, navigate])

  return null
}

export const Route = createFileRoute('/menu')({
  component: MenuPage,
})
