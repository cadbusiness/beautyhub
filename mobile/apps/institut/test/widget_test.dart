import 'package:beautyhub_institut/features/auth/login_screen.dart';
import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:beautyhub_institut/state/session_providers.dart';

void main() {
  testWidgets('LoginScreen affiche le titre app', (tester) async {
    const bootstrap = MobileBootstrap(
      appId: '00000000-0000-4000-8000-000000000001',
      audience: 'institut',
      scopeType: 'brand',
      appName: 'BeautyHub Pro',
      appSlug: 'beautyhub-pro',
      deepLinkScheme: 'beautyhub-pro',
      branding: MobileBranding(primaryColor: '#0f172a'),
      brand: MobileBrand(
        id: '00000000-0000-4000-8000-000000000002',
        name: 'BeautyHub',
        slug: 'beautyhub',
      ),
      tenant: null,
      api: MobileApiConfig(
        baseUrl: 'https://example.com',
        supabaseUrl: 'https://xyz.supabase.co',
        supabaseAnonKey: 'anon',
      ),
      features: MobileFeatures(modules: ['institut']),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          bootstrapProvider.overrideWithValue(bootstrap),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );

    expect(find.text('BeautyHub Pro'), findsOneWidget);
    expect(find.text('Se connecter'), findsOneWidget);
  });
}
