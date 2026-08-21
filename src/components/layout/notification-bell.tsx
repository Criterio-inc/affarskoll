"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, Trash2, BellOff } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkAllRead,
  useMarkNotificationRead,
  useDeleteNotification,
  type Notification,
} from "@/hooks/use-notifications";

const typeLabels: Record<string, string> = {
  budget_warning: "Budget",
  contract_expiry: "Kontrakt",
  billing_reminder: "Fakturering",
  weekly_summary: "Veckosammanfattning",
};

const typeColors: Record<string, string> = {
  budget_warning: "bg-amber-500",
  contract_expiry: "bg-red-500",
  billing_reminder: "bg-blue-500",
  weekly_summary: "bg-green-500",
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "nyss";
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h sedan`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} dagar sedan`;
  return d.toLocaleDateString("sv-SE", {
    month: "short",
    day: "numeric",
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markAllRead = useMarkAllRead();
  const markRead = useMarkNotificationRead();
  const remove = useDeleteNotification();

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleNotificationClick(n: Notification) {
    if (!n.read) markRead.mutate(n.id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/50 transition-colors"
          aria-label={`Notifikationer (${unreadCount} olästa)`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0 max-w-[calc(100vw-2rem)]"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div>
            <p className="font-semibold text-sm">Notifikationer</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} oläst${unreadCount === 1 ? "" : "a"}`
                : "Allt läst"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-xs h-7"
            >
              <Check className="w-3 h-3 mr-1" />
              Markera alla
            </Button>
          )}
        </div>

        {/* Lista */}
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <BellOff className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Inga notifikationer</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const inner = (
                  <div
                    className={cn(
                      "group flex items-start gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    {/* Färgad prick */}
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        typeColors[n.type] ?? "bg-gray-400",
                        n.read && "opacity-30"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {typeLabels[n.type] ?? n.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          · {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          !n.read && "font-medium"
                        )}
                      >
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        remove.mutate(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 rounded text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Ta bort"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );

                // Klickbar länk om kopplat till projekt
                if (n.projectId) {
                  return (
                    <Link
                      key={n.id}
                      href={`/uppdrag/${n.projectId}`}
                      onClick={() => {
                        handleNotificationClick(n);
                        setOpen(false);
                      }}
                    >
                      {inner}
                    </Link>
                  );
                }

                return (
                  <button
                    key={n.id}
                    type="button"
                    className="w-full text-left"
                    onClick={() => handleNotificationClick(n)}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
