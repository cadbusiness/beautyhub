import 'dart:async';

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';
import 'sale_detail_sheet.dart';

class SalesHistoryTab extends ConsumerStatefulWidget {
  const SalesHistoryTab({super.key});

  @override
  ConsumerState<SalesHistoryTab> createState() => _SalesHistoryTabState();
}

class _SalesHistoryTabState extends ConsumerState<SalesHistoryTab> {
  static const _bg = Color(0xFFF5F5F5);
  static const _muted = Color(0xFF737373);

  final _scrollController = ScrollController();
  List<InstSale> _items = const [];
  String? _cursor;
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitial());
    _scrollController.addListener(_onScroll);
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
      final page = await ref.read(mobileApiProvider).fetchInstitutSales(
            accessToken: token,
            tenantId: tenantId,
          );
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _cursor = page.nextCursor;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _cursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) return;
      final page = await ref.read(mobileApiProvider).fetchInstitutSales(
            accessToken: token,
            tenantId: tenantId,
            cursor: _cursor,
          );
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...page.items];
        _cursor = page.nextCursor;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
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
        ),
      );
    }
    if (_items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(
                Icons.receipt_long_outlined,
                size: 44,
                color: _muted,
              ),
              SizedBox(height: 12),
              Text(
                'Aucune vente enregistrée.',
                style: TextStyle(color: _muted, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    final grouped = _groupByDay(_items);

    return Container(
      color: _bg,
      child: RefreshIndicator(
        onRefresh: _loadInitial,
        child: ListView.builder(
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.only(
            top: 8,
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
            final group = grouped[index];
            return _DayGroup(day: group);
          },
        ),
      ),
    );
  }

  List<_DaySales> _groupByDay(List<InstSale> sales) {
    final map = <String, List<InstSale>>{};
    for (final s in sales) {
      final key = DateFormat('yyyy-MM-dd').format(s.createdAt);
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

class _DayGroup extends StatelessWidget {
  const _DayGroup({required this.day});
  final _DaySales day;

  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFEBEBEB);

  String _formatDay(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final that = DateTime(dt.year, dt.month, dt.day);
    if (that == today) return "Aujourd'hui";
    if (that == today.subtract(const Duration(days: 1))) return 'Hier';
    return DateFormat("EEEE d MMM", 'fr_FR').format(dt);
  }

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
                    _formatDay(day.date),
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
                  _SaleRow(sale: day.sales[i]),
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

class _SaleRow extends StatelessWidget {
  const _SaleRow({required this.sale});
  final InstSale sale;

  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);

  String _paymentLabel() {
    if (sale.payments.length > 1) return '${sale.payments.length} moyens';
    final m = sale.payments.isNotEmpty
        ? sale.payments.first.method
        : sale.paymentMethod;
    switch (m) {
      case 'cash':
        return 'Espèces';
      case 'card':
        return 'Carte';
      case 'transfer':
        return 'Virement';
      case 'gift_card':
        return 'Carte cadeau';
      case 'store_credit':
        return 'Avoir';
      default:
        return m;
    }
  }

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
        return 'Solde à venir';
      case 'refunded':
        return 'Remboursé';
      default:
        return 'Payé';
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => showSaleDetailSheet(context: context, sale: sale),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Text(
                        DateFormat.Hm().format(sale.createdAt),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: _black,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (sale.ticketNumber != null)
                        Text(
                          '#${sale.ticketNumber}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: _muted,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _statusColor().withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _statusLabel(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: _statusColor(),
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    sale.clientLabel ?? 'Sans cliente',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: sale.clientLabel != null ? _black : _muted,
                      fontStyle:
                          sale.clientLabel != null ? FontStyle.normal : FontStyle.italic,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    sale.itemsSummary.isEmpty
                        ? '${sale.itemsCount} article${sale.itemsCount > 1 ? "s" : ""}'
                        : sale.itemsSummary,
                    style: const TextStyle(fontSize: 12, color: _muted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
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
                const SizedBox(height: 4),
                Text(
                  _paymentLabel(),
                  style: const TextStyle(fontSize: 11, color: _muted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
