import { useMemo, useState, type ChangeEvent } from "react";
import { useCreateClient, useDeleteClient, useGetClients, type InvoiceAttachment, type PurchasedItem } from "@workspace/api-client-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, IndianRupee, Receipt, Users, Loader2, Trash2, Upload, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const MAX_INVOICE_SIZE_BYTES = 2 * 1024 * 1024;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function extractCostFromPdf(dataUrl: string): Promise<number | null> {
  try {
    // @ts-ignore
    const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.mjs";

    const loadingTask = pdfjsLib.getDocument(dataUrl);
    const pdf = await loadingTask.promise;
    let fullText = "";

    // Parse up to first 3 pages
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    // Heuristics for finding the total amount
    const patterns = [
      /(?:grand\s*total|total\s*amount|amount\s*due|total|payable|balance)\s*[:\s]*[^\d\w]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)/gi,
      /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{2})?)/gi,
    ];

    let candidates: number[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount) && amount > 0) {
          candidates.push(amount);
        }
      }
    }

    if (candidates.length > 0) {
      // In invoices, the largest amount found is often the total
      return Math.max(...candidates);
    }

    return null;
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    return null;
  }
}

export default function RevenuePage() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualRevenue, setManualRevenue] = useState<number | "">("");
  const [itemDraft, setItemDraft] = useState({ itemName: "", quantity: 1, unitPrice: 0 });
  const [items, setItems] = useState<PurchasedItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceAttachment[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch ALL won-stage clients without period filter — period filtering is done
  // client-side so past-dated entries (e.g. Jan sales added today) are never hidden.
  const { data: allClients, isLoading } = useGetClients(activeWorkspaceId!);
  const wonClients = useMemo(
    () => (allClients ?? []).filter((c) => c.leadStage === "won"),
    [allClients],
  );

  // Period-filtered subset — used only for table view when period != "all"
  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "year") return new Date(now.getFullYear(), 0, 1);
    return null;
  }, [period]);

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/analytics`] });
        setDialogOpen(false);
        setClientName("");
        setClientPhone("");
        setItemDraft({ itemName: "", quantity: 1, unitPrice: 0 });
        setItems([]);
        setInvoices([]);
        setManualRevenue("");
        setFormError(null);
      },
    },
  });

  const deleteMutation = useDeleteClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/analytics`] });
      },
    },
  });

  // periodClients = won entries filtered by sale date for analytics stats
  const periodClients = useMemo(
    () =>
      periodStart
        ? wonClients.filter((c) => new Date(c.createdAt ?? 0) >= periodStart)
        : wonClients,
    [wonClients, periodStart],
  );

  const totalRevenue = useMemo(
    () => periodClients.reduce((sum, client) => sum + Number(client.revenueTotal ?? 0), 0),
    [periodClients],
  );

  const totalInvoices = useMemo(
    () => periodClients.reduce((sum, client) => sum + (client.invoices?.length ?? 0), 0),
    [periodClients],
  );

  const itemsTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0),
    [items]
  );

  const addItem = () => {
    if (!itemDraft.itemName.trim()) {
      setFormError("Add an item name.");
      return;
    }

    if (itemDraft.quantity < 1) {
      setFormError("Quantity must be at least 1.");
      return;
    }

    if (itemDraft.unitPrice < 0) {
      setFormError("Cost cannot be negative.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        itemName: itemDraft.itemName.trim(),
        quantity: itemDraft.quantity,
        unitPrice: itemDraft.unitPrice,
        totalPrice: itemDraft.quantity * itemDraft.unitPrice,
      },
    ]);
    setItemDraft({ itemName: "", quantity: 1, unitPrice: 0 });
    setFormError(null);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleInvoiceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) {
      return;
    }

    try {
      const nextInvoices = [...invoices];

      for (const file of Array.from(fileList)) {
        if (file.size > MAX_INVOICE_SIZE_BYTES) {
          throw new Error(`${file.name} is larger than 2 MB.`);
        }

        const fileDataUrl = await readFileAsDataUrl(file);
        let amount = 0;

        if (file.type === "application/pdf") {
          const detectedAmount = await extractCostFromPdf(fileDataUrl);
          if (detectedAmount) {
            amount = detectedAmount;
          }
        }

        nextInvoices.push({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          fileDataUrl,
          uploadedAt: new Date().toISOString(),
          amount,
        });
      }

      setInvoices(nextInvoices);
      setFormError(null);
      event.target.value = "";
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to upload invoice.");
    }
  };

  const removeInvoice = (index: number) => {
    setInvoices((current) => current.filter((_, invoiceIndex) => invoiceIndex !== index));
  };

  const handleSubmit = () => {
    if (!clientName.trim()) {
      setFormError("Client name is required.");
      return;
    }

    createMutation.mutate({
      workspaceId: activeWorkspaceId!,
      data: {
        clientName: clientName.trim(),
        phone: clientPhone.trim() || undefined,
        leadStage: "won",
        purchasedItems: items,
        invoices,
        createdAt: saleDate ? new Date(saleDate).toISOString() : undefined,
        revenueTotal: invoices.length > 0 ? undefined : (manualRevenue === "" ? itemsTotal : Number(manualRevenue)),
      },
    });
  };

  const handleDeleteClient = (clientId: number, name: string) => {
    if (!window.confirm(`Delete "${name}" from revenue entries?`)) {
      return;
    }

    deleteMutation.mutate({ workspaceId: activeWorkspaceId!, clientId });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-display font-bold">Revenue</h1>
          <p className="text-muted-foreground mt-1">
            Track sales for {activeWorkspace?.name || "this workspace"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/50">
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as any)} className="h-8">
              <ToggleGroupItem value="day" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Day</ToggleGroupItem>
              <ToggleGroupItem value="week" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Week</ToggleGroupItem>
              <ToggleGroupItem value="month" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Month</ToggleGroupItem>
              <ToggleGroupItem value="year" className="px-3 rounded-lg text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm">Year</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl h-11 px-6">
                <Plus className="w-4 h-4 mr-2" />
                Add Revenue Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[95vh] overflow-hidden flex flex-col p-0">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="text-2xl font-bold">Add Revenue Entry</DialogTitle>
                <DialogDescription>
                  Track a new sale by adding client details and revenue.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-name" className="text-sm font-medium">Client Name</Label>
                    <Input
                      id="client-name"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="h-10 rounded-xl bg-muted/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-phone" className="text-sm font-medium">Phone (Optional)</Label>
                    <Input
                      id="client-phone"
                      value={clientPhone}
                      onChange={(event) => setClientPhone(event.target.value)}
                      placeholder="e.g. +91 987..."
                      className="h-10 rounded-xl bg-muted/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale-date" className="text-sm font-medium">Sale Date</Label>
                    <Input
                      id="sale-date"
                      type="date"
                      value={saleDate}
                      onChange={(event) => setSaleDate(event.target.value)}
                      className="h-10 rounded-xl bg-muted/20"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Purchased Items</h3>
                    <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Total: {formatCurrency(itemsTotal)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Item</Label>
                      <Input
                        value={itemDraft.itemName}
                        onChange={(event) => setItemDraft((current) => ({ ...current, itemName: event.target.value }))}
                        placeholder="SEO retainer, hosting, ad spend..."
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={itemDraft.quantity}
                        onChange={(event) =>
                          setItemDraft((current) => ({ ...current, quantity: Number(event.target.value || 1) }))
                        }
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={itemDraft.unitPrice}
                        onChange={(event) =>
                          setItemDraft((current) => ({ ...current, unitPrice: Number(event.target.value || 0) }))
                        }
                        className="rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" variant="outline" className="rounded-lg" onClick={addItem}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {!items.length ? (
                    <div className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4">
                      No items added yet. (Optional)
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={`${item.itemName}-${index}`} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                          <div>
                            <div className="font-medium">{item.itemName}</div>
                            <div className="text-sm text-muted-foreground">
                              Qty {item.quantity ?? 1} x {formatCurrency(item.unitPrice)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="font-semibold">{formatCurrency(item.totalPrice ?? 0)}</div>
                            <Button type="button" variant="ghost" size="icon" className="rounded-lg" onClick={() => removeItem(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Invoices & Revenue</h3>
                    <div className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      Final Rev: {formatCurrency(invoices.length > 0 ? invoices.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0) : (manualRevenue === "" ? itemsTotal : Number(manualRevenue)))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Input id="invoice-upload" type="file" accept=".pdf,image/*" multiple className="hidden" onChange={handleInvoiceUpload} />
                    <Button asChild variant="outline" className="rounded-xl h-10 border-dashed hover:bg-muted/50 transition-colors flex-1">
                      <label htmlFor="invoice-upload" className="cursor-pointer flex items-center justify-center">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Files
                      </label>
                    </Button>
                  </div>

                  {invoices.length > 0 ? (
                    <div className="space-y-2">
                      {invoices.map((invoice, index) => (
                        <div key={`${invoice.fileName}-${index}`} className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 p-3 border border-border/50">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{invoice.fileName}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{formatFileSize(invoice.sizeBytes)}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-[9px] text-muted-foreground font-bold">AMOUNT</span>
                              <Input
                                type="number"
                                className="h-8 w-24 text-right bg-background border-border/50 rounded-lg text-sm"
                                value={invoice.amount ?? 0}
                                onChange={(e) => {
                                  const next = [...invoices];
                                  next[index] = { ...next[index], amount: Number(e.target.value || 0) };
                                  setInvoices(next);
                                }}
                              />
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => removeInvoice(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-revenue" className="text-xs font-bold text-muted-foreground uppercase">Manual Revenue Amount (₹)</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="manual-revenue"
                            type="number"
                            placeholder={`Default: ${itemsTotal}`}
                            value={manualRevenue}
                            onChange={(e) => setManualRevenue(e.target.value ? Number(e.target.value) : "")}
                            className="pl-9 h-11 rounded-xl bg-muted/20 border-border/50 font-semibold"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">If left empty, total from items ({formatCurrency(itemsTotal)}) will be used.</p>
                      </div>
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center">
                    <div className="w-1 h-4 bg-destructive rounded-full mr-3" />
                    {formError}
                  </div>
                )}
              </div>

              <DialogFooter className="p-6 pt-2 border-t mt-auto flex items-center justify-between sm:justify-between">
                <Button type="button" variant="ghost" className="rounded-xl px-6" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-xl px-8 h-11 font-semibold hover-elevate shadow-lg shadow-primary/20" disabled={createMutation.isPending} onClick={handleSubmit}>
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-display font-bold mt-1">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clients Added</p>
                <p className="text-2xl font-display font-bold mt-1">{periodClients.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoices Stored</p>
                <p className="text-2xl font-display font-bold mt-1">{totalInvoices}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Revenue Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Client</TableHead>
                    <TableHead>Items Purchased</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Invoices</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!wonClients.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No revenue entries yet. Add your first client sale to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    wonClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {(client.purchasedItems ?? []).length ? (
                              (client.purchasedItems ?? []).map((item, index) => (
                                <div key={`${item.itemName}-${index}`} className="text-sm">
                                  {item.itemName} - {formatCurrency(item.totalPrice ?? item.unitPrice * (item.quantity ?? 1))}
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No items</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          {formatCurrency(Number(client.revenueTotal ?? 0))}
                        </TableCell>
                        <TableCell>{client.invoices?.length ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {client.leadStage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDeleteClient(client.id, client.clientName)}
                          >
                            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
