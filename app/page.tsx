import { EntryGate } from "@/components/entry-gate"

export const revalidate = 3600

export default function Home() {
  return (
    <div style={{ minHeight: "100svh", background: "#fff" }}>
      <EntryGate />
    </div>
  )
}
