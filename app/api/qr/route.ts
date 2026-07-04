import { NextResponse } from "next/server"
import QRCode from "qrcode"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")?.trim()
  if (!url || url.length > 2048) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  try {
    const buffer = await QRCode.toBuffer(url, {
      type: "png",
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#064e3b", light: "#ffffff" },
    })
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch {
    return NextResponse.json({ error: "QR generation failed" }, { status: 500 })
  }
}
