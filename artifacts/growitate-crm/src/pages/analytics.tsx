import { useWorkspace } from "@/contexts/workspace-context";
import { useGetAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Activity, Target, DollarSign, Loader2, Calendar, Receipt, IndianRupee } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import { motion } from "framer-motion";

const COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899'];

const OPPORTUNITY_COLORS = ['#10B981', '#3B82F6', '#7C3AED', '#F59E0B', '#F43F5E', '#8B5CF6'];

export default function AnalyticsDashboard() {
  const { activeWorkspaceId } = useWorkspace();
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [view, setView] = useState<"analytics" | "revenue">("analytics");
  const { data: stats, isLoading } = useGetAnalytics(activeWorkspaceId!, { period });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Clients", value: stats.totalClients, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Total Revenue", value: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(stats.totalRevenue), icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "New This Month", value: stats.newClientsThisMonth, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Total Activities", value: stats.totalActivities, icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Won Deals", value: stats.wonClients || 0, icon: Target, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  const hasOpportunityData = stats.opportunityBySize && stats.opportunityBySize.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-display font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Insights and metrics for your workspace</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
        <Tabs value={view} onValueChange={(v) => setView(v as "analytics" | "revenue")} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 w-full sm:w-[300px] h-10 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Activity className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="revenue" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <DollarSign className="w-4 h-4 mr-2" />
              Revenue
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl">
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as any)} className="h-8">
            <ToggleGroupItem value="day" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Day</ToggleGroupItem>
            <ToggleGroupItem value="week" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Week</ToggleGroupItem>
            <ToggleGroupItem value="month" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Month</ToggleGroupItem>
            <ToggleGroupItem value="year" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Year</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {view === "analytics" ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map((stat, i) => (
              <Card key={i} className="rounded-2xl border-border/50 shadow-sm">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
                    <h3 className="text-3xl font-display font-bold">{stat.value}</h3>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Clients by Lead Stage</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.clientsByStage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} className="capitalize" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                    <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={50} name="Clients" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Activities Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.activitiesByType}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="type"
                    >
                      {stats.activitiesByType.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value, name) => [value, name]} />
                    <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 12, color: '#64748B', textTransform: 'capitalize' }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* Revenue View Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Revenue Forecast & Trend</CardTitle>
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {period === "month" ? "MTD" : period.toUpperCase()}
                </div>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.monthlyRevenue || []} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v: number) => `₹${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}`} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                      formatter={(v: number) => [new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v), 'Revenue']}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={4} dot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Top Clients by Revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {(stats.topClients || []).length > 0 ? (
                    stats.topClients?.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center font-bold text-primary shadow-sm border border-border/50">
                            {i + 1}
                          </div>
                          <span className="font-semibold">{c.name}</span>
                        </div>
                        <span className="font-display font-bold text-emerald-600">
                          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(c.revenue)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-muted-foreground">
                      No revenue data for this period.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Opportunity Size Analysis */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <CardTitle>Opportunity Size Distribution</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Number of clients by opportunity size</p>
          </div>
        </CardHeader>
        <CardContent>
          {hasOpportunityData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Bar Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.opportunityBySize}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="size" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} width={90} />
                    <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [value, 'Clients']} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32} name="Clients">
                      {stats.opportunityBySize.map((_, index) => (
                        <Cell key={`opp-${index}`} fill={OPPORTUNITY_COLORS[index % OPPORTUNITY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Table */}
              <div className="space-y-3">
                {stats.opportunityBySize.map((item, index) => {
                  const total = stats.opportunityBySize.reduce((sum, o) => sum + o.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: OPPORTUNITY_COLORS[index % OPPORTUNITY_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium truncate">{item.size}</span>
                          <span className="text-sm text-muted-foreground ml-2">{item.count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: OPPORTUNITY_COLORS[index % OPPORTUNITY_COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <DollarSign className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No opportunity size data yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Set opportunity sizes on your clients to see this chart.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Growth */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Client Growth (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.monthlyClients} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [value, 'New Clients']} />
              <Line type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={3} dot={{ r: 4, fill: '#7C3AED', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="New Clients" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
