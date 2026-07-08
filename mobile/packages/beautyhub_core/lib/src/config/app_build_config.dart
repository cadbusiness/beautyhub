/// Configuration injectée au build (marque blanche).
///
/// Exemple :
/// ```bash
/// flutter run --dart-define-from-file=../../flavors/beautyhub_pro.json
/// ```
class AppBuildConfig {
  const AppBuildConfig({
    required this.bundleId,
    required this.bootstrapBaseUrl,
    required this.audience,
  });

  final String bundleId;
  final String bootstrapBaseUrl;
  final MobileAudience audience;

  static const _bundleIdKey = 'BUNDLE_ID';
  static const _bootstrapUrlKey = 'BOOTSTRAP_BASE_URL';
  static const _audienceKey = 'APP_AUDIENCE';

  /// Valeurs par défaut dev — surchargeables via `--dart-define` ou `--dart-define-from-file`.
  factory AppBuildConfig.fromEnvironment({
    required String defaultBundleId,
    required MobileAudience defaultAudience,
    String defaultBootstrapBaseUrl = 'http://localhost:3000',
  }) {
    final bundleId = const String.fromEnvironment(_bundleIdKey).isEmpty
        ? defaultBundleId
        : const String.fromEnvironment(_bundleIdKey);
    final bootstrapBaseUrl = const String.fromEnvironment(_bootstrapUrlKey).isEmpty
        ? defaultBootstrapBaseUrl
        : const String.fromEnvironment(_bootstrapUrlKey);
    final audienceRaw = const String.fromEnvironment(_audienceKey).isEmpty
        ? defaultAudience.apiValue
        : const String.fromEnvironment(_audienceKey);

    return AppBuildConfig(
      bundleId: bundleId,
      bootstrapBaseUrl: bootstrapBaseUrl,
      audience: MobileAudience.fromString(audienceRaw),
    );
  }
}

enum MobileAudience {
  institut,
  client;

  static MobileAudience fromString(String raw) {
    switch (raw) {
      case 'client':
        return MobileAudience.client;
      case 'institut':
      default:
        return MobileAudience.institut;
    }
  }

  String get apiValue => name;
}
