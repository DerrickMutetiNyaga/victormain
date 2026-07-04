import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserCircle2, PlusCircle } from "lucide-react"

const clients = [
  { id: 1, name: "Corporate VIP Table", phone: "0790 123 456", visits: 24, spend: 485000, status: "Active" },
  { id: 2, name: "Whisky Lovers Club", phone: "0712 000 999", visits: 12, spend: 215800, status: "Active" },
  { id: 3, name: "Birthday Group", phone: "0700 555 333", visits: 3, spend: 48500, status: "Prospect" },
]

export default function ClientsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Header title="Clients" subtitle="Track frequent customers and groups" />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-sky-100 flex items-center justify-center">
                <UserCircle2 className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Customer List</h2>
                <p className="text-sm text-muted-foreground">Use this to remember your best spenders.</p>
              </div>
            </div>
            <Button variant="outline" className="gap-2 bg-transparent">
              <PlusCircle className="h-4 w-4" />
              Add Client
            </Button>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-card-foreground">Clients</CardTitle>
              <CardDescription>Static demo data for now; hook to your CRM later.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className="border-border">
                      <TableCell className="text-sm text-foreground">{client.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{client.phone}</TableCell>
                      <TableCell className="text-right text-sm text-foreground">{client.visits}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-primary">
                        Ksh {client.spend.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className="text-[11px]"
                          variant={client.status === "Active" ? "default" : "outline"}
                        >
                          {client.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}


