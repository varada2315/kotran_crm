import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetClients, useCreateClient, useDeleteClient, type Client } from "@workspace/api-client-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MoreVertical, Trash2, Mail, Phone, MessageSquare, Loader2, Calendar, User as UserIcon, Building2, Tag, ArrowRight, IndianRupee, Upload, Receipt, Users } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { STAGE_COLORS } from "@/lib/stage-colors";

const createClientSchema = z.object({
  clientName: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required"),
  whatsapp: z.string().optional(),
  leadStage: z.enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]).default("new"),
  createdAt: z.string().optional(),
  revenueTotal: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().optional()),
  purchasedItems: z.array(z.object({
    itemName: z.string().min(1, "Item name is required"),
    quantity: z.number().min(1).default(1),
    unitPrice: z.number().min(0).default(0),
    totalPrice: z.number().optional(),
  })).default([]),
});

type CreateClientForm = z.infer<typeof createClientSchema>;

const preferredContactChannelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
] as const;

const sourceOptions = [
  { value: "instagram_ad", label: "Instagram Ad" },
  { value: "whatsapp_organic", label: "WhatsApp Organic" },
  { value: "whatsapp_lead", label: "WhatsApp Lead (Ad)" },
  { value: "referral", label: "Referral" },
  { value: "cold_dm", label: "Cold DM" },
  { value: "meta_ad", label: "Meta Ad (Other)" },
  { value: "google_ad", label: "Google Ad" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email_campaign", label: "Email Campaign" },
  { value: "organic_search", label: "Organic Search" },
  { value: "social_media_organic", label: "Social Media Organic" },
  { value: "human_reference", label: "Human Reference" },
  { value: "outreach", label: "Outreach" },
  { value: "other", label: "Other" },
] as const;

const priorityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

const leadStageOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
] as const;

const serviceTypeOptions = [
  { value: "new_website", label: "New Website" },
  { value: "redesign", label: "Redesign" },
  { value: "landing_page", label: "Landing Page" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "maintenance", label: "Maintenance" },
  { value: "seo", label: "SEO" },
  { value: "other", label: "Other" },
] as const;

const hostingTypeOptions = [
  { value: "static_hosting", label: "Static Hosting" },
  { value: "dynamic_hosting", label: "Dynamic Hosting" },
  { value: "client_managed", label: "Client Manages Own Hosting" },
  { value: "not_decided", label: "Not Decided" },
] as const;

const domainStatusOptions = [
  { value: "has_domain", label: "Client Has Domain" },
  { value: "needs_domain", label: "Needs Domain" },
  { value: "not_discussed", label: "Not Discussed" },
] as const;

const timelineOptions = [
  { value: "asap", label: "ASAP" },
  { value: "1_2_weeks", label: "1–2 Weeks" },
  { value: "1_month", label: "1 Month" },
  { value: "flexible", label: "Flexible" },
] as const;

const budgetRangeOptions = [
  { value: "under_5k", label: "Under ₹5K" },
  { value: "5k_15k", label: "₹5K–₹15K" },
  { value: "15k_30k", label: "₹15K–₹30K" },
  { value: "30k_50k", label: "₹30K–₹50K" },
  { value: "50k_plus", label: "₹50K+" },
] as const;

const paymentModeOptions = [
  { value: "full_upfront", label: "Full Upfront" },
  { value: "fifty_fifty", label: "50-50" },
  { value: "milestone_based", label: "Milestone Based" },
  { value: "post_delivery", label: "Post Delivery" },
] as const;

const followUpStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "done", label: "Done" },
  { value: "no_response", label: "No Response" },
  { value: "not_interested", label: "Not Interested" },
] as const;

const followUpNoteSchema = z.object({
  note: z.string().min(1, "Note text is required"),
  timestamp: z.string().min(1, "Timestamp is required"),
});

const createLeadSchema = z.object({
  fullName: z.string().optional(),
  businessName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneNumber: z.string().min(1, "Phone number is required"),
  secondaryPhone: z.string().optional(),
  city: z.string().optional(),
  preferredContactChannel: z.enum(["whatsapp", "call", "email"]).default("whatsapp"),

  leadDate: z.string().optional(),
  source: z.enum(["instagram_ad", "whatsapp_organic", "whatsapp_lead", "referral", "cold_dm", "meta_ad", "google_ad", "linkedin", "email_campaign", "organic_search", "social_media_organic", "human_reference", "outreach", "other"]).default("whatsapp_organic"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  leadStage: z.enum(["new", "contacted", "qualified", "proposal_sent", "negotiation", "closed_won", "closed_lost"]).default("new"),

  serviceType: z.enum(["new_website", "redesign", "landing_page", "ecommerce", "maintenance", "seo", "other"]).optional(),
  websiteRequirement: z.string().optional(),
  numberOfPages: z.string().optional().refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0), {
    message: "Number of pages must be a valid number",
  }),
  hostingType: z.enum(["static_hosting", "dynamic_hosting", "client_managed", "not_decided"]).default("not_decided"),
  domainStatus: z.enum(["has_domain", "needs_domain", "not_discussed"]).default("not_discussed"),
  projectTimeline: z.enum(["asap", "1_2_weeks", "1_month", "flexible"]).default("flexible"),

  budgetRange: z.enum(["under_5k", "5k_15k", "15k_30k", "30k_50k", "50k_plus"]).optional(),
  expectedPaymentAmount: z.string().optional().refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0), {
    message: "Expected payment amount must be a valid number",
  }),
  paymentModePreference: z.enum(["full_upfront", "fifty_fifty", "milestone_based", "post_delivery"]).default("milestone_based"),
  proposalSent: z.boolean().default(false),

  followUpStatus: z.enum(["pending", "scheduled", "done", "no_response", "not_interested"]).default("pending"),
  nextFollowUpDate: z.string().optional(),
  followUpNotes: z.array(followUpNoteSchema).default([]),

  tags: z.string().optional(),
  internalRemarks: z.string().optional(),
  assignedTo: z.string().optional(),
  purchasedItems: z.array(z.object({
    itemName: z.string().min(1, "Item name is required"),
    quantity: z.number().min(1).default(1),
    unitPrice: z.number().min(0).default(0),
    totalPrice: z.number().optional(),
  })).default([]),
});

type CreateLeadForm = z.infer<typeof createLeadSchema>;

type Option = { value: string; label: string };

function getOptionLabel(options: readonly Option[], value?: string) {
  if (!value) return "-";
  return options.find((option) => option.value === value)?.label ?? value;
}

function toDateInputValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function toDateTimeInputValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function defaultLeadValues(): CreateLeadForm {
  return {
    fullName: "",
    businessName: "",
    email: "",
    phoneNumber: "",
    secondaryPhone: "",
    city: "",
    preferredContactChannel: "whatsapp",

    leadDate: toDateInputValue(),
    source: "whatsapp_organic",
    priority: "medium",
    leadStage: "new",

    serviceType: undefined,
    websiteRequirement: "",
    numberOfPages: "",
    hostingType: "not_decided",
    domainStatus: "not_discussed",
    projectTimeline: "flexible",

    budgetRange: undefined,
    expectedPaymentAmount: "",
    paymentModePreference: "milestone_based",
    proposalSent: false,

    followUpStatus: "pending",
    nextFollowUpDate: "",
    followUpNotes: [],

    tags: "",
    internalRemarks: "",
    assignedTo: "",
    purchasedItems: [],
  };
}

function buildLeadNotes(data: CreateLeadForm) {
  const clean = (value?: string) => (value && value.trim() ? value.trim() : "-");

  const followUpLines =
    data.followUpNotes.length > 0
      ? data.followUpNotes.map((entry, index) => `${index + 1}. ${entry.timestamp} — ${entry.note}`)
      : ["None"];

  return [
    "Lead Intake Record",
    "",
    "Basic Info",
    `Full Name: ${clean(data.fullName)}`,
    `Business / Company Name: ${clean(data.businessName)}`,
    `Email: ${clean(data.email)}`,
    `Phone Number: ${clean(data.phoneNumber)}`,
    `Secondary Phone: ${clean(data.secondaryPhone)}`,
    `City / Location: ${clean(data.city)}`,
    `Preferred Contact Channel: ${getOptionLabel(preferredContactChannelOptions, data.preferredContactChannel)}`,
    "",
    "Lead Details",
    `Lead Date: ${clean(data.leadDate)}`,
    `Source: ${getOptionLabel(sourceOptions, data.source)}`,
    `Priority: ${getOptionLabel(priorityOptions, data.priority)}`,
    `Lead Stage: ${getOptionLabel(leadStageOptions, data.leadStage)}`,
    "",
    "Project Details",
    `Service Type: ${getOptionLabel(serviceTypeOptions, data.serviceType)}`,
    `Website Requirement: ${clean(data.websiteRequirement)}`,
    `Number of Pages: ${clean(data.numberOfPages)}`,
    `Hosting Type: ${getOptionLabel(hostingTypeOptions, data.hostingType)}`,
    `Domain Status: ${getOptionLabel(domainStatusOptions, data.domainStatus)}`,
    `Project Timeline: ${getOptionLabel(timelineOptions, data.projectTimeline)}`,
    "",
    "Financials",
    `Budget Range: ${getOptionLabel(budgetRangeOptions, data.budgetRange)}`,
    `Expected Payment Amount: ${clean(data.expectedPaymentAmount)}`,
    `Payment Mode Preference: ${getOptionLabel(paymentModeOptions, data.paymentModePreference)}`,
    `Proposal Sent: ${data.proposalSent ? "Yes" : "No"}`,
    "",
    "Follow-up",
    `Follow-up Status: ${getOptionLabel(followUpStatusOptions, data.followUpStatus)}`,
    `Next Follow-up Date: ${clean(data.nextFollowUpDate)}`,
    "Follow-up Notes:",
    ...followUpLines,
    "",
    "Other",
    `Tags: ${clean(data.tags)}`,
    `Internal Remarks: ${clean(data.internalRemarks)}`,
    `Assigned To: ${clean(data.assignedTo)}`,
  ].join("\n");
}

const leadStageToClientStage: Record<CreateLeadForm["leadStage"], CreateClientForm["leadStage"]> = {
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  proposal_sent: "proposal",
  negotiation: "negotiation",
  closed_won: "won",
  closed_lost: "lost",
};

const LEAD_GROUP_MARKER = "__lead_record__";
const LEAD_NOTE_PREFIX = "Lead Intake Record";

function parseGroupTags(groups?: string) {
  return (groups ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isLeadRecord(record: Client) {
  const groupTags = parseGroupTags(record.groups);
  return groupTags.includes(LEAD_GROUP_MARKER) || Boolean(record.notes?.startsWith(LEAD_NOTE_PREFIX));
}

type DashboardType = "clients" | "leads";

export default function Clients({ dashboardType = "clients" }: { dashboardType?: DashboardType }) {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isLeadsDashboard = dashboardType === "leads";
  const isClientsDashboard = !isLeadsDashboard;
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "uncontacted" | "followups">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState("");

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + N for New Record
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        if (isLeadsDashboard) {
          setLeadDialogOpen(true);
        } else {
          setDialogOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLeadsDashboard]);

  const { data: clients, isLoading } = useGetClients(
    activeWorkspaceId!,
    { search: search || undefined, tab: isClientsDashboard && tab !== "all" ? tab : undefined }
  );
  const allRecords = clients ?? [];
  const leadRecords = allRecords.filter((record) => isLeadRecord(record));
  const clientRecords = allRecords.filter((record) => !isLeadRecord(record));

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control: clientControl,
    watch: watchClient,
  } = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { 
      leadStage: "new",
      createdAt: toDateInputValue(),
      purchasedItems: [],
    }
  });

  const {
    fields: clientItemFields,
    append: appendClientItem,
    remove: removeClientItem,
  } = useFieldArray({
    control: clientControl,
    name: "purchasedItems",
  });

  const {
    register: registerLead,
    handleSubmit: handleLeadSubmit,
    formState: { errors: leadErrors },
    reset: resetLead,
    setValue: setLeadValue,
    watch: watchLead,
    control: leadControl,
  } = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: defaultLeadValues(),
  });

  const {
    fields: followUpNoteFields,
    append: appendFollowUpNote,
    remove: removeFollowUpNote,
  } = useFieldArray({
    control: leadControl,
    name: "followUpNotes",
  });

  const {
    fields: leadItemFields,
    append: appendLeadItem,
    remove: removeLeadItem,
  } = useFieldArray({
    control: leadControl,
    name: "purchasedItems",
  });

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/analytics`] });

        setDialogOpen(false);
        setLeadDialogOpen(false);
        reset();
        resetLead(defaultLeadValues());
      }
    }
  });

  const deleteMutation = useDeleteClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/analytics`] });
      }
    }
  });

  const onSubmit = (data: CreateClientForm) => {
    if (!activeWorkspaceId) return;
    const finalData = {
      ...data,
      clientName: data.clientName?.trim() || (data.phone ? `Client ${data.phone}` : "New Client"),
      createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
      purchasedItems: data.purchasedItems.map(item => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice
      })),
      revenueTotal: data.revenueTotal ?? data.purchasedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
    };
    createMutation.mutate({ workspaceId: activeWorkspaceId, data: finalData as any });
  };

  const onSubmitLead = (data: CreateLeadForm) => {
    if (!activeWorkspaceId) return;

    const parsedTags = data.tags
      ? data.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
    const groupsWithMarker = Array.from(new Set([LEAD_GROUP_MARKER, ...parsedTags]));

    createMutation.mutate({
      workspaceId: activeWorkspaceId,
      data: {
        clientName: data.businessName?.trim() || data.fullName?.trim() || `Lead ${data.phoneNumber}`,
        displayName: data.fullName?.trim() || "",
        email: data.email?.trim() || undefined,
        phone: data.phoneNumber.trim(),
        whatsapp: data.secondaryPhone?.trim() || undefined,
        leadStage: leadStageToClientStage[data.leadStage],
        opportunitySize: data.budgetRange ? getOptionLabel(budgetRangeOptions, data.budgetRange) : undefined,
        groups: groupsWithMarker.join(", "),
        notes: buildLeadNotes(data),
        createdAt: data.leadDate ? new Date(data.leadDate).toISOString() : undefined,
        purchasedItems: data.purchasedItems.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        })),
        revenueTotal: data.expectedPaymentAmount ? Number(data.expectedPaymentAmount) : data.purchasedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
      } as any,
    });
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddValue.trim() || !activeWorkspaceId) return;

    // Simple parsing: "Name, Phone" or just "Phone" or just "Name"
    const parts = quickAddValue.split(",").map(p => p.trim());
    let fullName = "";
    let phoneNumber = "";

    if (parts.length >= 2) {
      fullName = parts[0];
      phoneNumber = parts[1];
    } else {
      // If only one part, check if it looks like a phone number
      if (/^\d+$/.test(parts[0].replace(/\+/g, ""))) {
        phoneNumber = parts[0];
      } else {
        fullName = parts[0];
      }
    }

    const defaultValues = defaultLeadValues();
    const quickData: CreateLeadForm = {
      ...defaultValues,
      fullName: fullName || undefined,
      phoneNumber: phoneNumber || "0000000000", // Fallback if no phone provided
      internalRemarks: `Quick added from dashboard: ${quickAddValue}`,
    };

    onSubmitLead(quickData);
    setQuickAddValue("");
  };

  const handleDeleteClient = (clientId: number, clientName: string) => {
    if (!activeWorkspaceId) return;
    if (!window.confirm(`Delete client "${clientName}"?`)) return;
    deleteMutation.mutate({ workspaceId: activeWorkspaceId, clientId });
  };

  const renderRecordTable = (records: Client[], title: string, emptyMessage: string) => (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20">
        <h2 className="text-base font-semibold">
          {title}
          <span className="text-muted-foreground font-normal ml-2">({records.length})</span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-foreground">Client / Company</TableHead>
              <TableHead className="font-semibold text-foreground">Contact</TableHead>
              <TableHead className="font-semibold text-foreground">Revenue</TableHead>
              <TableHead className="font-semibold text-foreground">Notes</TableHead>
              <TableHead className="font-semibold text-foreground">Stage</TableHead>
              <TableHead className="font-semibold text-foreground">Last Activity</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              records.map((client) => (
                <TableRow key={client.id} className="group transition-colors">
                  <TableCell>
                    <div className="font-semibold text-foreground">{client.clientName}</div>
                    {client.displayName && <div className="text-sm text-muted-foreground">{client.displayName}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      {client.email && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Mail className="w-3.5 h-3.5 mr-2" />
                          {client.email}
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 mr-2" />
                          {client.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="font-medium">
                      {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(client.revenueTotal || 0)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {client.notes ? (
                      <p className="text-sm text-muted-foreground truncate" title={client.notes}>
                        {client.notes}
                      </p>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize font-medium border ${STAGE_COLORS[client.leadStage]}`}>
                      {client.leadStage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.lastActivityAt ? new Date(client.lastActivityAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {client.whatsapp && (
                        <a
                          href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                      <Link href={`/${dashboardType === "leads" ? "leads" : "clients"}/${client.id}`}>
                        <Button variant="secondary" size="sm" className="rounded-lg h-8 px-3 font-medium">
                          View Profile
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg h-8 px-3 text-destructive hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDeleteClient(client.id, client.clientName)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">{isLeadsDashboard ? "Leads" : "Clients"}</h1>
          <p className="text-muted-foreground mt-1">
            {isLeadsDashboard
              ? "Manage and qualify incoming leads"
              : "Manage active clients and customer accounts"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isClientsDashboard ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="hover-elevate shadow-md shadow-primary/20 rounded-xl px-6 h-11">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Client
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle className="text-2xl font-bold">Add New Client</DialogTitle>
                  <DialogDescription>
                    Create a new client profile in your CRM.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-2">
                  <form onSubmit={handleSubmit(onSubmit)} id="add-client-form" className="space-y-6 pb-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientName" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                          <Building2 className="w-3 h-3 mr-1" />
                          Company / Client Name
                        </Label>
                        <Input id="clientName" {...register("clientName")} className="h-11 rounded-xl bg-muted/20 border-border/50" placeholder="e.g. Acme Corp (Optional)" autoFocus />
                        {errors.clientName && <p className="text-xs text-destructive">{errors.clientName.message}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="displayName" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                            <UserIcon className="w-3 h-3 mr-1" />
                            Contact Person
                          </Label>
                          <Input id="displayName" {...register("displayName")} className="h-11 rounded-xl bg-muted/20 border-border/50" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="leadStage" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                            <Tag className="w-3 h-3 mr-1" />
                            Status
                          </Label>
                          <Select onValueChange={(val) => setValue("leadStage", val as any)} defaultValue="new">
                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border/50">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {Object.keys(STAGE_COLORS).map(stage => (
                                <SelectItem key={stage} value={stage} className="capitalize">{stage}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          Email Address
                        </Label>
                        <Input id="email" type="email" {...register("email")} className="h-11 rounded-xl bg-muted/20 border-border/50" placeholder="hello@company.com" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            Phone Number *
                          </Label>
                          <Input id="phone" {...register("phone")} className="h-11 rounded-xl bg-muted/20 border-border/50" placeholder="Required" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="whatsapp" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            WhatsApp
                          </Label>
                          <Input id="whatsapp" {...register("whatsapp")} className="h-11 rounded-xl bg-muted/20 border-border/50" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="createdAt" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Creation Date
                        </Label>
                        <Input id="createdAt" type="date" {...register("createdAt")} className="h-11 rounded-xl bg-muted/20 border-border/50" />
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                            <IndianRupee className="w-3 h-3 mr-1" />
                            Purchased Items
                          </h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-8 text-[11px] font-bold uppercase"
                            onClick={() => appendClientItem({ itemName: "", quantity: 1, unitPrice: 0 })}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Item
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {clientItemFields.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground border border-dashed rounded-xl p-4 text-center">
                              No items added. Revenue will be 0 unless manual override is used.
                            </p>
                          ) : (
                            clientItemFields.map((field, index) => (
                              <div key={field.id} className="rounded-xl border border-border/50 p-3 space-y-3 bg-muted/5">
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Item Name</Label>
                                  <Input
                                    {...register(`purchasedItems.${index}.itemName` as const)}
                                    className="h-9 rounded-lg bg-background border-border/50"
                                    placeholder="Service or Product Name"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Qty</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      {...register(`purchasedItems.${index}.quantity` as const, { valueAsNumber: true })}
                                      className="h-9 rounded-lg bg-background border-border/50"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Price</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      {...register(`purchasedItems.${index}.unitPrice` as const, { valueAsNumber: true })}
                                      className="h-9 rounded-lg bg-background border-border/50"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  <div className="text-[10px] font-bold text-emerald-600">
                                    Total: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((watchClient(`purchasedItems.${index}.quantity`) || 0) * (watchClient(`purchasedItems.${index}.unitPrice`) || 0))}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive h-7 px-2"
                                    onClick={() => removeClientItem(index)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label htmlFor="revenueTotal" className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                          <IndianRupee className="w-3 h-3 mr-1" />
                          Manual Revenue Override (Optional)
                        </Label>
                        <Input
                          id="revenueTotal"
                          type="number"
                          {...register("revenueTotal", { valueAsNumber: true })}
                          className="h-11 rounded-xl bg-muted/20 border-border/50"
                          placeholder="Leave blank to auto-calculate from items"
                        />
                      </div>
                    </div>
                  </form>
                </div>
                <DialogFooter className="p-6 pt-2 border-t mt-auto flex items-center justify-between sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button type="submit" form="add-client-form" disabled={createMutation.isPending} className="rounded-xl px-8 h-11 font-semibold hover-elevate shadow-lg shadow-primary/20">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Client
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog
              open={leadDialogOpen}
              onOpenChange={(open) => {
                setLeadDialogOpen(open);
                if (!open) {
                  resetLead(defaultLeadValues());
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="hover-elevate shadow-md shadow-primary/20 rounded-xl px-6 h-11">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] rounded-2xl max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle className="text-2xl font-bold">Add New Lead</DialogTitle>
                  <DialogDescription>
                    Capture detailed lead information and add it as a client record.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2">
                  <form onSubmit={handleLeadSubmit(onSubmitLead)} id="add-lead-form" className="space-y-8 pb-8">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                          <UserIcon className="w-3 h-3 mr-1" />
                          Basic Info
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Full Name</Label>
                            <Input {...registerLead("fullName")} className="h-10 rounded-xl bg-muted/20 border-border/50" placeholder="Optional" />
                            {leadErrors.fullName && <p className="text-xs text-destructive">{leadErrors.fullName.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Business / Company Name</Label>
                            <Input {...registerLead("businessName")} className="h-10 rounded-xl bg-muted/20 border-border/50" placeholder="Optional" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Email</Label>
                            <Input type="email" {...registerLead("email")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                            {leadErrors.email && <p className="text-xs text-destructive">{leadErrors.email.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Phone Number *</Label>
                            <Input {...registerLead("phoneNumber")} className="h-10 rounded-xl bg-muted/20 border-border/50" placeholder="Required" />
                            {leadErrors.phoneNumber && <p className="text-xs text-destructive">{leadErrors.phoneNumber.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Secondary Phone</Label>
                            <Input {...registerLead("secondaryPhone")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">City / Location</Label>
                            <Input {...registerLead("city")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Preferred Contact Channel</Label>
                            <Select
                              value={watchLead("preferredContactChannel")}
                              onValueChange={(value) => setLeadValue("preferredContactChannel", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select channel" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {preferredContactChannelOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                          <Tag className="w-3 h-3 mr-1" />
                          Lead Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Lead Date</Label>
                            <Input type="date" {...registerLead("leadDate")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Source</Label>
                            <Select
                              value={watchLead("source")}
                              onValueChange={(value) => setLeadValue("source", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {sourceOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Priority</Label>
                            <Select
                              value={watchLead("priority")}
                              onValueChange={(value) => setLeadValue("priority", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {priorityOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Lead Stage</Label>
                            <Select
                              value={watchLead("leadStage")}
                              onValueChange={(value) => setLeadValue("leadStage", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select stage" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {leadStageOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Next Follow-up Date</Label>
                            <Input type="date" {...registerLead("nextFollowUpDate")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                          <Building2 className="w-3 h-3 mr-1" />
                          Project Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Service Type</Label>
                            <Select
                              value={watchLead("serviceType") ?? undefined}
                              onValueChange={(value) => setLeadValue("serviceType", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select service" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {serviceTypeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Number of Pages</Label>
                            <Input type="number" min="0" {...registerLead("numberOfPages")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Hosting Type</Label>
                            <Select
                              value={watchLead("hostingType")}
                              onValueChange={(value) => setLeadValue("hostingType", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select hosting" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {hostingTypeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Domain Status</Label>
                            <Select
                              value={watchLead("domainStatus")}
                              onValueChange={(value) => setLeadValue("domainStatus", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select domain" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {domainStatusOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Project Timeline</Label>
                            <Select
                              value={watchLead("projectTimeline")}
                              onValueChange={(value) => setLeadValue("projectTimeline", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select timeline" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {timelineOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Website Requirement</Label>
                            <Textarea {...registerLead("websiteRequirement")} className="min-h-24 rounded-xl bg-muted/20 border-border/50" placeholder="Optional" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                          <IndianRupee className="w-3 h-3 mr-1" />
                          Financials
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Budget Range</Label>
                            <Select
                              value={watchLead("budgetRange") ?? undefined}
                              onValueChange={(value) => setLeadValue("budgetRange", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select budget" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {budgetRangeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Expected Payment Amount</Label>
                            <Input type="number" min="0" {...registerLead("expectedPaymentAmount")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Payment Preference</Label>
                            <Select
                              value={watchLead("paymentModePreference")}
                              onValueChange={(value) => setLeadValue("paymentModePreference", value as any)}
                            >
                              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50">
                                <SelectValue placeholder="Select payment" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {paymentModeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground flex items-center justify-between">
                              Proposal Sent
                              <Switch
                                checked={watchLead("proposalSent")}
                                onCheckedChange={(checked) => setLeadValue("proposalSent", checked)}
                                className="scale-75"
                              />
                            </Label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Project Items / Services
                          </h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-8 text-[11px] font-bold uppercase"
                            onClick={() => appendLeadItem({ itemName: "", quantity: 1, unitPrice: 0 })}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Item
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {leadItemFields.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground border border-dashed rounded-xl p-6 text-center">
                              No items added yet.
                            </p>
                          ) : (
                            leadItemFields.map((field, index) => (
                              <div key={field.id} className="rounded-xl border border-border/50 p-4 space-y-4 bg-muted/5">
                                <div className="space-y-2">
                                  <Label className="text-[11px] font-bold uppercase text-muted-foreground">Item Name</Label>
                                  <Input
                                    {...registerLead(`purchasedItems.${index}.itemName` as const)}
                                    className="h-10 rounded-xl bg-background border-border/50"
                                    placeholder="Service or Product Name"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Quantity</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      {...registerLead(`purchasedItems.${index}.quantity` as const, { valueAsNumber: true })}
                                      className="h-10 rounded-xl bg-background border-border/50"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Unit Price</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      {...registerLead(`purchasedItems.${index}.unitPrice` as const, { valueAsNumber: true })}
                                      className="h-10 rounded-xl bg-background border-border/50"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                  <div className="text-sm font-bold text-emerald-600">
                                    Subtotal: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((watchLead(`purchasedItems.${index}.quantity`) || 0) * (watchLead(`purchasedItems.${index}.unitPrice`) || 0))}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-10 px-4"
                                    onClick={() => removeLeadItem(index)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remove Item
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                            <Tag className="w-3 h-3 mr-1" />
                            Follow-up Notes
                          </h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-8 text-[11px] font-bold uppercase"
                            onClick={() => appendFollowUpNote({ note: "", timestamp: toDateTimeInputValue() })}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Note
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {followUpNoteFields.length === 0 ? (
                            <p className="text-sm text-muted-foreground border border-dashed rounded-xl p-6 text-center">
                              No follow-up notes added yet.
                            </p>
                          ) : (
                            followUpNoteFields.map((field, index) => (
                              <div key={field.id} className="rounded-xl border border-border/50 p-4 space-y-4 bg-muted/5">
                                <div className="space-y-2">
                                  <Label className="text-[11px] font-bold uppercase text-muted-foreground">Note Content</Label>
                                  <Textarea
                                    {...registerLead(`followUpNotes.${index}.note` as const)}
                                    className="min-h-20 rounded-xl bg-background border-border/50"
                                    placeholder="Enter follow-up details..."
                                  />
                                  {leadErrors.followUpNotes?.[index]?.note && (
                                    <p className="text-xs text-destructive">{leadErrors.followUpNotes[index]?.note?.message}</p>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Timestamp</Label>
                                    <Input
                                      type="datetime-local"
                                      {...registerLead(`followUpNotes.${index}.timestamp` as const)}
                                      className="h-10 rounded-xl bg-background border-border/50"
                                    />
                                    {leadErrors.followUpNotes?.[index]?.timestamp && (
                                      <p className="text-xs text-destructive">{leadErrors.followUpNotes[index]?.timestamp?.message}</p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-10"
                                    onClick={() => removeFollowUpNote(index)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border/40">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
                          <MoreVertical className="w-3 h-3 mr-1" />
                          Other
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Tags</Label>
                            <Input
                              {...registerLead("tags")}
                              className="h-10 rounded-xl bg-muted/20 border-border/50"
                              placeholder="Hot Lead, Cold, Repeat Client (comma separated)"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Internal Remarks</Label>
                            <Textarea {...registerLead("internalRemarks")} className="min-h-24 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Assigned To</Label>
                            <Input {...registerLead("assignedTo")} className="h-10 rounded-xl bg-muted/20 border-border/50" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                <DialogFooter className="p-6 pt-2 border-t mt-auto flex items-center justify-between sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => setLeadDialogOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button type="submit" form="add-lead-form" disabled={createMutation.isPending} className="rounded-xl px-8 h-11 font-semibold hover-elevate shadow-lg shadow-primary/20">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Lead
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
        {isClientsDashboard ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full sm:w-auto">
            <TabsList className="h-11 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="all" className="rounded-lg data-[state=active]:shadow-sm">All Clients</TabsTrigger>
              <TabsTrigger value="uncontacted" className="rounded-lg data-[state=active]:shadow-sm">Uncontacted</TabsTrigger>
              <TabsTrigger value="followups" className="rounded-lg data-[state=active]:shadow-sm">Follow Ups</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <div className="text-sm text-muted-foreground">Lead Dashboard</div>
        )}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {isLeadsDashboard && (
            <form onSubmit={handleQuickAdd} className="relative w-full sm:w-80">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input
                placeholder="Quick add: Name, Phone (Enter)"
                className="pl-9 h-11 bg-primary/5 border-primary/20 rounded-xl focus-visible:ring-primary/30"
                value={quickAddValue}
                onChange={(e) => setQuickAddValue(e.target.value)}
              />
            </form>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isLeadsDashboard ? "Search leads..." : "Search clients..."}
              className="pl-9 h-11 bg-background rounded-xl border-border/60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {isLeadsDashboard
            ? renderRecordTable(leadRecords, "Leads", "No leads found. Add a lead to get started.")
            : renderRecordTable(clientRecords, "Clients", "No clients found. Add a new client to get started.")}
        </div>
      )}
      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 sm:hidden z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-2xl shadow-primary/40 hover-elevate"
          onClick={() => isLeadsDashboard ? setLeadDialogOpen(true) : setDialogOpen(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </motion.div>
  );
}
