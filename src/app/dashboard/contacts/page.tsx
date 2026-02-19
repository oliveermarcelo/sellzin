"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate, formatRelativeTime, getInitials, getSegmentLabel, getSegmentColor } from "@/lib/utils";
import { PageHeader, Button, SearchInput, Table, Badge, Pagination, Loading, Modal, Tabs, StatCard, Select, EmptyState } from "@/components/ui";
import { Users, UserPlus, Tag, Download, Mail, Phone, MapPin, Calendar, ShoppingBag, ArrowUpRight } from "lucide-react";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [tagModal, setTagModal] = useState(false);
  const [tagValue, setTagValue] = useState("");

  const loadContacts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "25" };
      if (segmentFilter) params.segment = segmentFilter;
      const data = search ? await api.searchContacts(search) : await api.getContacts(params);
      setContacts(data.contacts || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, segmentFilter]);

  const loadStats = async () => {
    try {
      const [s, seg] = await Promise.all([api.getContactStats(), api.getContactSegments()]);
      setStats(s.stats);
      setSegments(seg.segments || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadContacts(); loadStats(); }, [loadContacts]);

  const openDetail = async (id: string) => {
    try {
      const data = await api.getContact(id);
      setSelectedContact(data.contact);
    } catch (e) { console.error(e); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const bulkTag = async (action: "add" | "remove") => {
    if (!tagValue || selectedIds.length === 0) return;
    await api.bulkTag(selectedIds, tagValue, action);
    setTagModal(false);
    setTagValue("");
    setSelectedIds([]);
    loadContacts(pagination.page);
  };

  const segmentOptions = [
    { value: "", label: "Todos os segmentos" },
    ...["champions", "loyal", "potential", "new_customers", "at_risk", "cant_lose", "hibernating", "lost"]
      .map(s => ({ value: s, label: getSegmentLabel(s) }))
  ];

  return (
    <div>
      <PageHeader title="Contatos" description={`${formatNumber(pagination.total)} contatos`}
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setTagModal(true)}>
                <Tag className="w-3.5 h-3.5" /> Tag ({selectedIds.length})
              </Button>
            )}
            <Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> Exportar</Button>
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={formatNumber(stats.total)} icon={<Users className="w-4 h-4" />} />
          <StatCard label="Novos (7d)" value={formatNumber(stats.newThisWeek)} icon={<UserPlus className="w-4 h-4" />} />
          <StatCard label="Com pedidos" value={formatNumber(stats.withOrders)} />
          <StatCard label="Opt-in WhatsApp" value={formatNumber(stats.optedIn)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, email, telefone..." /></div>
        <Select options={segmentOptions} value={segmentFilter}
          onChange={(e) => { setSegmentFilter(e.target.value); }} className="w-48" />
      </div>

      {/* Segments bar */}
      {segments.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {segments.sort((a, b) => b.count - a.count).map((s: any) => (
            <button key={s.segment} onClick={() => setSegmentFilter(segmentFilter === s.segment ? "" : s.segment)}
              className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                segmentFilter === s.segment ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-400" : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700"
              }`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getSegmentColor(s.segment) }} />
              {getSegmentLabel(s.segment)} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <Table headers={["", "Contato", "Segmento", "Pedidos", "Gasto Total", "Última Compra", "Cidade"]}
        empty={!loading && contacts.length === 0}>
        {loading ? (
          <tr><td colSpan={7}><Loading /></td></tr>
        ) : contacts.map((c: any) => (
          <tr key={c.id} className="hover:bg-zinc-800/20 cursor-pointer transition" onClick={() => openDetail(c.id)}>
            <td className="px-4 py-3 w-10">
              <input type="checkbox" checked={selectedIds.includes(c.id)}
                onChange={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                className="rounded bg-zinc-800 border-zinc-700" />
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                  {getInitials(c.firstName, c.lastName)}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-zinc-600">{c.email || c.phone || "—"}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3">
              <Badge color={getSegmentColor(c.rfmSegment)}>{getSegmentLabel(c.rfmSegment)}</Badge>
            </td>
            <td className="px-4 py-3 text-sm text-zinc-400">{c.totalOrders || 0}</td>
            <td className="px-4 py-3 text-sm font-medium text-zinc-300">{formatCurrency(c.totalSpent)}</td>
            <td className="px-4 py-3 text-xs text-zinc-500">{formatRelativeTime(c.lastOrderAt)}</td>
            <td className="px-4 py-3 text-xs text-zinc-500">{c.city ? `${c.city}/${c.state}` : "—"}</td>
          </tr>
        ))}
      </Table>

      <Pagination page={pagination.page} pages={pagination.pages} onChange={(p) => loadContacts(p)} />

      {/* Contact Detail Modal */}
      <Modal open={!!selectedContact} onClose={() => setSelectedContact(null)}
        title={selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName}` : ""} size="lg">
        {selectedContact && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold text-zinc-400">
                {getInitials(selectedContact.firstName, selectedContact.lastName)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">{selectedContact.firstName} {selectedContact.lastName}</h3>
                <Badge color={getSegmentColor(selectedContact.rfmSegment)} size="xs">{getSegmentLabel(selectedContact.rfmSegment)}</Badge>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-500">
                  {selectedContact.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selectedContact.email}</span>}
                  {selectedContact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selectedContact.phone}</span>}
                  {selectedContact.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedContact.city}/{selectedContact.state}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Cliente desde {formatDate(selectedContact.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{selectedContact.totalOrders || 0}</p>
                <p className="text-xs text-zinc-500">Pedidos</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{formatCurrency(selectedContact.totalSpent)}</p>
                <p className="text-xs text-zinc-500">Total Gasto</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{formatCurrency(selectedContact.avgOrderValue)}</p>
                <p className="text-xs text-zinc-500">Ticket Médio</p>
              </div>
            </div>

            {/* RFM Score */}
            <div className="bg-zinc-900/50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-zinc-400 mb-3">Score RFM</h4>
              <div className="flex gap-4">
                {[
                  { label: "Recência", value: selectedContact.rfmRecency },
                  { label: "Frequência", value: selectedContact.rfmFrequency },
                  { label: "Monetário", value: selectedContact.rfmMonetary },
                ].map(m => (
                  <div key={m.label} className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-zinc-600">{m.label}</span>
                      <span className="text-xs font-bold text-zinc-400">{m.value || 0}/5</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${((m.value || 0) / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            {selectedContact.tags && selectedContact.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedContact.tags.map((tag: string) => (
                    <Badge key={tag} color="#818cf8" size="xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Orders */}
            {selectedContact.orders && selectedContact.orders.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 mb-2">Últimos Pedidos</h4>
                <div className="space-y-2">
                  {selectedContact.orders.slice(0, 5).map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between py-2 px-3 bg-zinc-900/30 rounded-lg">
                      <div>
                        <span className="text-sm text-zinc-300">#{o.orderNumber}</span>
                        <span className="text-xs text-zinc-600 ml-2">{formatDate(o.placedAt)}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{formatCurrency(o.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {selectedContact.interactions && selectedContact.interactions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 mb-2">Histórico</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedContact.interactions.slice(0, 10).map((i: any) => (
                    <div key={i.id} className="flex items-start gap-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs text-zinc-400">{i.content || i.type}</p>
                        <p className="text-[10px] text-zinc-600">{formatRelativeTime(i.createdAt)} · {i.channel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Tag Modal */}
      <Modal open={tagModal} onClose={() => setTagModal(false)} title="Gerenciar Tags" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">{selectedIds.length} contatos selecionados</p>
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Nome da Tag</label>
            <input value={tagValue} onChange={(e) => setTagValue(e.target.value)}
              placeholder="ex: vip, black-friday, inativo"
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => bulkTag("add")} className="flex-1">Adicionar Tag</Button>
            <Button variant="danger" onClick={() => bulkTag("remove")} className="flex-1">Remover Tag</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
