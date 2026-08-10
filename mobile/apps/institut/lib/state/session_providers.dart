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

final dayAgendaProvider = FutureProvider.autoDispose<DayAgenda>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  final api = ref.watch(mobileApiProvider);
  return api.fetchDay(accessToken: token, tenantId: tenantId);
});

final cashSessionProvider =
    FutureProvider.autoDispose<CashSessionSummary?>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) return null;
  final api = ref.watch(mobileApiProvider);
  return api.fetchCashSession(accessToken: token, tenantId: tenantId);
});
