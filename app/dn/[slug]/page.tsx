import type { Metadata } from "next"
import { DeliveryNotePublicClient } from "@/app/delivery-note/[token]/delivery-note-public-client"

export const metadata: Metadata = {
  title: "Delivery note",
  description: "View your Infusion Jaba delivery note",
  robots: { index: false, follow: false },
}

export default function PublicDeliveryNoteShortLinkPage() {
  return <DeliveryNotePublicClient />
}
