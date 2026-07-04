"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { hourlyStats as defaultHourly, weeklyData as defaultWeekly } from "@/lib/dummy-data"
import { useState } from "react"

interface SalesChartProps {
  hourlyStats?: { hour: string; sales: number; orders: number }[]
  weeklyData?: { day: string; sales: number; orders: number }[]
}

export function SalesChart({ hourlyStats = defaultHourly, weeklyData = defaultWeekly }: SalesChartProps) {
  const [period, setPeriod] = useState("today")

  const data = period === "today" ? (hourlyStats?.length ? hourlyStats : defaultHourly) : (weeklyData?.length ? weeklyData : defaultWeekly)
  const xKey = period === "today" ? "hour" : "day"

  return (
    <Card className="lg:col-span-2 border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 md:px-6">
        <CardTitle className="text-base md:text-lg font-semibold text-card-foreground">Sales Overview</CardTitle>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="bg-secondary h-8 md:h-9">
            <TabsTrigger value="today" className="text-[10px] md:text-xs px-2 md:px-3">
              Today
            </TabsTrigger>
            <TabsTrigger value="week" className="text-[10px] md:text-xs px-2 md:px-3">
              Week
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-2 md:pt-4 px-2 md:px-6">
        <div className="h-[200px] md:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C4A052" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C4A052" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" vertical={false} />
              <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={(value) => `Ksh ${(value / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c28",
                  border: "1px solid #2a2a3c",
                  borderRadius: "8px",
                  color: "#fafafa",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`Ksh ${value.toLocaleString("en-KE")}`, "Sales"]}
              />
              <Area type="monotone" dataKey="sales" stroke="#C4A052" strokeWidth={2} fill="url(#salesGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
