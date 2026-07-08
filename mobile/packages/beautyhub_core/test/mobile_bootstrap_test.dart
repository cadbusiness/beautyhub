import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('MobileBootstrap parse minimal payload', () {
    final bootstrap = MobileBootstrap.fromJson({
      'appId': '00000000-0000-4000-8000-000000000001',
      'audience': 'institut',
      'scopeType': 'brand',
      'appName': 'BeautyHub Pro',
      'appSlug': 'beautyhub-pro',
      'deepLinkScheme': 'beautyhub-pro',
      'branding': {'primaryColor': '#0f172a'},
      'brand': {
        'id': '00000000-0000-4000-8000-000000000002',
        'name': 'BeautyHub',
        'slug': 'beautyhub',
      },
      'tenant': null,
      'api': {
        'baseUrl': 'https://example.com',
        'supabaseUrl': 'https://xyz.supabase.co',
        'supabaseAnonKey': 'anon',
      },
      'features': {'modules': ['institut']},
    });

    expect(bootstrap.appName, 'BeautyHub Pro');
    expect(bootstrap.branding.primaryColor, '#0f172a');
    expect(bootstrap.features.modules, ['institut']);
  });
}
