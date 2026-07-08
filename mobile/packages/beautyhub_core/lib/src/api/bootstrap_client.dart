import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_build_config.dart';
import '../models/mobile_bootstrap.dart';

class BootstrapClient {
  BootstrapClient({http.Client? httpClient}) : _http = httpClient ?? http.Client();

  final http.Client _http;

  static const bundleIdHeader = 'x-beautyhub-bundle-id';
  static const appVersionHeader = 'x-beautyhub-app-version';
  static const platformHeader = 'x-beautyhub-platform';

  Future<MobileBootstrap> fetch(AppBuildConfig config, {String? appVersion}) async {
    final uri = Uri.parse('${config.bootstrapBaseUrl}/api/mobile/bootstrap');
    final response = await _http.get(
      uri,
      headers: {
        bundleIdHeader: config.bundleId,
        if (appVersion != null) appVersionHeader: appVersion,
        platformHeader: _platformLabel(),
      },
    );

    if (response.statusCode == 404) {
      throw BootstrapException(
        'App introuvable pour le bundle id « ${config.bundleId} ».',
        code: 'app_not_found',
      );
    }
    if (response.statusCode != 200) {
      throw BootstrapException(
        'Bootstrap échoué (${response.statusCode}).',
        code: 'bootstrap_failed',
      );
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final bootstrap = MobileBootstrap.fromJson(json);

    if (bootstrap.audience != config.audience.apiValue) {
      throw BootstrapException(
        'Audience incompatible : attendu ${config.audience.apiValue}, '
        'reçu ${bootstrap.audience}.',
        code: 'audience_mismatch',
      );
    }

    return bootstrap;
  }

  String _platformLabel() {
    // dart:io Platform is not available on web; mobile targets only for now.
    return 'flutter';
  }

  void close() => _http.close();
}

class BootstrapException implements Exception {
  BootstrapException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}
