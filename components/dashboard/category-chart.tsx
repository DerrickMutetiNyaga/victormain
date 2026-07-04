"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { categoryStats as defaultCategoryStats } from "@/lib/dummy-data"

const COLORS = ["#C4A052", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#38bdf8", "#94a3b8"]

interface CategoryChartProps {
  categoryStats?: { category: string; sales: number; percentage?: number }[]
}

export function CategoryChart({ categoryStats = defaultCategoryStats }: CategoryChartProps) {
  const data = categoryStats?.length ? categoryStats : defaultCategoryStats
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 px-4 md:px-6">
        <CardTitle className="text-base md:text-lg font-semibold text-card-foreground">Sales by Category</CardTitle>
      </CardHeader>
      <CardContent className="px-2 md:px-6">
        {/* Desktop Chart */}
        <div className="hidden md:block h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="sales"
                nameKey="category"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c28",
                  border: "1px solid #2a2a3c",
                  borderRadius: "8px",
                  color: "#fafafa",
                }}
                formatter={(value: number) => [`Ksh ${value.toLocaleString("en-KE")}`, "Sales"]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Mobile Chart */}
        <div className="md:hidden h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="sales"
                nameKey="category"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c28",
                  border: "1px solid #2a2a3c",
                  borderRadius: "8px",
                  color: "#fafafa",
                  fontSize: "11px",
                }}
                formatter={(value: number) => [`Ksh ${value.toLocaleString("en-KE")}`, "Sales"]}
              />
              <Legend
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                formatter={(value) => <span className="text-[10px] text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
