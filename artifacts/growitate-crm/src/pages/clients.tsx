import { useState } from "react";
import { Link } from "wouter";
import { useGetClients, useCreateClient } from "@workspace/api-client-react";
import { useWorkspace } from "@/contexts/workspace-context";
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
import { Search, Plus, Loader2, Phone, Mail, MessageSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

export const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  qualified: "bg-green-50 text-green-700 border-green-200",
  proposal: "bg-purple-50 text-purple-700 border-purple-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-700 border-red-200"
};

const createClientSchema = z.object({
  clientName: z.string().min(1, "Company/Client name is required"),
  displayName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  leadStage: z.enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]).default("new"),
});

type CreateClientForm = z.infer<typeof createClientSchema>;

export default function Clients() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "uncontacted" | "followups">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: clients, isLoading } = useGetClients(
    activeWorkspaceId!, 
    { search: search || undefined, tab: tab !== "all" ? tab : undefined }
  );

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/clients`] });
        setDialogOpen(false);
        reset();
      }
    }
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { leadStage: "new" }
  });

  const onSubmit = (data: CreateClientForm) => {
    if (!activeWorkspaceId) return;
    createMutation.mutate({ workspaceId: activeWorkspaceId, data: data as any });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage and track your leads and customers</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="hover-elevate shadow-md shadow-primary/20 rounded-xl px-6 h-11">
              <Plus className="w-4 h-4 mr-2" />
              Add New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Create a new client profile in your CRM.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Company / Client Name *</Label>
                <Input id="clientName" {...register("clientName")} className="h-11 rounded-lg" />
                {errors.clientName && <p className="text-xs text-destructive">{errors.clientName.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Contact Person</Label>
                  <Input id="displayName" {...register("displayName")} className="h-11 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leadStage">Lead Stage</Label>
                  <Select onValueChange={(val) => setValue("leadStage", val as any)} defaultValue="new">
                    <SelectTrigger className="h-11 rounded-lg">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STAGE_COLORS).map(stage => (
                        <SelectItem key={stage} value={stage} className="capitalize">{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" {...register("email")} className="h-11 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" {...register("phone")} className="h-11 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" {...register("whatsapp")} className="h-11 rounded-lg" />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} className="rounded-xl hover-elevate shadow-md">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Client
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full sm:w-auto">
          <TabsList className="h-11 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:shadow-sm">All Clients</TabsTrigger>
            <TabsTrigger value="uncontacted" className="rounded-lg data-[state=active]:shadow-sm">Uncontacted</TabsTrigger>
            <TabsTrigger value="followups" className="rounded-lg data-[state=active]:shadow-sm">Follow Ups</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search clients..." 
            className="pl-9 h-11 bg-background rounded-xl border-border/60"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Client / Company</TableHead>
                  <TableHead className="font-semibold text-foreground">Contact</TableHead>
                  <TableHead className="font-semibold text-foreground">Notes</TableHead>
                  <TableHead className="font-semibold text-foreground">Stage</TableHead>
                  <TableHead className="font-semibold text-foreground">Last Activity</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No clients found. Add a new client to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients?.map((client) => (
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
                              href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                            >
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg">
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                          <Link href={`/clients/${client.id}`}>
                            <Button variant="secondary" size="sm" className="rounded-lg h-8 px-3 font-medium">
                              View Profile
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
