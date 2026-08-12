import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../../state/session_providers.dart';
import '../shared/catalog_item_thumb.dart';
import '../shared/money.dart';

class PosSaleTab extends ConsumerStatefulWidget {
  const PosSaleTab({super.key});

  @override
  ConsumerState<PosSaleTab> createState() => _PosSaleTabState();
}

class _PosSaleTabState extends ConsumerState<PosSaleTab> {
  String? _clientId;
  String _paymentMethod = 'cash';
  bool _checkingOut = false;

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
              {
                'method': _paymentMethod,
                'amountCents': totalCents,
              },
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
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (ctx.wooConnected)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: Text(
                      'WooCommerce connecté · ${items.length} article(s)',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      _FilterChip(label: 'Tout', value: 'all', selected: filter),
                      _FilterChip(label: 'Prestations', value: 'service', selected: filter),
                      _FilterChip(label: 'Woo', value: 'woocommerce', selected: filter),
                      _FilterChip(label: 'Internes', value: 'internal', selected: filter),
                    ],
                  ),
                ),
                Expanded(
                  child: items.isEmpty
                      ? const Center(child: Text('Aucun article dans cette catégorie.'))
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 88),
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final item = items[index];
                            final qty = cart[item.key] ?? 0;
                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(vertical: 4),
                              leading: CatalogItemThumb(
                                imageUrl: item.imageUrl,
                                colorHex: item.color,
                                category: item.category,
                              ),
                              title: Text(
                                item.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                [
                                  formatEuros(item.priceCents),
                                  if (item.category == 'service' && item.durationMin != null)
                                    '${item.durationMin} min',
                                  if (item.sku != null && item.sku!.isNotEmpty) item.sku!,
                                ].join(' · '),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (qty > 0) ...[
                                    IconButton(
                                      icon: const Icon(Icons.remove_circle_outline),
                                      onPressed: () => ref
                                          .read(posCartProvider.notifier)
                                          .removeOne(item.key),
                                    ),
                                    Text('$qty'),
                                  ],
                                  IconButton(
                                    icon: const Icon(Icons.add_circle_outline),
                                    onPressed: () =>
                                        ref.read(posCartProvider.notifier).add(item.key),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
            if (cartCount > 0)
              Positioned(
                left: 16,
                right: 16,
                bottom: 16,
                child: FilledButton.icon(
                  onPressed: () => _openCartSheet(ctx),
                  icon: const Icon(Icons.shopping_cart_outlined),
                  label: Text(
                    'Panier ($cartCount) · ${formatEuros(_cartTotalCents(ctx, cart))}',
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isSelected = selected == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) =>
            ref.read(posCategoryFilterProvider.notifier).state = value,
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
        ListTile(
          dense: true,
          leading: CatalogItemThumb(
            imageUrl: item.imageUrl,
            colorHex: item.color,
            category: item.category,
            size: 36,
          ),
          title: Text('${item.name} × ${entry.value}'),
          trailing: Text(formatEuros(lineTotal)),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Panier', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...lines,
          const Divider(),
          Row(
            children: [
              const Text('Total'),
              const Spacer(),
              Text(
                formatEuros(total),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            value: clientId,
            decoration: const InputDecoration(
              labelText: 'Client (optionnel)',
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
