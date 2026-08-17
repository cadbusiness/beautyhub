import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_theme.dart';
import 'features/agenda/agenda_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/cash/cash_screen.dart';
import 'features/clients/clients_screen.dart';
import 'features/home/home_screen.dart';
import 'features/institut/institut_screen.dart';
import 'features/loyalty/loyalty_screen.dart';
import 'features/more/more_screen.dart';
import 'features/shell/institut_shell.dart';
import 'features/team/team_screen.dart';
import 'features/tenant/tenant_picker_screen.dart';
import 'state/session_providers.dart';

class InstitutApp extends StatelessWidget {
  const InstitutApp({
    super.key,
    required this.bootstrap,
    required this.bundleId,
  });

  final MobileBootstrap bootstrap;
  final String bundleId;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        bootstrapProvider.overrideWithValue(bootstrap),
        mobileApiProvider.overrideWith((ref) {
          final client = MobileApiClient(
            baseUrl: bootstrap.api.baseUrl,
            bundleId: bundleId,
          );
          ref.onDispose(client.close);
          return client;
        }),
      ],
      child: const _InstitutRouterApp(),
    );
  }
}

class _InstitutRouterApp extends ConsumerStatefulWidget {
  const _InstitutRouterApp();

  @override
  ConsumerState<_InstitutRouterApp> createState() => _InstitutRouterAppState();
}

class _InstitutRouterAppState extends ConsumerState<_InstitutRouterApp> {
  late final GoRouter _router;
  late final _RouterRefresh _refresh;

  @override
  void initState() {
    super.initState();
    _refresh = _RouterRefresh();
    Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      _refresh.ping();
    });

    _router = GoRouter(
      initialLocation: '/splash',
      refreshListenable: _refresh,
      redirect: (context, state) {
        final session = Supabase.instance.client.auth.currentSession;
        final loc = state.matchedLocation;
        final loggingIn = loc == '/login';
        final picking = loc == '/tenants';
        final splash = loc == '/splash';

        if (session == null) {
          return loggingIn ? null : '/login';
        }

        // Auth OK: splash decides tenant, other routes need tenant.
        if (splash || picking) return null;
        if (loggingIn) return '/splash';

        final tenantId = ProviderScope.containerOf(context)
            .read(selectedTenantIdProvider);
        if (tenantId == null || tenantId.isEmpty) {
          return '/splash';
        }
        return null;
      },
      routes: [
        GoRoute(
          path: '/splash',
          builder: (_, _) => _SplashScreen(onReady: _refresh.ping),
        ),
        GoRoute(
          path: '/login',
          builder: (_, _) => const LoginScreen(),
        ),
        GoRoute(
          path: '/tenants',
          builder: (_, _) => const TenantPickerScreen(),
        ),
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            return InstitutShell(navigationShell: navigationShell);
          },
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/app',
                  builder: (_, _) => const HomeScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/app/agenda',
                  builder: (_, _) => const AgendaScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/app/cash',
                  builder: (_, _) => const CashScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/app/more',
                  builder: (_, _) => const MoreScreen(),
                  routes: [
                    GoRoute(
                      path: 'clients',
                      builder: (_, _) => const ClientsScreen(),
                    ),
                    GoRoute(
                      path: 'loyalty',
                      builder: (_, _) => const LoyaltyScreen(),
                    ),
                    GoRoute(
                      path: 'team',
                      builder: (_, _) => const TeamScreen(),
                    ),
                    GoRoute(
                      path: 'institut',
                      builder: (_, _) => const InstitutScreen(),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(bootstrapProvider);
    // Rebuild router redirects when tenant selection changes.
    ref.listen(selectedTenantIdProvider, (_, _) => _refresh.ping());
    ref.listen(tenantsProvider, (_, _) => _refresh.ping());

    return MaterialApp.router(
      title: bootstrap.appName,
      theme: institutAppTheme(bootstrap.branding),
      routerConfig: _router,
    );
  }
}

class _SplashScreen extends ConsumerStatefulWidget {
  const _SplashScreen({required this.onReady});

  final VoidCallback onReady;

  @override
  ConsumerState<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<_SplashScreen> {
  @override
  Widget build(BuildContext context) {
    final tenantsAsync = ref.watch(tenantsProvider);
    final selected = ref.watch(selectedTenantIdProvider);

    ref.listen(tenantsProvider, (prev, next) async {
      next.whenData((tenants) async {
        if (tenants.isEmpty) {
          if (context.mounted) context.go('/tenants');
          return;
        }
        final valid =
            selected != null && tenants.any((t) => t.id == selected);
        if (valid) {
          if (context.mounted) context.go('/app');
          return;
        }
        if (tenants.length == 1) {
          await ref
              .read(selectedTenantIdProvider.notifier)
              .select(tenants.first.id);
          if (context.mounted) context.go('/app');
          return;
        }
        if (context.mounted) context.go('/tenants');
      });
    });

    if (tenantsAsync.hasValue) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final tenants = tenantsAsync.requireValue;
        if (tenants.isEmpty) {
          context.go('/tenants');
          return;
        }
        final valid =
            selected != null && tenants.any((t) => t.id == selected);
        if (valid) {
          context.go('/app');
        } else if (tenants.length == 1) {
          ref
              .read(selectedTenantIdProvider.notifier)
              .select(tenants.first.id)
              .then((_) {
            if (context.mounted) context.go('/app');
          });
        } else {
          context.go('/tenants');
        }
      });
    }

    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

class _RouterRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}
