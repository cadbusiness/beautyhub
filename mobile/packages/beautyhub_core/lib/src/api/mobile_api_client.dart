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

class ClosedCashSessionResult {
  const ClosedCashSessionResult({
    required this.reportNumber,
    required this.varianceCents,
  });

  final String reportNumber;
  final int varianceCents;
}

class CreditNoteResult {
  const CreditNoteResult({
    required this.id,
    required this.creditNumber,
    required this.settlement,
    required this.remainingRefundableCents,
    this.documentId,
  });

  final String id;
  final String creditNumber;
  final String settlement;
  final int remainingRefundableCents;
  final String? documentId;

  factory CreditNoteResult.fromJson(Map<String, dynamic> json) =>
      CreditNoteResult(
        id: json['id'] as String? ?? '',
        creditNumber: json['creditNumber'] as String? ?? '',
        settlement: json['settlement'] as String? ?? 'credit',
        remainingRefundableCents: json['remainingRefundableCents'] as int? ?? 0,
        documentId: json['documentId'] as String?,
      );
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
    String accept = 'application/json',
    bool jsonContentType = true,
  }) {
    return {
      'Authorization': 'Bearer $accessToken',
      'Accept': accept,
      if (jsonContentType) 'Content-Type': 'application/json',
      bundleIdHeader: bundleId,
      if (tenantId != null && tenantId.isNotEmpty) tenantIdHeader: tenantId,
    };
  }

  bool _looksLikePdf(Uint8List bytes) {
    return bytes.length >= 5 &&
        bytes[0] == 0x25 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x44 &&
        bytes[3] == 0x46 &&
        bytes[4] == 0x2D;
  }

  Never _throwPdfError(http.Response response, String fallback) {
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
      body['message'] as String? ?? body['error'] as String? ?? fallback,
      statusCode: response.statusCode,
      code: body['error'] as String?,
    );
  }

  Uint8List _requirePdfBytes(http.Response response, String fallback) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwPdfError(
        response,
        '$fallback (${response.statusCode})',
      );
    }
    final bytes = response.bodyBytes;
    if (!_looksLikePdf(bytes)) {
      _throwPdfError(response, 'PDF illisible. Réessayez dans un instant.');
    }
    return bytes;
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
    String period = 'week',
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/dashboard', {
        'channel': channel,
        'period': period,
      }),
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

  Future<AgendaRange> fetchAgendaRange({
    required String accessToken,
    required String tenantId,
    required String from,
    required String to,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/agenda/range', {'from': from, 'to': to}),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return AgendaRange.fromJson(body);
  }

  Future<String> createAppointment({
    required String accessToken,
    required String tenantId,
    required String startsAt,
    String? serviceId,
    String? clientId,
    String? staffId,
    String? notes,
    List<AppointmentLineInput>? lines,
    List<BookingExtraLine>? extras,
    String? recurrenceFrequency,
    String? recurrenceUntil,
    List<String>? skipDates,
    bool force = false,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/appointments'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'startsAt': startsAt,
        if (serviceId != null && serviceId.isNotEmpty) 'serviceId': serviceId,
        if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
        if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (extras != null && extras.isNotEmpty)
          'extras': extras.map((e) => e.toJson()).toList(),
        if (lines != null && lines.isNotEmpty)
          'lines': lines.map((e) => e.toJson()).toList(),
        if (recurrenceFrequency != null && recurrenceFrequency.isNotEmpty)
          'recurrenceFrequency': recurrenceFrequency,
        if (recurrenceUntil != null && recurrenceUntil.isNotEmpty)
          'recurrenceUntil': recurrenceUntil,
        if (skipDates != null && skipDates.isNotEmpty) 'skipDates': skipDates,
        if (force) 'force': true,
      }),
    );
    final body = await _decode(response);
    return body['id'] as String? ?? '';
  }

  Future<RecurrencePreview> previewRecurrence({
    required String accessToken,
    required String tenantId,
    required String startsAt,
    required List<AppointmentLineInput> lines,
    String? clientId,
    String? staffId,
    String? recurrenceFrequency,
    String? recurrenceUntil,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/appointments/preview'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'startsAt': startsAt,
        'lines': lines.map((e) => e.toJson()).toList(),
        if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
        if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
        if (recurrenceFrequency != null && recurrenceFrequency.isNotEmpty)
          'recurrenceFrequency': recurrenceFrequency,
        if (recurrenceUntil != null && recurrenceUntil.isNotEmpty)
          'recurrenceUntil': recurrenceUntil,
      }),
    );
    final body = await _decode(response);
    return RecurrencePreview.fromJson(body);
  }

  Future<List<ServiceExtraConfig>> fetchServiceExtras({
    required String accessToken,
    required String tenantId,
    required String serviceId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/service-extras', {'serviceId': serviceId}),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    final raw = body['extras'] as List? ?? const [];
    return raw
        .whereType<Map>()
        .map((e) => ServiceExtraConfig.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> updateAppointment({
    required String accessToken,
    required String tenantId,
    required String appointmentId,
    String? status,
    String? notes,
    String? startsAt,
    String? serviceId,
    List<BookingExtraLine>? extras,
    bool force = false,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/appointments/$appointmentId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        if (status != null) 'status': status,
        if (notes != null) 'notes': notes,
        if (startsAt != null) 'startsAt': startsAt,
        if (serviceId != null && serviceId.isNotEmpty) 'serviceId': serviceId,
        if (extras != null) 'extras': extras.map((e) => e.toJson()).toList(),
        if (force) 'force': true,
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

  Future<CashSessionSummary?> pauseCashSession({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/cash-session/pause'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode(const {}),
    );
    final body = await _decode(response);
    final raw = body['session'];
    if (raw is! Map) return null;
    return CashSessionSummary.fromJson(Map<String, dynamic>.from(raw));
  }

  Future<CashSessionSummary?> resumeCashSession({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/cash-session/resume'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode(const {}),
    );
    final body = await _decode(response);
    final raw = body['session'];
    if (raw is! Map) return null;
    return CashSessionSummary.fromJson(Map<String, dynamic>.from(raw));
  }

  Future<ClosedCashSessionResult> closeCashSession({
    required String accessToken,
    required String tenantId,
    required int countedCashCents,
    String? notes,
    DateTime? closedAt,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/cash-session/close'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'countedCashCents': countedCashCents,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (closedAt != null) 'closedAt': closedAt.toUtc().toIso8601String(),
      }),
    );
    final body = await _decode(response);
    final variance = body['varianceCents'];
    return ClosedCashSessionResult(
      reportNumber: body['reportNumber'] as String? ?? '',
      varianceCents: variance is int
          ? variance
          : variance is num
              ? variance.round()
              : 0,
    );
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
    String? fromLetter,
  }) async {
    final params = <String, String>{
      if (query.isNotEmpty) 'q': query,
      'limit': '$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      if (fromLetter != null && fromLetter.isNotEmpty) 'from': fromLetter,
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
    final response = await _http.get(
      _uri('/api/mobile/institut/sales/$saleId/ticket'),
      headers: _headers(
        accessToken: accessToken,
        tenantId: tenantId,
        accept: 'application/pdf',
        jsonContentType: false,
      ),
    );
    return _requirePdfBytes(response, 'Ticket PDF indisponible');
  }

  Future<Uint8List> fetchSaleDocumentPdf({
    required String accessToken,
    required String tenantId,
    required String documentId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/documents/$documentId/pdf'),
      headers: _headers(
        accessToken: accessToken,
        tenantId: tenantId,
        accept: 'application/pdf',
        jsonContentType: false,
      ),
    );
    return _requirePdfBytes(response, 'PDF indisponible');
  }

  /// Équipe institut (personnel, rôles, droits).
  Future<InstTeamSnapshot> fetchInstitutTeam({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/team'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return InstTeamSnapshot.fromJson(body);
  }

  Future<String> createInstitutStaff({
    required String accessToken,
    required String tenantId,
    required String fullName,
    String? email,
    String? color,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/team'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'fullName': fullName,
        if (email != null && email.isNotEmpty) 'email': email,
        if (color != null && color.isNotEmpty) 'color': color,
      }),
    );
    final body = await _decode(response);
    return body['staffId'] as String? ?? '';
  }

  Future<void> updateInstitutStaff({
    required String accessToken,
    required String tenantId,
    required String staffId,
    required String fullName,
    String? email,
    String? color,
    String? tenantRoleId,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/team/$staffId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'fullName': fullName,
        'email': email,
        'color': color,
        'tenantRoleId': tenantRoleId,
      }),
    );
    await _decode(response);
  }

  Future<String> activateInstitutStaff({
    required String accessToken,
    required String tenantId,
    required String staffId,
    required String email,
    String? tenantRoleId,
    String? password,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/team/$staffId/activate'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'email': email,
        if (tenantRoleId != null && tenantRoleId.isNotEmpty)
          'tenantRoleId': tenantRoleId,
        if (password != null && password.isNotEmpty) 'password': password,
      }),
    );
    final body = await _decode(response);
    return body['temporaryPassword'] as String? ?? '';
  }

  Future<String> resetInstitutStaffPassword({
    required String accessToken,
    required String tenantId,
    required String staffId,
    String? password,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/team/$staffId/password'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        if (password != null && password.isNotEmpty) 'password': password,
      }),
    );
    final body = await _decode(response);
    return body['temporaryPassword'] as String? ?? '';
  }

  Future<void> inviteInstitutStaff({
    required String accessToken,
    required String tenantId,
    required String staffId,
    required String email,
    String? tenantRoleId,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/team/$staffId/invite'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'email': email,
        if (tenantRoleId != null && tenantRoleId.isNotEmpty)
          'tenantRoleId': tenantRoleId,
      }),
    );
    await _decode(response);
  }

  Future<void> archiveInstitutStaff({
    required String accessToken,
    required String tenantId,
    required String staffId,
    bool revokeAccess = false,
    bool restore = false,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/team/$staffId/archive'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'revokeAccess': revokeAccess,
        'restore': restore,
      }),
    );
    await _decode(response);
  }

  Future<List<InstTeamAuditRow>> fetchInstitutTeamAudit({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/team/audit'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return (body['items'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => InstTeamAuditRow.fromJson(Map<String, dynamic>.from(e)))
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
    Map<String, String>? lineStaffIds,
    String? notes,
    int? cartDiscountCents,
    String? discountReason,
    String? loyaltyRewardId,
    int? loyaltyCreditCents,
    Map<String, int>? priceOverrides,
    String? posCartId,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/checkout'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'cart': cart,
        'payments': payments,
        if (clientId != null) 'clientId': clientId,
        if (staffId != null) 'staffId': staffId,
        if (lineStaffIds != null && lineStaffIds.isNotEmpty)
          'lineStaffIds': lineStaffIds,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (cartDiscountCents != null && cartDiscountCents > 0)
          'cartDiscountCents': cartDiscountCents,
        if (discountReason != null && discountReason.isNotEmpty)
          'discountReason': discountReason,
        if (loyaltyRewardId != null && loyaltyRewardId.isNotEmpty)
          'loyaltyRewardId': loyaltyRewardId,
        if (loyaltyCreditCents != null && loyaltyCreditCents > 0)
          'loyaltyCreditCents': loyaltyCreditCents,
        if (priceOverrides != null && priceOverrides.isNotEmpty)
          'priceOverrides': priceOverrides,
        if (posCartId != null && posCartId.isNotEmpty) 'posCartId': posCartId,
      }),
    );
    final body = await _decode(response);
    return PosCheckoutResult.fromJson(body);
  }

  List<PosCartSnapshot> _parsePosCarts(dynamic raw) {
    return (raw as List? ?? const [])
        .whereType<Map>()
        .map((e) => PosCartSnapshot.fromJson(Map<String, dynamic>.from(e)))
        .toList(growable: false);
  }

  Future<({List<PosCartSnapshot> carts, PosCartSnapshot active})>
      ensurePosCarts({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/pos-carts', {'ensure': '1'}),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    final activeRaw = body['active'];
    if (activeRaw is! Map) {
      throw MobileApiException('Panier actif introuvable.');
    }
    return (
      carts: _parsePosCarts(body['carts']),
      active: PosCartSnapshot.fromJson(Map<String, dynamic>.from(activeRaw)),
    );
  }

  Future<List<PosCartSnapshot>> listPosCarts({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/pos-carts'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return _parsePosCarts(body['carts']);
  }

  Future<PosCartSnapshot> createPosCart({
    required String accessToken,
    required String tenantId,
    Map<String, dynamic>? payload,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/pos-carts'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode(payload ?? const <String, dynamic>{}),
    );
    final body = await _decode(response);
    return PosCartSnapshot.fromJson(
      Map<String, dynamic>.from(body['cart'] as Map),
    );
  }

  Future<PosCartSnapshot> updatePosCart({
    required String accessToken,
    required String tenantId,
    required String cartId,
    required Map<String, dynamic> payload,
    bool force = false,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/pos-carts/$cartId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({...payload, if (force) 'force': true}),
    );
    final body = await _decode(response);
    return PosCartSnapshot.fromJson(
      Map<String, dynamic>.from(body['cart'] as Map),
    );
  }

  Future<PosCartSnapshot> claimPosCart({
    required String accessToken,
    required String tenantId,
    required String cartId,
    bool force = false,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/pos-carts/$cartId/claim'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({'force': force}),
    );
    final body = await _decode(response);
    return PosCartSnapshot.fromJson(
      Map<String, dynamic>.from(body['cart'] as Map),
    );
  }

  Future<void> abandonPosCart({
    required String accessToken,
    required String tenantId,
    required String cartId,
    bool force = false,
  }) async {
    final response = await _http.delete(
      _uri(
        '/api/mobile/institut/pos-carts/$cartId',
        {if (force) 'force': '1'},
      ),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    await _decode(response);
  }

  Future<CreditNoteResult> createSaleCreditNote({
    required String accessToken,
    required String tenantId,
    required String saleId,
    required int amountCents,
    required String reason,
    String settlement = 'credit',
    String? intent,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/sales/$saleId/credit-note'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'amountCents': amountCents,
        'reason': reason,
        'settlement': settlement,
        if (intent != null && intent.isNotEmpty) 'intent': intent,
      }),
    );
    final body = await _decode(response);
    return CreditNoteResult.fromJson(body);
  }

  Future<void> createInternalProduct({
    required String accessToken,
    required String tenantId,
    required String name,
    required int priceCents,
    String? sku,
    int? stockQuantity,
    String? categoryId,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/products'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'name': name,
        'priceCents': priceCents,
        if (sku != null && sku.isNotEmpty) 'sku': sku,
        if (stockQuantity != null) 'stockQuantity': stockQuantity,
        if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
      }),
    );
    await _decode(response);
  }

  Future<void> createInternalProductCategory({
    required String accessToken,
    required String tenantId,
    required String name,
    int sortOrder = 0,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/product-categories'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'name': name,
        'sortOrder': sortOrder,
      }),
    );
    await _decode(response);
  }

  Future<InstClientDossier> fetchClientDossier({
    required String accessToken,
    required String tenantId,
    required String clientId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/clients/$clientId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return InstClientDossier.fromJson(body);
  }

  Future<InstClientAppointmentsPage> fetchClientAppointments({
    required String accessToken,
    required String tenantId,
    required String clientId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/clients/$clientId/appointments'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return InstClientAppointmentsPage.fromJson(body);
  }

  Future<List<InstClientSale>> fetchClientSalesHistory({
    required String accessToken,
    required String tenantId,
    required String clientId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/clients/$clientId/sales'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return (body['sales'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => InstClientSale.fromJson(Map<String, dynamic>.from(e)))
        .toList(growable: false);
  }

  Future<InstClientLoyaltyDetail> fetchClientLoyaltyDossier({
    required String accessToken,
    required String tenantId,
    required String clientId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/clients/$clientId/loyalty'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return InstClientLoyaltyDetail.fromJson(body);
  }

  Future<InstClientLoyaltyDetail> assignClientLoyaltyProgram({
    required String accessToken,
    required String tenantId,
    required String clientId,
    String? loyaltyProgramId,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/clients/$clientId/loyalty'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({'loyaltyProgramId': loyaltyProgramId}),
    );
    final body = await _decode(response);
    return InstClientLoyaltyDetail.fromJson(body);
  }

  Future<InstLoyaltyAdminSnapshot> fetchLoyaltyAdmin({
    required String accessToken,
    required String tenantId,
    String? programId,
  }) async {
    final response = await _http.get(
      _uri(
        '/api/mobile/institut/loyalty',
        {if (programId != null && programId.isNotEmpty) 'programId': programId},
      ),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return InstLoyaltyAdminSnapshot.fromJson(body);
  }

  Future<String> createLoyaltyProgram({
    required String accessToken,
    required String tenantId,
    required String name,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/loyalty/programs'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({'name': name}),
    );
    final body = await _decode(response);
    return body['programId'] as String? ?? '';
  }

  Future<void> setLoyaltyProgramActive({
    required String accessToken,
    required String tenantId,
    required String programId,
    required bool isActive,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/loyalty/programs/$programId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({'isActive': isActive}),
    );
    await _decode(response);
  }

  Future<void> saveLoyaltyProgramSettings({
    required String accessToken,
    required String tenantId,
    required String programId,
    required String name,
    required String pointsLabel,
    required bool isActive,
    required int birthdayBonusPoints,
    required bool birthdayAutoEnabled,
    required bool portalVisible,
    required int referralPoints,
    required int sameDayRebookPoints,
    bool creditEnabled = false,
    int creditRateBps = 0,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/loyalty/programs/$programId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'name': name,
        'pointsLabel': pointsLabel,
        'isActive': isActive,
        'birthdayBonusPoints': birthdayBonusPoints,
        'birthdayAutoEnabled': birthdayAutoEnabled,
        'portalVisible': portalVisible,
        'referralPoints': referralPoints,
        'sameDayRebookPoints': sameDayRebookPoints,
        'creditEnabled': creditEnabled,
        'creditRateBps': creditRateBps,
      }),
    );
    await _decode(response);
  }

  Future<String> duplicateLoyaltyProgram({
    required String accessToken,
    required String tenantId,
    required String programId,
    required String name,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/loyalty/programs/$programId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({'action': 'duplicate', 'name': name}),
    );
    final body = await _decode(response);
    return body['programId'] as String? ?? '';
  }

  Future<void> saveLoyaltyRule({
    required String accessToken,
    required String tenantId,
    required String name,
    required String sourceType,
    required String calcMode,
    required num pointsValue,
    required int minAmountCents,
    required bool isActive,
    String? programId,
    String? id,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/loyalty/rules'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        if (programId != null) 'programId': programId,
        if (id != null) 'id': id,
        'name': name,
        'sourceType': sourceType,
        'calcMode': calcMode,
        'pointsValue': pointsValue,
        'minAmountCents': minAmountCents,
        'isActive': isActive,
      }),
    );
    await _decode(response);
  }

  Future<void> deleteLoyaltyRule({
    required String accessToken,
    required String tenantId,
    required String ruleId,
  }) async {
    final response = await _http.delete(
      _uri('/api/mobile/institut/loyalty/rules/$ruleId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    await _decode(response);
  }

  Future<void> saveLoyaltyReward({
    required String accessToken,
    required String tenantId,
    required String name,
    required String rewardType,
    required num pointsCost,
    required bool isActive,
    required bool newServiceOnly,
    String? programId,
    String? id,
    String? description,
    int? discountPercent,
    int? discountCents,
    String? serviceId,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/loyalty/rewards'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        if (programId != null) 'programId': programId,
        if (id != null) 'id': id,
        'name': name,
        'description': description,
        'rewardType': rewardType,
        'pointsCost': pointsCost,
        'isActive': isActive,
        'newServiceOnly': newServiceOnly,
        'discountPercent': discountPercent,
        'discountCents': discountCents,
        'serviceId': serviceId,
      }),
    );
    await _decode(response);
  }

  Future<void> deleteLoyaltyReward({
    required String accessToken,
    required String tenantId,
    required String rewardId,
  }) async {
    final response = await _http.delete(
      _uri('/api/mobile/institut/loyalty/rewards/$rewardId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    await _decode(response);
  }

  Future<List<InstPromo>> fetchPromos({
    required String accessToken,
    required String tenantId,
    String? query,
  }) async {
    final response = await _http.get(
      _uri(
        '/api/mobile/institut/promos',
        {if (query != null && query.isNotEmpty) 'q': query},
      ),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return (body['promos'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => InstPromo.fromJson(Map<String, dynamic>.from(e)))
        .toList(growable: false);
  }

  Future<void> savePromo({
    required String accessToken,
    required String tenantId,
    String? promoId,
    required String code,
    required String name,
    String? description,
    required String discountType,
    int? discountPercent,
    int? discountCents,
    int minOrderCents = 0,
    String? startsAt,
    String? endsAt,
    int? usageLimit,
    int? usageLimitPerClient,
    required bool channelWoo,
    required bool channelBooking,
    required bool channelPos,
    required bool isActive,
  }) async {
    final payload = {
      'code': code,
      'name': name,
      'description': description,
      'discountType': discountType,
      'discountPercent': discountPercent,
      'discountCents': discountCents,
      'minOrderCents': minOrderCents,
      'startsAt': startsAt,
      'endsAt': endsAt,
      'usageLimit': usageLimit,
      'usageLimitPerClient': usageLimitPerClient,
      'channelWoo': channelWoo,
      'channelBooking': channelBooking,
      'channelPos': channelPos,
      'isActive': isActive,
    };
    final response = promoId == null
        ? await _http.post(
            _uri('/api/mobile/institut/promos'),
            headers: _headers(accessToken: accessToken, tenantId: tenantId),
            body: jsonEncode(payload),
          )
        : await _http.patch(
            _uri('/api/mobile/institut/promos/$promoId'),
            headers: _headers(accessToken: accessToken, tenantId: tenantId),
            body: jsonEncode(payload),
          );
    await _decode(response);
  }

  Future<void> deletePromo({
    required String accessToken,
    required String tenantId,
    required String promoId,
  }) async {
    final response = await _http.delete(
      _uri('/api/mobile/institut/promos/$promoId'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    await _decode(response);
  }

  Future<InstPosFiscalSettings> fetchPosSettings({
    required String accessToken,
    required String tenantId,
  }) async {
    final response = await _http.get(
      _uri('/api/mobile/institut/pos-settings'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
    );
    final body = await _decode(response);
    return InstPosFiscalSettings.fromJson(body);
  }

  Future<InstPosFiscalSettings> savePosSettings({
    required String accessToken,
    required String tenantId,
    required String countryCode,
    required String fiscalRegime,
    required int defaultVatRateBps,
    required int serviceVatRateBps,
    required int productVatRateBps,
    String? legalName,
    String? legalAddress,
    String? vatNumber,
    String? siret,
  }) async {
    final response = await _http.patch(
      _uri('/api/mobile/institut/pos-settings'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({
        'countryCode': countryCode,
        'fiscalRegime': fiscalRegime,
        'defaultVatRateBps': defaultVatRateBps,
        'serviceVatRateBps': serviceVatRateBps,
        'productVatRateBps': productVatRateBps,
        'legalName': legalName,
        'legalAddress': legalAddress,
        'vatNumber': vatNumber,
        'siret': siret,
      }),
    );
    final body = await _decode(response);
    return InstPosFiscalSettings.fromJson(body);
  }

  Future<void> applyLoyaltyStarter({
    required String accessToken,
    required String tenantId,
    String? programId,
  }) async {
    final response = await _http.post(
      _uri('/api/mobile/institut/loyalty/starter'),
      headers: _headers(accessToken: accessToken, tenantId: tenantId),
      body: jsonEncode({if (programId != null) 'programId': programId}),
    );
    await _decode(response);
  }

  void close() => _http.close();
}
