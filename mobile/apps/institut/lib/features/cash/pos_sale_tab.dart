import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../../state/session_providers.dart';
import '../shared/catalog_item_thumb.dart';
import '../shared/money.dart';
import 'catalog_item_detail_sheet.dart';
import 'catalog_product_row.dart';

class PosSaleTab extends ConsumerStatefulWidget {
  const PosSaleTab({super.key});

  @override
  ConsumerState<PosSaleTab> createState() => _PosSaleTabState();
}

class _PosSaleTabState extends ConsumerState<PosSaleTab> {
  String? _clientId;
  String _paymentMethod = 'cash';
  bool _checkingOut = false;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  List<PosCatalogItem> _filtered(PosContext ctx, String filter) {
    if (filter == 'all') return ctx.catalog;
    return ctx.catalog.where((item) => item.category == filter).toList();
  }

  int _cartTotalCents(PosContext ctx, Map<String, int> cart) {
    var total = 0;
    for (final entry in cart.entries) {
      final item = ctx.catalog.where((i) => i.key == entry.key).firstOrNull;
      if (item != null) total += item.priceCents * entry.value;
    }
    return total;
  }

  Future<void> _checkout(PosContext ctx) async {
    final cart = ref.read(posCartProvider);
    if (cart.isEmpty) return;

    if (ctx.requireOpenSession && !ctx.sessionOpen) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ouvrez la session caisse d’abord.')),
        );
      }
      return;
    }

    final totalCents = _cartTotalCents(ctx, cart);
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() => _checkingOut = true);
    try {
      final result = await ref.read(mobileApiProvider).checkout(
            accessToken: token,
            tenantId: tenantId,
            cart: cart,
            clientId: _clientId,
            payments: [
              {'method': _paymentMethod, 'amountCents': totalCents},
            ],
          );
      ref.read(posCartProvider.notifier).clear();
      ref.invalidate(cashSessionProvider);
      ref.invalidate(posContextProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Vente enregistrée${result.ticketNumber != null ? ' · ${result.ticketNumber}' : ''}',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingOut = false);
    }
  }

  void _openCartSheet(PosContext ctx) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => _CartSheet(
        ctx: ctx,
        clientId: _clientId,
        paymentMethod: _paymentMethod,
        checkingOut: _checkingOut,
        onClientChanged: (id) => setState(() => _clientId = id),
        onPaymentChanged: (m) => setState(() => _paymentMethod = m),
        onCheckout: () {
          Navigator.pop(context);
          _checkout(ctx);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(posContextProvider);
    final filter = ref.watch(posCategoryFilterProvider);
    final cart = ref.watch(posCartProvider);
    final cartCount = cart.values.fold(0, (a, b) => a + b);

    return posAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [Text('$e')],
      ),
      data: (ctx) {
        final items = _filtered(ctx, filter);
        return Stack(
          children: [
            CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    child: Row(
                      children: [
                        if (ctx.wooConnected)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF3),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFBBF7D0)),
                            ),
                            child: const Text(
                              'WooCommerce',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF166534),
                              ),
                            ),
                          ),
                        if (ctx.wooConnected) const SizedBox(width: 8),
                        Text(
                          '${items.length} article${items.length > 1 ? 's' : ''}',
                          style: const TextStyle(fontSize: 12, color: _muted),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Row(
                      children: [
                        _FilterChip(label: 'Tout', value: 'all', selected: filter),
                        _FilterChip(
                          label: 'Prestations',
                          value: 'service',
                          selected: filter,
                        ),
                        _FilterChip(label: 'Woo', value: 'woocommerce', selected: filter),
                        _FilterChip(label: 'Internes', value: 'internal', selected: filter),
                      ],
                    ),
                  ),
                ),
                if (items.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Text(
                        'Aucun article dans cette catégorie.',
                        style: TextStyle(color: _muted),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final item = items[index];
                          final qty = cart[item.key] ?? 0;
                          return CatalogProductRow(
                            item: item,
                            quantity: qty,
                            onTap: () => showCatalogItemDetailSheet(
                              context,
                              ref,
                              item: item,
                            ),
                            onAdd: () =>
                                ref.read(posCartProvider.notifier).add(item.key),
                            onRemove: () => ref
                                .read(posCartProvider.notifier)
                                .removeOne(item.key),
                          );
                        },
                        childCount: items.length,
                      ),
                    ),
                  ),
              ],
            ),
            if (cartCount > 0)
              Positioned(
                left: 16,
                right: 16,
                bottom: 12,
                child: Material(
                  elevation: 8,
                  shadowColor: Colors.black26,
                  borderRadius: BorderRadius.circular(14),
                  color: _black,
                  child: InkWell(
                    onTap: () => _openCartSheet(ctx),
                    borderRadius: BorderRadius.circular(14),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.shopping_bag_outlined,
                            color: Colors.white,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Panier · $cartCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Text(
                            formatEuros(_cartTotalCents(ctx, cart)),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _FilterChip extends ConsumerWidget {
  const _FilterChip({
    required this.label,
    required this.value,
    required this.selected,
  });

  final String label;
  final String value;
  final String selected;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isSelected = selected == value;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => ref.read(posCategoryFilterProvider.notifier).state = value,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: isSelected ? _black : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? _black : const Color(0xFFE5E5E5),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : _muted,
            ),
          ),
        ),
      ),
    );
  }
}

class _CartSheet extends ConsumerWidget {
  const _CartSheet({
    required this.ctx,
    required this.clientId,
    required this.paymentMethod,
    required this.checkingOut,
    required this.onClientChanged,
    required this.onPaymentChanged,
    required this.onCheckout,
  });

  final PosContext ctx;
  final String? clientId;
  final String paymentMethod;
  final bool checkingOut;
  final ValueChanged<String?> onClientChanged;
  final ValueChanged<String> onPaymentChanged;
  final VoidCallback onCheckout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(posCartProvider);
    var total = 0;
    final lines = <Widget>[];
    for (final entry in cart.entries) {
      final item = ctx.catalog.where((i) => i.key == entry.key).firstOrNull;
      if (item == null) continue;
      final lineTotal = item.priceCents * entry.value;
      total += lineTotal;
      lines.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              CatalogItemThumb(
                imageUrl: item.imageUrl,
                colorHex: item.color,
                category: item.category,
                size: 40,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${item.name} × ${entry.value}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                formatEuros(lineTotal),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E5E5),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Panier', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          ...lines,
          const Divider(height: 24),
          Row(
            children: [
              const Text('Total', style: TextStyle(fontSize: 15)),
              const Spacer(),
              Text(
                formatEuros(total),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
              ),
            ],
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String?>(
            initialValue: clientId,
            decoration: const InputDecoration(
              labelText: 'Client (optionnel)',
              filled: true,
              fillColor: Color(0xFFF9F9F9),
              border: OutlineInputBorder(),
            ),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('—')),
              ...ctx.clients.map(
                (c) => DropdownMenuItem(value: c.id, child: Text(c.label)),
              ),
            ],
            onChanged: onClientChanged,
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: [
              if (ctx.settings.paymentMethods.cash)
                const ButtonSegment(value: 'cash', label: Text('Espèces')),
              if (ctx.settings.paymentMethods.card)
                const ButtonSegment(value: 'card', label: Text('CB')),
            ],
            selected: {paymentMethod},
            onSelectionChanged: (s) => onPaymentChanged(s.first),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: checkingOut ? null : onCheckout,
            child: checkingOut
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Encaisser'),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (it.moveNext()) return it.current;
    return null;
  }
}
