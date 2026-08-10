import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/mobile_bootstrap.dart';

/// Initialise Supabase une seule fois à partir du bootstrap marque blanche.
class SupabaseBootstrap {
  static bool _initialized = false;

  static bool get isInitialized => _initialized;

  static Future<void> ensureInitialized(MobileApiConfig api) async {
    if (_initialized) return;
    await Supabase.initialize(
      url: api.supabaseUrl,
      anonKey: api.supabaseAnonKey,
    );
    _initialized = true;
  }

  static SupabaseClient get client => Supabase.instance.client;
}
