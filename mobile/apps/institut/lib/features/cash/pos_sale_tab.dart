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
import 'internal_product_sheets.dart';
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
    if (facet == 'product:none') {
      return item.category == 'internal' &&
          (item.productCategoryId == null || item.productCategoryId!.isEmpty);
    }
    if (facet.startsWith('product:')) {
      return item.productCategoryId == facet.substring('product:'.length);
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
    if (item.productCategoryName?.toLowerCase().contains(q) ?? false) {
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

  List<PosOption> _productFacets(PosContext ctx, String type) {
    if (type != 'all' && type != 'internal') return const [];
    return ctx.productCategories;
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

  bool _hasUncategorizedInternal(PosContext ctx, String type) {
    if (type != 'all' && type != 'internal') return false;
    return ctx.catalog.any(
      (item) =>
          item.category == 'internal' &&
          (item.productCategoryId == null || item.productCategoryId!.isEmpty),
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
    int loyaltyDiscountCents = 0,
    String? notes,
    String? discountReason,
    String? loyaltyRewardId,
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
    var totalCents = grossCents - discountCents - loyaltyDiscountCents;
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
            discountReason: discountReason,
            loyaltyRewardId: loyaltyRewardId,
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
      useSafeArea: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _CartSheet(
        ctx: ctx,
        selectedClient: _selectedClient,
        paymentMethod: _paymentMethod,
        onClientChanged: (item) => setState(() => _selectedClient = item),
        onPaymentChanged: (m) => setState(() => _paymentMethod = m),
        onCheckout: ({
          discountCents = 0,
          loyaltyDiscountCents = 0,
          notes,
          discountReason,
          loyaltyRewardId,
        }) =>
            _checkout(
              ctx,
              discountCents: discountCents,
              loyaltyDiscountCents: loyaltyDiscountCents,
              notes: notes,
              discountReason: discountReason,
              loyaltyRewardId: loyaltyRewardId,
            ),
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
        final productFacets = _productFacets(ctx, filter);
        final wooNav = _wooNav(ctx, filter);
        final wooGroup = _expandedWooGroup(facet);
        final showUncategorized = _hasUncategorizedServices(ctx, filter);
        final showUncategorizedInternal = _hasUncategorizedInternal(ctx, filter);
        final selectedProductCategoryId =
            facet.startsWith('product:') && facet != 'product:none'
                ? facet.substring('product:'.length)
                : null;
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
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
                    child: _SourceSegmented(
                      selected: filter,
                      onSelected: (value) {
                        ref.read(posCategoryFilterProvider.notifier).state =
                            value;
                        ref.read(posCatalogFacetProvider.notifier).state = 'all';
                      },
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: Row(
                      children: [
                        _FacetChip(label: 'Toutes', value: 'all', selected: facet),
                        _FacetChip(
                          label: 'Plus vendus',
                          value: 'bestsellers',
                          selected: facet,
                        ),
                        if (filter == 'internal') ...[
                          _InlineActionChip(
                            label: '+ Produit',
                            onTap: () => showCreateInternalProductSheet(
                              context,
                              ref,
                              categories: ctx.productCategories,
                              defaultCategoryId: selectedProductCategoryId,
                            ),
                          ),
                          _InlineActionChip(
                            label: '+ Catégorie',
                            onTap: () =>
                                showCreateInternalProductCategorySheet(
                              context,
                              ref,
                            ),
                          ),
                        ],
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
                        for (final category in productFacets)
                          _FacetChip(
                            label: category.label,
                            value: 'product:${category.id}',
                            selected: facet,
                          ),
                        if (showUncategorizedInternal)
                          _FacetChip(
                            label: 'Sans catégorie',
                            value: 'product:none',
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
                                  : filter == 'internal'
                                      ? 'Aucun produit interne. Créez une catégorie, puis un produit.'
                                      : filter == 'service'
                                          ? 'Aucune prestation visible. Ajoutez-les dans Prestations sur le site.'
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

class _SourceSegmented extends StatelessWidget {
  const _SourceSegmented({
    required this.selected,
    required this.onSelected,
  });

  final String selected;
  final ValueChanged<String> onSelected;

  static const _items = <({String id, String label})>[
    (id: 'all', label: 'Tout'),
    (id: 'service', label: 'Prestations'),
    (id: 'woocommerce', label: 'Woo'),
    (id: 'internal', label: 'Internes'),
  ];

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
          for (final item in _items)
            Expanded(
              child: Material(
                color: selected == item.id ? Colors.white : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                elevation: selected == item.id ? 0.5 : 0,
                shadowColor: Colors.black26,
                child: InkWell(
                  onTap: () => onSelected(item.id),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      item.label,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: selected == item.id
                            ? const Color(0xFF0A0A0A)
                            : const Color(0xFF737373),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MiniSegmented extends StatelessWidget {
  const _MiniSegmented({
    required this.items,
    required this.selected,
    required this.onSelected,
  });

  final List<({String id, String label})> items;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
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
              child: Material(
                color: selected == item.id ? Colors.white : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                elevation: selected == item.id ? 0.5 : 0,
                shadowColor: Colors.black26,
                child: InkWell(
                  onTap: () => onSelected(item.id),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      item.label,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: selected == item.id
                            ? const Color(0xFF0A0A0A)
                            : const Color(0xFF737373),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PosChip extends StatelessWidget {
  const _PosChip({
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
      color: selected ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : const Color(0xFF0A0A0A),
            ),
          ),
        ),
      ),
    );
  }
}

class _InlineActionChip extends StatelessWidget {
  const _InlineActionChip({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE5E5E5)),
            ),
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0A0A0A),
              ),
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
  final   Future<bool> Function({
    int discountCents,
    int loyaltyDiscountCents,
    String? notes,
    String? discountReason,
    String? loyaltyRewardId,
  }) onCheckout;
  final bool sessionBlocked;

  @override
  ConsumerState<_CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends ConsumerState<_CartSheet> {
  late PickerItem? _client = widget.selectedClient;
  bool _showDiscount = false;
  String _discountKind = 'percent';
  String? _pickedReason;
  bool _customReason = false;
  final _discountValue = TextEditingController();
  final _discountReason = TextEditingController();
  PosClientLoyalty? _loyalty;
  String? _loyaltyRewardId;
  bool _loyaltyLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final id = _client?.id;
      if (id != null) _loadLoyalty(id);
    });
  }

  @override
  void dispose() {
    _discountValue.dispose();
    _discountReason.dispose();
    super.dispose();
  }

  Future<void> _loadLoyalty(String? clientId) async {
    if (clientId == null || clientId.isEmpty) {
      setState(() {
        _loyalty = null;
        _loyaltyRewardId = null;
        _loyaltyLoading = false;
      });
      return;
    }
    setState(() => _loyaltyLoading = true);
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) {
        if (mounted) setState(() => _loyaltyLoading = false);
        return;
      }
      final snap = await ref.read(mobileApiProvider).fetchClientLoyalty(
            accessToken: token,
            tenantId: tenantId,
            clientId: clientId,
          );
      if (!mounted) return;
      setState(() {
        _loyalty = snap.active ? snap : null;
        _loyaltyRewardId = null;
        _loyaltyLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loyalty = null;
        _loyaltyRewardId = null;
        _loyaltyLoading = false;
      });
    }
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

  void _setDiscountOpen(bool open) {
    setState(() {
      _showDiscount = open;
      if (!open) {
        _discountValue.clear();
        _discountReason.clear();
        _pickedReason = null;
        _customReason = false;
      }
    });
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
    var afterManual = total - discountCents;
    if (afterManual < 0) afterManual = 0;
    PosLoyaltyReward? selectedReward;
    if (_loyaltyRewardId != null && _loyalty != null) {
      for (final reward in _loyalty!.rewards) {
        if (reward.id == _loyaltyRewardId) {
          selectedReward = reward;
          break;
        }
      }
    }
    final loyaltyDiscountCents =
        selectedReward?.discountForSubtotal(afterManual) ?? 0;
    var payable = afterManual - loyaltyDiscountCents;
    if (payable < 0) payable = 0;
    final eligibleRewards =
        _loyalty?.rewards.where((r) => r.eligible).toList() ?? const [];

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
            const Text(
              'Panier',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0A0A0A),
              ),
            ),
            const SizedBox(height: 16),
            ...lines,
            const SizedBox(height: 4),
            const _CartRule(),
            InkWell(
              onTap: () => _setDiscountOpen(!_showDiscount),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    const Text(
                      'Réduction',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0A0A0A),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      _showDiscount ? 'Fermer' : 'Ajouter',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0A0A0A),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_showDiscount) ...[
              _MiniSegmented(
                items: const [
                  (id: 'percent', label: '%'),
                  (id: 'fixed', label: '€'),
                ],
                selected: _discountKind,
                onSelected: (value) => setState(() => _discountKind = value),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _discountValue,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: _cartFieldDecoration(
                  hint: _discountKind == 'percent' ? '10' : '15,00',
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              const Text(
                'Motif',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF404040),
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final reason in ctx.settings.discountReasons)
                    _PosChip(
                      label: reason,
                      selected: !_customReason && _pickedReason == reason,
                      onTap: () => setState(() {
                        _customReason = false;
                        _pickedReason = _pickedReason == reason ? null : reason;
                        if (_pickedReason != null) {
                          _discountReason.text = _pickedReason!;
                        }
                      }),
                    ),
                  _PosChip(
                    label: 'Autre',
                    selected: _customReason,
                    onTap: () => setState(() {
                      _customReason = true;
                      _pickedReason = null;
                    }),
                  ),
                ],
              ),
              if (_customReason) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _discountReason,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: _cartFieldDecoration(
                    hint: 'Geste commercial, promotion…',
                  ),
                ),
              ],
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
              const SizedBox(height: 12),
            ],
            const _CartRule(),
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
                await _loadLoyalty(next?.id);
              },
            ),
            if (_client != null) ...[
              const SizedBox(height: 12),
              if (_loyaltyLoading)
                const Text(
                  'Chargement de la fidélité…',
                  style: TextStyle(fontSize: 13, color: Color(0xFF737373)),
                )
              else if (_loyalty != null)
                _LoyaltyPaymentCard(
                  loyalty: _loyalty!,
                  eligibleRewards: eligibleRewards,
                  selectedRewardId: _loyaltyRewardId,
                  subtotalCents: afterManual,
                  onSelect: (id) => setState(() => _loyaltyRewardId = id),
                ),
            ],
            if (loyaltyDiscountCents > 0) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Text(
                    'Fidélité',
                    style: TextStyle(fontSize: 13, color: Color(0xFF5B21B6)),
                  ),
                  const Spacer(),
                  Text(
                    '−${formatEuros(loyaltyDiscountCents)}',
                    style: const TextStyle(
                      color: Color(0xFF5B21B6),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                const Text(
                  'Total',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0A0A0A),
                  ),
                ),
                const Spacer(),
                Text(
                  formatEuros(payable),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 22,
                    color: Color(0xFF0A0A0A),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _MiniSegmented(
              items: [
                if (ctx.settings.paymentMethods.cash)
                  (id: 'cash', label: 'Espèces'),
                if (ctx.settings.paymentMethods.card) (id: 'card', label: 'CB'),
              ],
              selected: paymentMethod,
              onSelected: onPaymentChanged,
            ),
            const SizedBox(height: 16),
            if (sessionBlocked) ...[
              const Text(
                'Ouvrez la journée pour encaisser. Le fond de caisse est facultatif.',
                style: TextStyle(fontSize: 13, color: Color(0xFF92400E)),
              ),
              const SizedBox(height: 12),
            ],
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: checkingOut || sessionBlocked || payable <= 0
                    ? null
                    : () async {
                        final reason = _customReason
                            ? _discountReason.text.trim()
                            : (_pickedReason ?? '').trim();
                        final ok = await onCheckout(
                          discountCents: discountCents,
                          loyaltyDiscountCents: loyaltyDiscountCents,
                          loyaltyRewardId: _loyaltyRewardId,
                          notes: reason.isEmpty ? null : 'Remise : $reason',
                          discountReason: reason.isEmpty ? null : reason,
                        );
                        if (ok && context.mounted) {
                          Navigator.pop(context);
                          ref.read(posCartProvider.notifier).clear();
                        }
                      },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0A0A0A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                child: checkingOut
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: Colors.white,
                        ),
                      )
                    : Text('Encaisser · ${formatEuros(payable)}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

InputDecoration _cartFieldDecoration({required String hint}) {
  const black = Color(0xFF0A0A0A);
  return InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
    filled: true,
    fillColor: const Color(0xFFF5F5F5),
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: black, width: 1.2),
    ),
  );
}

class _CartRule extends StatelessWidget {
  const _CartRule();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFFE8E8E8),
      child: SizedBox(width: double.infinity, height: 1),
    );
  }
}

class _LoyaltyPaymentCard extends StatelessWidget {
  const _LoyaltyPaymentCard({
    required this.loyalty,
    required this.eligibleRewards,
    required this.selectedRewardId,
    required this.subtotalCents,
    required this.onSelect,
  });

  final PosClientLoyalty loyalty;
  final List<PosLoyaltyReward> eligibleRewards;
  final String? selectedRewardId;
  final int subtotalCents;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFDDD6FE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Fidélité',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.4,
                        color: Color(0xFF5B21B6),
                      ),
                    ),
                    if (loyalty.programName != null &&
                        loyalty.programName!.isNotEmpty)
                      Text(
                        loyalty.programName!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6D28D9),
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${loyalty.balance} ${loyalty.pointsLabel}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6D28D9),
                    ),
                  ),
                  if (loyalty.valueCents > 0)
                    Text(
                      'jusqu’à −${formatEuros(loyalty.valueCents)}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF4C1D95),
                      ),
                    ),
                ],
              ),
            ],
          ),
          if (eligibleRewards.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Aucune récompense disponible pour cette cliente.',
                style: TextStyle(fontSize: 12, color: Color(0xFF6D28D9)),
              ),
            )
          else ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _PosChip(
                  label: 'Ne pas utiliser',
                  selected: selectedRewardId == null,
                  onTap: () => onSelect(null),
                ),
                for (final reward in eligibleRewards)
                  _PosChip(
                    label:
                        '${reward.name} · −${formatEuros(reward.discountForSubtotal(subtotalCents))}',
                    selected: selectedRewardId == reward.id,
                    onTap: () => onSelect(reward.id),
                  ),
              ],
            ),
          ],
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
