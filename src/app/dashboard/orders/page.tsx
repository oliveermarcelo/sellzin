"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate, formatRelativeTime, getStatusLabel, getStatusColor, getInitials } from "@/lib/utils";
import { PageHeader, Button, SearchInput, Table, Badge, Pagination, Loading, Modal, StatCard, Select, Tabs } from "@/components/ui";
import { Package, DollarSign, Clock, Truck, Eye } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("month");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "25", period: periodFilter };
      if (statusFilter) params.status = statusFilter;
      const data = await api.getOrders(params);
      setOrders(data.orders || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, periodFilter]);

  const loadStats = async () => {
    try {
      const data = await api.getOrderStats(periodFilter);
      setStats(data.stats);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadOrders(); loadStats(); }, [loadOrders, periodFilter]);

  const openDetail = async (id: string) => {
    try {
      const data = await api.getOrder(id);
      setSelectedOrder(data.order);
    } catch (e) { console.error(e); }
  };

  const statusOptions = [
    { value: "", label: "Todos os status" },
    { value: "pending", label: "Pendente" },
    { value: "processing", label: "Processando" },
    { value: "shipped", label: "Enviado" },
    { value: "delivered", label: "Entregue" },
    { value: "cancelled", label: "Cancelado" },
    { value: "refunded", label: "Reembolsado" },
  ];

  return (
    <div>
      <PageHeader title="Pedidos" description={`${formatNumber(pagination.total)} pedidos`} />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Faturamento" value={formatCurrency(stats.totalRevenue)} icon={<DollarSign className="w-4 h-4" />} />
          <StatCard label="Total Pedidos" value={formatNumber(stats.totalOrders)} icon={<Package className="w-4 h-4" />} />
          <StatCard label="Ticket Médio" value={formatCurrency(stats.avgOrderValue)} />
          <StatCard label="Aguard. Envio" value={formatNumber(stats.pendingShipment)} icon={<Truck className="w-4 h-4" />} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Tabs tabs={[
          { id: "today", label: "Hoje" },
          { id: "week", label: "7 dias" },
          { id: "month", label: "30 dias" },
        ]} active={periodFilter} onChange={setPeriodFilter} />
        <div className="ml-auto">
          <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44" />
        </div>
      </div>

      {/* Table */}
      <Table headers={["Pedido", "Cliente", "Status", "Pagamento", "Total", "Data"]} empty={!loading && orders.length === 0}>
        {loading ? (
          <tr><td colSpan={6}><Loading /></td></tr>
        ) : orders.map((o: any) => (
          <tr key={o.id} className="hover:bg-zinc-800/20 cursor-pointer transition" onClick={() => openDetail(o.id)}>
            <td className="px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-200">#{o.orderNumber || o.externalId}</p>
                <p className="text-[10px] text-zinc-600">{o.store?.name}</p>
              </div>
            </td>
            <td className="px-4 py-3">
              {o.contact ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                    {getInitials(o.contact.firstName, o.contact.lastName)}
                  </div>
                  <span className="text-sm text-zinc-300">{o.contact.firstName} {o.contact.lastName}</span>
                </div>
              ) : <span className="text-sm text-zinc-600">—</span>}
            </td>
            <td className="px-4 py-3">
              <Badge color={getStatusColor(o.status)}>{getStatusLabel(o.status)}</Badge>
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500">{o.paymentMethod || "—"}</td>
            <td className="px-4 py-3 text-sm font-semibold text-zinc-300">{formatCurrency(o.total)}</td>
            <td className="px-4 py-3 text-xs text-zinc-500">{formatRelativeTime(o.placedAt)}</td>
          </tr>
        ))}
      </Table>

      <Pagination page={pagination.page} pages={pagination.pages} onChange={(p) => loadOrders(p)} />

      {/* Order Detail Modal */}
      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Pedido #${selectedOrder.orderNumber || selectedOrder.externalId}` : ""} size="lg">
        {selectedOrder && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Badge color={getStatusColor(selectedOrder.status)} size="sm">{getStatusLabel(selectedOrder.status)}</Badge>
              <span className="text-xs text-zinc-600">{formatDate(selectedOrder.placedAt, true)}</span>
            </div>

            {/* Customer info */}
            {selectedOrder.contact && (
              <div className="bg-zinc-900/50 rounded-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400">
                  {getInitials(selectedOrder.contact.firstName, selectedOrder.contact.lastName)}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{selectedOrder.contact.firstName} {selectedOrder.contact.lastName}</p>
                  <p className="text-xs text-zinc-500">{selectedOrder.contact.email} · {selectedOrder.contact.phone}</p>
                </div>
              </div>
            )}

            {/* Items */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 mb-2">Itens</h4>
              <div className="space-y-2">
                {(selectedOrder.items || []).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-zinc-900/30 rounded-lg">
                    <div>
                      <p className="text-sm text-zinc-300">{item.name}</p>
                      <p className="text-xs text-zinc-600">SKU: {item.sku} · Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-medium text-zinc-300">{formatCurrency(item.total || item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-zinc-900/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Subtotal</span><span className="text-zinc-300">{formatCurrency(selectedOrder.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Frete</span><span className="text-zinc-300">{formatCurrency(selectedOrder.shippingCost)}</span></div>
              {parseFloat(selectedOrder.discount) > 0 && (
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Desconto</span><span className="text-emerald-400">-{formatCurrency(selectedOrder.discount)}</span></div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-zinc-800 pt-2 mt-2">
                <span className="text-white">Total</span><span className="text-white">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Tracking */}
            {selectedOrder.trackingCode && (
              <div className="bg-zinc-900/50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-zinc-400 mb-2">Rastreamento</h4>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-300">{selectedOrder.shippingCarrier}: {selectedOrder.trackingCode}</span>
                </div>
              </div>
            )}

            {selectedOrder.customerNote && (
              <div className="bg-zinc-900/50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-zinc-400 mb-2">Nota do Cliente</h4>
                <p className="text-sm text-zinc-400">{selectedOrder.customerNote}</p>
              </div>
            )}

            <div className="text-[10px] text-zinc-700">
              Loja: {selectedOrder.store?.name} ({selectedOrder.store?.platform}) · ID externo: {selectedOrder.externalId}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
