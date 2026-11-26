import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Phone, Mail, MessageSquare, Calendar, Briefcase, Clock, Loader2, User, Building2, MapPin, Globe, DollarSign, FileText, Tag, AlertCircle, CheckCircle2, XCircle, Save, X, Edit } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useGetClient, useUpdateClient } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { STAGE_COLORS } from "@/lib/stage-colors";
import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type LeadDetailProps = {
  id: number;
};

const updateLeadSchema = z.object({
  clientName: z.string().min(1, "Name is required"),
  email: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  leadStage: z.string(),
  notes: z.string().optional().or(z.literal("")),
});

interface ParsedNotes {
  basicInfo: {
    fullName: string;
    companyName: string;
    email: string;
    phone: string;
    secondaryPhone: string;
    location: string;
    preferredChannel: string;
  };
  leadDetails: {
    leadDate: string;
    source: string;
    priority: string;
    stage: string;
  };
  projectDetails: {
    serviceType: string;
    websiteRequirement: string;
    numberOfPages: string;
    hostingType: string;
    domainStatus: string;
    timeline: string;
  };
  financials: {
    budgetRange: string;
    expectedPayment: string;
    paymentMode: string;
    proposalSent: string;
  };
  followUp: {
    status: string;
    nextDate: string;
    notes: string;
  };
  other: {
    tags: string;
    remarks: string;
    assignedTo: string;
  };
}

function parseNotes(notes: string): ParsedNotes {
  const getValue = (key: string): string => {
    const patterns = [
      new RegExp(`${key}:\\s*([^\\n]+)`, "i"),
      new RegExp(`${key}\\s*:\\s*([^\\n]+)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = notes.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return "-";
  };

  return {
    basicInfo: {
      fullName: getValue("Full Name"),
      companyName: getValue("Business / Company Name") || getValue("Company Name"),
      email: getValue("Email"),
      phone: getValue("Phone Number") || getValue("Phone"),
      secondaryPhone: getValue("Secondary Phone"),
      location: getValue("City / Location") || getValue("Location"),
      preferredChannel: getValue("Preferred Contact Channel"),
    },
    leadDetails: {
      leadDate: getValue("Lead Date"),
      source: getValue("Source"),
      priority: getValue("Lead Priority"),
      stage: getValue("Lead Stage"),
    },
    projectDetails: {
      serviceType: getValue("Service Type"),
      websiteRequirement: getValue("Website Requirement"),
      numberOfPages: getValue("Number of Pages"),
      hostingType: getValue("Hosting Type"),
      domainStatus: getValue("Domain Status"),
      timeline: getValue("Project Timeline"),
    },
    financials: {
      budgetRange: getValue("Budget Range"),
      expectedPayment: getValue("Expected Payment Amount"),
      paymentMode: getValue("Payment Mode Preference"),
      proposalSent: getValue("Proposal Sent"),
    },
    followUp: {
      status: getValue("Follow-up Status") || getValue("Follow Up Status"),
      nextDate: getValue("Next Follow-up Date") || getValue("Next Follow Up Date"),
      notes: getValue("Follow-up Notes") || getValue("Follow Up Notes"),
    },
    other: {
      tags: getValue("Tags"),
      remarks: getValue("Internal Remarks"),
      assignedTo: getValue("Assigned To"),
    },
  };
}

function serializeParsedNotes(notes: ParsedNotes): string {
  const lines: string[] = [];
  const addLine = (key: string, value: string) => {
    if (value && value !== "-") {
      lines.push(`${key}: ${value}`);
    }
  };

  // Basic Info
  addLine("Full Name", notes.basicInfo.fullName);
  addLine("Business / Company Name", notes.basicInfo.companyName);
  addLine("Email", notes.basicInfo.email);
  addLine("Phone Number", notes.basicInfo.phone);
  addLine("Secondary Phone", notes.basicInfo.secondaryPhone);
  addLine("City / Location", notes.basicInfo.location);
  addLine("Preferred Contact Channel", notes.basicInfo.preferredChannel);

  // Lead Details
  addLine("Lead Date", notes.leadDetails.leadDate);
  addLine("Source", notes.leadDetails.source);
  addLine("Lead Priority", notes.leadDetails.priority);
  addLine("Lead Stage", notes.leadDetails.stage);

  // Project Details
  addLine("Service Type", notes.projectDetails.serviceType);
  addLine("Website Requirement", notes.projectDetails.websiteRequirement);
  addLine("Number of Pages", notes.projectDetails.numberOfPages);
  addLine("Hosting Type", notes.projectDetails.hostingType);
  addLine("Domain Status", notes.projectDetails.domainStatus);
  addLine("Project Timeline", notes.projectDetails.timeline);

  // Financials
  addLine("Budget Range", notes.financials.budgetRange);
  addLine("Expected Payment Amount", notes.financials.expectedPayment);
  addLine("Payment Mode Preference", notes.financials.paymentMode);
  addLine("Proposal Sent", notes.financials.proposalSent);

  // Follow-up
  addLine("Follow-up Status", notes.followUp.status);
  addLine("Next Follow-up Date", notes.followUp.nextDate);
  addLine("Follow-up Notes", notes.followUp.notes);

  // Other
  addLine("Tags", notes.other.tags);
  addLine("Internal Remarks", notes.other.remarks);
  addLine("Assigned To", notes.other.assignedTo);

  return lines.join("\n");
}

function InfoField({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  if (!value || value === "-") return null;
  
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${highlight ? "text-primary" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function EditableInfoField({
  icon: Icon,
  label,
  value,
  highlight,
  isEditing,
  onChange
}: {
  icon: any;
  label: string;
  value: string;
  highlight?: boolean;
  isEditing: boolean;
  onChange?: (newValue: string) => void;
}) {
  if (!value || value === "-") return null;

  return (
    <div className="flex items-start gap-3 py-2 group">
      <div className="mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2 mt-0.5">
            <Input
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <p className={`text-sm font-medium mt-0.5 ${highlight ? "text-primary" : ""}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: any }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function getPriorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
}

const LEAD_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export default function LeadDetail({ id }: LeadDetailProps) {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { data: lead, isLoading } = useGetClient(activeWorkspaceId!, id);
  const [isEditing, setIsEditing] = useState(false);
  const [editableParsedNotes, setEditableParsedNotes] = useState<ParsedNotes | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  const updateMutation = useUpdateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients/${id}`] });
        setIsEditing(false);
        setEditingField(null);
      },
    },
  });

  const editForm = useForm<z.infer<typeof updateLeadSchema>>({
    resolver: zodResolver(updateLeadSchema),
    defaultValues: {
      clientName: "",
      email: "",
      phone: "",
      whatsapp: "",
      leadStage: "new",
      notes: "",
    },
  });

  useEffect(() => {
    if (lead) {
      editForm.reset({
        clientName: lead.clientName || "",
        email: lead.email || "",
        phone: lead.phone || "",
        whatsapp: lead.whatsapp || "",
        leadStage: lead.leadStage || "new",
        notes: lead.notes || "",
      });
    }
  }, [lead, editForm]);

  const onEditSubmit = (data: z.infer<typeof updateLeadSchema>) => {
    updateMutation.mutate({
      workspaceId: activeWorkspaceId!,
      clientId: id,
      data: {
        ...data,
        leadStage: data.leadStage as any,
      }
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (lead) {
      editForm.reset({
        clientName: lead.clientName || "",
        email: lead.email || "",
        phone: lead.phone || "",
        whatsapp: lead.whatsapp || "",
        leadStage: lead.leadStage || "new",
        notes: lead.notes || "",
      });
    }
  };

  const parsedNotes = useMemo(() => {
    if (!lead?.notes) return null;
    return parseNotes(lead.notes);
  }, [lead?.notes]);

  const handleParsedNoteChange = (section: keyof ParsedNotes, field: string, newValue: string) => {
    if (!editableParsedNotes) return;
    const updated = { ...editableParsedNotes };
    if (section === 'basicInfo' && field in updated.basicInfo) {
      (updated.basicInfo as any)[field] = newValue;
    } else if (section === 'leadDetails' && field in updated.leadDetails) {
      (updated.leadDetails as any)[field] = newValue;
    } else if (section === 'projectDetails' && field in updated.projectDetails) {
      (updated.projectDetails as any)[field] = newValue;
    } else if (section === 'financials' && field in updated.financials) {
      (updated.financials as any)[field] = newValue;
    } else if (section === 'followUp' && field in updated.followUp) {
      (updated.followUp as any)[field] = newValue;
    } else if (section === 'other' && field in updated.other) {
      (updated.other as any)[field] = newValue;
    }
    setEditableParsedNotes(updated);
    // Update raw notes field
    editForm.setValue('notes', serializeParsedNotes(updated));
  };

  useEffect(() => {
    if (parsedNotes) {
      setEditableParsedNotes(parsedNotes);
    } else {
      setEditableParsedNotes(null);
    }
  }, [parsedNotes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/leads">
            <Button variant="ghost" size="sm" className="rounded-lg">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Button>
          </Link>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="default"
                onClick={editForm.handleSubmit(onEditSubmit)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              Edit Lead
            </Button>
          )}
        </div>
      </div>

      {/* Lead Header Card */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Lead Name</Label>
                <Input
                  id="edit-name"
                  {...editForm.register("clientName")}
                  className="mt-1"
                />
                {editForm.formState.errors.clientName && (
                  <p className="text-sm text-red-500 mt-1">{editForm.formState.errors.clientName.message}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    {...editForm.register("email")}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    {...editForm.register("phone")}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-whatsapp">WhatsApp</Label>
                  <Input
                    id="edit-whatsapp"
                    {...editForm.register("whatsapp")}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-stage">Lead Stage</Label>
                <Select
                  value={editForm.watch("leadStage")}
                  onValueChange={(val) => editForm.setValue("leadStage", val)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">{lead.clientName}</h1>
                  <Badge className="capitalize" style={{ backgroundColor: STAGE_COLORS[lead.leadStage] }}>
                    {lead.leadStage.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Lead #{id}</span>
                  <span>•</span>
                  <span>Created: {format(new Date(lead.createdAt || ""), "dd MMM yyyy")}</span>
                  {parsedNotes?.leadDetails.priority && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(parsedNotes.leadDetails.priority)}`} />
                        <span>{parsedNotes.leadDetails.priority} Priority</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {lead.phone && (
                  <a href={`tel:${lead.phone}`}>
                    <Button variant="outline" size="sm" className="rounded-lg">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`}>
                    <Button variant="outline" size="sm" className="rounded-lg">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </a>
                )}
                {lead.whatsapp && (
                  <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-lg">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Contact & Lead Info */}
        <div className="space-y-6">
          <SectionCard title="Contact Information" icon={User}>
            <div className="space-y-1">
              {parsedNotes?.basicInfo.fullName && parsedNotes.basicInfo.fullName !== "-" && (
                <EditableInfoField
                  icon={User}
                  label="Full Name"
                  value={parsedNotes.basicInfo.fullName}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('basicInfo', 'fullName', newValue)}
                />
              )}
              {parsedNotes?.basicInfo.companyName && parsedNotes.basicInfo.companyName !== "-" && (
                <EditableInfoField
                  icon={Building2}
                  label="Company"
                  value={parsedNotes.basicInfo.companyName}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('basicInfo', 'companyName', newValue)}
                />
              )}
              {lead.email && <InfoField icon={Mail} label="Email" value={lead.email} highlight />}
              {lead.phone && <InfoField icon={Phone} label="Phone" value={lead.phone} highlight />}
              {lead.whatsapp && <InfoField icon={MessageSquare} label="WhatsApp" value={lead.whatsapp} />}
              {parsedNotes?.basicInfo.secondaryPhone && parsedNotes.basicInfo.secondaryPhone !== "-" && (
                <EditableInfoField
                  icon={Phone}
                  label="Secondary Phone"
                  value={parsedNotes.basicInfo.secondaryPhone}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('basicInfo', 'secondaryPhone', newValue)}
                />
              )}
              {parsedNotes?.basicInfo.location && parsedNotes.basicInfo.location !== "-" && (
                <EditableInfoField
                  icon={MapPin}
                  label="Location"
                  value={parsedNotes.basicInfo.location}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('basicInfo', 'location', newValue)}
                />
              )}
              {parsedNotes?.basicInfo.preferredChannel && parsedNotes.basicInfo.preferredChannel !== "-" && (
                <EditableInfoField
                  icon={MessageSquare}
                  label="Preferred Channel"
                  value={parsedNotes.basicInfo.preferredChannel}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('basicInfo', 'preferredChannel', newValue)}
                />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Lead Details" icon={Briefcase}>
            <div className="space-y-1">
              {parsedNotes?.leadDetails.source && parsedNotes.leadDetails.source !== "-" && (
                <EditableInfoField
                  icon={Tag}
                  label="Source"
                  value={parsedNotes.leadDetails.source}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('leadDetails', 'source', newValue)}
                />
              )}
              {parsedNotes?.leadDetails.leadDate && parsedNotes.leadDetails.leadDate !== "-" && (
                <EditableInfoField
                  icon={Calendar}
                  label="Lead Date"
                  value={parsedNotes.leadDetails.leadDate}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('leadDetails', 'leadDate', newValue)}
                />
              )}
              <InfoField icon={Briefcase} label="Stage" value={lead.leadStage.replace("_", " ")} />
              {parsedNotes?.leadDetails.priority && parsedNotes.leadDetails.priority !== "-" && (
                <EditableInfoField
                  icon={AlertCircle}
                  label="Priority"
                  value={parsedNotes.leadDetails.priority}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('leadDetails', 'priority', newValue)}
                />
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right Column - Project & Financials */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Project Details" icon={Globe}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className="space-y-1">
                {parsedNotes?.projectDetails.serviceType && parsedNotes.projectDetails.serviceType !== "-" && (
                  <EditableInfoField
                    icon={Briefcase}
                    label="Service Type"
                    value={parsedNotes.projectDetails.serviceType}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('projectDetails', 'serviceType', newValue)}
                  />
                )}
                {parsedNotes?.projectDetails.websiteRequirement && parsedNotes.projectDetails.websiteRequirement !== "-" && (
                  <EditableInfoField
                    icon={Globe}
                    label="Website Requirement"
                    value={parsedNotes.projectDetails.websiteRequirement}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('projectDetails', 'websiteRequirement', newValue)}
                  />
                )}
                {parsedNotes?.projectDetails.numberOfPages && parsedNotes.projectDetails.numberOfPages !== "-" && (
                  <EditableInfoField
                    icon={FileText}
                    label="Number of Pages"
                    value={parsedNotes.projectDetails.numberOfPages}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('projectDetails', 'numberOfPages', newValue)}
                  />
                )}
              </div>
              <div className="space-y-1">
                {parsedNotes?.projectDetails.hostingType && parsedNotes.projectDetails.hostingType !== "-" && (
                  <EditableInfoField
                    icon={Globe}
                    label="Hosting Type"
                    value={parsedNotes.projectDetails.hostingType}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('projectDetails', 'hostingType', newValue)}
                  />
                )}
                {parsedNotes?.projectDetails.domainStatus && parsedNotes.projectDetails.domainStatus !== "-" && (
                  <EditableInfoField
                    icon={CheckCircle2}
                    label="Domain Status"
                    value={parsedNotes.projectDetails.domainStatus}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('projectDetails', 'domainStatus', newValue)}
                  />
                )}
                {parsedNotes?.projectDetails.timeline && parsedNotes.projectDetails.timeline !== "-" && (
                  <EditableInfoField
                    icon={Clock}
                    label="Timeline"
                    value={parsedNotes.projectDetails.timeline}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('projectDetails', 'timeline', newValue)}
                  />
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Financials" icon={DollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className="space-y-1">
                {parsedNotes?.financials.budgetRange && parsedNotes.financials.budgetRange !== "-" && (
                  <EditableInfoField
                    icon={DollarSign}
                    label="Budget Range"
                    value={parsedNotes.financials.budgetRange}
                    highlight
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('financials', 'budgetRange', newValue)}
                  />
                )}
                {parsedNotes?.financials.expectedPayment && parsedNotes.financials.expectedPayment !== "-" && (
                  <EditableInfoField
                    icon={DollarSign}
                    label="Expected Payment"
                    value={parsedNotes.financials.expectedPayment}
                    highlight
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('financials', 'expectedPayment', newValue)}
                  />
                )}
              </div>
              <div className="space-y-1">
                {parsedNotes?.financials.paymentMode && parsedNotes.financials.paymentMode !== "-" && (
                  <EditableInfoField
                    icon={DollarSign}
                    label="Payment Mode"
                    value={parsedNotes.financials.paymentMode}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('financials', 'paymentMode', newValue)}
                  />
                )}
                {parsedNotes?.financials.proposalSent && parsedNotes.financials.proposalSent !== "-" && (
                  <InfoField
                    icon={parsedNotes.financials.proposalSent.toLowerCase() === "yes" ? CheckCircle2 : XCircle}
                    label="Proposal Sent"
                    value={parsedNotes.financials.proposalSent}
                  />
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Follow-up" icon={Clock}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className="space-y-1">
                {parsedNotes?.followUp.status && parsedNotes.followUp.status !== "-" && (
                  <EditableInfoField
                    icon={Clock}
                    label="Status"
                    value={parsedNotes.followUp.status}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('followUp', 'status', newValue)}
                  />
                )}
                {parsedNotes?.followUp.nextDate && parsedNotes.followUp.nextDate !== "-" && (
                  <EditableInfoField
                    icon={Calendar}
                    label="Next Follow-up"
                    value={parsedNotes.followUp.nextDate}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('followUp', 'nextDate', newValue)}
                  />
                )}
              </div>
              <div className="space-y-1">
                {parsedNotes?.followUp.notes && parsedNotes.followUp.notes !== "-" && (
                  <EditableInfoField
                    icon={MessageSquare}
                    label="Notes"
                    value={parsedNotes.followUp.notes}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('followUp', 'notes', newValue)}
                  />
                )}
              </div>
            </div>
          </SectionCard>

          {parsedNotes?.other.remarks && parsedNotes.other.remarks !== "-" && (
            <SectionCard title="Internal Notes" icon={FileText}>
              <div className="space-y-1">
                <EditableInfoField
                  icon={FileText}
                  label="Remarks"
                  value={parsedNotes.other.remarks}
                  isEditing={isEditing}
                  onChange={(newValue) => handleParsedNoteChange('other', 'remarks', newValue)}
                />
                {parsedNotes.other.tags && parsedNotes.other.tags !== "-" && (
                  <EditableInfoField
                    icon={Tag}
                    label="Tags"
                    value={parsedNotes.other.tags}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('other', 'tags', newValue)}
                  />
                )}
                {parsedNotes.other.assignedTo && parsedNotes.other.assignedTo !== "-" && (
                  <EditableInfoField
                    icon={User}
                    label="Assigned To"
                    value={parsedNotes.other.assignedTo}
                    isEditing={isEditing}
                    onChange={(newValue) => handleParsedNoteChange('other', 'assignedTo', newValue)}
                  />
                )}
              </div>
            </SectionCard>
          )}

          {/* Edit Notes Section - Only visible in edit mode */}
          {isEditing && (
            <SectionCard title="Edit Notes" icon={FileText}>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Raw Notes</Label>
                <Textarea
                  id="edit-notes"
                  {...editForm.register("notes")}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Enter raw notes here..."
                />
                <p className="text-xs text-muted-foreground">
                  This contains the raw lead intake data. You can edit it directly here.
                </p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
