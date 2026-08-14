import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models/ops_models.dart';
import '../models/pos_models.dart';

class MobileApiException implements Exception {
  MobileApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}

/// Credentials retournés quand on créé un compte cliente à la volée.
class ClientAccountCredentials {
  const ClientAccountCredentials({required this.loginId, required this.pinCode});

  final String loginId;
  final String pinCode;
}

/// Résultat de la création d'une cliente depuis le mobile.
class CreatedClientResult {
  const CreatedClientResult({required this.option, this.account});

  final PosOption option;
  final ClientAccountCredentials? account;
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

  Future<MobileDashboard> fetchDashboard({
    required String accessToken,
    required String tenantId,
    String channel = 'all',
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/dashboard', {'channel': channel}),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return MobileDashboard.fromJson(body);
  }

  Future<TenantBranding> fetchTenantBranding({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/branding'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return TenantBranding.fromJson(body);
  }

  Future<String> uploadTenantLogo({
    required String accessToken,
    required String tenantId,
    required Uint8List bytes,
    required String filename,
    required String mimeType,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      _uri('/api/mobile/institut/branding/logo'),
    );
    request.headers.addAll(
      _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final subtype = mimeType.split('/').length > 1
        ? mimeType.split('/')[1]
        : 'octet-stream';
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
        contentType: MediaType('image', subtype),
      ),
    );
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final body = await _decode(response);
    return body['logoUrl'] as String? ?? '';
  }

  Future<DayAgenda> fetchDay({
    required String accessToken,
    required String tenantId,
    String? date,
    bool includeWeek = true,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/day', {
        if (date != null && date.isNotEmpty) 'date': date,
        if (includeWeek) 'week': '1',
      }),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return DayAgenda.fromJson(body);
  }

  Future<String> createAppointment({
    required String accessToken,
    required String tenantId,
    required String serviceId,
    required String startsAt,
    String? clientId,
    String? staffId,
    String? notes,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/appointments'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'serviceId': serviceId,
        'startsAt': startsAt,
        if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
        if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      }),
    );
    final body = await _decode(response);
    return body['id'] as String? ?? '';
  }

  Future<void> updateAppointment({
    required String accessToken,
    required String tenantId,
    required String appointmentId,
    String? status,
    String? notes,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/appointments/$appointmentId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        if (status != null) 'status': status,
        if (notes != null) 'notes': notes,
      }),
    );
    await _decode(response);
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

  Future<PosContext> fetchPosContext({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/pos-context'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return PosContext.fromJson(body);
  }

  /// Créé une nouvelle cliente depuis le mobile (POS / agenda).
  /// Retourne l'option picker + éventuel compte cliente provisionné.
  Future<CreatedClientResult> createInstitutClient({
    required String accessToken,
    required String tenantId,
    String? fullName,
    String? email,
    String? phone,
    bool marketingOptIn = false,
    bool createAccount = false,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/clients'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        if (fullName != null && fullName.isNotEmpty) 'fullName': fullName,
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        'marketingOptIn': marketingOptIn,
        'createAccount': createAccount,
      }),
    );
    final body = await _decode(response);
    final clientRaw = body['client'];
    if (clientRaw is! Map) {
      throw MobileApiException('Réponse invalide');
    }
    final clientMap = Map<String, dynamic>.from(clientRaw);
    final accountRaw = body['account'];
    ClientAccountCredentials? account;
    if (accountRaw is Map) {
      final m = Map<String, dynamic>.from(accountRaw);
      account = ClientAccountCredentials(
        loginId: m['loginId'] as String? ?? '',
        pinCode: m['pinCode'] as String? ?? '',
      );
    }
    return CreatedClientResult(
      option: PosOption(
        id: clientMap['id'] as String,
        label: clientMap['label'] as String? ?? '',
      ),
      account: account,
    );
  }

  Future<PosCheckoutResult> checkout({
    required String accessToken,
    required String tenantId,
    required Map<String, int> cart,
    required List<Map<String, dynamic>> payments,
    String? clientId,
    String? staffId,
    String? notes,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/checkout'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'cart': cart,
        'payments': payments,
        if (clientId != null) 'clientId': clientId,
        if (staffId != null) 'staffId': staffId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      }),
    );
    final body = await _decode(response);
    return PosCheckoutResult.fromJson(body);
  }

  void close() => _http.close();
}
