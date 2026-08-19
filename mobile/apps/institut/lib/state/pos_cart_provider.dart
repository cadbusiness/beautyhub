import 'dart:async';

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_providers.dart';

class PosCartNotifier extends StateNotifier<Map<String, int>> {
  PosCartNotifier() : super(const {});

  void add(String key) {
    state = {...state, key: (state[key] ?? 0) + 1};
  }

  void removeOne(String key) {
    final qty = (state[key] ?? 0) - 1;
    if (qty <= 0) {
      final next = Map<String, int>.from(state)..remove(key);
      state = next;
    } else {
      state = {...state, key: qty};
    }
  }

  void remove(String key) {
    if (!state.containsKey(key)) return;
    final next = Map<String, int>.from(state)..remove(key);
    state = next;
  }

  void clear() => state = const {};

  void replace(Map<String, int> next) {
    state = {
      for (final entry in next.entries)
        if (entry.value > 0) entry.key: entry.value,
    };
  }

  int get totalItems => state.values.fold(0, (a, b) => a + b);
}

class PosPriceOverridesNotifier extends StateNotifier<Map<String, int>> {
  PosPriceOverridesNotifier() : super(const {});

  void setPrice(String key, int cents) {
    if (cents < 0) return;
    state = {...state, key: cents};
  }

  void reset(String key) {
    if (!state.containsKey(key)) return;
    final next = Map<String, int>.from(state)..remove(key);
    state = next;
  }

  void retainKeys(Iterable<String> keys) {
    final keep = keys.toSet();
    final next = {
      for (final entry in state.entries)
        if (keep.contains(entry.key)) entry.key: entry.value,
    };
    if (next.length != state.length) state = next;
  }

  void clear() => state = const {};

  void replace(Map<String, int> next) {
    state = {
      for (final entry in next.entries)
        if (entry.value >= 0) entry.key: entry.value,
    };
  }
}

final posCartProvider =
    StateNotifierProvider<PosCartNotifier, Map<String, int>>((ref) {
  return PosCartNotifier();
});

final posPriceOverridesProvider =
    StateNotifierProvider<PosPriceOverridesNotifier, Map<String, int>>((ref) {
  return PosPriceOverridesNotifier();
});

void clearPosCart(WidgetRef ref) {
  ref.read(posCartProvider.notifier).clear();
  ref.read(posPriceOverridesProvider.notifier).clear();
}

const customPosDefaultName = 'Encaissement libre';

bool isCustomPosKey(String key) => key.startsWith('custom:');

String customPosLineName(String key) {
  if (!isCustomPosKey(key)) return customPosDefaultName;
  final rest = key.substring('custom:'.length);
  final sep = rest.indexOf(':');
  if (sep < 0) return customPosDefaultName;
  final raw = rest.substring(sep + 1);
  if (raw.isEmpty) return customPosDefaultName;
  return Uri.decodeComponent(raw).trim().isEmpty
      ? customPosDefaultName
      : Uri.decodeComponent(raw).trim();
}

String createCustomPosKey([String? name]) {
  final trimmed = name?.trim() ?? '';
  final raw = trimmed.isEmpty ? customPosDefaultName : trimmed;
  final label = raw.length > 80 ? raw.substring(0, 80) : raw;
  final id = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
  return 'custom:$id:${Uri.encodeComponent(label)}';
}

PosCatalogItem customPosCatalogItem(String key, int priceCents) {
  return PosCatalogItem(
    key: key,
    type: 'service',
    id: key,
    name: customPosLineName(key),
    priceCents: priceCents,
    category: 'custom',
  );
}

List<PosCatalogItem> mergeCustomCatalogItems({
  required List<PosCatalogItem> current,
  required Map<String, int> lines,
  required Map<String, int> overrides,
}) {
  final extras = [
    for (final key in lines.keys)
      if (isCustomPosKey(key)) customPosCatalogItem(key, overrides[key] ?? 0),
  ];
  final kept = current
      .where((item) => !isCustomPosKey(item.key) || lines.containsKey(item.key))
      .toList();
  final existing = {for (final item in kept) item.key};
  return [
    ...kept,
    ...extras.where((item) => !existing.contains(item.key)),
  ];
}

Map<String, int> activePriceOverrides({
  required Map<String, int> cart,
  required Map<String, int> overrides,
  required int Function(String key) catalogPriceCents,
}) {
  final out = <String, int>{};
  for (final entry in overrides.entries) {
    if (!cart.containsKey(entry.key)) continue;
    if (entry.value == catalogPriceCents(entry.key) &&
        !isCustomPosKey(entry.key)) {
      continue;
    }
    if (entry.value < 0) continue;
    out[entry.key] = entry.value;
  }
  return out;
}

int discountedUnitCents({
  required int catalogCents,
  required String kind,
  required double value,
}) {
  if (catalogCents <= 0 || value <= 0) return catalogCents < 0 ? 0 : catalogCents;
  if (kind == 'percent') {
    final pct = value > 100 ? 100.0 : value;
    final next = (catalogCents * (1 - pct / 100)).round();
    return next < 0 ? 0 : next;
  }
  final off = (value * 100).round();
  final next = catalogCents - off;
  return next < 0 ? 0 : next;
}

int cartLineUnitCents({
  required String key,
  required int catalogCents,
  required Map<String, int> overrides,
}) {
  return overrides[key] ?? catalogCents;
}

int cartTotalCents({
  required Map<String, int> cart,
  required Map<String, int> overrides,
  required int Function(String key) catalogPriceCents,
}) {
  var total = 0;
  for (final entry in cart.entries) {
    total +=
        cartLineUnitCents(
          key: entry.key,
          catalogCents: catalogPriceCents(entry.key),
          overrides: overrides,
        ) *
        entry.value;
  }
  return total;
}

final posCategoryFilterProvider = StateProvider<String>((ref) => 'all');

final posCatalogFacetProvider = StateProvider<String>((ref) => 'all');

final posCatalogQueryProvider = StateProvider<String>((ref) => '');

class PosAppointmentPrefill {
  const PosAppointmentPrefill({
    required this.appointmentId,
    required this.serviceName,
    this.clientId,
    this.clientName,
    this.staffId,
    this.staffName,
    this.serviceId,
    this.priceCents,
    this.extras = const [],
  });

  final String appointmentId;
  final String? clientId;
  final String? clientName;
  final String? staffId;
  final String? staffName;
  final String? serviceId;
  final String serviceName;
  final int? priceCents;
  final List<AppointmentExtra> extras;

  factory PosAppointmentPrefill.fromAppointment(DayAppointment appointment) {
    return PosAppointmentPrefill(
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      staffId: appointment.staffId,
      staffName: appointment.staffName,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      priceCents: appointment.priceCents,
      extras: appointment.extras,
    );
  }
}

final pendingPosPrefillProvider =
    StateProvider<PosAppointmentPrefill?>((ref) => null);

final posInjectedCatalogProvider =
    StateProvider<List<PosCatalogItem>>((ref) => const []);

void startAppointmentCheckout(
  WidgetRef ref,
  DayAppointment appointment,
) {
  ref.read(pendingPosPrefillProvider.notifier).state =
      PosAppointmentPrefill.fromAppointment(appointment);
  ref.read(cashInitialTabProvider.notifier).state = 1;
}

final posCheckoutBusyProvider = StateProvider<bool>((ref) => false);

class PosCartMeta {
  const PosCartMeta({
    this.clientId,
    this.clientName,
    this.staffId,
    this.appointmentId,
    this.discountKind,
    this.discountValue,
    this.discountReason,
    this.cartDiscountCents = 0,
    this.notes,
  });

  final String? clientId;
  final String? clientName;
  final String? staffId;
  final String? appointmentId;
  final String? discountKind;
  final double? discountValue;
  final String? discountReason;
  final int cartDiscountCents;
  final String? notes;
}

final posCartMetaProvider = StateProvider<PosCartMeta>(
  (ref) => const PosCartMeta(),
);

class PosCartSessionState {
  const PosCartSessionState({
    this.carts = const [],
    this.activeCartId,
    this.loading = false,
    this.hydrateSeq = 0,
    this.error,
  });

  final List<PosCartSnapshot> carts;
  final String? activeCartId;
  final bool loading;
  final int hydrateSeq;
  final String? error;

  PosCartSnapshot? get active {
    for (final cart in carts) {
      if (cart.id == activeCartId) return cart;
    }
    return null;
  }

  PosCartSessionState copyWith({
    List<PosCartSnapshot>? carts,
    String? activeCartId,
    bool? loading,
    int? hydrateSeq,
    String? error,
    bool clearError = false,
  }) {
    return PosCartSessionState(
      carts: carts ?? this.carts,
      activeCartId: activeCartId ?? this.activeCartId,
      loading: loading ?? this.loading,
      hydrateSeq: hydrateSeq ?? this.hydrateSeq,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class PosCartSessionNotifier extends StateNotifier<PosCartSessionState> {
  PosCartSessionNotifier(this._ref) : super(const PosCartSessionState());

  final Ref _ref;
  Timer? _debounce;
  bool _hydrating = false;
  bool _ensured = false;

  ({String token, String tenantId})? get _auth {
    final token = _ref.read(accessTokenProvider);
    final tenantId = _ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return null;
    return (token: token, tenantId: tenantId);
  }

  MobileApiClient get _api => _ref.read(mobileApiProvider);

  Map<String, dynamic> _writePayload() {
    final meta = _ref.read(posCartMetaProvider);
    return {
      'lines': _ref.read(posCartProvider),
      'priceOverrides': _ref.read(posPriceOverridesProvider),
      'clientId': meta.clientId,
      'staffId': meta.staffId,
      'appointmentId': meta.appointmentId,
      if (meta.discountKind != null) 'discountKind': meta.discountKind,
      'discountValue': meta.discountValue,
      'discountReason': meta.discountReason,
      'cartDiscountCents': meta.cartDiscountCents,
      'notes': meta.notes,
    };
  }

  void _applySnapshot(List<PosCartSnapshot> carts, PosCartSnapshot active) {
    _hydrating = true;
    _ref.read(posCartProvider.notifier).replace(active.lines);
    _ref.read(posPriceOverridesProvider.notifier).replace(active.priceOverrides);
    _ref.read(posInjectedCatalogProvider.notifier).state =
        mergeCustomCatalogItems(
      current: _ref.read(posInjectedCatalogProvider),
      lines: active.lines,
      overrides: active.priceOverrides,
    );
    state = state.copyWith(
      carts: carts,
      activeCartId: active.id,
      loading: false,
      hydrateSeq: state.hydrateSeq + 1,
      clearError: true,
    );
    _hydrating = false;
  }

  Future<void> ensure({bool force = false}) async {
    if (_ensured && !force) return;
    final auth = _auth;
    if (auth == null) return;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final result = await _api.ensurePosCarts(
        accessToken: auth.token,
        tenantId: auth.tenantId,
      );
      _ensured = true;
      _applySnapshot(result.carts, result.active);
    } catch (e) {
      state = state.copyWith(loading: false, error: '$e');
    }
  }

  void scheduleSave() {
    if (_hydrating) return;
    if (state.active?.lockedByOther == true) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      unawaited(flushSave());
    });
  }

  Future<void> flushSave({bool force = false}) async {
    _debounce?.cancel();
    if (_hydrating) return;
    final auth = _auth;
    final id = state.activeCartId;
    if (auth == null || id == null) return;
    if (state.active?.lockedByOther == true && !force) return;
    try {
      final cart = await _api.updatePosCart(
        accessToken: auth.token,
        tenantId: auth.tenantId,
        cartId: id,
        payload: _writePayload(),
        force: force,
      );
      final carts = [
        for (final existing in state.carts)
          if (existing.id == cart.id) cart else existing,
      ];
      if (!carts.any((c) => c.id == cart.id)) carts.add(cart);
      state = state.copyWith(carts: carts, activeCartId: cart.id);
    } on MobileApiException catch (e) {
      state = state.copyWith(error: e.message);
    }
  }

  Future<void> createEmpty() async {
    final auth = _auth;
    if (auth == null) return;
    await flushSave();
    final current = _ref.read(posCartProvider);
    if (current.isEmpty && (state.active?.itemCount ?? 0) == 0) return;
    try {
      final cart = await _api.createPosCart(
        accessToken: auth.token,
        tenantId: auth.tenantId,
      );
      final carts = await _api.listPosCarts(
        accessToken: auth.token,
        tenantId: auth.tenantId,
      );
      _applySnapshot(carts, cart);
    } catch (e) {
      state = state.copyWith(error: '$e');
      rethrow;
    }
  }

  Future<void> switchTo(String cartId, {bool force = false}) async {
    final auth = _auth;
    if (auth == null || cartId == state.activeCartId) return;
    await flushSave();
    try {
      final cart = await _api.claimPosCart(
        accessToken: auth.token,
        tenantId: auth.tenantId,
        cartId: cartId,
        force: force,
      );
      final carts = await _api.listPosCarts(
        accessToken: auth.token,
        tenantId: auth.tenantId,
      );
      _applySnapshot(carts, cart);
    } catch (e) {
      state = state.copyWith(error: '$e');
      rethrow;
    }
  }

  Future<void> abandon(String cartId, {bool force = false}) async {
    final auth = _auth;
    if (auth == null) return;
    try {
      await _api.abandonPosCart(
        accessToken: auth.token,
        tenantId: auth.tenantId,
        cartId: cartId,
        force: force,
      );
      _ensured = false;
      await ensure(force: true);
    } catch (e) {
      state = state.copyWith(error: '$e');
      rethrow;
    }
  }

  Future<void> afterCheckout() async {
    _debounce?.cancel();
    _hydrating = true;
    _ref.read(posCartProvider.notifier).clear();
    _ref.read(posPriceOverridesProvider.notifier).clear();
    _ref.read(posInjectedCatalogProvider.notifier).state = const [];
    _ref.read(posCartMetaProvider.notifier).state = const PosCartMeta();
    _hydrating = false;
    _ensured = false;
    await ensure(force: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}

final posCartSessionProvider =
    StateNotifierProvider<PosCartSessionNotifier, PosCartSessionState>((ref) {
  return PosCartSessionNotifier(ref);
});
