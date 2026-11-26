import { useState, type ChangeEvent, type ComponentType } from "react";
import { Link, useLocation } from "wouter";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  useGetClient,
  useUpdateClient,
  useDeleteClient,
  useGetClientActivities,
  useCreateActivity,
  type InvoiceAttachment,
  type PurchasedItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Briefcase,
  Clock,
  Calendar,
  FileText,
  CheckCircle2,
  Loader2,
  Save,
  Plus,
  IndianRupee,
  Receipt,
  Upload,
  Trash2,
} from "lucide-react";
import { STAGE_COLORS } from "@/lib/stage-colors";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { format } from "date-fns";

const updateClientSchema = z.object({
  clientName: z.string().min(1),
  displayName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  leadStage: z.string(),
  opportunitySize: z.string().optional(),
  notes: z.string().optional(),
});

const createActivitySchema = z.object({
  type: z.enum(["call", "meeting", "note", "follow_up", "task"]),
  description: z.string().min(1, "Description is required"),
  date: z.string().optional(),
});

const purchaseItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Price cannot be negative"),
});

const ACTIVITY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  client_added: CheckCircle2,
  call: Phone,
  meeting: Briefcase,
  note: FileText,
  follow_up: Clock,
  task: Calendar,
};

const MAX_INVOICE_SIZE_BYTES = 2 * 1024 * 1024;

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
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

export default function ClientDetail({ id }: { id: number }) {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState({ itemName: "", quantity: 1, unitPrice: 0 });
  const [itemError, setItemError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const { data: client, isLoading } = useGetClient(activeWorkspaceId!, id);
  const { data: activities } = useGetClientActivities(activeWorkspaceId!, id);

  const updateMutation = useUpdateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients/${id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/analytics`] });
        setIsEditing(false);
      },
    },
  });

  const createActivityMutation = useCreateActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients/${id}/activities`] });
        setActivityFormOpen(false);
        activityForm.reset();
      },
    },
  });

  const deleteMutation = useDeleteClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/analytics`] });
        setLocation("/clients");
      },
    },
  });

  const editForm = useForm({
    resolver: zodResolver(updateClientSchema),
    values: client
      ? {
          clientName: client.clientName,
          displayName: client.displayName || "",
          email: client.email || "",
          phone: client.phone || "",
          whatsapp: client.whatsapp || "",
          leadStage: client.leadStage,
          opportunitySize: client.opportunitySize || "",
          notes: client.notes || "",
        }
      : undefined,
  });

  const activityForm = useForm({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { 
      type: "note" as "call" | "meeting" | "note" | "follow_up" | "task", 
      description: "", 
      date: "" 
    },
  });

  const purchasedItems = client?.purchasedItems ?? [];
  const invoices = client?.invoices ?? [];
  const totalRevenue =
    client?.revenueTotal ??
    invoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  const onUpdateSubmit = (data: z.infer<typeof updateClientSchema>) => {
    updateMutation.mutate({ workspaceId: activeWorkspaceId!, clientId: id, data: data as any });
  };

  const onActivitySubmit = (data: z.infer<typeof createActivitySchema>) => {
    createActivityMutation.mutate({ workspaceId: activeWorkspaceId!, clientId: id, data });
  };

  const savePurchasedItems = (nextItems: PurchasedItem[]) => {
    updateMutation.mutate({
      workspaceId: activeWorkspaceId!,
      clientId: id,
      data: { purchasedItems: nextItems },
    });
  };

  const saveInvoices = (nextInvoices: InvoiceAttachment[]) => {
    updateMutation.mutate({
      workspaceId: activeWorkspaceId!,
      clientId: id,
      data: { invoices: nextInvoices },
    });
  };

  const handleAddItem = () => {
    const parsed = purchaseItemSchema.safeParse(itemDraft);
    if (!parsed.success) {
      setItemError(parsed.error.issues[0]?.message ?? "Please enter a valid item.");
      return;
    }

    const nextItem: PurchasedItem = {
      ...parsed.data,
      totalPrice: parsed.data.quantity * parsed.data.unitPrice,
    };

    setItemError(null);
    savePurchasedItems([...purchasedItems, nextItem]);
    setItemDraft({ itemName: "", quantity: 1, unitPrice: 0 });
  };

  const handleRemoveItem = (index: number) => {
    savePurchasedItems(purchasedItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleInvoiceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) {
      return;
    }

    try {
      const nextInvoices: InvoiceAttachment[] = [...invoices];

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

      setInvoiceError(null);
      saveInvoices(nextInvoices);
      event.target.value = "";
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "Unable to upload invoice.");
    }
  };

  const handleUpdateInvoiceAmount = (index: number, amount: number) => {
    const nextInvoices = [...invoices];
    nextInvoices[index] = { ...nextInvoices[index], amount };
    saveInvoices(nextInvoices);
  };

  const handleRemoveInvoice = (index: number) => {
    saveInvoices(invoices.filter((_, invoiceIndex) => invoiceIndex !== index));
  };

  const handleDeleteClient = () => {
    if (!client) return;
    if (!window.confirm(`Delete client "${client.clientName}"?`)) {
      return;
    }

    deleteMutation.mutate({ workspaceId: activeWorkspaceId!, clientId: id });
  };

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon" className="rounded-xl border border-border/50 bg-card">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold">{client.clientName}</h1>
            <Badge variant="outline" className={`capitalize text-sm px-3 py-0.5 border ${STAGE_COLORS[client.leadStage]}`}>
              {client.leadStage}
            </Badge>
          </div>
          {client.displayName && <p className="text-muted-foreground mt-1">Contact: {client.displayName}</p>}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${user?.role === "admin" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
        {user?.role === "admin" && (
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
        )}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Purchased Items</p>
                <p className="text-2xl font-display font-bold mt-1">{purchasedItems.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoices Uploaded</p>
                <p className="text-2xl font-display font-bold mt-1">{invoices.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 rounded-2xl shadow-sm border-border">
          <CardHeader className="flex flex-row justify-between items-center pb-4 border-b border-border/50">
            <CardTitle className="text-lg">Client Details</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg h-8 text-destructive hover:text-destructive"
                onClick={handleDeleteClient}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </Button>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                className="rounded-lg h-8"
                onClick={() => (isEditing ? editForm.handleSubmit(onUpdateSubmit)() : setIsEditing(true))}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isEditing ? (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Save
                  </>
                ) : (
                  "Edit"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="space-y-5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client Name</Label>
                {isEditing ? (
                  <Input {...editForm.register("clientName")} className="h-10 rounded-lg" />
                ) : (
                  <div className="font-medium">{client.clientName}</div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Contact Person</Label>
                {isEditing ? (
                  <Input {...editForm.register("displayName")} className="h-10 rounded-lg" />
                ) : (
                  <div className="font-medium">{client.displayName || "-"}</div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stage</Label>
                {isEditing ? (
                  <Select onValueChange={(v) => editForm.setValue("leadStage", v)} defaultValue={client.leadStage}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STAGE_COLORS).map((stage) => (
                        <SelectItem key={stage} value={stage as any} className="capitalize">
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="font-medium capitalize">{client.leadStage}</div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                {isEditing ? (
                  <Input {...editForm.register("email")} className="h-10 rounded-lg" />
                ) : (
                  <div className="flex items-center gap-2 font-medium">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {client.email || "-"}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                {isEditing ? (
                  <Input {...editForm.register("phone")} className="h-10 rounded-lg" />
                ) : (
                  <div className="flex items-center gap-2 font-medium">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {client.phone || "-"}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                {isEditing ? (
                  <Input {...editForm.register("whatsapp")} className="h-10 rounded-lg" />
                ) : (
                  <div className="flex items-center gap-2 font-medium">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    {client.whatsapp ? (
                      <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">
                        {client.whatsapp}
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Opportunity Size</Label>
                {isEditing ? (
                  <Input {...editForm.register("opportunitySize")} className="h-10 rounded-lg" placeholder="e.g. Retainer" />
                ) : (
                  <div className="font-medium">{client.opportunitySize || "-"}</div>
                )}
              </div>

              <div className="space-y-1 pt-2 border-t border-border/50">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                {isEditing ? (
                  <Textarea {...editForm.register("notes")} className="min-h-[100px] rounded-lg mt-2" />
                ) : (
                  <p className="text-sm mt-1 whitespace-pre-wrap">{client.notes || "No notes added yet."}</p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
              <CardTitle className="text-lg">Purchased Items</CardTitle>
              {user?.role === "admin" && <div className="text-sm font-medium text-emerald-600">{formatCurrency(totalRevenue)}</div>}
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2 space-y-2">
                  <Label>Item / Service</Label>
                  <Input
                    value={itemDraft.itemName}
                    onChange={(event) => setItemDraft((current) => ({ ...current, itemName: event.target.value }))}
                    placeholder="SEO retainer, Hosting, Ad budget..."
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
                  <Label>Unit Price</Label>
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
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {user?.role === "admin" 
                    ? "Track products or services for reference. Revenue is now calculated from invoice costs."
                    : "Track products or services associated with this client."}
                </div>
                <Button onClick={handleAddItem} disabled={updateMutation.isPending} className="rounded-lg">
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Item
                </Button>
              </div>
              {itemError && <p className="text-sm text-destructive">{itemError}</p>}

              {!purchasedItems.length ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No purchases recorded for this client yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {purchasedItems.map((item, index) => {
                    const totalPrice = item.totalPrice ?? item.unitPrice * (item.quantity ?? 1);
                    return (
                      <div key={`${item.itemName}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
                        <div>
                          <p className="font-medium">{item.itemName}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty {item.quantity ?? 1} x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {user?.role === "admin" && <div className="font-semibold">{formatCurrency(totalPrice)}</div>}
                          <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => handleRemoveItem(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
              <CardTitle className="text-lg">Invoices</CardTitle>
              <div>
                <Label htmlFor="invoice-upload" className="sr-only">
                  Upload invoice
                </Label>
                <Input
                  id="invoice-upload"
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  onChange={handleInvoiceUpload}
                  className="hidden"
                />
                <Button asChild className="rounded-lg">
                  <label htmlFor="invoice-upload" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Invoice
                  </label>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                {user?.role === "admin" 
                  ? "Upload invoices and specify their cost. ONLY these costs contribute to the total revenue."
                  : "Upload invoices for this client."}
              </p>
              {invoiceError && <p className="text-sm text-destructive">{invoiceError}</p>}
              {!invoices.length ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No invoices uploaded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice, index) => (
                    <div key={`${invoice.fileName}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{invoice.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(invoice.sizeBytes)}{invoice.uploadedAt ? ` - ${format(new Date(invoice.uploadedAt), "MMM d, yyyy")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {user?.role === "admin" && (
                          <div className="flex flex-col items-end gap-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Amount (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0.00"
                              className="h-8 w-24 text-right pr-2"
                              value={invoice.amount ?? 0}
                              onChange={(e) => handleUpdateInvoiceAmount(index, Number(e.target.value || 0))}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Button asChild variant="outline" size="sm" className="h-8 rounded-lg">
                            <a href={invoice.fileDataUrl} download={invoice.fileName}>
                              View
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveInvoice(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-border flex flex-col">
            <CardHeader className="flex flex-row justify-between items-center pb-4 border-b border-border/50">
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
              <Button size="sm" onClick={() => setActivityFormOpen(!activityFormOpen)} className="rounded-lg h-8 shadow-sm hover-elevate">
                <Plus className="w-4 h-4 mr-2" /> Add Activity
              </Button>
            </CardHeader>

            <CardContent className="pt-0 flex-1 overflow-hidden flex flex-col p-0">
              {activityFormOpen && (
                <div className="p-6 bg-muted/20 border-b border-border">
                  <form onSubmit={activityForm.handleSubmit(onActivitySubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Activity Type</Label>
                        <Select onValueChange={(v) => activityForm.setValue("type", v as "call" | "meeting" | "note" | "follow_up" | "task")} defaultValue="note">
                          <SelectTrigger className="bg-background rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">Call</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                            <SelectItem value="note">Note</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                            <SelectItem value="task">Task</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="datetime-local" {...activityForm.register("date")} className="bg-background rounded-lg" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea {...activityForm.register("description")} placeholder="What happened?" className="bg-background rounded-lg min-h-[80px]" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="ghost" onClick={() => setActivityFormOpen(false)} className="rounded-lg">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createActivityMutation.isPending} className="rounded-lg">
                        {createActivityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!activities?.length ? (
                  <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Clock className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p>No activity recorded yet.</p>
                    <Button variant="link" className="mt-2 text-primary" onClick={() => setActivityFormOpen(true)}>
                      Log the first activity
                    </Button>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-border/60 ml-4 space-y-8 pb-4">
                    {activities.map((act) => {
                      const Icon = ACTIVITY_ICONS[act.type] || Clock;
                      return (
                        <div key={act.id} className="relative pl-6">
                          <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center text-primary shadow-sm">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-semibold capitalize text-foreground">{act.type.replace("_", " ")}</span>
                              <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                                {format(new Date(act.date), "MMM d, yyyy h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{act.description || "System log"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
