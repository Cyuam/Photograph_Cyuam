import { ResumePage } from "@/components/resume-page"

export const revalidate = 3600

export default function Resume() {
  return (
    <main className="min-h-screen bg-white">
      <ResumePage />
    </main>
  )
}
