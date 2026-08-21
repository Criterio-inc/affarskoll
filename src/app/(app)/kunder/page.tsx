"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useCustomerCommunications,
  useCreateCommunication,
} from "@/hooks/use-customers";
import { useProjects } from "@/hooks/use-projects";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { Customer, CustomerCommunication, COMMUNICATION_TYPE_LABELS } from "@/types/project";
import { formatCurrency, projectBelongsToCustomer } from "@/lib/utils";
import {
  Plus,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageSquare,
  FileText,
  BarChart3,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export default function KunderPage() {
  const { data: customers = [], isLoading } = useCustomers();
  const { data: projects = [] } = useProjects();
  const { data: timeEntries = [] } = useTimeEntries();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [commDialogOpen, setCommDialogOpen] = useState(false);

  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    defaultHourlyRate: 0,
  });

  // Communication form
  const [newComm, setNewComm] = useState({
    type: "email" as CustomerCommunication["type"],
    summary: "",
    date: new Date().toISOString().split("T")[0],
  });

  const selectedCustomer = customers.find((c) => c.id === selectedId) ?? null;

  const { data: communications = [] } = useCustomerCommunications(selectedId);
  const createCommunication = useCreateCommunication();

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contactPerson?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  // Customer statistics — Fas 4.6: CLV, avg rate, trend
  const customerStats = useMemo(() => {
    if (!selectedCustomer) return null;

    const customerProjects = projects.filter((p) =>
      projectBelongsToCustomer(p, selectedCustomer)
    );
    const projectIds = customerProjects.map((p) => p.id);
    const customerEntries = timeEntries.filter((e) =>
      projectIds.includes(e.projectId)
    );
    const totalHours = customerEntries.reduce(
      (sum, e) => sum + Number(e.hours),
      0
    );

    let totalRevenue = 0;
    customerProjects.forEach((p) => {
      if (p.contractType === "fastpris" || p.contractType === "fastpris_overtid") {
        totalRevenue += Number(p.fixedPrice ?? 0);
      } else {
        const projEntries = customerEntries.filter((e) => e.projectId === p.id);
        const projHours = projEntries.reduce((sum, e) => sum + Number(e.hours), 0);
        totalRevenue += projHours * Number(p.hourlyRate ?? 0);
      }
    });

    // Avg hourly rate (CLV basis)
    const avgHourlyRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    // Revenue last 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    let revenueLast12m = 0;
    for (const e of customerEntries) {
      const d = new Date(e.date);
      if (d >= twelveMonthsAgo && d <= now) {
        const p = customerProjects.find((cp) => cp.id === e.projectId);
        if (!p) continue;
        if (p.contractType === "timpris" || p.contractType === "blandat") {
          revenueLast12m += Number(e.hours) * Number(p.hourlyRate ?? 0);
        }
      }
    }

    // Revenue per month (last 12 months) for sparkline
    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const monthEntries = customerEntries.filter((e) =>
        e.date.startsWith(monthKey)
      );
      let rev = 0;
      for (const e of monthEntries) {
        const p = customerProjects.find((cp) => cp.id === e.projectId);
        if (!p) continue;
        if (p.contractType === "timpris" || p.contractType === "blandat") {
          rev += Number(e.hours) * Number(p.hourlyRate ?? 0);
        }
      }
      monthlyRevenue.push({ month: monthKey, revenue: Math.round(rev) });
    }

    // First/last project dates (CLV time span)
    const projectDates = customerProjects
      .flatMap((p) => [p.startDate, p.createdAt])
      .filter(Boolean)
      .map((d) => new Date(d));
    const firstEngagement =
      projectDates.length > 0
        ? new Date(Math.min(...projectDates.map((d) => d.getTime())))
        : null;

    return {
      projectCount: customerProjects.length,
      totalHours: Math.round(totalHours),
      totalRevenue: Math.round(totalRevenue),
      activeProjects: customerProjects.filter((p) => p.status === "aktiv").length,
      avgHourlyRate: Math.round(avgHourlyRate),
      revenueLast12m: Math.round(revenueLast12m),
      monthlyRevenue,
      firstEngagement,
    };
  }, [selectedCustomer, projects, timeEntries]);

  const handleCreateCustomer = () => {
    if (!newCustomer.name.trim()) return;
    createCustomer.mutate(newCustomer, {
      onSuccess: () => {
        toast.success("Kund skapad");
        setAddDialogOpen(false);
        setNewCustomer({
          name: "",
          contactPerson: "",
          email: "",
          phone: "",
          address: "",
          notes: "",
          defaultHourlyRate: 0,
        });
      },
      onError: () => toast.error("Kunde inte skapa kund"),
    });
  };

  const handleDeleteCustomer = (id: string) => {
    deleteCustomer.mutate(id, {
      onSuccess: () => {
        toast.success("Kund borttagen");
        if (selectedId === id) setSelectedId(null);
      },
      onError: () => toast.error("Kunde inte ta bort kund"),
    });
  };

  const handleLogCommunication = () => {
    if (!selectedId || !newComm.summary.trim()) return;
    createCommunication.mutate(
      {
        customerId: selectedId,
        type: newComm.type,
        summary: newComm.summary,
        date: newComm.date,
      },
      {
        onSuccess: () => {
          toast.success("Kommunikation loggad");
          setCommDialogOpen(false);
          setNewComm({
            type: "email",
            summary: "",
            date: new Date().toISOString().split("T")[0],
          });
        },
        onError: () => toast.error("Kunde inte logga kommunikation"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kunder"
        description={`${customers.length} kunder registrerade`}
      />

      <div className="grid lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Left panel: Customer list — döljs på mobil när kund är vald */}
        <Card
          className={`lg:col-span-1 ${
            selectedId ? "hidden lg:block" : "block"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-lg">Kundlista</CardTitle>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Ny kund
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök kunder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  {searchQuery
                    ? "Inga kunder matchar sökningen"
                    : "Inga kunder registrerade"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredCustomers.map((customer) => {
                    const isSelected = selectedId === customer.id;
                    return (
                      <button
                        key={customer.id}
                        className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                          isSelected ? "bg-accent" : ""
                        }`}
                        onClick={() => setSelectedId(customer.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {customer.name}
                            </p>
                            {customer.contactPerson && (
                              <p className="text-xs text-muted-foreground truncate">
                                {customer.contactPerson}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel: Customer detail — döljs på mobil när ingen kund är vald */}
        <Card
          className={`lg:col-span-2 ${
            selectedId ? "block" : "hidden lg:block"
          }`}
        >
          {!selectedCustomer ? (
            <CardContent className="flex items-center justify-center min-h-[500px] text-muted-foreground">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Välj en kund för att se detaljer</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                {/* Mobil: tillbaka-knapp som rensar valet */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden mb-2 -ml-2 w-fit"
                >
                  ← Tillbaka till lista
                </Button>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {selectedCustomer.name}
                    </CardTitle>
                    {selectedCustomer.contactPerson && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Kontaktperson: {selectedCustomer.contactPerson}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCommDialogOpen(true)}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Logga kontakt
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Ta bort kund"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Ta bort {selectedCustomer.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Detta tar permanent bort kunden och all
                            kommunikationshistorik. Kopplade uppdrag försvinner
                            inte — men deras "Kund"-koppling tappas. Detta kan
                            inte ångras.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Ta bort
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="info">
                  <TabsList>
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="uppdrag">Uppdrag</TabsTrigger>
                    <TabsTrigger value="historik">Historik</TabsTrigger>
                    <TabsTrigger value="statistik">Statistik</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="mt-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {selectedCustomer.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <a
                            href={`mailto:${selectedCustomer.email}`}
                            className="hover:underline"
                          >
                            {selectedCustomer.email}
                          </a>
                        </div>
                      )}
                      {selectedCustomer.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a
                            href={`tel:${selectedCustomer.phone}`}
                            className="hover:underline"
                          >
                            {selectedCustomer.phone}
                          </a>
                        </div>
                      )}
                      {selectedCustomer.address && (
                        <div className="flex items-center gap-2 text-sm sm:col-span-2">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span>{selectedCustomer.address}</span>
                        </div>
                      )}
                    </div>
                    {selectedCustomer.defaultHourlyRate && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span>
                          Standardtimpris:{" "}
                          {formatCurrency(Number(selectedCustomer.defaultHourlyRate))}/h
                        </span>
                      </div>
                    )}
                    {selectedCustomer.notes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-1">Anteckningar</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedCustomer.notes}
                        </p>
                      </div>
                    )}

                    <Separator className="my-4" />
                    <CustomerInvoiceDetailsForm
                      key={selectedCustomer.id}
                      customer={selectedCustomer}
                      saving={updateCustomer.isPending}
                      onSave={(patch) =>
                        updateCustomer.mutate(
                          { id: selectedCustomer.id, ...patch },
                          {
                            onSuccess: () =>
                              toast.success("Fakturauppgifter sparade"),
                            onError: () =>
                              toast.error("Kunde inte spara fakturauppgifterna"),
                          }
                        )
                      }
                    />
                  </TabsContent>

                  <TabsContent value="uppdrag" className="mt-4">
                    {(() => {
                      const customerProjects = projects.filter((p) =>
                        projectBelongsToCustomer(p, selectedCustomer)
                      );
                      if (customerProjects.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Inga uppdrag registrerade för denna kund.
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          {customerProjects.map((project) => (
                            <div
                              key={project.id}
                              className="border rounded-lg p-4"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{project.title}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {project.startDate} - {project.endDate}
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    project.status === "aktiv"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {project.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </TabsContent>

                  <TabsContent value="historik" className="mt-4">
                    {communications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Ingen kommunikationshistorik.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {communications.map((comm) => (
                          <div
                            key={comm.id}
                            className="border rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {COMMUNICATION_TYPE_LABELS[comm.type]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {comm.date}
                              </span>
                            </div>
                            <p className="text-sm">{comm.summary}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="statistik" className="mt-4 space-y-4">
                    {customerStats && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="border rounded-lg p-4 text-center">
                            <Briefcase className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-2xl font-bold">
                              {customerStats.projectCount}
                            </p>
                            <p className="text-xs text-muted-foreground">Projekt</p>
                          </div>
                          <div className="border rounded-lg p-4 text-center">
                            <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-green-600" />
                            <p className="text-2xl font-bold">
                              {customerStats.activeProjects}
                            </p>
                            <p className="text-xs text-muted-foreground">Aktiva</p>
                          </div>
                          <div className="border rounded-lg p-4 text-center">
                            <Clock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-2xl font-bold">
                              {customerStats.totalHours}h
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Totalt timmar
                            </p>
                          </div>
                          <div className="border rounded-lg p-4 text-center">
                            <DollarSign className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-2xl font-bold">
                              {formatCurrency(customerStats.totalRevenue)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Total intakt (CLV)
                            </p>
                          </div>
                        </div>

                        {/* Fas 4.6: Extended KPIs */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div className="border rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">
                              Genomsnittligt timpris
                            </p>
                            <p className="text-xl font-bold">
                              {customerStats.avgHourlyRate > 0
                                ? `${formatCurrency(customerStats.avgHourlyRate)}/h`
                                : "-"}
                            </p>
                          </div>
                          <div className="border rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">
                              Intakt senaste 12 man
                            </p>
                            <p className="text-xl font-bold">
                              {formatCurrency(customerStats.revenueLast12m)}
                            </p>
                          </div>
                          <div className="border rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">
                              Första engagemang
                            </p>
                            <p className="text-xl font-bold">
                              {customerStats.firstEngagement
                                ? customerStats.firstEngagement.toLocaleDateString(
                                    "sv-SE",
                                    {
                                      year: "numeric",
                                      month: "short",
                                    }
                                  )
                                : "-"}
                            </p>
                          </div>
                        </div>

                        {/* Revenue trend - 12 months */}
                        <div className="border rounded-lg p-4">
                          <p className="text-sm font-medium mb-3 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-muted-foreground" />
                            Intäktstrend senaste 12 månader
                          </p>
                          <div className="flex items-end gap-1 h-24">
                            {(() => {
                              const maxRev = Math.max(
                                ...customerStats.monthlyRevenue.map((m) => m.revenue),
                                1
                              );
                              return customerStats.monthlyRevenue.map((m) => {
                                const pct = (m.revenue / maxRev) * 100;
                                return (
                                  <div
                                    key={m.month}
                                    className="flex-1 flex flex-col items-center gap-1"
                                    title={`${m.month}: ${formatCurrency(m.revenue)}`}
                                  >
                                    <div
                                      className={`w-full rounded-t ${
                                        m.revenue > 0
                                          ? "bg-primary/70"
                                          : "bg-muted"
                                      }`}
                                      style={{ height: `${Math.max(2, pct)}%` }}
                                    />
                                    <span className="text-[9px] text-muted-foreground">
                                      {m.month.slice(-2)}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Add customer dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny kund</DialogTitle>
            <DialogDescription>
              Lägg till en ny kund i systemet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Företagsnamn *</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, name: e.target.value })
                }
                placeholder="AB Företaget"
              />
            </div>
            <div className="space-y-2">
              <Label>Kontaktperson</Label>
              <Input
                value={newCustomer.contactPerson}
                onChange={(e) =>
                  setNewCustomer({
                    ...newCustomer,
                    contactPerson: e.target.value,
                  })
                }
                placeholder="Anna Svensson"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  placeholder="anna@foretaget.se"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  placeholder="070-123 45 67"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adress (besöks-/kontaktadress)</Label>
              <Input
                value={newCustomer.address}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, address: e.target.value })
                }
                placeholder="Storgatan 1, 123 45 Stockholm"
              />
              <p className="text-xs text-muted-foreground">
                Fakturaadressen anges separat under Fakturauppgifter på
                kundkortet — det är den som hamnar på fakturan.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Standardtimpris (SEK)</Label>
              <Input
                type="number"
                value={newCustomer.defaultHourlyRate || ""}
                onChange={(e) =>
                  setNewCustomer({
                    ...newCustomer,
                    defaultHourlyRate: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Anteckningar</Label>
              <Textarea
                value={newCustomer.notes}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Avbryt
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={!newCustomer.name.trim() || createCustomer.isPending}
            >
              {createCustomer.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              Skapa kund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log communication dialog */}
      <Dialog open={commDialogOpen} onOpenChange={setCommDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logga kommunikation</DialogTitle>
            <DialogDescription>
              Dokumentera kontakt med {selectedCustomer?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select
                  value={newComm.type}
                  onValueChange={(v) =>
                    setNewComm({
                      ...newComm,
                      type: v as CustomerCommunication["type"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMMUNICATION_TYPE_LABELS).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={newComm.date}
                  onChange={(e) =>
                    setNewComm({ ...newComm, date: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sammanfattning *</Label>
              <Textarea
                value={newComm.summary}
                onChange={(e) =>
                  setNewComm({ ...newComm, summary: e.target.value })
                }
                placeholder="Beskriv kontakten..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommDialogOpen(false)}>
              Avbryt
            </Button>
            <Button
              onClick={handleLogCommunication}
              disabled={
                !newComm.summary.trim() || createCommunication.isPending
              }
            >
              {createCommunication.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <MessageSquare className="w-4 h-4 mr-1" />
              )}
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Fakturauppgifter på kundkortet — det som behövs när kunden står som
// köpare på en genererad faktura (orgnr, fakturaadress, referens, villkor).
function CustomerInvoiceDetailsForm({
  customer,
  saving,
  onSave,
}: {
  customer: Customer;
  saving: boolean;
  onSave: (patch: Partial<Customer>) => void;
}) {
  const [form, setForm] = useState({
    orgNumber: customer.orgNumber ?? "",
    invoiceStreet: customer.invoiceStreet ?? "",
    invoicePostalCode: customer.invoicePostalCode ?? "",
    invoiceCity: customer.invoiceCity ?? "",
    invoiceCountry: customer.invoiceCountry ?? "Sverige",
    invoiceReference: customer.invoiceReference ?? "",
    deliveryAddress: customer.deliveryAddress ?? "",
    paymentTermsDays:
      customer.paymentTermsDays != null ? String(customer.paymentTermsDays) : "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((s) => ({ ...s, [key]: value }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Fakturauppgifter</p>
        <p className="text-xs text-muted-foreground">
          Används när kunden är köpare på en genererad faktura
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Organisationsnummer</Label>
          <Input
            value={form.orgNumber}
            onChange={(e) => set("orgNumber")(e.target.value)}
            placeholder="556677-8899"
          />
        </div>
        <div className="space-y-2">
          <Label>Er referens</Label>
          <Input
            value={form.invoiceReference}
            onChange={(e) => set("invoiceReference")(e.target.value)}
            placeholder="t.ex. Anna-Karin Jönsson"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Fakturaadress (gata)</Label>
        <Input
          value={form.invoiceStreet}
          onChange={(e) => set("invoiceStreet")(e.target.value)}
          placeholder="Järntorget 3"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Postnummer</Label>
          <Input
            value={form.invoicePostalCode}
            onChange={(e) => set("invoicePostalCode")(e.target.value)}
            placeholder="413 04"
          />
        </div>
        <div className="space-y-2">
          <Label>Ort</Label>
          <Input
            value={form.invoiceCity}
            onChange={(e) => set("invoiceCity")(e.target.value)}
            placeholder="Göteborg"
          />
        </div>
        <div className="space-y-2">
          <Label>Land</Label>
          <Input
            value={form.invoiceCountry}
            onChange={(e) => set("invoiceCountry")(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Betalningsvillkor (dagar)</Label>
          <Input
            type="number"
            value={form.paymentTermsDays}
            onChange={(e) => set("paymentTermsDays")(e.target.value)}
            placeholder="30"
          />
        </div>
        <div className="space-y-2">
          <Label>Leveransadress (om annan)</Label>
          <Textarea
            rows={2}
            value={form.deliveryAddress}
            onChange={(e) => set("deliveryAddress")(e.target.value)}
            placeholder="Lämna tom för samma som fakturaadressen"
          />
        </div>
      </div>
      <Button
        size="sm"
        disabled={saving}
        onClick={() =>
          onSave({
            orgNumber: form.orgNumber.trim() || null,
            invoiceStreet: form.invoiceStreet.trim() || null,
            invoicePostalCode: form.invoicePostalCode.trim() || null,
            invoiceCity: form.invoiceCity.trim() || null,
            invoiceCountry: form.invoiceCountry.trim() || null,
            invoiceReference: form.invoiceReference.trim() || null,
            deliveryAddress: form.deliveryAddress.trim() || null,
            paymentTermsDays: form.paymentTermsDays
              ? Number(form.paymentTermsDays)
              : null,
          })
        }
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
        Spara fakturauppgifter
      </Button>
    </div>
  );
}
