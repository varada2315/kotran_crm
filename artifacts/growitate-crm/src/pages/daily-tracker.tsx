import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, BarChart3, IndianRupee, TrendingUp, Users, X, Plus, Trash2, Zap } from "lucide-react";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";

interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  metaSpend: number;
  leads: number;
  revenue: number;
  createdAt: string;
}

export default function DailyTracker() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [metaSpend, setMetaSpend] = useState<string>("");
  const [leads, setLeads] = useState<string>("");
  const [revenue, setRevenue] = useState<string>("");
  const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('all');

  // Load entries from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("dailyTrackerEntries");
    if (stored) {
      try {
        setEntries(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored entries", e);
      }
    }
  }, []);

  // Save entries to localStorage whenever entries change
  useEffect(() => {
    localStorage.setItem("dailyTrackerEntries", JSON.stringify(entries));
  }, [entries]);

  const handleAddEntry = () => {
    if (!date.trim()) {
      toast({ title: "Date is required", variant: "destructive" });
      return;
    }
    const spend = parseFloat(metaSpend);
    const leadsNum = parseFloat(leads);
    const revenueNum = parseFloat(revenue);
    if (isNaN(spend) || spend < 0) {
      toast({ title: "Valid Meta Ad Spend is required", variant: "destructive" });
      return;
    }
    if (isNaN(leadsNum) || leadsNum < 0) {
      toast({ title: "Valid Leads Generated is required", variant: "destructive" });
      return;
    }
    if (isNaN(revenueNum) || revenueNum < 0) {
      toast({ title: "Valid Revenue Generated is required", variant: "destructive" });
      return;
    }

    const existingIndex = entries.findIndex((entry) => entry.date === date);
    if (existingIndex >= 0) {
      // Update existing entry
      const updated = [...entries];
      updated[existingIndex] = {
        ...updated[existingIndex],
        metaSpend: spend,
        leads: leadsNum,
        revenue: revenueNum,
      };
      setEntries(updated);
      toast({ title: "Entry updated successfully" });
    } else {
      // Add new entry
      const newEntry: DailyEntry = {
        id: Date.now().toString(),
        date,
        metaSpend: spend,
        leads: leadsNum,
        revenue: revenueNum,
        createdAt: new Date().toISOString(),
      };
      setEntries([newEntry, ...entries]);
      toast({ title: "Entry added successfully" });
    }
    // Reset form
    setMetaSpend("");
    setLeads("");
    setRevenue("");
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter((entry) => entry.id !== id));
    toast({ title: "Entry deleted" });
  };

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries]);

  const totalMetaSpend = useMemo(() => entries.reduce((sum, entry) => sum + entry.metaSpend, 0), [entries]);
  const totalLeads = useMemo(() => entries.reduce((sum, entry) => sum + entry.leads, 0), [entries]);
  const totalRevenue = useMemo(() => entries.reduce((sum, entry) => sum + entry.revenue, 0), [entries]);
  const roas = useMemo(() => totalMetaSpend > 0 ? totalRevenue / totalMetaSpend : 0, [totalMetaSpend, totalRevenue]);
  const roasColor = roas >= 3 ? "text-green-600" : roas >= 1 ? "text-yellow-600" : "text-red-600";
  const roasBgColor = roas >= 3 ? "bg-green-100" : roas >= 1 ? "bg-yellow-100" : "bg-red-100";

  // Filter entries based on date range
  const filteredEntries = useMemo(() => {
    if (dateRange === 'all') return entries;
    const days = dateRange === '7' ? 7 : 30;
    const cutoff = subDays(new Date(), days);
    return entries.filter(entry => new Date(entry.date) >= cutoff);
  }, [entries, dateRange]);

  // Calculate filtered totals for KPI pills
  const filteredTotalSpend = useMemo(() =>
    filteredEntries.reduce((sum, entry) => sum + entry.metaSpend, 0),
    [filteredEntries]
  );
  const filteredTotalRevenue = useMemo(() =>
    filteredEntries.reduce((sum, entry) => sum + entry.revenue, 0),
    [filteredEntries]
  );
  const filteredROAS = useMemo(() =>
    filteredTotalSpend > 0 ? filteredTotalRevenue / filteredTotalSpend : 0,
    [filteredTotalSpend, filteredTotalRevenue]
  );
  const filteredROASColor = filteredROAS >= 3 ? "bg-green-500" : filteredROAS >= 1 ? "bg-yellow-500" : "bg-red-500";

  // Prepare chart data with CPL
  const chartData = useMemo(() => {
    const data = filteredEntries.map(entry => ({
      date: entry.date,
      metaSpend: entry.metaSpend,
      leads: entry.leads,
      revenue: entry.revenue,
      cpl: entry.leads > 0 ? entry.metaSpend / entry.leads : 0,
    }));
    // Sort by date ascending for charts
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredEntries]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-IN").format(num);
  };

  const getCostPerLeadColor = (cpl: number) => {
    if (cpl < 500) return "bg-green-500";
    if (cpl <= 1000) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Tracker</h1>
          <p className="text-muted-foreground">Track your daily ad spend, leads, and revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
        </div>
      </div>

      {/* Add Daily Entry Form */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Daily Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="metaSpend">Meta Ad Spend (₹)</Label>
              <Input
                id="metaSpend"
                type="number"
                placeholder="0"
                value={metaSpend}
                onChange={(e) => setMetaSpend(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="leads">Leads Generated</Label>
              <Input
                id="leads"
                type="number"
                placeholder="0"
                value={leads}
                onChange={(e) => setLeads(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="revenue">Revenue Generated (₹)</Label>
              <Input
                id="revenue"
                type="number"
                placeholder="0"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={handleAddEntry}
              className="rounded-xl h-11 px-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Total Meta Spend</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalMetaSpend)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Total Leads</p>
                <p className="text-2xl font-bold mt-1">{formatNumber(totalLeads)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">ROAS</p>
                <p className={`text-2xl font-bold mt-1 ${roasColor}`}>
                  {roas.toFixed(1)}x
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(totalRevenue)} revenue / {formatCurrency(totalMetaSpend)} spend
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full ${roasBgColor} flex items-center justify-center`}>
                <Zap className={`h-6 w-6 ${roasColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Entries Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedEntries.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No entries yet. Add your first daily entry above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Meta Ad Spend</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Cost Per Lead</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map((entry) => {
                    const cpl = entry.leads > 0 ? entry.metaSpend / entry.leads : 0;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {format(new Date(entry.date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>{formatCurrency(entry.metaSpend)}</TableCell>
                        <TableCell>{formatNumber(entry.leads)}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(entry.revenue)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${getCostPerLeadColor(cpl)} text-white`}
                            variant="secondary"
                          >
                            {formatCurrency(cpl)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Combined Ad ROI Chart */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Ad ROI Overview</CardTitle>
            <div className="flex items-center gap-3 mt-2">
              {/* KPI Pills */}
              <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-800 px-3 py-1 rounded-full text-sm">
                <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                <span className="font-medium">Total Spent:</span>
                <span>{formatCurrency(filteredTotalSpend)}</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-800 px-3 py-1 rounded-full text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="font-medium">Total Revenue:</span>
                <span>{formatCurrency(filteredTotalRevenue)}</span>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${filteredROASColor.replace('500', '50')} ${filteredROAS >= 3 ? 'text-green-800' : filteredROAS >= 1 ? 'text-yellow-800' : 'text-red-800'}`}>
                <div className={`h-2 w-2 rounded-full ${filteredROASColor}`}></div>
                <span className="font-medium">ROAS:</span>
                <span>{filteredROAS.toFixed(1)}x</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={dateRange === '7' ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange('7')}
              className="rounded-lg"
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRange === '30' ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange('30')}
              className="rounded-lg"
            >
              Last 30 Days
            </Button>
            <Button
              variant={dateRange === 'all' ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange('all')}
              className="rounded-lg"
            >
              All Time
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(value) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8b5cf6' }}
                  tickFormatter={(value) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                />
                <RechartsTooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Meta Spend') return [`₹${Number(value).toLocaleString('en-IN')}`, 'Meta Spend'];
                    if (name === 'Revenue') return [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue'];
                    if (name === 'CPL') return [`₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 'Cost Per Lead'];
                    return [value.toString(), name];
                  }}
                  labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => {
                    if (value === 'metaSpend') return 'Meta Spend';
                    if (value === 'revenue') return 'Revenue';
                    if (value === 'cpl') return 'CPL';
                    return value;
                  }}
                />
                <Bar
                  dataKey="metaSpend"
                  name="Meta Spend"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                  yAxisId="left"
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                  yAxisId="left"
                />
                <Line
                  type="monotone"
                  dataKey="cpl"
                  name="CPL"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: '#8b5cf6' }}
                  activeDot={{ r: 5, fill: '#8b5cf6' }}
                  yAxisId="right"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Showing {filteredEntries.length} {dateRange === 'all' ? 'total' : dateRange === '7' ? 'last 7 days' : 'last 30 days'} entries •
            <span className="ml-2">🟠 Meta Spend</span>
            <span className="mx-2">🟢 Revenue</span>
            <span className="text-purple-600">⎯ CPL (dashed)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}