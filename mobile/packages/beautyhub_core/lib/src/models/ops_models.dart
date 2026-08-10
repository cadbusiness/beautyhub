class TenantOption {
  const TenantOption({
    required this.id,
    required this.name,
    required this.slug,
    required this.role,
  });

  final String id;
  final String name;
  final String slug;
  final String role;

  factory TenantOption.fromJson(Map<String, dynamic> json) {
    return TenantOption(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      role: json['role'] as String? ?? '',
    );
  }
}

class DayAppointment {
  const DayAppointment({
    required this.id,
    required this.startsAt,
    required this.endsAt,
    required this.status,
    required this.clientName,
    required this.serviceName,
    this.notes,
    this.priceCents,
    this.staffName,
    this.serviceColor,
  });

  final String id;
  final DateTime startsAt;
  final DateTime endsAt;
  final String status;
  final String clientName;
  final String serviceName;
  final String? notes;
  final int? priceCents;
  final String? staffName;
  final String? serviceColor;

  factory DayAppointment.fromJson(Map<String, dynamic> json) {
    return DayAppointment(
      id: json['id'] as String,
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      status: json['status'] as String? ?? 'booked',
      clientName: json['clientName'] as String? ?? 'Client',
      serviceName: json['serviceName'] as String? ?? 'Prestation',
      notes: json['notes'] as String?,
      priceCents: json['priceCents'] as int?,
      staffName: json['staffName'] as String?,
      serviceColor: json['serviceColor'] as String?,
    );
  }
}

class DayAgenda {
  const DayAgenda({
    required this.date,
    required this.appointments,
    this.nextAppointment,
    this.tenantName,
  });

  final String date;
  final List<DayAppointment> appointments;
  final DayAppointment? nextAppointment;
  final String? tenantName;

  factory DayAgenda.fromJson(Map<String, dynamic> json) {
    final list = (json['appointments'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => DayAppointment.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final nextRaw = json['nextAppointment'];
    return DayAgenda(
      date: json['date'] as String? ?? '',
      appointments: list,
      nextAppointment: nextRaw is Map
          ? DayAppointment.fromJson(Map<String, dynamic>.from(nextRaw))
          : null,
      tenantName: (json['tenant'] as Map?)?['name'] as String?,
    );
  }
}

class CashSessionSummary {
  const CashSessionSummary({
    required this.id,
    required this.openedAt,
    required this.openingFloatCents,
    required this.salesCount,
    required this.totalCents,
    required this.expectedCashCents,
  });

  final String id;
  final DateTime openedAt;
  final int openingFloatCents;
  final int salesCount;
  final int totalCents;
  final int expectedCashCents;

  factory CashSessionSummary.fromJson(Map<String, dynamic> json) {
    return CashSessionSummary(
      id: json['id'] as String,
      openedAt: DateTime.parse(json['openedAt'] as String).toLocal(),
      openingFloatCents: json['openingFloatCents'] as int? ?? 0,
      salesCount: json['salesCount'] as int? ?? 0,
      totalCents: json['totalCents'] as int? ?? 0,
      expectedCashCents: json['expectedCashCents'] as int? ?? 0,
    );
  }
}
