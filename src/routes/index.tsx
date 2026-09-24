import { createFileRoute } from '@tanstack/react-router'
import { Chamber } from '../components/chamber'

export const Route = createFileRoute('/')({
  component: Chamber,
})
