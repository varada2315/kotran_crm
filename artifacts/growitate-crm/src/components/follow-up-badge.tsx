import { useWorkspace } from "@/contexts/workspace-context";
import { useGetClients, type Client } from "@workspace/api-client-react";
import { Bell, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isToday, parseISO, isValid } from "date-fns";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";

// Recreate the parseNotes function from leads-detail.tsx
interface ParsedNotes {
  followUp: {
    nextDate: string;
    status: string;
    notes: string;
  };
}

function parseNotesForFollowUp(notes: string): ParsedNotes['followUp'] {
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
    status: getValue("Follow-up Status") || getValue("Follow Up Status"),
    nextDate: getValue("Next Follow-up Date") || getValue("Next Follow Up Date"),
    notes: getValue("Follow-up Notes") || getValue("Follow Up Notes"),
  };
}

// Recreate isLeadRecord logic from clients.tsx
export function parseGroupTags(groups?: string): string[] {
  if (!groups) return [];
  return groups
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const LEAD_GROUP_MARKER = "lead";
const LEAD_NOTE_PREFIX = "Full Name:";

export function isLeadRecord(record: Client): boolean {
  const groupTags = parseGroupTags(record.groups);
  return groupTags.includes(LEAD_GROUP_MARKER) || Boolean(record.notes?.startsWith(LEAD_NOTE_PREFIX));
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "-") return null;
  
  // Try ISO format first
  const isoDate = parseISO(dateStr);
  if (isValid(isoDate)) return isoDate;
  
  // Try DD/MM/YYYY or other common formats
  const formats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd-MM-yyyy"];
  for (const fmt of formats) {
    try {
      const parsed = parseISO(new Date(dateStr).toISOString());
      if (isValid(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  
  return null;
}

export function FollowUpBadge() {
  const { activeWorkspaceId } = useWorkspace();
  const { data: clients, isLoading } = useGetClients(activeWorkspaceId!, {});
  
  const todaysFollowUps = useMemo(() => {
    if (!clients) return [];
    
    return clients.filter((client) => {
      if (!isLeadRecord(client)) return false;
      if (!client.notes) return false;
      
      const followUp = parseNotesForFollowUp(client.notes);
      if (followUp.nextDate === "-") return false;
      
      const date = parseDate(followUp.nextDate);
      if (!date) return false;
      
      return isToday(date);
    });
  }, [clients]);
  
  const count = todaysFollowUps.length;
  
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
        <Bell className="h-3.5 w-3.5" />
        <span className="text-xs">Loading...</span>
      </Badge>
    );
  }
  
  if (count === 0) {
    return null;
  }
  
  return (
    <Link href="/leads?tab=followups">
      <Button
        variant="outline"
        size="sm"
        className="relative gap-2 px-3 py-1.5 hover:bg-destructive/10 hover:text-destructive border-destructive/30 text-destructive"
      >
        <Bell className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{count} follow-up{count !== 1 ? 's' : ''} due today</span>
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive text-[10px] font-bold text-white items-center justify-center">
            {count}
          </span>
        </span>
      </Button>
    </Link>
  );
}

export function FollowUpList() {
  const { activeWorkspaceId } = useWorkspace();
  const { data: clients, isLoading } = useGetClients(activeWorkspaceId!, {});
  
  const allFollowUps = useMemo(() => {
    if (!clients) return [];
    
    const followUps: Array<{
      client: Client;
      followUp: ParsedNotes['followUp'];
      parsedDate: Date | null;
    }> = [];
    
    clients.forEach((client) => {
      if (!isLeadRecord(client) || !client.notes) return;
      
      const followUp = parseNotesForFollowUp(client.notes);
      if (followUp.nextDate === "-") return;
      
      const parsedDate = parseDate(followUp.nextDate);
      followUps.push({ client, followUp, parsedDate });
    });
    
    // Sort by date (soonest first)
    return followUps.sort((a, b) => {
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });
  }, [clients]);
  
  const todaysFollowUps = allFollowUps.filter(({ parsedDate }) => parsedDate && isToday(parsedDate));
  const upcomingFollowUps = allFollowUps.filter(({ parsedDate }) => parsedDate && !isToday(parsedDate) && parsedDate > new Date());
  const pastDueFollowUps = allFollowUps.filter(({ parsedDate }) => parsedDate && parsedDate < new Date() && !isToday(parsedDate));
  
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading follow-ups...</div>;
  }
  
  const totalCount = allFollowUps.length;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Follow-up Reminders</h3>
        <Badge variant={totalCount > 0 ? "destructive" : "outline"}>
          {totalCount} total
        </Badge>
      </div>
      
      {todaysFollowUps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-destructive flex items-center gap-1">
            <Bell className="h-3 w-3" />
            Due Today ({todaysFollowUps.length})
          </h4>
          <div className="space-y-1">
            {todaysFollowUps.map(({ client, followUp, parsedDate }) => (
              <div key={client.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{client.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {followUp.status !== "-" ? `Status: ${followUp.status}` : "No status"}
                    {followUp.notes !== "-" && ` • ${followUp.notes}`}
                  </p>
                </div>
                <div className="text-xs text-destructive font-medium whitespace-nowrap ml-2">
                  {parsedDate ? format(parsedDate, "h:mm a") : "Today"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {upcomingFollowUps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-amber-600 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Upcoming ({upcomingFollowUps.length})
          </h4>
          <div className="space-y-1">
            {upcomingFollowUps.slice(0, 3).map(({ client, followUp, parsedDate }) => (
              <div key={client.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{client.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsedDate ? format(parsedDate, "MMM d, yyyy") : followUp.nextDate}
                  </p>
                </div>
                <div className="text-xs text-amber-700 font-medium whitespace-nowrap ml-2">
                  {parsedDate ? format(parsedDate, "MMM d") : "Soon"}
                </div>
              </div>
            ))}
            {upcomingFollowUps.length > 3 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{upcomingFollowUps.length - 3} more upcoming
              </p>
            )}
          </div>
        </div>
      )}
      
      {totalCount === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No follow-ups scheduled</p>
          <p className="text-xs mt-1">Set follow-up dates in lead details</p>
        </div>
      )}
    </div>
  );
}