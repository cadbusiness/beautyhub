import 'package:beautyhub_client/home_screen.dart';
import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ClientHomeScreen affiche le CTA réservation', (tester) async {
    const bootstrap = MobileBootstrap(
      appId: '00000000-0000-4000-8000-000000000001',
      audience: 'client',
      scopeType: 'tenant',
      appName: 'BeautyHub',
      appSlug: 'beautyhub-client',
      deepLinkScheme: 'beautyhub-client',
      branding: MobileBranding(primaryColor: '#0f172a'),
      brand: MobileBrand(
        id: '00000000-0000-4000-8000-000000000002',
        name: 'BeautyHub',
        slug: 'beautyhub',
      ),
      tenant: MobileTenant(
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Institut Demo',
        slug: 'demo',
      ),
      api: MobileApiConfig(
        baseUrl: 'https://example.com',
        supabaseUrl: 'https://xyz.supabase.co',
        supabaseAnonKey: 'anon',
      ),
      features: MobileFeatures(modules: ['institut']),
    );

    await tester.pumpWidget(
      MaterialApp(home: ClientHomeScreen(bootstrap: bootstrap)),
    );

    expect(find.text('Institut Demo'), findsOneWidget);
    expect(find.text('Prendre rendez-vous'), findsOneWidget);
  });
}
