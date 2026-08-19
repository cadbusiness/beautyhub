import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  PickerItem? _selectedStaff;
  String _paymentMethod = 'cash';
  bool _openingDay = false;
  bool _openCartAfterPrefill = false;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pending = ref.read(pendingPosPrefillProvider);
      if (pending != null) _applyPrefill(pending);
    });
  }

  void _applyPrefill(PosAppointmentPrefill prefill) {
    final ctx = ref.read(posContextProvider).asData?.value;
    clearPosCart(ref);
    ref.read(posInjectedCatalogProvider.notifier).state = const [];

    final cart = ref.read(posCartProvider.notifier);
    final overrides = ref.read(posPriceOverridesProvider.notifier);
    final injected = <PosCatalogItem>[];

    PosCatalogItem? serviceItem;
    if (prefill.serviceId != null && prefill.serviceId!.isNotEmpty) {
      serviceItem = ctx?.catalog
          .where((i) => i.key == 'service:${prefill.serviceId}')
          .firstOrNull;
    }
    serviceItem ??= ctx?.catalog
        .where(
          (i) =>
              i.type == 'service' &&
              i.name.toLowerCase() == prefill.serviceName.toLowerCase(),
        )
        .firstOrNull;

    if (serviceItem == null &&
        prefill.serviceId != null &&
        prefill.serviceId!.isNotEmpty) {
      serviceItem = PosCatalogItem(
        key: 'service:${prefill.serviceId}',
        type: 'service',
        id: prefill.serviceId!,
        name: prefill.serviceName,
        priceCents: prefill.priceCents ?? 0,
        category: 'service',
      );
      injected.add(serviceItem);
    }

    if (serviceItem != null) {
      cart.add(serviceItem.key);
      if (prefill.extras.isEmpty &&
          prefill.priceCents != null &&
          prefill.priceCents! > 0 &&
          prefill.priceCents != serviceItem.priceCents) {
        overrides.setPrice(serviceItem.key, prefill.priceCents!);
      }
    }

    for (final extra in prefill.extras) {
      if (extra.serviceId.isEmpty) continue;
      final key = 'service:${extra.serviceId}';
      var extraItem = ctx?.catalog.where((i) => i.key == key).firstOrNull;
      extraItem ??= injected.where((i) => i.key == key).firstOrNull;
      if (extraItem == null) {
        extraItem = PosCatalogItem(
          key: key,
          type: 'service',
          id: extra.serviceId,
          name: extra.name,
          priceCents: extra.priceCents ?? 0,
          category: 'service',
        );
        injected.add(extraItem);
      }
      for (var i = 0; i < extra.quantity; i++) {
        cart.add(key);
      }
    }

    if (injected.isNotEmpty) {
      ref.read(posInjectedCatalogProvider.notifier).state = injected;
    }

    if (prefill.clientId != null && prefill.clientId!.isNotEmpty) {
      _selectedClient = PickerItem(
        id: prefill.clientId!,
        title: prefill.clientName ?? 'Cliente',
      );
    }
    if (prefill.staffId != null && prefill.staffId!.isNotEmpty) {
      _selectedStaff = PickerItem(
        id: prefill.staffId!,
        title: prefill.staffName ?? 'Praticienne',
      );
    }

    ref.read(pendingPosPrefillProvider.notifier).state = null;
    _openCartAfterPrefill = serviceItem != null || prefill.extras.isNotEmpty;
    if (mounted) setState(() {});
  }

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
    if (facet == 'woo:none') {
      return item.category == 'woocommerce' &&
          item.wooBrands.isEmpty &&
          item.wooCategories.isEmpty;
    }
    if (facet.startsWith('woo-brand-child:')) {
      final rest = facet.substring('woo-brand-child:'.length);
      final idx = rest.indexOf('::');
      if (idx <= 0) return false;
      final brand = rest.substring(0, idx);
      final child = rest.substring(idx + 2);
      return item.wooBrands.contains(brand) && item.wooCategories.contains(child);
    }
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

  List<({String id, String brand, String child, String label})>
      _wooBrandChildren(PosContext ctx, String type) {
    if (type != 'all' && type != 'woocommerce') return const [];
    final allBrands = <String>{};
    for (final item in ctx.catalog) {
      if (item.category != 'woocommerce') continue;
      allBrands.addAll(item.wooBrands);
    }
    if (allBrands.isEmpty) return const [];
    const soinsLabels = <String>{
      'Visage', 'Corps', 'Cheveux', 'Soins', 'Marques', 'soins', 'marques',
    };
    final pairs = <String, ({String brand, String child})>{};
    for (final item in ctx.catalog) {
      if (item.category != 'woocommerce') continue;
      if (item.wooBrands.isEmpty) continue;
      for (final rawCat in item.wooCategories) {
        final cat = rawCat.trim();
        if (cat.isEmpty) continue;
        if (allBrands.contains(cat)) continue;
        if (soinsLabels.contains(cat)) continue;
        for (final brand in item.wooBrands) {
          pairs['$brand::$cat'] = (brand: brand, child: cat);
        }
      }
    }
    final list = pairs.values
        .map((p) => (
              id: 'woo-brand-child:${p.brand}::${p.child}',
              brand: p.brand,
              child: p.child,
              label: '${p.brand} — ${p.child}',
            ))
        .toList();
    list.sort((a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()));
    return list;
  }

  bool _hasUncategorizedWoo(PosContext ctx, String type) {
    if (type != 'all' && type != 'woocommerce') return false;
    return ctx.catalog.any(
      (item) =>
          item.category == 'woocommerce' &&
          item.wooBrands.isEmpty &&
          item.wooCategories.isEmpty,
    );
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
    if (facet == 'woo-group:marques' ||
        facet.startsWith('woo-brand:') ||
        facet.startsWith('woo-brand-child:')) {
      return 'marques';
    }
    return null;
  }

  String? _activeBrandName(String facet) {
    if (facet.startsWith('woo-brand:')) {
      return facet.substring('woo-brand:'.length);
    }
    if (facet.startsWith('woo-brand-child:')) {
      final rest = facet.substring('woo-brand-child:'.length);
      final idx = rest.indexOf('::');
      if (idx <= 0) return null;
      return rest.substring(0, idx);
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

  PosCatalogItem? _itemForKey(PosContext ctx, String key) {
    return ctx.catalog.where((i) => i.key == key).firstOrNull ??
        ref
            .read(posInjectedCatalogProvider)
            .where((i) => i.key == key)
            .firstOrNull;
  }

  int _catalogPriceCents(PosContext ctx, String key) {
    return _itemForKey(ctx, key)?.priceCents ?? 0;
  }

  int _cartTotalCents(PosContext ctx, Map<String, int> cart) {
    return cartTotalCents(
      cart: cart,
      overrides: ref.read(posPriceOverridesProvider),
      catalogPriceCents: (key) => _catalogPriceCents(ctx, key),
    );
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
    int loyaltyCreditCents = 0,
    String? staffId,
    String paymentMethod = 'cash',
  }) async {
    final cart = ref.read(posCartProvider);
    if (cart.isEmpty) return false;

    if (ctx.sessionPaused) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('La caisse est en pause — reprenez la session pour encaisser.'),
          ),
        );
      }
      return false;
    }

    if (ctx.sessionIsPreviousDay) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Clôturez d’abord la session d’hier avant d’encaisser aujourd’hui.',
            ),
          ),
        );
      }
      return false;
    }

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

    final overrides = activePriceOverrides(
      cart: cart,
      overrides: ref.read(posPriceOverridesProvider),
      catalogPriceCents: (key) => _catalogPriceCents(ctx, key),
    );
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
            staffId: staffId,
            notes: notes,
            cartDiscountCents: discountCents > 0 ? discountCents : null,
            discountReason: discountReason,
            loyaltyRewardId: loyaltyRewardId,
            loyaltyCreditCents:
                loyaltyCreditCents > 0 ? loyaltyCreditCents : null,
            priceOverrides: overrides.isEmpty ? null : overrides,
            payments: totalCents > 0
                ? [
                    {'method': paymentMethod, 'amountCents': totalCents},
                  ]
                : const [],
          );
      ref.invalidate(cashSessionProvider);
      ref.invalidate(posContextProvider);
      ref.invalidate(institutSalesFirstPageProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Ticket enregistré${result.ticketNumber != null ? ' · n° ${result.ticketNumber}' : ''}',
            ),
          ),
        );
      }
      final ticketContext = context;
      final saleId = result.saleId;
      final ticketTitle = result.ticketNumber != null
          ? 'Ticket n° ${result.ticketNumber}'
          : 'Ticket';
      Future<void>.microtask(() {
        clearPosCart(ref);
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
        selectedStaff: _selectedStaff,
        paymentMethod: _paymentMethod,
        onClientChanged: (item) => setState(() => _selectedClient = item),
        onStaffChanged: (item) => setState(() => _selectedStaff = item),
        onPaymentChanged: (m) => setState(() => _paymentMethod = m),
        onCheckout: ({
          discountCents = 0,
          loyaltyDiscountCents = 0,
          notes,
          discountReason,
          loyaltyRewardId,
          loyaltyCreditCents = 0,
          staffId,
          paymentMethod = 'cash',
        }) =>
            _checkout(
              ctx,
              discountCents: discountCents,
              loyaltyDiscountCents: loyaltyDiscountCents,
              notes: notes,
              discountReason: discountReason,
              loyaltyRewardId: loyaltyRewardId,
              loyaltyCreditCents: loyaltyCreditCents,
              staffId: staffId,
              paymentMethod: paymentMethod,
            ),
        sessionBlocked: ctx.sessionPaused ||
            ctx.sessionIsPreviousDay ||
            (ctx.requireOpenSession && !ctx.sessionOpen),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<PosAppointmentPrefill?>(pendingPosPrefillProvider, (_, next) {
      if (next != null) _applyPrefill(next);
    });
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
        if (_openCartAfterPrefill) {
          _openCartAfterPrefill = false;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _openCartSheet(ctx);
          });
        }
        final items = _filtered(ctx, filter, facet, query);
        final queryTrimmed = query.trim();
        final serviceFacets = _serviceFacets(ctx, filter);
        final productFacets = _productFacets(ctx, filter);
        final wooNav = _wooNav(ctx, filter);
        final wooBrandChildren = _wooBrandChildren(ctx, filter);
        final showUncategorizedWoo = _hasUncategorizedWoo(ctx, filter);
        final activeBrand = _activeBrandName(facet);
        final activeBrandChildren = activeBrand == null
            ? const <({String id, String brand, String child, String label})>[]
            : wooBrandChildren.where((c) => c.brand == activeBrand).toList();
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
                if (ctx.sessionOpen && ctx.sessionPaused)
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
                                    'Caisse en pause',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF78350F),
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Reprenez la session pour encaisser.',
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
                              child: const Text('Reprendre'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (ctx.sessionOpen && ctx.sessionIsPreviousDay && !ctx.sessionPaused)
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
                                    'Session d’hier ouverte',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF78350F),
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Les encaissements sont bloqués. Clôturez-la en indiquant l’heure de fermeture d’hier.',
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
                              onPressed: () => requestCashCloseSheet(ref),
                              child: const Text('Clôturer'),
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
                        if (showUncategorizedWoo)
                          _FacetChip(
                            label: 'Woo sans cat.',
                            value: 'woo:none',
                            selected: facet,
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
                if (wooGroup == 'marques' && activeBrandChildren.isNotEmpty)
                  SliverToBoxAdapter(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(28, 0, 16, 8),
                      child: Row(
                        children: [
                          for (final child in activeBrandChildren)
                            _FacetChip(
                              label: child.child,
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
    required this.selectedStaff,
    required this.paymentMethod,
    required this.onClientChanged,
    required this.onStaffChanged,
    required this.onPaymentChanged,
    required this.onCheckout,
    this.sessionBlocked = false,
  });

  final PosContext ctx;
  final PickerItem? selectedClient;
  final PickerItem? selectedStaff;
  final String paymentMethod;
  final ValueChanged<PickerItem?> onClientChanged;
  final ValueChanged<PickerItem?> onStaffChanged;
  final ValueChanged<String> onPaymentChanged;
  final   Future<bool> Function({
    int discountCents,
    int loyaltyDiscountCents,
    String? notes,
    String? discountReason,
    String? loyaltyRewardId,
    int loyaltyCreditCents,
    String? staffId,
    String paymentMethod,
  }) onCheckout;
  final bool sessionBlocked;

  @override
  ConsumerState<_CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends ConsumerState<_CartSheet> {
  late PickerItem? _client = widget.selectedClient;
  late PickerItem? _staff = widget.selectedStaff;
  late String _paymentMethod = widget.paymentMethod;
  bool _showDiscount = false;
  String _discountKind = 'percent';
  String? _pickedReason;
  bool _customReason = false;
  final _discountValue = TextEditingController();
  final _discountReason = TextEditingController();
  PosClientLoyalty? _loyalty;
  String? _loyaltyRewardId;
  int _loyaltyCreditCents = 0;
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
        _loyaltyCreditCents = 0;
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
        _loyaltyCreditCents = 0;
        _loyaltyLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loyalty = null;
        _loyaltyRewardId = null;
        _loyaltyCreditCents = 0;
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
    final onCheckout = widget.onCheckout;
    final sessionBlocked = widget.sessionBlocked;
    final cart = ref.watch(posCartProvider);
    final overrides = ref.watch(posPriceOverridesProvider);
    final checkingOut = ref.watch(posCheckoutBusyProvider);
    ref.listen<Map<String, int>>(posCartProvider, (_, next) {
      ref.read(posPriceOverridesProvider.notifier).retainKeys(next.keys);
    });
    var total = 0;
    final lines = <Widget>[];
    final injected = ref.watch(posInjectedCatalogProvider);
    for (final entry in cart.entries) {
      final item = ctx.catalog.where((i) => i.key == entry.key).firstOrNull ??
          injected.where((i) => i.key == entry.key).firstOrNull;
      if (item == null) continue;
      final unitCents = cartLineUnitCents(
        key: entry.key,
        catalogCents: item.priceCents,
        overrides: overrides,
      );
      final lineTotal = unitCents * entry.value;
      total += lineTotal;
      lines.add(
        _CartLineRow(
          item: item,
          quantity: entry.value,
          unitCents: unitCents,
          lineTotalCents: lineTotal,
          overridden: overrides.containsKey(entry.key) &&
              overrides[entry.key] != item.priceCents,
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
    final creditCap = _loyalty != null && _loyalty!.creditEnabled
        ? (_loyalty!.balance < afterManual ? _loyalty!.balance : afterManual)
        : 0;
    final creditCents =
        _loyaltyCreditCents > creditCap ? creditCap : _loyaltyCreditCents;
    final loyaltyDiscountCents = creditCents > 0
        ? creditCents
        : (selectedReward?.discountForSubtotal(afterManual) ?? 0);
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
                  search: (q, {fromLetter}) => searchInstitutClients(
                    ref,
                    q,
                    fromLetter: fromLetter,
                  ),
                  showAlphabet: true,
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
            const SizedBox(height: 12),
            SearchablePickerField(
              label: 'Praticienne (optionnel)',
              value: _staff?.title,
              placeholder: 'Aucune praticienne',
              onOpen: () async {
                final picked = await showSearchablePicker(
                  context: context,
                  title: 'Choisir une praticienne',
                  items: ctx.staff
                      .map((s) => PickerItem(id: s.id, title: s.label))
                      .toList(),
                  selectedId: _staff?.id,
                  searchHint: 'Rechercher…',
                  nullOption: const PickerItem(
                    id: '__none__',
                    title: 'Aucune praticienne',
                  ),
                  emptyMessage: 'Aucune praticienne dans l’équipe.',
                );
                if (picked == null) return;
                final next = picked.id == '__none__' ? null : picked;
                setState(() => _staff = next);
                widget.onStaffChanged(next);
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
                  creditCents: creditCents,
                  subtotalCents: afterManual,
                  onSelect: (id) => setState(() {
                    _loyaltyRewardId = id;
                    _loyaltyCreditCents = 0;
                  }),
                  onCreditChanged: (cents) => setState(() {
                    _loyaltyCreditCents = cents;
                    _loyaltyRewardId = null;
                  }),
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
                if (ctx.settings.paymentMethods.transfer)
                  (id: 'transfer', label: 'Virement'),
              ],
              selected: _paymentMethod,
              onSelected: (m) {
                setState(() => _paymentMethod = m);
                widget.onPaymentChanged(m);
              },
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
                onPressed: checkingOut ||
                        sessionBlocked ||
                        (payable <= 0 && loyaltyDiscountCents <= 0)
                    ? null
                    : () async {
                        final reason = _customReason
                            ? _discountReason.text.trim()
                            : (_pickedReason ?? '').trim();
                        final ok = await onCheckout(
                          discountCents: discountCents,
                          loyaltyDiscountCents: loyaltyDiscountCents,
                          loyaltyRewardId: _loyaltyRewardId,
                          loyaltyCreditCents: creditCents,
                          notes: reason.isEmpty ? null : 'Remise : $reason',
                          discountReason: reason.isEmpty ? null : reason,
                          staffId: _staff?.id,
                          paymentMethod: _paymentMethod,
                        );
                        if (ok && context.mounted) {
                          Navigator.pop(context);
                          clearPosCart(ref);
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

class _CartLineRow extends ConsumerStatefulWidget {
  const _CartLineRow({
    required this.item,
    required this.quantity,
    required this.unitCents,
    required this.lineTotalCents,
    required this.overridden,
  });

  final PosCatalogItem item;
  final int quantity;
  final int unitCents;
  final int lineTotalCents;
  final bool overridden;

  @override
  ConsumerState<_CartLineRow> createState() => _CartLineRowState();
}

class _CartLineRowState extends ConsumerState<_CartLineRow> {
  late final TextEditingController _price;
  var _editing = false;

  @override
  void initState() {
    super.initState();
    _price = TextEditingController(text: _euros(widget.unitCents));
  }

  @override
  void didUpdateWidget(covariant _CartLineRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_editing && oldWidget.unitCents != widget.unitCents) {
      _price.text = _euros(widget.unitCents);
    }
  }

  @override
  void dispose() {
    _price.dispose();
    super.dispose();
  }

  String _euros(int cents) => (cents / 100).toStringAsFixed(2);

  void _commitPrice() {
    if (!mounted) return;
    _editing = false;
    final parsed = double.tryParse(_price.text.replaceAll(',', '.'));
    if (parsed == null) {
      _price.text = _euros(widget.unitCents);
      return;
    }
    final cents = (parsed * 100).round();
    if (cents < 0) {
      _price.text = _euros(widget.unitCents);
      return;
    }
    if (cents == widget.item.priceCents) {
      ref.read(posPriceOverridesProvider.notifier).reset(widget.item.key);
    } else {
      ref.read(posPriceOverridesProvider.notifier).setPrice(widget.item.key, cents);
    }
    _price.text = _euros(cents == widget.item.priceCents ? widget.item.priceCents : cents);
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final qty = widget.quantity;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CatalogItemThumb(
                imageUrl: item.imageUrl,
                colorHex: item.color,
                category: item.category,
                size: 40,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Row(
                  children: [
                    if (widget.overridden) ...[
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Color(0xFF7C3AED),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Expanded(
                      child: Text(
                        item.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0A0A0A),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                formatEuros(widget.lineTotalCents),
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _CartQtyChip(
                quantity: qty,
                onMinus: () =>
                    ref.read(posCartProvider.notifier).removeOne(item.key),
                onPlus: () => ref.read(posCartProvider.notifier).add(item.key),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 88,
                height: 36,
                child: Focus(
                  onFocusChange: (hasFocus) {
                    if (hasFocus) {
                      _editing = true;
                    } else {
                      _commitPrice();
                    }
                  },
                  child: TextField(
                  controller: _price,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                  ],
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: widget.overridden
                        ? const Color(0xFF6D28D9)
                        : const Color(0xFF0A0A0A),
                  ),
                  onTap: () {
                    _editing = true;
                    _price.selection = TextSelection(
                      baseOffset: 0,
                      extentOffset: _price.text.length,
                    );
                  },
                  onSubmitted: (_) => _commitPrice(),
                  decoration: InputDecoration(
                    isDense: true,
                    suffixText: '€',
                    suffixStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF737373),
                    ),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    filled: true,
                    fillColor: widget.overridden
                        ? const Color(0xFFF5F3FF)
                        : const Color(0xFFF5F5F5),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: widget.overridden
                            ? const Color(0xFFDDD6FE)
                            : const Color(0xFFE5E5E5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: widget.overridden
                            ? const Color(0xFFDDD6FE)
                            : const Color(0xFFE5E5E5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFF0A0A0A)),
                    ),
                  ),
                ),
                ),
              ),
              if (widget.overridden)
                Flexible(
                  child: TextButton(
                    onPressed: () {
                      ref
                          .read(posPriceOverridesProvider.notifier)
                          .reset(item.key);
                      _price.text = _euros(item.priceCents);
                      _editing = false;
                    },
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      foregroundColor: const Color(0xFF6D28D9),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    child: const Text(
                      'Tarif catalogue',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                )
              else
                const Spacer(),
              IconButton(
                onPressed: () =>
                    ref.read(posCartProvider.notifier).remove(item.key),
                icon: const Icon(Icons.delete_outline_rounded, size: 20),
                color: const Color(0xFF737373),
                visualDensity: VisualDensity.compact,
                tooltip: 'Retirer',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CartQtyChip extends StatelessWidget {
  const _CartQtyChip({
    required this.quantity,
    required this.onMinus,
    required this.onPlus,
  });

  final int quantity;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            onPressed: onMinus,
            icon: const Icon(Icons.remove, size: 16),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 36),
          ),
          Text(
            '$quantity',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          IconButton(
            onPressed: onPlus,
            icon: const Icon(Icons.add, size: 16),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 36),
          ),
        ],
      ),
    );
  }
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
    required this.creditCents,
    required this.subtotalCents,
    required this.onSelect,
    required this.onCreditChanged,
  });

  final PosClientLoyalty loyalty;
  final List<PosLoyaltyReward> eligibleRewards;
  final String? selectedRewardId;
  final int creditCents;
  final int subtotalCents;
  final ValueChanged<String?> onSelect;
  final ValueChanged<int> onCreditChanged;

  @override
  Widget build(BuildContext context) {
    final maxCredit = loyalty.balance < subtotalCents
        ? loyalty.balance
        : subtotalCents;
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
                    loyalty.creditEnabled
                        ? 'Bon ${formatEuros(loyalty.balance)}'
                        : '${loyalty.balance} ${loyalty.pointsLabel}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF4C1D95),
                    ),
                  ),
                  if (!loyalty.creditEnabled && loyalty.valueCents > 0)
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
          if (loyalty.creditEnabled) ...[
            const SizedBox(height: 8),
            const Text(
              'Cumulable, ou à débiter en tout ou partie.',
              style: TextStyle(fontSize: 12, color: Color(0xFF6D28D9)),
            ),
            const SizedBox(height: 8),
            _CreditAmountField(
              creditCents: creditCents,
              maxCredit: maxCredit,
              onChanged: onCreditChanged,
            ),
          ] else if (eligibleRewards.isEmpty)
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

class _CreditAmountField extends StatefulWidget {
  const _CreditAmountField({
    required this.creditCents,
    required this.maxCredit,
    required this.onChanged,
  });

  final int creditCents;
  final int maxCredit;
  final ValueChanged<int> onChanged;

  @override
  State<_CreditAmountField> createState() => _CreditAmountFieldState();
}

class _CreditAmountFieldState extends State<_CreditAmountField> {
  late final _controller = TextEditingController(
    text: widget.creditCents > 0
        ? (widget.creditCents / 100).toStringAsFixed(2)
        : '',
  );

  @override
  void didUpdateWidget(covariant _CreditAmountField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.creditCents != widget.creditCents) {
      final next = widget.creditCents > 0
          ? (widget.creditCents / 100).toStringAsFixed(2)
          : '';
      if (_controller.text != next) _controller.text = next;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _apply(String raw) {
    final n = double.tryParse(raw.replaceAll(',', '.')) ?? 0;
    var cents = (n * 100).round();
    if (cents < 0) cents = 0;
    if (cents > widget.maxCredit) cents = widget.maxCredit;
    widget.onChanged(cents);
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              isDense: true,
              hintText: '0,00',
              suffixText: '€',
            ),
            onChanged: _apply,
          ),
        ),
        const SizedBox(width: 8),
        TextButton(
          onPressed: widget.maxCredit <= 0
              ? null
              : () => widget.onChanged(widget.maxCredit),
          child: const Text('Tout'),
        ),
        if (widget.creditCents > 0)
          TextButton(
            onPressed: () => widget.onChanged(0),
            child: const Text('Aucun'),
          ),
      ],
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
