import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _tenantPrefKey = 'beautyhub.selected_tenant_id';

final bootstrapProvider = Provider<MobileBootstrap>((ref) {
  throw UnimplementedError('bootstrapProvider must be overridden');
});

final mobileApiProvider = Provider<MobileApiClient>((ref) {
  final bootstrap = ref.watch(bootstrapProvider);
  final client = MobileApiClient(
    baseUrl: bootstrap.api.baseUrl,
    bundleId: 'app.beautyhub.pro',
  );
  ref.onDispose(client.close);
  return client;
});

final authStateProvider = StreamProvider<AuthState>((ref) {
  return Supabase.instance.client.auth.onAuthStateChange;
});

final accessTokenProvider = Provider<String?>((ref) {
  ref.watch(authStateProvider);
  return Supabase.instance.client.auth.currentSession?.accessToken;
});

final selectedTenantIdProvider =
    StateNotifierProvider<SelectedTenantNotifier, String?>((ref) {
  return SelectedTenantNotifier();
});

class SelectedTenantNotifier extends StateNotifier<String?> {
  SelectedTenantNotifier() : super(null) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getString(_tenantPrefKey);
  }

  Future<void> select(String? tenantId) async {
    state = tenantId;
    final prefs = await SharedPreferences.getInstance();
    if (tenantId == null || tenantId.isEmpty) {
      await prefs.remove(_tenantPrefKey);
    } else {
      await prefs.setString(_tenantPrefKey, tenantId);
    }
  }
}

final tenantsProvider = FutureProvider<List<TenantOption>>((ref) async {
  final token = ref.watch(accessTokenProvider);
  if (token == null) return const [];
  final api = ref.watch(mobileApiProvider);
  return api.fetchTenants(token);
});

final cashInitialTabProvider = StateProvider<int>((ref) => 1);

final selectedAgendaDateProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
});

final selectedStaffFilterProvider = StateProvider<String?>((ref) => null);

final dashboardSalesChannelProvider = StateProvider<String>((ref) => 'all');

final dashboardProvider =
    FutureProvider.autoDispose<MobileDashboard>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  final channel = ref.watch(dashboardSalesChannelProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchDashboard(
    accessToken: token,
    tenantId: tenantId,
    channel: channel,
  );
});

final tenantBrandingProvider =
    FutureProvider.autoDispose<TenantBranding>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchTenantBranding(accessToken: token, tenantId: tenantId);
});

final todayAgendaProvider = FutureProvider.autoDispose<DayAgenda>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchDay(
    accessToken: token,
    tenantId: tenantId,
    includeWeek: false,
  );
});

final dayAgendaProvider = FutureProvider.autoDispose<DayAgenda>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  final selectedDate = ref.watch(selectedAgendaDateProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  final date =
      '${selectedDate.year.toString().padLeft(4, '0')}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}';
  return api.fetchDay(
    accessToken: token,
    tenantId: tenantId,
    date: date,
    includeWeek: true,
  );
});

final cashSessionProvider =
    FutureProvider.autoDispose<CashSessionSummary?>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) return null;
  final api = ref.watch(mobileApiProvider);
  return api.fetchCashSession(accessToken: token, tenantId: tenantId);
});

final posContextProvider = FutureProvider.autoDispose<PosContext>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchPosContext(accessToken: token, tenantId: tenantId);
});

final institutTeamProvider =
    FutureProvider.autoDispose<List<InstStaffMember>>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchInstitutTeam(accessToken: token, tenantId: tenantId);
});

final institutTenantInfoProvider =
    FutureProvider.autoDispose<InstTenantInfo>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchInstitutTenant(accessToken: token, tenantId: tenantId);
});

/// Page 0 des ventes (les autres pages sont chargées manuellement via l'API).
final institutSalesFirstPageProvider =
    FutureProvider.autoDispose<InstSalePage>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchInstitutSales(accessToken: token, tenantId: tenantId);
});

Future<void> openInstitutCashDay(
  WidgetRef ref, {
  int openingFloatCents = 0,
}) async {
  final token = ref.read(accessTokenProvider);
  final tenantId = ref.read(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  await ref.read(mobileApiProvider).openCashSession(
        accessToken: token,
        tenantId: tenantId,
        openingFloatCents: openingFloatCents,
      );
  ref.invalidate(cashSessionProvider);
  ref.invalidate(posContextProvider);
}
