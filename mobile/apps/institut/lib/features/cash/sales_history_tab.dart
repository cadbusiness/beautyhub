import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';
import '../shared/sale_doc.dart';
import 'sale_detail_sheet.dart';
import 'sale_ticket_actions_sheet.dart';
import 'sale_ticket_pdf_screen.dart';

class SalesHistoryTab extends ConsumerStatefulWidget {
  const SalesHistoryTab({super.key, this.active = false});

  final bool active;

  @override
  ConsumerState<SalesHistoryTab> createState() => _SalesHistoryTabState();
}

class _SalesHistoryTabState extends ConsumerState<SalesHistoryTab> {
  static const _bg = Color(0xFFF5F5F5);
  static const _muted = Color(0xFF737373);

  final _scrollController = ScrollController();
  List<InstSale> _sales = const [];
  List<InstSaleDocument> _docs = const [];
  String? _cursor;
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;
  bool _loadedOnce = false;
  String? _today;

  String _view = 'sales';
  String _period = 'today';
  String _status = '';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    if (widget.active) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitial());
    }
  }

  @override
  void didUpdateWidget(covariant SalesHistoryTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) {
      _loadInitial();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 320 &&
        !_loadingMore &&
        _cursor != null) {
      _loadMore();
    }
  }

  Future<void> _loadInitial() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) {
        throw StateError('Session ou institut manquant');
      }
      if (_view == 'sales') {
        final page = await ref.read(mobileApiProvider).fetchInstitutSales(
              accessToken: token,
              tenantId: tenantId,
              period: _period,
              status: _status.isEmpty ? null : _status,
            );
        if (!mounted) return;
        setState(() {
          _sales = page.items;
          _docs = const [];
          _cursor = page.nextCursor;
          _today = page.today ?? _today;
          _loading = false;
          _loadedOnce = true;
        });
      } else {
        final page = await ref.read(mobileApiProvider).fetchInstitutDocuments(
              accessToken: token,
              tenantId: tenantId,
              period: _period,
              docType: _view,
            );
        if (!mounted) return;
        setState(() {
          _docs = page.items;
          _sales = const [];
          _cursor = page.nextCursor;
          _today = page.today ?? _today;
          _loading = false;
          _loadedOnce = true;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
        _loadedOnce = true;
      });
    }
  }

  Future<void> _runTicketAction(InstSale sale) async {
    final outcome = await showSaleTicketActionsSheet(
      context: context,
      sale: sale,
    );
    if (outcome == null || !mounted) return;
    await _loadInitial();
    if (!mounted) return;
    if (outcome.replace) return;
    final documentId = outcome.documentId;
    if (documentId != null && documentId.isNotEmpty) {
      await openSaleDocumentPdf(
        context,
        documentId: documentId,
        title: outcome.creditNumber,
        docType: 'credit_note',
      );
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _cursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) return;
      if (_view == 'sales') {
        final page = await ref.read(mobileApiProvider).fetchInstitutSales(
              accessToken: token,
              tenantId: tenantId,
              cursor: _cursor,
              period: _period,
              status: _status.isEmpty ? null : _status,
            );
        if (!mounted) return;
        setState(() {
          _sales = [..._sales, ...page.items];
          _cursor = page.nextCursor;
          _loadingMore = false;
        });
      } else {
        final page = await ref.read(mobileApiProvider).fetchInstitutDocuments(
              accessToken: token,
              tenantId: tenantId,
              cursor: _cursor,
              period: _period,
              docType: _view,
            );
        if (!mounted) return;
        setState(() {
          _docs = [..._docs, ...page.items];
          _cursor = page.nextCursor;
          _loadingMore = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  void _setFilter({String? view, String? period, String? status}) {
    setState(() {
      if (view != null) _view = view;
      if (period != null) _period = period;
      if (status != null) _status = status;
    });
    _loadInitial();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && !_loadedOnce) {
      return const Center(child: CircularProgressIndicator());
    }

    final empty = _view == 'sales' ? _sales.isEmpty : _docs.isEmpty;
    final emptyLabel = _view == 'invoice'
        ? 'Aucune facture émise. Chaque vente crée un ticket ; la facture se génère depuis le ticket si la cliente en a besoin.'
        : _view == 'delivery_note'
            ? 'Aucun bon de livraison pour ces filtres.'
            : _view == 'credit_note'
                ? 'Aucun avoir pour ces filtres.'
                : (_period == 'today'
                    ? 'Aucune vente aujourd’hui.'
                    : 'Aucune vente pour ces filtres.');

    return Container(
      color: _bg,
      child: Column(
        children: [
          _FiltersBar(
            view: _view,
            period: _period,
            status: _status,
            onView: (v) => _setFilter(view: v),
            onPeriod: (v) => _setFilter(period: v),
            onStatus: (v) => _setFilter(status: v),
          ),
          Expanded(
            child: _error != null && empty
                ? _RefreshableMessage(
                    onRefresh: _loadInitial,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: _muted, fontSize: 13),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: _loadInitial,
                          child: const Text('Réessayer'),
                        ),
                      ],
                    ),
                  )
                : empty
                    ? _RefreshableMessage(
                        onRefresh: _loadInitial,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.receipt_long_outlined,
                              size: 44,
                              color: _muted,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              emptyLabel,
                              style: const TextStyle(color: _muted, fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadInitial,
                        child: _view == 'sales'
                            ? _buildSalesList()
                            : _buildDocsList(),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalesList() {
    final grouped = _groupSales(_sales);
    return ListView.builder(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.only(
        top: 4,
        bottom: MediaQuery.viewPaddingOf(context).bottom + 24,
      ),
      itemCount: grouped.length + (_loadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= grouped.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        return _DayGroup(
          day: grouped[index],
          today: _today,
          onTicketAction: _runTicketAction,
        );
      },
    );
  }

  Widget _buildDocsList() {
    final grouped = _groupDocs(_docs);
    return ListView.builder(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.only(
        top: 4,
        bottom: MediaQuery.viewPaddingOf(context).bottom + 24,
      ),
      itemCount: grouped.length + (_loadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= grouped.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        return _DocDayGroup(day: grouped[index], today: _today);
      },
    );
  }

  List<_DaySales> _groupSales(List<InstSale> sales) {
    final map = <String, List<InstSale>>{};
    for (final s in sales) {
      final key = s.calendarDate ?? DateFormat('yyyy-MM-dd').format(s.createdAt);
      (map[key] ??= []).add(s);
    }
    return map.entries.map((e) {
      final total = e.value.fold<int>(0, (sum, s) => sum + s.totalCents);
      return _DaySales(
        key: e.key,
        date: e.value.first.createdAt,
        sales: e.value,
        totalCents: total,
      );
    }).toList();
  }

  List<_DayDocs> _groupDocs(List<InstSaleDocument> docs) {
    final map = <String, List<InstSaleDocument>>{};
    for (final d in docs) {
      final key = d.calendarDate ?? DateFormat('yyyy-MM-dd').format(d.issuedAt);
      (map[key] ??= []).add(d);
    }
    return map.entries
        .map((e) => _DayDocs(key: e.key, date: e.value.first.issuedAt, docs: e.value))
        .toList();
  }
}

class _FiltersBar extends StatelessWidget {
  const _FiltersBar({
    required this.view,
    required this.period,
    required this.status,
    required this.onView,
    required this.onPeriod,
    required this.onStatus,
  });

  final String view;
  final String period;
  final String status;
  final ValueChanged<String> onView;
  final ValueChanged<String> onPeriod;
  final ValueChanged<String> onStatus;

  static const _border = Color(0xFFE8E8E8);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: _border)),
        ),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SegmentedRow(
              items: const [
                (id: 'sales', label: 'Ventes'),
                (id: 'invoice', label: 'Factures'),
                (id: 'delivery_note', label: 'Bons'),
                (id: 'credit_note', label: 'Avoirs'),
              ],
              selected: view,
              onSelected: onView,
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _Chip(
                    label: 'Aujourd’hui',
                    selected: period == 'today',
                    onTap: () => onPeriod('today'),
                  ),
                  _Chip(
                    label: 'Hier',
                    selected: period == 'yesterday',
                    onTap: () => onPeriod('yesterday'),
                  ),
                  _Chip(
                    label: '7 jours',
                    selected: period == 'week',
                    onTap: () => onPeriod('week'),
                  ),
                  _Chip(
                    label: 'Tout',
                    selected: period == 'all',
                    onTap: () => onPeriod('all'),
                  ),
                ],
              ),
            ),
            if (view == 'sales') ...[
              const SizedBox(height: 10),
              _SegmentedRow(
                items: const [
                  (id: '', label: 'Tous'),
                  (id: 'paid', label: 'Payé'),
                  (id: 'partial', label: 'Acompte'),
                ],
                selected: status,
                onSelected: onStatus,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SegmentedRow extends StatelessWidget {
  const _SegmentedRow({
    required this.items,
    required this.selected,
    required this.onSelected,
  });

  final List<({String id, String label})> items;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F3F3),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          for (final item in items)
            Expanded(
              child: _SegmentCell(
                label: item.label,
                selected: selected == item.id,
                onTap: () => onSelected(item.id),
              ),
            ),
        ],
      ),
    );
  }
}

class _SegmentCell extends StatelessWidget {
  const _SegmentCell({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? Colors.white : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      elevation: selected ? 0.5 : 0,
      shadowColor: Colors.black26,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? const Color(0xFF0A0A0A) : const Color(0xFF737373),
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: selected ? _black : Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: selected ? _black : const Color(0xFFE5E5E5),
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : _muted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RefreshableMessage extends StatelessWidget {
  const _RefreshableMessage({
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.35,
            child: Center(child: child),
          ),
        ],
      ),
    );
  }
}

class _DaySales {
  const _DaySales({
    required this.key,
    required this.date,
    required this.sales,
    required this.totalCents,
  });
  final String key;
  final DateTime date;
  final List<InstSale> sales;
  final int totalCents;
}

class _DayDocs {
  const _DayDocs({
    required this.key,
    required this.date,
    required this.docs,
  });
  final String key;
  final DateTime date;
  final List<InstSaleDocument> docs;
}

String _formatDayLabel(String key, String? today, DateTime fallback) {
  if (today != null) {
    if (key == today) return 'Aujourd’hui';
    final y = DateTime.parse(today).subtract(const Duration(days: 1));
    if (key == DateFormat('yyyy-MM-dd').format(y)) return 'Hier';
  }
  return DateFormat("EEEE d MMM", 'fr_FR').format(fallback);
}

class _DayGroup extends StatelessWidget {
  const _DayGroup({required this.day, required this.onTicketAction, this.today});
  final _DaySales day;
  final String? today;
  final Future<void> Function(InstSale sale) onTicketAction;

  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFEBEBEB);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _formatDayLabel(day.key, today, day.date),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: _muted,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                Text(
                  '${day.sales.length} vente${day.sales.length > 1 ? "s" : ""} · ${formatEuros(day.totalCents)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: _muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _border),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < day.sales.length; i++) ...[
                  _SaleRow(
                    sale: day.sales[i],
                    onTicketAction: () => onTicketAction(day.sales[i]),
                  ),
                  if (i < day.sales.length - 1)
                    const Divider(
                      height: 1,
                      thickness: 1,
                      color: _border,
                      indent: 12,
                      endIndent: 12,
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DocDayGroup extends StatelessWidget {
  const _DocDayGroup({required this.day, this.today});
  final _DayDocs day;
  final String? today;

  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFEBEBEB);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
            child: Text(
              _formatDayLabel(day.key, today, day.date),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _muted,
                letterSpacing: 0.5,
              ),
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _border),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < day.docs.length; i++) ...[
                  _DocRow(doc: day.docs[i]),
                  if (i < day.docs.length - 1)
                    const Divider(
                      height: 1,
                      thickness: 1,
                      color: _border,
                      indent: 12,
                      endIndent: 12,
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SaleRow extends StatefulWidget {
  const _SaleRow({required this.sale, required this.onTicketAction});
  final InstSale sale;
  final VoidCallback onTicketAction;

  @override
  State<_SaleRow> createState() => _SaleRowState();
}

class _SaleRowState extends State<_SaleRow> {
  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);

  bool _open = false;

  InstSale get sale => widget.sale;

  Color _statusColor() {
    switch (sale.status) {
      case 'partial':
        return const Color(0xFFB45309);
      case 'refunded':
        return const Color(0xFFB91C1C);
      default:
        return const Color(0xFF065F46);
    }
  }

  String _statusLabel() {
    switch (sale.status) {
      case 'partial':
        return 'Acompte';
      case 'refunded':
        return 'Remboursé';
      default:
        return 'Payé';
    }
  }

  @override
  Widget build(BuildContext context) {
    final extraDocs = sale.documents.where((d) => d.docType != 'ticket').toList();
    final ticketDocs = sale.documents.where((d) => d.docType == 'ticket');
    final ticketDoc = ticketDocs.isEmpty ? null : ticketDocs.first;
    final client = sale.clientLabel;
    final time = DateFormat.Hm().format(sale.createdAt);
    final subtitle = [
      if (client != null && client.isNotEmpty) client,
      time,
    ].join(' · ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => setState(() => _open = !_open),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
            child: Row(
              children: [
                const SaleDocMark(docType: 'ticket', size: 34),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Ticket',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: _black,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        subtitle.isEmpty ? time : subtitle,
                        style: const TextStyle(fontSize: 12, color: _muted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatEuros(sale.totalCents),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _black,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    Text(
                      _statusLabel(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _statusColor(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 4),
                AnimatedRotation(
                  turns: _open ? 0.25 : 0,
                  duration: const Duration(milliseconds: 160),
                  child: const Icon(Icons.chevron_right, size: 18, color: _muted),
                ),
              ],
            ),
          ),
        ),
        if (_open)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (sale.ticketNumber != null)
                    Text(
                      'n° ${sale.ticketNumber}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF9A3412),
                        letterSpacing: 0.2,
                      ),
                    ),
                  if (sale.items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        '${sale.itemsCount} article${sale.itemsCount > 1 ? "s" : ""}',
                        style: const TextStyle(fontSize: 13, color: _black),
                      ),
                    )
                  else ...[
                    const SizedBox(height: 8),
                    for (final item in sale.items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${item.quantity}× ${item.name}',
                                style: const TextStyle(fontSize: 13, color: _black),
                              ),
                            ),
                            Text(
                              formatEuros(item.lineTotalCents),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                  if (sale.payments.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const Divider(height: 1, color: Color(0xFFFED7AA)),
                    const SizedBox(height: 8),
                    for (final payment in sale.payments)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          children: [
                            Icon(
                              salePaymentIcon(payment.method),
                              size: 15,
                              color: const Color(0xFF9A3412),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${salePaymentLabel(payment.method)} · ${formatEuros(payment.amountCents)}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF7C2D12),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      _DocChip(
                        docType: 'ticket',
                        label: 'Ticket',
                        onTap: () {
                          if (ticketDoc != null) {
                            openSaleDocumentPdf(
                              context,
                              documentId: ticketDoc.id,
                              title: ticketDoc.docNumber,
                              docType: 'ticket',
                            );
                          } else {
                            openSaleTicketPdf(
                              context,
                              saleId: sale.id,
                              title: sale.ticketNumber != null
                                  ? 'Ticket n° ${sale.ticketNumber}'
                                  : 'Ticket',
                            );
                          }
                        },
                      ),
                      for (final doc in extraDocs)
                        _DocChip(
                          docType: doc.docType,
                          label: doc.shortLabel,
                          onTap: () => openSaleDocumentPdf(
                            context,
                            documentId: doc.id,
                            title: doc.docNumber,
                            docType: doc.docType,
                          ),
                        ),
                      if (sale.canIssueCredit)
                        _ActionChip(onTap: widget.onTicketAction),
                    ],
                  ),
                  if (sale.status == 'partial') ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () =>
                          showSaleDetailSheet(context: context, sale: sale),
                      child: const Text('Encaisser le solde'),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _DocChip extends StatelessWidget {
  const _DocChip({
    required this.docType,
    required this.label,
    required this.onTap,
  });

  final String docType;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final look = saleDocLook(docType);
    return Material(
      color: look.background,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.fromLTRB(6, 4, 8, 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: look.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(look.icon, size: 13, color: look.foreground),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: look.foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF0A0A0A),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.fromLTRB(6, 4, 8, 4),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.more_horiz, size: 13, color: Colors.white),
              SizedBox(width: 4),
              Text(
                'Actions',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DocRow extends StatelessWidget {
  const _DocRow({required this.doc});
  final InstSaleDocument doc;

  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => openSaleDocumentPdf(
        context,
        documentId: doc.id,
        title: doc.docNumber,
        docType: doc.docType,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        child: Row(
          children: [
            SaleDocMark(docType: doc.docType, size: 34),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doc.typeLabel,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: _black,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    [
                      doc.docNumber,
                      if (doc.clientLabel != null) doc.clientLabel,
                    ].join(' · '),
                    style: const TextStyle(fontSize: 12, color: _muted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Text(
              formatEuros(doc.amountCents),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: _black,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, size: 18, color: _muted),
          ],
        ),
      ),
    );
  }
}
