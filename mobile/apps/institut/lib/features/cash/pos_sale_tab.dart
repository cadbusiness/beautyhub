import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../../state/session_providers.dart';
import '../../widgets/client_picker.dart';
import '../../widgets/new_client_form.dart';
import '../../widgets/searchable_picker.dart';
import '../shared/catalog_item_thumb.dart';
import '../shared/money.dart';
import 'catalog_item_detail_sheet.dart';
import 'catalog_product_row.dart';
import 'sale_ticket_pdf_screen.dart';

class PosSaleTab extends ConsumerStatefulWidget {
  const PosSaleTab({super.key});

  @override
  ConsumerState<PosSaleTab> createState() => _PosSaleTabState();
}

class _PosSaleTabState extends ConsumerState<PosSaleTab> {
  PickerItem? _selectedClient;
  String _paymentMethod = 'cash';
  bool _openingDay = false;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  List<PosCatalogItem> _filtered(
    PosContext ctx,
    String type,
    String facet,
    String query,
  ) {
    final items = ctx.catalog.where((item) {
      if (type != 'all' && item.category != type) return false;
      if (!_matchesFacet(item, facet)) return false;
      return _matchesQuery(item, query);
    }).toList();
    if (facet != 'bestsellers') return items;
    items.sort((a, b) {
      final sold = b.soldQty.compareTo(a.soldQty);
      if (sold != 0) return sold;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return items;
  }

  bool _matchesFacet(PosCatalogItem item, String facet) {
    if (facet == 'all') return true;
    if (facet == 'bestsellers') return item.soldQty > 0;
    if (facet == 'service:none') {
      return item.category == 'service' &&
          (item.serviceCategoryId == null || item.serviceCategoryId!.isEmpty);
    }
    if (facet.startsWith('service:')) {
      return item.serviceCategoryId == facet.substring('service:'.length);
    }
    if (facet == 'woo-group:soins') return item.wooSoins.isNotEmpty;
    if (facet == 'woo-group:marques') return item.wooBrands.isNotEmpty;
    if (facet.startsWith('woo-soins:')) {
      return item.wooSoins.contains(facet.substring('woo-soins:'.length));
    }
    if (facet.startsWith('woo-brand:')) {
      return item.wooBrands.contains(facet.substring('woo-brand:'.length));
    }
    if (facet.startsWith('woo:')) {
      final name = facet.substring('woo:'.length);
      return item.wooCategories.contains(name) || item.wooBrands.contains(name);
    }
    return true;
  }

  bool _matchesQuery(PosCatalogItem item, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    if (item.name.toLowerCase().contains(q)) return true;
    if (item.sku?.toLowerCase().contains(q) ?? false) return true;
    if (item.serviceCategoryName?.toLowerCase().contains(q) ?? false) {
      return true;
    }
    if (item.description?.toLowerCase().contains(q) ?? false) return true;
    if (item.wooBrands.any((name) => name.toLowerCase().contains(q))) {
      return true;
    }
    return item.wooCategories.any((name) => name.toLowerCase().contains(q));
  }

  List<PosOption> _serviceFacets(PosContext ctx, String type) {
    if (type != 'all' && type != 'service') return const [];
    final used = ctx.catalog
        .where((item) => item.category == 'service')
        .map((item) => item.serviceCategoryId)
        .whereType<String>()
        .where((id) => id.isNotEmpty)
        .toSet();
    return ctx.serviceCategories.where((c) => used.contains(c.id)).toList();
  }

  ({List<({String id, String name})> soins, List<({String id, String name})> marques})
      _wooNav(PosContext ctx, String type) {
    if (type != 'all' && type != 'woocommerce') {
      return (soins: const [], marques: const []);
    }
    const order = ['Visage', 'Corps', 'Cheveux', 'autres'];
    const labels = {
      'Visage': 'Visage',
      'Corps': 'Corps',
      'Cheveux': 'Cheveux',
      'autres': 'Autres soins',
    };
    final soinsPresent = <String>{};
    final brands = <String>{};
    for (final item in ctx.catalog) {
      if (item.category != 'woocommerce') continue;
      soinsPresent.addAll(item.wooSoins);
      brands.addAll(item.wooBrands.where((name) => name.trim().isNotEmpty));
    }
    final soins = [
      for (final child in order)
        if (soinsPresent.contains(child))
          (id: 'woo-soins:$child', name: labels[child] ?? child),
    ];
    final marques = (brands.toList()..sort())
        .map((name) => (id: 'woo-brand:$name', name: name))
        .toList();
    return (soins: soins, marques: marques);
  }

  String? _expandedWooGroup(String facet) {
    if (facet == 'woo-group:soins' || facet.startsWith('woo-soins:')) {
      return 'soins';
    }
    if (facet == 'woo-group:marques' || facet.startsWith('woo-brand:')) {
      return 'marques';
    }
    return null;
  }

  bool _hasUncategorizedServices(PosContext ctx, String type) {
    if (type != 'all' && type != 'service') return false;
    return ctx.catalog.any(
      (item) =>
          item.category == 'service' &&
          (item.serviceCategoryId == null || item.serviceCategoryId!.isEmpty),
    );
  }

  int _cartTotalCents(PosContext ctx, Map<String, int> cart) {
    var total = 0;
    for (final entry in cart.entries) {
      final item = ctx.catalog.where((i) => i.key == entry.key).firstOrNull;
      if (item != null) total += item.priceCents * entry.value;
    }
    return total;
  }

  Future<void> _openDayWithoutFloat() async {
    setState(() => _openingDay = true);
    try {
      await openInstitutCashDay(ref);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _openingDay = false);
    }
  }

  Future<bool> _checkout(
    PosContext ctx, {
    int discountCents = 0,
    String? notes,
  }) async {
    final cart = ref.read(posCartProvider);
    if (cart.isEmpty) return false;

    if (ctx.requireOpenSession && !ctx.sessionOpen) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ouvrez d’abord la journée — le fond de caisse est facultatif.'),
          ),
        );
      }
      return false;
    }

    final grossCents = _cartTotalCents(ctx, cart);
    var totalCents = grossCents - discountCents;
    if (totalCents < 0) totalCents = 0;
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return false;

    ref.read(posCheckoutBusyProvider.notifier).state = true;
    try {
      final result = await ref.read(mobileApiProvider).checkout(
            accessToken: token,
            tenantId: tenantId,
            cart: cart,
            clientId: _selectedClient?.id,
            notes: notes,
            cartDiscountCents: discountCents > 0 ? discountCents : null,
            payments: [
              {'method': _paymentMethod, 'amountCents': totalCents},
            ],
          );
      ref.invalidate(cashSessionProvider);
      ref.invalidate(posContextProvider);
      ref.invalidate(institutSalesFirstPageProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Vente enregistrée${result.ticketNumber != null ? ' · ${result.ticketNumber}' : ''}',
            ),
          ),
        );
      }
      final ticketContext = context;
      final saleId = result.saleId;
      final ticketTitle = result.ticketNumber != null
          ? 'Ticket #${result.ticketNumber}'
          : 'Ticket';
      Future<void>.microtask(() {
        ref.read(posCartProvider.notifier).clear();
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!ticketContext.mounted) return;
        openSaleTicketPdf(
          ticketContext,
          saleId: saleId,
          title: ticketTitle,
        );
      });
      return true;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
      return false;
    } finally {
      if (mounted) {
        ref.read(posCheckoutBusyProvider.notifier).state = false;
      }
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
        selectedClient: _selectedClient,
        paymentMethod: _paymentMethod,
        onClientChanged: (item) => setState(() => _selectedClient = item),
        onPaymentChanged: (m) => setState(() => _paymentMethod = m),
        onCheckout: ({discountCents = 0, notes}) =>
            _checkout(ctx, discountCents: discountCents, notes: notes),
        sessionBlocked: ctx.requireOpenSession && !ctx.sessionOpen,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(posContextProvider);
    final filter = ref.watch(posCategoryFilterProvider);
    final facet = ref.watch(posCatalogFacetProvider);
    final query = ref.watch(posCatalogQueryProvider);
    final cart = ref.watch(posCartProvider);
    final cartCount = cart.values.fold(0, (a, b) => a + b);

    return posAsync.when(
      skipLoadingOnReload: true,
      skipLoadingOnRefresh: true,
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [Text('$e')],
      ),
      data: (ctx) {
        final items = _filtered(ctx, filter, facet, query);
        final queryTrimmed = query.trim();
        final serviceFacets = _serviceFacets(ctx, filter);
        final wooNav = _wooNav(ctx, filter);
        final wooGroup = _expandedWooGroup(facet);
        final showUncategorized = _hasUncategorizedServices(ctx, filter);
        return Stack(
          children: [
            CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                if (!ctx.sessionOpen)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Caisse fermée',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF78350F),
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Ouvrez la journée pour ne pas l’oublier. Le fond est facultatif.',
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF92400E),
                                height: 1.35,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                FilledButton(
                                  onPressed: _openingDay ? null : _openDayWithoutFloat,
                                  style: FilledButton.styleFrom(
                                    backgroundColor: const Color(0xFF78350F),
                                    foregroundColor: Colors.white,
                                    visualDensity: VisualDensity.compact,
                                  ),
                                  child: _openingDay
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Text('Ouvrir sans fond'),
                                ),
                                const SizedBox(width: 8),
                                TextButton(
                                  onPressed: () {
                                    ref.read(cashInitialTabProvider.notifier).state = 0;
                                  },
                                  child: const Text('Ajouter un fond'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (ctx.sessionOpen && ctx.sessionIsPreviousDay)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: Row(
                          children: [
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Session d’hier encore ouverte',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF78350F),
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Clôturez-la pour séparer les journées. Vous pouvez encore encaisser.',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: Color(0xFF92400E),
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: () {
                                ref.read(cashInitialTabProvider.notifier).state = 0;
                              },
                              child: const Text('Session'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
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
                SliverToBoxAdapter(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Row(
                      children: [
                        _FacetChip(label: 'Toutes', value: 'all', selected: facet),
                        _FacetChip(
                          label: 'Plus vendus',
                          value: 'bestsellers',
                          selected: facet,
                        ),
                        for (final category in serviceFacets)
                          _FacetChip(
                            label: category.label,
                            value: 'service:${category.id}',
                            selected: facet,
                          ),
                        if (showUncategorized)
                          _FacetChip(
                            label: 'Sans catégorie',
                            value: 'service:none',
                            selected: facet,
                          ),
                        if (wooNav.soins.isNotEmpty)
                          _FacetChip(
                            label: 'Soins',
                            value: 'woo-group:soins',
                            selected: wooGroup == 'soins'
                                ? 'woo-group:soins'
                                : facet,
                          ),
                        if (wooNav.marques.isNotEmpty)
                          _FacetChip(
                            label: 'Marques',
                            value: 'woo-group:marques',
                            selected: wooGroup == 'marques'
                                ? 'woo-group:marques'
                                : facet,
                          ),
                      ],
                    ),
                  ),
                ),
                if (wooGroup == 'soins' && wooNav.soins.isNotEmpty)
                  SliverToBoxAdapter(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: Row(
                        children: [
                          for (final child in wooNav.soins)
                            _FacetChip(
                              label: child.name,
                              value: child.id,
                              selected: facet,
                            ),
                        ],
                      ),
                    ),
                  ),
                if (wooGroup == 'marques' && wooNav.marques.isNotEmpty)
                  SliverToBoxAdapter(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: Row(
                        children: [
                          for (final child in wooNav.marques)
                            _FacetChip(
                              label: child.name,
                              value: child.id,
                              selected: facet,
                            ),
                        ],
                      ),
                    ),
                  ),
                if (items.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          queryTrimmed.isNotEmpty
                              ? 'Aucun article pour « $queryTrimmed ».'
                              : facet == 'bestsellers'
                                  ? 'Pas encore assez de ventes pour classer les articles.'
                                  : 'Aucun article dans cette catégorie.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: _muted),
                        ),
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
        onTap: () {
          ref.read(posCategoryFilterProvider.notifier).state = value;
          ref.read(posCatalogFacetProvider.notifier).state = 'all';
        },
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

class _FacetChip extends ConsumerWidget {
  const _FacetChip({
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
        onTap: () => ref.read(posCatalogFacetProvider.notifier).state = value,
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

class _CartSheet extends ConsumerStatefulWidget {
  const _CartSheet({
    required this.ctx,
    required this.selectedClient,
    required this.paymentMethod,
    required this.onClientChanged,
    required this.onPaymentChanged,
    required this.onCheckout,
    this.sessionBlocked = false,
  });

  final PosContext ctx;
  final PickerItem? selectedClient;
  final String paymentMethod;
  final ValueChanged<PickerItem?> onClientChanged;
  final ValueChanged<String> onPaymentChanged;
  final Future<bool> Function({int discountCents, String? notes}) onCheckout;
  final bool sessionBlocked;

  @override
  ConsumerState<_CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends ConsumerState<_CartSheet> {
  late PickerItem? _client = widget.selectedClient;
  bool _showDiscount = false;
  String _discountKind = 'percent';
  final _discountValue = TextEditingController();
  final _discountReason = TextEditingController();

  @override
  void dispose() {
    _discountValue.dispose();
    _discountReason.dispose();
    super.dispose();
  }

  int _discountCents(int gross) {
    final n = double.tryParse(_discountValue.text.replaceAll(',', '.')) ?? 0;
    if (n <= 0 || gross <= 0) return 0;
    if (_discountKind == 'percent') {
      final pct = n > 100 ? 100.0 : n;
      final cents = (gross * pct / 100).round();
      return cents > gross ? gross : cents;
    }
    final cents = (n * 100).round();
    return cents > gross ? gross : cents;
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final paymentMethod = widget.paymentMethod;
    final onPaymentChanged = widget.onPaymentChanged;
    final onCheckout = widget.onCheckout;
    final sessionBlocked = widget.sessionBlocked;
    final cart = ref.watch(posCartProvider);
    final checkingOut = ref.watch(posCheckoutBusyProvider);
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

    final discountCents = _showDiscount ? _discountCents(total) : 0;
    var payable = total - discountCents;
    if (payable < 0) payable = 0;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
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
            if (!_showDiscount)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() => _showDiscount = true),
                  child: const Text('Ajouter une réduction'),
                ),
              )
            else ...[
              const Text(
                'Réduction',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'percent', label: Text('%')),
                  ButtonSegment(value: 'fixed', label: Text('€')),
                ],
                selected: {_discountKind},
                onSelectionChanged: (s) =>
                    setState(() => _discountKind = s.first),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _discountValue,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: _discountKind == 'percent'
                      ? 'Pourcentage'
                      : 'Montant (€)',
                  hintText: _discountKind == 'percent' ? '10' : '15',
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _discountReason,
                decoration: const InputDecoration(
                  labelText: 'Motif (optionnel)',
                  hintText: 'Bon, promotion, geste commercial…',
                ),
              ),
              if (discountCents > 0) ...[
                const SizedBox(height: 8),
                Text(
                  '−${formatEuros(discountCents)}',
                  style: const TextStyle(
                    color: Color(0xFF047857),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                const Text('Total', style: TextStyle(fontSize: 15)),
                const Spacer(),
                Text(
                  formatEuros(payable),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SearchablePickerField(
              label: 'Cliente (optionnel)',
              value: _client?.title,
              selectedSubtitle: _client?.subtitle,
              placeholder: 'Aucune cliente',
              onOpen: () async {
                final picked = await showSearchablePicker(
                  context: context,
                  title: 'Choisir une cliente',
                  items: const [],
                  search: (q) => searchInstitutClients(ref, q),
                  selectedId: _client?.id,
                  searchHint: 'Rechercher (nom, email, téléphone)…',
                  nullOption:
                      const PickerItem(id: '__none__', title: 'Aucune cliente'),
                  emptyMessage: 'Aucune cliente trouvée.',
                  createAction: newClientPickerAction(ref),
                );
                if (picked == null) return;
                final next = picked.id == '__none__' ? null : picked;
                setState(() => _client = next);
                widget.onClientChanged(next);
              },
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
            if (sessionBlocked) ...[
              const Text(
                'Ouvrez la journée pour encaisser. Le fond de caisse est facultatif.',
                style: TextStyle(fontSize: 13, color: Color(0xFF92400E)),
              ),
              const SizedBox(height: 12),
            ],
            FilledButton(
              onPressed: checkingOut || sessionBlocked || payable <= 0
                  ? null
                  : () async {
                      final reason = _discountReason.text.trim();
                      final ok = await onCheckout(
                        discountCents: discountCents,
                        notes: reason.isEmpty ? null : 'Remise : $reason',
                      );
                      if (ok && context.mounted) {
                        Navigator.pop(context);
                        ref.read(posCartProvider.notifier).clear();
                      }
                    },
              child: checkingOut
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text('Encaisser · ${formatEuros(payable)}'),
            ),
          ],
        ),
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
