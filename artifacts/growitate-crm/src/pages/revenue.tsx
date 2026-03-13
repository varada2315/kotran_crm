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
import { Plus, IndianRupee, Receipt, Users, Loader2, Trash2, Upload } from "lucide-react";
import { motion } from "framer-motion";

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

export default function RevenuePage() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [itemDraft, setItemDraft] = useState({ itemName: "", quantity: 1, unitPrice: 0 });
  const [items, setItems] = useState<PurchasedItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceAttachment[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: clients, isLoading } = useGetClients(activeWorkspaceId!);

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/analytics`] });
        setDialogOpen(false);
        setClientName("");
        setItemDraft({ itemName: "", quantity: 1, unitPrice: 0 });
        setItems([]);
        setInvoices([]);
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

  const totalRevenue = useMemo(
    () => (clients ?? []).reduce((sum, client) => sum + Number(client.revenueTotal ?? 0), 0),
    [clients],
  );

  const totalInvoices = useMemo(
    () => (clients ?? []).reduce((sum, client) => sum + (client.invoices?.length ?? 0), 0),
    [clients],
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

        nextInvoices.push({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          fileDataUrl: await readFileAsDataUrl(file),
          uploadedAt: new Date().toISOString(),
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

    if (!items.length) {
      setFormError("Add at least one purchased item.");
      return;
    }

    createMutation.mutate({
      workspaceId: activeWorkspaceId!,
      data: {
        clientName: clientName.trim(),
        leadStage: "won",
        purchasedItems: items,
        invoices,
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Revenue</h1>
          <p className="text-muted-foreground mt-1">
            Track sales for {activeWorkspace?.name || "this workspace"} with client name, purchased items, invoice files, and total revenue.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-11 px-6">
              <Plus className="w-4 h-4 mr-2" />
              Add Revenue Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[760px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add Revenue Entry</DialogTitle>
              <DialogDescription>
                Add a client, the items they purchased, invoice files, and save the total revenue.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Enter client or company name"
                  className="rounded-lg"
                />
              </div>

              <div className="rounded-xl border border-border/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Purchased Items</h3>
                    <p className="text-sm text-muted-foreground">Add every item or service the client bought.</p>
                  </div>
                  <div className="font-semibold text-emerald-600">
                    {formatCurrency(items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0))}
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
                    No items added yet.
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

              <div className="rounded-xl border border-border/60 p-4 space-y-4">
                <div>
                  <h3 className="font-semibold">Invoices</h3>
                  <p className="text-sm text-muted-foreground">Upload PDF or image invoices for this client.</p>
                </div>

                <Label htmlFor="invoice-upload" className="sr-only">
                  Upload invoices
                </Label>
                <Input id="invoice-upload" type="file" accept=".pdf,image/*" multiple className="hidden" onChange={handleInvoiceUpload} />
                <Button asChild variant="outline" className="rounded-lg">
                  <label htmlFor="invoice-upload" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Invoice
                  </label>
                </Button>

                {!invoices.length ? (
                  <div className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4">
                    No invoices uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((invoice, index) => (
                      <div key={`${invoice.fileName}-${index}`} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                        <div>
                          <div className="font-medium">{invoice.fileName}</div>
                          <div className="text-sm text-muted-foreground">{formatFileSize(invoice.sizeBytes)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm" className="rounded-lg">
                            <a href={invoice.fileDataUrl} download={invoice.fileName}>
                              View
                            </a>
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="rounded-lg" onClick={() => removeInvoice(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="rounded-xl" disabled={createMutation.isPending} onClick={handleSubmit}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Revenue Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                <p className="text-2xl font-display font-bold mt-1">{clients?.length ?? 0}</p>
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
                  {!clients?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No revenue entries yet. Add your first client sale to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client) => (
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
