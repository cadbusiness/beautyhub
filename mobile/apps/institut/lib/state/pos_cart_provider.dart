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

Map<String, int> activePriceOverrides({
  required Map<String, int> cart,
  required Map<String, int> overrides,
  required int Function(String key) catalogPriceCents,
}) {
  final out = <String, int>{};
  for (final entry in overrides.entries) {
    if (!cart.containsKey(entry.key)) continue;
    if (entry.value == catalogPriceCents(entry.key)) continue;
    if (entry.value < 0) continue;
    out[entry.key] = entry.value;
  }
  return out;
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
