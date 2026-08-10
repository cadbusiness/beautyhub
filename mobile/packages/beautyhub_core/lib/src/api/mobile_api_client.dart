import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/ops_models.dart';

class MobileApiException implements Exception {
  MobileApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}

/// Client HTTP authentifié pour les routes `/api/mobile/*`.
class MobileApiClient {
  MobileApiClient({
    required this.baseUrl,
    required this.bundleId,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  final String baseUrl;
  final String bundleId;
  final http.Client _http;

  static const tenantIdHeader = 'x-tenant-id';
  static const bundleIdHeader = 'x-beautyhub-bundle-id';

  Map<String, String> _headers({
    required String accessToken,
    String? tenantId,
  }) {
    return {
      'Authorization': 'Bearer $accessToken',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      bundleIdHeader: bundleId,
      if (tenantId != null && tenantId.isNotEmpty) tenantIdHeader: tenantId,
    };
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final normalized = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$normalized').replace(queryParameters: query);
  }

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    Map<String, dynamic> body = const {};
    if (response.body.isNotEmpty) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        body = decoded;
      } else if (decoded is Map) {
        body = Map<String, dynamic>.from(decoded);
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MobileApiException(
        body['message'] as String? ??
            body['error'] as String? ??
            'Erreur API (${response.statusCode})',
        statusCode: response.statusCode,
        code: body['error'] as String?,
      );
    }
    return body;
  }

  Future<List<TenantOption>> fetchTenants(String accessToken) async {
    final response = await _http.get(
      _uri('/api/mobile/me/tenants'),
      headers: _headers(accessToken: accessToken),
    );
    final body = await _decode(response);
    final list = body['tenants'] as List? ?? const [];
    return list
        .whereType<Map>()
        .map((e) => TenantOption.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<DayAgenda> fetchDay({
    required String accessToken,
    required String tenantId,
    String? date,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/day', {
        if (date != null && date.isNotEmpty) 'date': date,
      }),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return DayAgenda.fromJson(body);
  }

  Future<CashSessionSummary?> fetchCashSession({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/cash-session'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    final raw = body['session'];
    if (raw is! Map) return null;
    return CashSessionSummary.fromJson(Map<String, dynamic>.from(raw));
  }

  Future<CashSessionSummary?> openCashSession({
    required String accessToken,
    required String tenantId,
    int openingFloatCents = 0,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/cash-session/open'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({'openingFloatCents': openingFloatCents}),
    );
    final body = await _decode(response);
    final raw = body['session'];
    if (raw is! Map) return null;
    return CashSessionSummary.fromJson(Map<String, dynamic>.from(raw));
  }

  void close() => _http.close();
}
