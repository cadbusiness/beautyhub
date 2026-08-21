import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../../state/session_providers.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/client_picker.dart';
import '../../widgets/new_client_form.dart';
import '../../widgets/searchable_picker.dart';
import '../shared/catalog_item_thumb.dart';
import '../shared/money.dart';
import 'catalog_item_detail_sheet.dart';
import 'catalog_product_row.dart';
import 'free_charge_sheet.dart';
import 'internal_product_sheets.dart';
import 'pos_cart_switcher.dart';
import 'sale_ticket_pdf_screen.dart';

class PosSaleTab extends ConsumerStatefulWidget {
  const PosSaleTab({super.key});

  @override
  ConsumerState<PosSaleTab> createState() => _PosSaleTabState();
}

class _PosSaleTabState extends ConsumerState<PosSaleTab> {
  PickerItem? _selectedClient;
  PickerItem? _selectedStaff;
  String? _appointmentId;
  String _paymentMethod = 'cash';
  bool _openingDay = false;
  bool _openCartAfterPrefill = false;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _tabletBreakpoint = 600.0;

  bool get _tablet =>
      MediaQuery.sizeOf(context).shortestSide >= _tabletBreakpoint;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(posCartSessionProvider.notifier).ensure();
      if (!mounted) return;
      final pending = ref.read(pendingPosPrefillProvider);
      if (pending != null) await _applyPrefill(pending);
    });
  }

  void _syncMeta({
    String? discountKind,
    double? discountValue,
    String? discountReason,
    int cartDiscountCents = 0,
    String? notes,
    Map<String, String>? lineStaff,
  }) {
    final current = ref.read(posCartMetaProvider);
    ref.read(posCartMetaProvider.notifier).state = PosCartMeta(
      clientId: _selectedClient?.id,
      clientName: _selectedClient?.title,
      staffId: _selectedStaff?.id,
      appointmentId: _appointmentId,
      lineStaff: lineStaff ?? current.lineStaff,
      discountKind: discountKind,
      discountValue: discountValue,
      discountReason: discountReason,
      cartDiscountCents: cartDiscountCents,
      notes: notes,
    );
  }

  void _hydrateFromCart(PosCartSnapshot cart) {
    final ctx = ref.read(posContextProvider).asData?.value;
    _selectedClient = cart.clientId != null
        ? PickerItem(
            id: cart.clientId!,
            title: cart.clientName ??
                ctx?.clients
                    .where((c) => c.id == cart.clientId)
                    .firstOrNull
                    ?.label ??
                'Cliente',
          )
        : null;
    _selectedStaff = cart.staffId != null
        ? PickerItem(
            id: cart.staffId!,
            title: ctx?.staff
                    .where((s) => s.id == cart.staffId)
                    .firstOrNull
                    ?.label ??
                'Praticienne',
          )
        : null;
    _appointmentId = cart.appointmentId;
    if (_selectedStaff == null && ctx?.currentStaffId != null) {
      final match = ctx!.staff.where((s) => s.id == ctx.currentStaffId).firstOrNull;
      if (match != null) {
        _selectedStaff = PickerItem(id: match.id, title: match.label);
      }
    }
    _syncMeta(
      discountKind: cart.discountKind,
      discountValue: cart.discountValue,
      discountReason: cart.discountReason,
      cartDiscountCents: cart.cartDiscountCents,
      notes: cart.notes,
      lineStaff: cart.lineStaff,
    );
    if (mounted) setState(() {});
  }

  Future<void> _applyPrefill(PosAppointmentPrefill prefill) async {
    final session = ref.read(posCartSessionProvider);
    if (ref.read(posCartProvider).isNotEmpty ||
        (session.active?.itemCount ?? 0) > 0) {
      try {
        await ref.read(posCartSessionProvider.notifier).createEmpty();
      } catch (_) {}
    }
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
    _appointmentId = prefill.appointmentId;

    ref.read(pendingPosPrefillProvider.notifier).state = null;
    _openCartAfterPrefill = serviceItem != null || prefill.extras.isNotEmpty;
    final lineStaff = <String, String>{};
    if (prefill.staffId != null && prefill.staffId!.isNotEmpty) {
      for (final key in ref.read(posCartProvider).keys) {
        lineStaff[key] = prefill.staffId!;
      }
    }
    _syncMeta(lineStaff: lineStaff);
    if (mounted) setState(() {});
    await ref.read(posCartSessionProvider.notifier).flushSave();
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

  String _normalizeScan(String raw) => raw.trim().replaceAll(RegExp(r'\s+'), '');

  bool _looksLikeScanCode(String raw) {
    final code = _normalizeScan(raw);
    if (code.length < 4 || code.length > 64) return false;
    if (RegExp(r'^[0-9]{6,14}$').hasMatch(code)) return true;
    return RegExp(r'^[A-Za-z0-9._\-/]+$').hasMatch(code) &&
        RegExp(r'\d').hasMatch(code) &&
        code.length >= 6;
  }

  PosCatalogItem? _findByScanCode(PosContext ctx, String raw) {
    final code = _normalizeScan(raw).toLowerCase();
    if (code.isEmpty) return null;
    for (final item in ctx.catalog) {
      final sku = item.sku?.trim().toLowerCase();
      final barcode = item.barcode?.trim().toLowerCase();
      if (sku == code || barcode == code) return item;
    }
    return null;
  }

  void _applyScanCode(PosContext ctx, String raw) {
    final match = _findByScanCode(ctx, raw);
    if (match != null) {
      ref.read(posCartProvider.notifier).add(match.key);
      ref.read(posCatalogQueryProvider.notifier).state = '';
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${match.name} ajouté au panier')),
      );
      return;
    }
    if (!_looksLikeScanCode(raw)) return;
    ref.read(posCatalogQueryProvider.notifier).state = _normalizeScan(raw);
  }

  bool _matchesQuery(PosCatalogItem item, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    if (item.name.toLowerCase().contains(q)) return true;
    if (item.sku?.toLowerCase().contains(q) ?? false) return true;
    if (item.barcode?.toLowerCase().contains(q) ?? false) return true;
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
    List<Map<String, dynamic>> payments = const [],
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

    final hasService = cart.keys.any((key) {
      final item = ctx.catalog.where((i) => i.key == key).firstOrNull;
      if (item != null) return item.type == 'service';
      return key.startsWith('service:') || key.startsWith('custom:');
    });
    final lineStaff = ref.read(posCartMetaProvider).lineStaff;
    final missingStaff = hasService &&
        (staffId == null || staffId.isEmpty) &&
        cart.keys.any((key) {
          final item = ctx.catalog.where((i) => i.key == key).firstOrNull;
          final isService = item?.type == 'service' ||
              key.startsWith('service:') ||
              key.startsWith('custom:');
          return isService && (lineStaff[key] == null || lineStaff[key]!.isEmpty);
        });
    if (missingStaff) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Choisissez une praticienne — obligatoire dès qu’il y a une prestation.',
            ),
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
      await ref.read(posCartSessionProvider.notifier).flushSave();
      final result = await ref.read(mobileApiProvider).checkout(
            accessToken: token,
            tenantId: tenantId,
            cart: cart,
            clientId: _selectedClient?.id,
            staffId: staffId,
            lineStaffIds: ref.read(posCartMetaProvider).lineStaff,
            notes: notes,
            cartDiscountCents: discountCents > 0 ? discountCents : null,
            discountReason: discountReason,
            loyaltyRewardId: loyaltyRewardId,
            loyaltyCreditCents:
                loyaltyCreditCents > 0 ? loyaltyCreditCents : null,
            priceOverrides: overrides.isEmpty ? null : overrides,
            posCartId: ref.read(posCartSessionProvider).activeCartId,
            payments: totalCents > 0
                ? (payments.isNotEmpty
                    ? payments
                    : [
                        {'method': 'cash', 'amountCents': totalCents},
                      ])
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
      _selectedClient = null;
      _selectedStaff = null;
      _appointmentId = null;
      Future<void>.microtask(() async {
        await ref.read(posCartSessionProvider.notifier).afterCheckout();
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

  Future<void> _addFreeCharge(PosContext ctx) async {
    final added = await showFreeChargeSheet(context, ref);
    if (!added || !mounted) return;
    await Future<void>.delayed(const Duration(milliseconds: 80));
    if (mounted) _openCartSheet(ctx);
  }

  _CartSheet _cartPanel(PosContext ctx, {required bool embedded}) {
    return _CartSheet(
      ctx: ctx,
      embedded: embedded,
      selectedClient: _selectedClient,
      selectedStaff: _selectedStaff,
      paymentMethod: _paymentMethod,
      onClientChanged: (item) {
        setState(() => _selectedClient = item);
        _syncMeta();
        ref.read(posCartSessionProvider.notifier).scheduleSave();
      },
      onStaffChanged: (item) {
        setState(() => _selectedStaff = item);
        _syncMeta();
        ref.read(posCartSessionProvider.notifier).scheduleSave();
      },
      onPaymentChanged: (m) => setState(() => _paymentMethod = m),
      onCheckout: ({
        discountCents = 0,
        loyaltyDiscountCents = 0,
        notes,
        discountReason,
        loyaltyRewardId,
        loyaltyCreditCents = 0,
        staffId,
        payments = const [],
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
            payments: payments,
          ),
      sessionBlocked: ctx.sessionPaused ||
          ctx.sessionIsPreviousDay ||
          (ctx.requireOpenSession && !ctx.sessionOpen),
    );
  }

  void _openCartSheet(PosContext ctx) {
    if (_tablet) return;
    showAppSheet<void>(
      context: context,
      builder: (context) => _cartPanel(ctx, embedded: false),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(posCatalogScanNonceProvider, (prev, next) {
      if (prev == next) return;
      final ctx = ref.read(posContextProvider).asData?.value;
      if (ctx == null) return;
      _applyScanCode(ctx, ref.read(posCatalogQueryProvider));
    });
    ref.listen<PosAppointmentPrefill?>(pendingPosPrefillProvider, (_, next) {
      if (next != null) _applyPrefill(next);
    });
    ref.listen<PosCartSessionState>(posCartSessionProvider, (prev, next) {
      if (prev?.hydrateSeq == next.hydrateSeq) return;
      final active = next.active;
      if (active != null) _hydrateFromCart(active);
    });
    ref.listen<Map<String, int>>(posCartProvider, (_, _) {
      ref.read(posCartSessionProvider.notifier).scheduleSave();
    });
    ref.listen<Map<String, int>>(posPriceOverridesProvider, (_, _) {
      ref.read(posCartSessionProvider.notifier).scheduleSave();
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
        final catalog = CustomScrollView(
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
                if (!_tablet)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(16, 10, 16, 2),
                      child: PosCartSwitcher(),
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
                        _InlineActionChip(
                          label: '+ Montant libre',
                          onTap: () => _addFreeCharge(ctx),
                        ),
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
                              defaultSku: _looksLikeScanCode(queryTrimmed)
                                  ? _normalizeScan(queryTrimmed)
                                  : null,
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
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              queryTrimmed.isNotEmpty
                                  ? (_looksLikeScanCode(queryTrimmed)
                                      ? 'Code « ${_normalizeScan(queryTrimmed)} » inconnu — créez le produit interne pour pouvoir le scanner.'
                                      : 'Aucun article pour « $queryTrimmed ».')
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
                            if (queryTrimmed.isNotEmpty &&
                                _looksLikeScanCode(queryTrimmed)) ...[
                              const SizedBox(height: 16),
                              FilledButton(
                                onPressed: () => showCreateInternalProductSheet(
                                  context,
                                  ref,
                                  categories: ctx.productCategories,
                                  defaultCategoryId: selectedProductCategoryId,
                                  defaultSku: _normalizeScan(queryTrimmed),
                                ),
                                style: FilledButton.styleFrom(
                                  backgroundColor: _black,
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('Créer ce produit'),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
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
            );
        if (_tablet) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: catalog),
              DecoratedBox(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    left: BorderSide(color: Color(0xFFE8E8E8)),
                  ),
                ),
                child: SizedBox(
                  width: 400,
                  child: _cartPanel(ctx, embedded: true),
                ),
              ),
            ],
          );
        }
        return Column(
          children: [
            Expanded(child: catalog),
            if (cartCount > 0)
              _DockedCartBar(
                count: cartCount,
                totalLabel: formatEuros(_cartTotalCents(ctx, cart)),
                onTap: () => _openCartSheet(ctx),
              ),
          ],
        );
      },
    );
  }
}

class _DockedCartBar extends StatelessWidget {
  const _DockedCartBar({
    required this.count,
    required this.totalLabel,
    required this.onTap,
  });

  final int count;
  final String totalLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _PosSaleTabState._black,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
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
                  'Panier · $count',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                totalLabel,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.keyboard_arrow_up_rounded,
                color: Colors.white,
                size: 22,
              ),
            ],
          ),
        ),
      ),
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

String _eurosField(int cents) {
  final whole = (cents / 100).truncate();
  final frac = (cents.abs() % 100).toString().padLeft(2, '0');
  return '$whole,$frac';
}

int _parseEurosField(String raw) {
  final n = double.tryParse(raw.trim().replaceAll(',', '.')) ?? 0;
  if (n <= 0) return 0;
  return (n * 100).round();
}

class _PayLine {
  _PayLine({required this.method, required this.amountCents});

  String method;
  int amountCents;
}

class _PaymentSplitEditor extends StatefulWidget {
  const _PaymentSplitEditor({
    required this.payableCents,
    required this.methods,
    required this.initialMethod,
    required this.onChanged,
    required this.onLinesChanged,
  });

  final int payableCents;
  final List<({String id, String label})> methods;
  final String initialMethod;
  final ValueChanged<String> onChanged;
  final ValueChanged<List<Map<String, dynamic>>> onLinesChanged;

  @override
  State<_PaymentSplitEditor> createState() => _PaymentSplitEditorState();
}

class _PaymentSplitEditorState extends State<_PaymentSplitEditor> {
  late final List<_PayLine> _lines = [
    _PayLine(
      method: widget.methods.any((m) => m.id == widget.initialMethod)
          ? widget.initialMethod
          : (widget.methods.firstOrNull?.id ?? 'cash'),
      amountCents: widget.payableCents,
    ),
  ];
  int _lastPayable = -1;
  int? _editingIndex;
  String _pad = '';
  bool _padDirty = false;

  @override
  void initState() {
    super.initState();
    _lastPayable = widget.payableCents;
    _emit();
  }

  @override
  void didUpdateWidget(covariant _PaymentSplitEditor oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.payableCents != _lastPayable && _lines.length == 1) {
      _lines[0].amountCents = widget.payableCents;
      if (_editingIndex == 0 && !_padDirty) {
        _pad = _eurosField(widget.payableCents);
      }
    }
    _lastPayable = widget.payableCents;
    _emit();
  }

  void _emit() {
    widget.onLinesChanged([
      for (final line in _lines)
        {'method': line.method, 'amountCents': line.amountCents},
    ]);
  }

  int get _paid => _lines.fold<int>(0, (sum, line) => sum + line.amountCents);
  int get _remaining => widget.payableCents - _paid;

  _PayLine? _lineFor(String method) {
    for (final line in _lines) {
      if (line.method == method) return line;
    }
    return null;
  }

  String _firstUnusedLabel() {
    final used = _lines.map((l) => l.method).toSet();
    for (final method in widget.methods) {
      if (!used.contains(method.id)) return method.label;
    }
    return '';
  }

  void _openPad(int index) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _editingIndex = index;
      _pad = _eurosField(_lines[index].amountCents);
      _padDirty = false;
    });
  }

  void _closePad() {
    setState(() {
      _editingIndex = null;
      _pad = '';
      _padDirty = false;
    });
  }

  void _commitPad() {
    final i = _editingIndex;
    if (i == null) return;
    _lines[i].amountCents = _parseEurosField(_pad);
    _emit();
  }

  void _appendDigit(String digit) {
    setState(() {
      if (!_padDirty) {
        _pad = digit;
        _padDirty = true;
      } else if (_pad.contains(',')) {
        final frac = _pad.split(',')[1];
        if (frac.length < 2) _pad += digit;
      } else if (_pad == '0') {
        _pad = digit;
      } else {
        _pad += digit;
      }
      _commitPad();
    });
  }

  void _appendComma() {
    setState(() {
      if (!_padDirty) {
        _pad = '0,';
        _padDirty = true;
      } else if (!_pad.contains(',')) {
        _pad = _pad.isEmpty ? '0,' : '$_pad,';
      }
      _commitPad();
    });
  }

  void _backspace() {
    setState(() {
      if (!_padDirty) {
        _pad = '';
        _padDirty = true;
      } else if (_pad.isNotEmpty) {
        _pad = _pad.substring(0, _pad.length - 1);
      }
      _commitPad();
    });
  }

  void _fillAll() {
    final i = _editingIndex;
    if (i == null) return;
    final others = _lines.asMap().entries
        .where((e) => e.key != i)
        .fold<int>(0, (sum, e) => sum + e.value.amountCents);
    final left = widget.payableCents - others;
    setState(() {
      _lines[i].amountCents = left > 0 ? left : 0;
      _pad = _eurosField(_lines[i].amountCents);
      _padDirty = true;
    });
    _emit();
  }

  void _tapMethod(String method) {
    FocusManager.instance.primaryFocus?.unfocus();
    final existing = _lineFor(method);
    if (existing != null) {
      _openPad(_lines.indexOf(existing));
      return;
    }
    if (_remaining > 0) {
      setState(() {
        _lines.add(_PayLine(method: method, amountCents: _remaining));
        _editingIndex = null;
      });
      if (_lines.length == 1) widget.onChanged(method);
      _emit();
      return;
    }
    if (_lines.length == 1) {
      setState(() => _lines[0].method = method);
      widget.onChanged(method);
      _emit();
    }
  }

  void _removeLine(int index) {
    if (_lines.length <= 1) return;
    setState(() {
      _lines.removeAt(index);
      if (_editingIndex == index) {
        _editingIndex = null;
      } else if (_editingIndex != null && _editingIndex! > index) {
        _editingIndex = _editingIndex! - 1;
      }
    });
    widget.onChanged(_lines.first.method);
    _emit();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.methods.isEmpty) return const SizedBox.shrink();
    final unused = _firstUnusedLabel();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Paiement',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF404040),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          _remaining > 0 && unused.isNotEmpty
              ? 'Reste ${formatEuros(_remaining)} — touchez $unused'
              : 'Touchez un montant pour le changer. Le reste se met sur l’autre moyen.',
          style: TextStyle(
            fontSize: 12,
            height: 1.35,
            color: _remaining > 0
                ? const Color(0xFFB45309)
                : const Color(0xFF737373),
          ),
        ),
        const SizedBox(height: 10),
        for (final method in widget.methods) ...[
          _PaymentMethodRow(
            label: method.label,
            amountCents: _lineFor(method.id)?.amountCents,
            selected: _lineFor(method.id) != null,
            editing: _editingIndex != null &&
                _lines[_editingIndex!].method == method.id,
            canRemove: _lineFor(method.id) != null && _lines.length > 1,
            remainingHint: _remaining > 0 && _lineFor(method.id) == null,
            onTap: () => _tapMethod(method.id),
            onRemove: () {
              final line = _lineFor(method.id);
              if (line != null) _removeLine(_lines.indexOf(line));
            },
          ),
          const SizedBox(height: 8),
        ],
        if (_remaining < 0)
          Text(
            'Trop-perçu : ${formatEuros(-_remaining)}',
            style: const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
          ),
        if (_editingIndex != null) ...[
          const SizedBox(height: 4),
          _PosNumpad(
            display: _padDirty ? (_pad.isEmpty ? '0' : _pad) : _pad,
            onDigit: _appendDigit,
            onComma: _appendComma,
            onBackspace: _backspace,
            onAll: _fillAll,
            onDone: _closePad,
          ),
        ],
      ],
    );
  }
}

class _PaymentMethodRow extends StatelessWidget {
  const _PaymentMethodRow({
    required this.label,
    required this.amountCents,
    required this.selected,
    required this.editing,
    required this.canRemove,
    required this.remainingHint,
    required this.onTap,
    required this.onRemove,
  });

  final String label;
  final int? amountCents;
  final bool selected;
  final bool editing;
  final bool canRemove;
  final bool remainingHint;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: editing
                  ? (selected ? Colors.white : const Color(0xFF0A0A0A))
                  : (selected ? const Color(0xFF0A0A0A) : const Color(0xFFE5E5E5)),
              width: editing ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white : const Color(0xFF0A0A0A),
                  ),
                ),
              ),
              if (amountCents != null)
                Text(
                  formatEuros(amountCents!),
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : const Color(0xFF0A0A0A),
                  ),
                )
              else if (remainingHint)
                Text(
                  'Solde',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white70 : const Color(0xFF737373),
                  ),
                ),
              if (canRemove) ...[
                const SizedBox(width: 4),
                IconButton(
                  onPressed: onRemove,
                  icon: const Icon(Icons.close, size: 18),
                  color: selected ? Colors.white : const Color(0xFFB91C1C),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PosNumpad extends StatelessWidget {
  const _PosNumpad({
    required this.display,
    required this.onDigit,
    required this.onComma,
    required this.onBackspace,
    required this.onAll,
    required this.onDone,
  });

  final String display;
  final ValueChanged<String> onDigit;
  final VoidCallback onComma;
  final VoidCallback onBackspace;
  final VoidCallback onAll;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    Widget key(String label, VoidCallback onTap, {bool emphasis = false}) {
      return Material(
        color: emphasis ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            height: 44,
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: emphasis ? Colors.white : const Color(0xFF0A0A0A),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        Text(
          '$display €',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0A0A0A),
          ),
        ),
        const SizedBox(height: 10),
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ]) ...[
          Row(
            children: [
              for (var i = 0; i < row.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: key(row[i], () => onDigit(row[i]))),
              ],
            ],
          ),
          const SizedBox(height: 8),
        ],
        Row(
          children: [
            Expanded(child: key(',', onComma)),
            const SizedBox(width: 8),
            Expanded(child: key('0', () => onDigit('0'))),
            const SizedBox(width: 8),
            Expanded(child: key('⌫', onBackspace)),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: key('Tout', onAll)),
            const SizedBox(width: 8),
            Expanded(child: key('OK', onDone, emphasis: true)),
          ],
        ),
      ],
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
    this.embedded = false,
  });

  final PosContext ctx;
  final bool embedded;
  final PickerItem? selectedClient;
  final PickerItem? selectedStaff;
  final String paymentMethod;
  final ValueChanged<PickerItem?> onClientChanged;
  final ValueChanged<PickerItem?> onStaffChanged;
  final ValueChanged<String> onPaymentChanged;
  final Future<bool> Function({
    int discountCents,
    int loyaltyDiscountCents,
    String? notes,
    String? discountReason,
    String? loyaltyRewardId,
    int loyaltyCreditCents,
    String? staffId,
    List<Map<String, dynamic>> payments,
  }) onCheckout;
  final bool sessionBlocked;

  @override
  ConsumerState<_CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends ConsumerState<_CartSheet> {
  late PickerItem? _client = widget.selectedClient;
  late PickerItem? _staff = widget.selectedStaff;
  late String _paymentMethod = widget.paymentMethod;
  List<Map<String, dynamic>> _payPayload = const [];
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
    final active = ref.read(posCartSessionProvider).active;
    if (active != null &&
        active.discountValue != null &&
        active.discountValue! > 0) {
      _showDiscount = true;
      _discountKind = active.discountKind ?? 'percent';
      _discountValue.text = active.discountKind == 'fixed'
          ? active.discountValue!.toStringAsFixed(2)
          : '${active.discountValue! % 1 == 0 ? active.discountValue!.toInt() : active.discountValue}';
      if (active.discountReason != null &&
          active.discountReason!.isNotEmpty) {
        _pickedReason = active.discountReason;
      }
    }
    _discountValue.addListener(_persistDiscount);
    _discountReason.addListener(_persistDiscount);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final id = _client?.id;
      if (id != null) _loadLoyalty(id);
    });
  }

  void _persistDiscount() {
    if (!mounted) return;
    final n = double.tryParse(_discountValue.text.replaceAll(',', '.'));
    final reason = _customReason
        ? _discountReason.text.trim()
        : (_pickedReason ?? '').trim();
    final current = ref.read(posCartMetaProvider);
    ref.read(posCartMetaProvider.notifier).state = PosCartMeta(
      clientId: current.clientId,
      clientName: current.clientName,
      staffId: current.staffId,
      appointmentId: current.appointmentId,
      lineStaff: current.lineStaff,
      discountKind: _showDiscount ? _discountKind : null,
      discountValue: _showDiscount && n != null && n > 0 ? n : null,
      discountReason: reason.isEmpty ? null : reason,
      cartDiscountCents: current.cartDiscountCents,
      notes: current.notes,
    );
    ref.read(posCartSessionProvider.notifier).scheduleSave();
  }

  @override
  void didUpdateWidget(covariant _CartSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedClient?.id != widget.selectedClient?.id) {
      _client = widget.selectedClient;
      _loadLoyalty(_client?.id);
    }
    if (oldWidget.selectedStaff?.id != widget.selectedStaff?.id) {
      _staff = widget.selectedStaff;
    }
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

  List<Map<String, dynamic>> _checkoutPayments(int payable) {
    final rows = _payPayload
        .where((p) => ((p['amountCents'] as num?)?.toInt() ?? 0) > 0)
        .toList();
    if (rows.isEmpty && payable > 0) {
      return [
        {'method': _paymentMethod, 'amountCents': payable},
      ];
    }
    return rows;
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
    _persistDiscount();
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
          staff: ctx.staff,
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

    final embedded = widget.embedded;
    return GestureDetector(
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      behavior: HitTestBehavior.translucent,
      child: Padding(
      padding: EdgeInsets.only(
        left: embedded ? 16 : 20,
        right: embedded ? 16 : 20,
        top: embedded ? 14 : 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + (embedded ? 16 : 20),
      ),
      child: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!embedded) ...[
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
            ],
            const Text(
              'Panier',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0A0A0A),
              ),
            ),
            const SizedBox(height: 10),
            const PosCartSwitcher(),
            const SizedBox(height: 16),
            ...lines,
            const SizedBox(height: 8),
            _CartAddLine(
              icon: Icons.add_shopping_cart_outlined,
              label: 'Ajouter un produit',
              onTap: () {
                if (!embedded && context.mounted) Navigator.pop(context);
                final hasWoo = ctx.catalog.any((i) => i.category == 'woocommerce');
                ref.read(posCategoryFilterProvider.notifier).state =
                    hasWoo ? 'woocommerce' : 'internal';
                ref.read(posCatalogFacetProvider.notifier).state = 'all';
              },
            ),
            _CartAddLine(
              icon: Icons.spa_outlined,
              label: 'Ajouter une prestation',
              onTap: () {
                if (!embedded && context.mounted) Navigator.pop(context);
                ref.read(posCategoryFilterProvider.notifier).state = 'service';
                ref.read(posCatalogFacetProvider.notifier).state = 'all';
              },
            ),
            _CartAddLine(
              icon: Icons.payments_outlined,
              label: 'Encaissement libre',
              onTap: () => showFreeChargeSheet(context, ref),
            ),
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
                textInputAction: TextInputAction.done,
                onEditingComplete: () =>
                    FocusManager.instance.primaryFocus?.unfocus(),
                onTapOutside: (_) =>
                    FocusManager.instance.primaryFocus?.unfocus(),
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
                  textInputAction: TextInputAction.done,
                  onEditingComplete: () =>
                      FocusManager.instance.primaryFocus?.unfocus(),
                  onTapOutside: (_) =>
                      FocusManager.instance.primaryFocus?.unfocus(),
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
              label: 'Praticienne',
              value: _staff?.title,
              placeholder: 'Requis pour une prestation',
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
            _PaymentSplitEditor(
              payableCents: payable,
              methods: [
                if (ctx.settings.paymentMethods.cash)
                  (id: 'cash', label: 'Espèces'),
                if (ctx.settings.paymentMethods.card) (id: 'card', label: 'CB'),
                if (ctx.settings.paymentMethods.transfer)
                  (id: 'transfer', label: 'Virement'),
              ],
              initialMethod: _paymentMethod,
              onChanged: (method) => widget.onPaymentChanged(method),
              onLinesChanged: (lines) => _payPayload = lines,
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
                onPressed: checkingOut || sessionBlocked
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
                          payments: _checkoutPayments(payable),
                        );
                        if (ok && context.mounted && !embedded) {
                          Navigator.pop(context);
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
    required this.staff,
  });

  final PosCatalogItem item;
  final int quantity;
  final int unitCents;
  final int lineTotalCents;
  final bool overridden;
  final List<PosOption> staff;

  @override
  ConsumerState<_CartLineRow> createState() => _CartLineRowState();
}

class _CartLineRowState extends ConsumerState<_CartLineRow> {
  late final TextEditingController _price;
  final _lineDiscount = TextEditingController();
  var _editing = false;
  var _showLineDiscount = false;
  var _lineDiscountKind = 'percent';

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
    _lineDiscount.dispose();
    super.dispose();
  }

  void _applyLineDiscount() {
    final n = double.tryParse(_lineDiscount.text.replaceAll(',', '.'));
    if (n == null || n <= 0) return;
    final cents = discountedUnitCents(
      catalogCents: widget.item.priceCents,
      kind: _lineDiscountKind,
      value: n,
    );
    if (cents == widget.item.priceCents) {
      ref.read(posPriceOverridesProvider.notifier).reset(widget.item.key);
    } else {
      ref.read(posPriceOverridesProvider.notifier).setPrice(widget.item.key, cents);
    }
    _price.text = _euros(cents);
    _lineDiscount.clear();
    setState(() => _showLineDiscount = false);
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
                  textInputAction: TextInputAction.done,
                  onTapOutside: (_) =>
                      FocusManager.instance.primaryFocus?.unfocus(),
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
          if (item.type == 'service') ...[
            const SizedBox(height: 6),
            _LineStaffChip(
              staff: widget.staff,
              selectedId: ref.watch(posCartMetaProvider).lineStaff[item.key],
              ticketStaffId: ref.watch(posCartMetaProvider).staffId,
              onChanged: (id) {
                final current = ref.read(posCartMetaProvider);
                final next = Map<String, String>.from(current.lineStaff);
                if (id == null || id.isEmpty) {
                  next.remove(item.key);
                } else {
                  next[item.key] = id;
                }
                ref.read(posCartMetaProvider.notifier).state = PosCartMeta(
                  clientId: current.clientId,
                  clientName: current.clientName,
                  staffId: current.staffId,
                  appointmentId: current.appointmentId,
                  lineStaff: next,
                  discountKind: current.discountKind,
                  discountValue: current.discountValue,
                  discountReason: current.discountReason,
                  cartDiscountCents: current.cartDiscountCents,
                  notes: current.notes,
                );
                ref.read(posCartSessionProvider.notifier).scheduleSave();
              },
            ),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              if (widget.overridden &&
                  widget.item.priceCents > widget.unitCents) ...[
                Text(
                  '−${formatEuros(widget.item.priceCents - widget.unitCents)} / unité',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6D28D9),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              GestureDetector(
                onTap: () =>
                    setState(() => _showLineDiscount = !_showLineDiscount),
                child: Text(
                  _showLineDiscount ? 'Fermer' : 'Réduc. article',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0A0A0A),
                    decoration: TextDecoration.underline,
                    decorationStyle: TextDecorationStyle.dotted,
                  ),
                ),
              ),
            ],
          ),
          if (_showLineDiscount) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                SizedBox(
                  width: 92,
                  child: _MiniSegmented(
                    items: const [
                      (id: 'percent', label: '%'),
                      (id: 'fixed', label: '€'),
                    ],
                    selected: _lineDiscountKind,
                    onSelected: (value) =>
                        setState(() => _lineDiscountKind = value),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _lineDiscount,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    textInputAction: TextInputAction.done,
                    onTapOutside: (_) =>
                        FocusManager.instance.primaryFocus?.unfocus(),
                    decoration: _cartFieldDecoration(
                      hint: _lineDiscountKind == 'percent' ? '10' : '5,00',
                    ),
                    onSubmitted: (_) => _applyLineDiscount(),
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: _applyLineDiscount,
                  child: const Text('OK'),
                ),
              ],
            ),
          ],
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

class _CartAddLine extends StatelessWidget {
  const _CartAddLine({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Icon(icon, size: 18, color: const Color(0xFF0A0A0A)),
            const SizedBox(width: 10),
            Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0A0A0A),
              ),
            ),
            const Spacer(),
            const Icon(
              Icons.chevron_right,
              size: 18,
              color: Color(0xFFA3A3A3),
            ),
          ],
        ),
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
            textInputAction: TextInputAction.done,
            onEditingComplete: () =>
                FocusManager.instance.primaryFocus?.unfocus(),
            onTapOutside: (_) =>
                FocusManager.instance.primaryFocus?.unfocus(),
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

class _LineStaffChip extends StatelessWidget {
  const _LineStaffChip({
    required this.staff,
    required this.onChanged,
    this.selectedId,
    this.ticketStaffId,
  });

  final List<PosOption> staff;
  final String? selectedId;
  final String? ticketStaffId;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final resolved = selectedId ?? ticketStaffId;
    final label = staff.where((s) => s.id == resolved).firstOrNull?.label ??
        'Comme le ticket';
    return Align(
      alignment: Alignment.centerLeft,
      child: InkWell(
        onTap: () async {
          final picked = await showSearchablePicker(
            context: context,
            title: 'Praticienne de la ligne',
            items: staff.map((s) => PickerItem(id: s.id, title: s.label)).toList(),
            selectedId: resolved,
            searchHint: 'Rechercher…',
            nullOption: const PickerItem(
              id: '__inherit__',
              title: 'Comme le ticket',
            ),
            emptyMessage: 'Aucune praticienne.',
          );
          if (picked == null) return;
          onChanged(picked.id == '__inherit__' ? null : picked.id);
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(
            'Praticienne · $label',
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF525252),
              fontWeight: FontWeight.w600,
            ),
          ),
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
