"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { weeklyData } from "@/lib/dummy-data"
import { useState } from "react"

const monthlyData = [
  { month: "Jan", sales: 98500, profit: 32400 },
  { month: "Feb", sales: 112000, profit: 38200 },
  { month: "Mar", sales: 125600, profit: 42800 },
  { month: "Apr", sales: 118400, profit: 39600 },
  { month: "May", sales: 142000, profit: 48500 },
  { month: "Jun", sales: 156800, profit: 54200 },
  { month: "Jul", sales: 168400, profit: 58900 },
  { month: "Aug", sales: 175200, profit: 62400 },
  { month: "Sep", sales: 162800, profit: 56800 },
  { month: "Oct", sales: 148600, profit: 51200 },
  { month: "Nov", sales: 156200, profit: 54800 },
  { month: "Dec", sales: 185400, profit: 65200 },
]

export function SalesReport() {
  const [period, setPeriod] = useState("weekly")

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">Sales Performance</CardTitle>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="weekly" className="text-xs">
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">
              Monthly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            {period === "weekly" ? (
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  tickFormatter={(value) => `Ksh ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1c28",
                    border: "1px solid #2a2a3c",
                    borderRadius: "8px",
                    color: "#fafafa",
                  }}
                  formatter={(value: number) => [`Ksh ${value.toLocaleString()}`, "Sales"]}
                />
                <Bar dataKey="sales" fill="#C4A052" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  tickFormatter={(value) => `Ksh ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1c28",
                    border: "1px solid #2a2a3c",
                    borderRadius: "8px",
                    color: "#fafafa",
                  }}
                  formatter={(value: number) => [`Ksh ${value.toLocaleString()}`]}
                />
                <Line type="monotone" dataKey="sales" stroke="#C4A052" strokeWidth={2} dot={{ fill: "#C4A052" }} />
                <Line type="monotone" dataKey="profit" stroke="#4ade80" strokeWidth={2} dot={{ fill: "#4ade80" }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
