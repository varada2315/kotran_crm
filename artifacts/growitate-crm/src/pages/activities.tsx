import { useWorkspace } from "@/contexts/workspace-context";
import { useGetWorkspaceActivities } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Phone, Briefcase, FileText, Clock, Calendar, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const ACTIVITY_ICONS: Record<string, any> = {
  client_added: CheckCircle2,
  call: Phone,
  meeting: Briefcase,
  note: FileText,
  follow_up: Clock,
  task: Calendar
};

export default function Activities() {
  const { activeWorkspaceId } = useWorkspace();
  const { data: activities, isLoading } = useGetWorkspaceActivities(activeWorkspaceId!);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Activity Feed</h1>
        <p className="text-muted-foreground mt-1">Global timeline of all workspace interactions</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {activities?.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              No activities found in this workspace.
            </Card>
          ) : (
            activities?.map((act, i) => {
              const Icon = ACTIVITY_ICONS[act.type] || Clock;
              return (
                <motion.div 
                  key={act.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="p-4 flex items-start gap-4 rounded-2xl hover:shadow-md transition-all border-border/60 hover:border-primary/20 group">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/clients/${act.clientId}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate">
                          {act.clientName}
                        </Link>
                        <Badge variant="secondary" className="capitalize font-normal text-xs">{act.type.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{act.description}</p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {format(new Date(act.date), "MMM d, h:mm a")}
                      </span>
                      <Link href={`/clients/${act.clientId}`}>
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Link>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </motion.div>
  );
}
