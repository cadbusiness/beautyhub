import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models/institut_models.dart';
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

class SavedClientResult {
  const SavedClientResult({required this.client, this.account});

  final InstClient client;
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

  /// Liste paginée des clientes avec recherche optionnelle.
  Future<InstClientPage> fetchInstitutClients({
    required String accessToken,
    required String tenantId,
    String query = '',
    int limit = 60,
    String? cursor,
  }) async {
    final params = <String, String>{
      if (query.isNotEmpty) 'q': query,
      'limit': '$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
    };
    final response = await _http.get(
      _uri('/api/mobile/institut/clients', params),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    final list = body['items'] as List? ?? const [];
    return InstClientPage(
      items: list
          .whereType<Map>()
          .map((e) => InstClient.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      nextCursor: body['nextCursor'] as String?,
    );
  }

  /// Crée ou met à jour une fiche cliente complète.
  Future<SavedClientResult> saveInstitutClient({
    required String accessToken,
    required String tenantId,
    String? clientId,
    required Map<String, dynamic> fields,
  }) async {
    final isCreate = clientId == null || clientId.isEmpty;
    final response = isCreate
        ? await _http.post(
            _uri('/api/mobile/institut/clients'),
            headers: _headers(accessToken: accessToken, tenantId: tenantId),
            body: jsonEncode(fields),
          )
        : await _http.patch(
            _uri('/api/mobile/institut/clients/$clientId'),
            headers: _headers(accessToken: accessToken, tenantId: tenantId),
            body: jsonEncode(fields),
          );
    final body = await _decode(response);
    final itemRaw = body['item'];
    if (itemRaw is! Map) {
      throw MobileApiException('Réponse invalide');
    }
    ClientAccountCredentials? account;
    final accountRaw = body['account'];
    if (accountRaw is Map) {
      final m = Map<String, dynamic>.from(accountRaw);
      account = ClientAccountCredentials(
        loginId: m['loginId'] as String? ?? '',
        pinCode: m['pinCode'] as String? ?? '',
      );
    }
    return SavedClientResult(
      client: InstClient.fromJson(Map<String, dynamic>.from(itemRaw)),
      account: account,
    );
  }

  /// Historique des ventes de caisse (pagination cursor).
  Future<InstSalePage> fetchInstitutSales({
    required String accessToken,
    required String tenantId,
    int limit = 40,
    String? cursor,
    String? status,
    String? from,
    String? to,
    String? period,
  }) async {
    final params = <String, String>{
      'limit': '$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      if (status != null && status.isNotEmpty) 'status': status,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
      if (period != null && period.isNotEmpty) 'period': period,
    };
    final response = await _http.get(
      _uri('/api/mobile/institut/sales', params),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    final list = body['items'] as List? ?? const [];
    return InstSalePage(
      items: list
          .whereType<Map>()
          .map((e) => InstSale.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      nextCursor: body['nextCursor'] as String?,
      today: body['today'] as String?,
    );
  }

  Future<InstDocumentPage> fetchInstitutDocuments({
    required String accessToken,
    required String tenantId,
    int limit = 40,
    String? cursor,
    String? docType,
    String? from,
    String? to,
    String? period,
  }) async {
    final params = <String, String>{
      'limit': '$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      if (docType != null && docType.isNotEmpty) 'docType': docType,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
      if (period != null && period.isNotEmpty) 'period': period,
    };
    final response = await _http.get(
      _uri('/api/mobile/institut/documents', params),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    final list = body['items'] as List? ?? const [];
    return InstDocumentPage(
      items: list
          .whereType<Map>()
          .map((e) => InstSaleDocument.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      nextCursor: body['nextCursor'] as String?,
      today: body['today'] as String?,
    );
  }

  Future<Uint8List> fetchSaleTicketPdf({
    required String accessToken,
    required String tenantId,
    required String saleId,
  }) async {
    final headers = _headers(accessToken: accessToken, tenantId: tenantId);
    headers['Accept'] = 'application/pdf';
    final response = await _http.get(
      _uri('/api/mobile/institut/sales/$saleId/ticket'),
      headers: headers,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic> body = const {};
      if (response.body.isNotEmpty) {
        try {
          final decoded = jsonDecode(response.body);
          if (decoded is Map<String, dynamic>) body = decoded;
        } catch (_) {
          // Réponse d'erreur non JSON.
        }
      }
      throw MobileApiException(
        body['message'] as String? ??
            body['error'] as String? ??
            'Ticket PDF indisponible (${response.statusCode})',
        statusCode: response.statusCode,
        code: body['error'] as String?,
      );
    }
    return response.bodyBytes;
  }

  /// Membres de l'équipe (staff institut).
  Future<List<InstStaffMember>> fetchInstitutTeam({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/team'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    final list = body['items'] as List? ?? const [];
    return list
        .whereType<Map>()
        .map((e) => InstStaffMember.fromJson(Map<String, dynamic>.from(e)))
        .toList(growable: false);
  }

  /// Infos publiques de l'institut (nom, contact, horaires, compteurs).
  Future<InstTenantInfo> fetchInstitutTenant({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/tenant'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return InstTenantInfo.fromJson(body);
  }

  /// Met à jour le profil public de l'institut (nom, contact, adresse, horaires).
  Future<InstTenantInfo> updateInstitutTenant({
    required String accessToken,
    required String tenantId,
    String? displayName,
    String? description,
    InstTenantContact? contact,
    InstTenantAddress? address,
    List<InstOpeningDay>? openingHours,
  }) async {
    final payload = <String, dynamic>{
      if (displayName != null) 'displayName': displayName,
      if (description != null) 'description': description,
      if (contact != null) 'contact': contact.toJson(),
      if (address != null) 'address': address.toJson(),
      if (openingHours != null)
        'openingHours':
            openingHours.map((d) => d.toJson()).toList(growable: false),
    };
    final response = await _http.patch(
      _uri('/api/mobile/institut/tenant'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode(payload),
    );
    final body = await _decode(response);
    return InstTenantInfo.fromJson(body);
  }

  Future<PosClientLoyalty> fetchClientLoyalty({
    required String accessToken,
    required String tenantId,
    required String clientId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/client-loyalty', {'clientId': clientId}),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return PosClientLoyalty.fromJson(body);
  }

  Future<PosCheckoutResult> checkout({
    required String accessToken,
    required String tenantId,
    required Map<String, int> cart,
    required List<Map<String, dynamic>> payments,
    String? clientId,
    String? staffId,
    String? notes,
    int? cartDiscountCents,
    String? loyaltyRewardId,
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
        if (cartDiscountCents != null && cartDiscountCents > 0)
          'cartDiscountCents': cartDiscountCents,
        if (loyaltyRewardId != null && loyaltyRewardId.isNotEmpty)
          'loyaltyRewardId': loyaltyRewardId,
      }),
    );
    final body = await _decode(response);
    return PosCheckoutResult.fromJson(body);
  }

  void close() => _http.close();
}
