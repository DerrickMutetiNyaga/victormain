import type { Db } from "mongodb"
import { sendJabaSmsStrict } from "@/lib/jaba-sms"
import { normalizeKenyaPhone } from "@/lib/phone-utils"

function normalizeKenyaRecipients(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : []
  const normalized = arr
    .map((n) => normalizeKenyaPhone(String(n ?? "")))
    .filter((n): n is string => Boolean(n))
  return [...new Set(normalized)]
}

function buildOnlineOrderSmsMessage(order: Record<string, unknown>): string {
  const orderId = String(order.orderId || order.id || "").trim() || "N/A"
  const table = String(order.tableNumber || order.tableId || "").trim() || "N/A"
  const totalNum = Number(order.total || 0)
  const total = Number.isFinite(totalNum) ? totalNum.toLocaleString() : "0"
  const phone = String(order.customerPhone || "").trim()
  const customerPhone = phone || "N/A"
  return `New online order received.\nOrder: ${orderId}\nTable: ${table}\nTotal: KES ${total}\nCustomer: ${customerPhone}`
}

export async function maybeSendOnlineOrderSms(
  db: Db,
  order: Record<string, unknown>
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const settings = await db.collection("catha_settings").findOne({})
    const phones = normalizeKenyaRecipients(settings?.notifications?.onlineOrderSmsPhones ?? [])
    if (!phones.length) return { sent: false, reason: "no_recipients" }
    const message = buildOnlineOrderSmsMessage(order)
    await sendJabaSmsStrict(message, phones)
    return { sent: true }
  } catch (error) {
    console.error("[online-order-sms] Failed to send SMS:", error)
    return { sent: false, reason: "sms_send_failed" }
  }
}

