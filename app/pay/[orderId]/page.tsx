import { PayOrderClient } from "@/components/pay/pay-order-client"

export const metadata = {
  title: "Pay Order | catha lounge",
  description: "Scan to pay your order with M-Pesa — fast and secure",
  robots: { index: false, follow: false },
}

export default async function PayOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  return <PayOrderClient orderId={orderId} />
}
