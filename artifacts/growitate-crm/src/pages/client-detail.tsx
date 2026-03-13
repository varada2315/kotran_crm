import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useWorkspace } from "@/contexts/workspace-context";
import { 
  useGetClient, 
  useUpdateClient, 
  useGetClientActivities, 
  useCreateActivity 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, Mail, MessageSquare, Briefcase, Clock, Calendar, FileText, CheckCircle2, MoreVertical, Loader2, Save, Plus } from "lucide-react";
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
  notes: z.string().optional()
});

const createActivitySchema = z.object({
  type: z.enum(["call", "meeting", "note", "follow_up", "task"]),
  description: z.string().min(1, "Description is required"),
  date: z.string().optional(),
});

const ACTIVITY_ICONS: Record<string, any> = {
  client_added: CheckCircle2,
  call: Phone,
  meeting: Briefcase,
  note: FileText,
  follow_up: Clock,
  task: Calendar
};

export default function ClientDetail({ id }: { id: number }) {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);

  const { data: client, isLoading } = useGetClient(activeWorkspaceId!, id);
  const { data: activities } = useGetClientActivities(activeWorkspaceId!, id);

  const updateMutation = useUpdateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients/${id}`] });
        setIsEditing(false);
      }
    }
  });

  const createActivityMutation = useCreateActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients/${id}/activities`] });
        setActivityFormOpen(false);
        activityForm.reset();
      }
    }
  });

  const editForm = useForm({
    resolver: zodResolver(updateClientSchema),
    values: client ? {
      clientName: client.clientName,
      displayName: client.displayName || "",
      email: client.email || "",
      phone: client.phone || "",
      whatsapp: client.whatsapp || "",
      leadStage: client.leadStage,
      opportunitySize: client.opportunitySize || "",
      notes: client.notes || ""
    } : undefined
  });

  const activityForm = useForm({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { type: "note", description: "" }
  });

  const onUpdateSubmit = (data: any) => {
    updateMutation.mutate({ workspaceId: activeWorkspaceId!, clientId: id, data });
  };

  const onActivitySubmit = (data: any) => {
    createActivityMutation.mutate({ workspaceId: activeWorkspaceId!, clientId: id, data });
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Client Info */}
        <Card className="lg:col-span-1 rounded-2xl shadow-sm border-border">
          <CardHeader className="flex flex-row justify-between items-center pb-4 border-b border-border/50">
            <CardTitle className="text-lg">Client Details</CardTitle>
            <Button 
              variant={isEditing ? "default" : "outline"} 
              size="sm" 
              className="rounded-lg h-8"
              onClick={() => isEditing ? editForm.handleSubmit(onUpdateSubmit)() : setIsEditing(true)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
               isEditing ? <><Save className="w-4 h-4 mr-2" /> Save</> : "Edit"}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="space-y-5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stage</Label>
                {isEditing ? (
                  <Select onValueChange={(v) => editForm.setValue("leadStage", v)} defaultValue={client.leadStage}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STAGE_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
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
                    {client.email || "—"}
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
                    {client.phone || "—"}
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
                      <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`} target="_blank" className="text-green-600 hover:underline">
                        {client.whatsapp}
                      </a>
                    ) : "—"}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Opportunity Size</Label>
                {isEditing ? (
                  <Input {...editForm.register("opportunitySize")} className="h-10 rounded-lg" placeholder="e.g. $10k MRR" />
                ) : (
                  <div className="font-medium">{client.opportunitySize || "—"}</div>
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

        {/* Right Column: Activities */}
        <Card className="lg:col-span-2 rounded-2xl shadow-sm border-border flex flex-col">
          <CardHeader className="flex flex-row justify-between items-center pb-4 border-b border-border/50">
            <CardTitle className="text-lg">Activity Timeline</CardTitle>
            <Button 
              size="sm" 
              onClick={() => setActivityFormOpen(!activityFormOpen)}
              className="rounded-lg h-8 shadow-sm hover-elevate"
            >
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
                      <Select onValueChange={(v) => activityForm.setValue("type", v as any)} defaultValue="note">
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
                    <Textarea 
                      {...activityForm.register("description")} 
                      placeholder="What happened?" 
                      className="bg-background rounded-lg min-h-[80px]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setActivityFormOpen(false)} className="rounded-lg">Cancel</Button>
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
                  <Button variant="link" className="mt-2 text-primary" onClick={() => setActivityFormOpen(true)}>Log the first activity</Button>
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
                            <span className="font-semibold capitalize text-foreground">{act.type.replace('_', ' ')}</span>
                            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                              {format(new Date(act.date), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{act.description || "System log"}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
