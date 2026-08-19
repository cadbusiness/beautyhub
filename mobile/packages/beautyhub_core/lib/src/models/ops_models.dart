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
    this.clientId,
    this.clientPhone,
    this.clientEmail,
    this.serviceId,
    this.serviceDurationMin,
    this.staffId,
    this.staffColor,
    this.resourceId,
    this.resourceName,
    this.extras = const [],
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
  final String? clientId;
  final String? clientPhone;
  final String? clientEmail;
  final String? serviceId;
  final int? serviceDurationMin;
  final String? staffId;
  final String? staffColor;
  final String? resourceId;
  final String? resourceName;
  final List<AppointmentExtra> extras;

  bool get isCancelled => status == 'cancelled' || status == 'no_show';

  int get durationMinutes {
    if (serviceDurationMin != null && serviceDurationMin! > 0) {
      return serviceDurationMin!;
    }
    final minutes = endsAt.difference(startsAt).inMinutes;
    return minutes > 0 ? minutes : 0;
  }

  String get durationLabel {
    final minutes = durationMinutes;
    return minutes > 0 ? "$minutes'" : '';
  }

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
      clientId: json['clientId'] as String?,
      clientPhone: json['clientPhone'] as String?,
      clientEmail: json['clientEmail'] as String?,
      serviceId: json['serviceId'] as String?,
      serviceDurationMin: json['serviceDurationMin'] as int?,
      staffId: json['staffId'] as String?,
      staffColor: json['staffColor'] as String?,
      resourceId: json['resourceId'] as String?,
      resourceName: json['resourceName'] as String?,
      extras: (json['extras'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => AppointmentExtra.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class AppointmentExtra {
  const AppointmentExtra({
    required this.serviceId,
    required this.quantity,
    required this.name,
    this.priceCents,
  });

  final String serviceId;
  final int quantity;
  final String name;
  final int? priceCents;

  factory AppointmentExtra.fromJson(Map<String, dynamic> json) {
    return AppointmentExtra(
      serviceId: json['serviceId'] as String? ?? '',
      quantity: json['quantity'] as int? ?? 1,
      name: json['name'] as String? ?? 'Option',
      priceCents: json['priceCents'] as int?,
    );
  }
}

class AppointmentTimeGroup {
  const AppointmentTimeGroup({
    required this.startsAt,
    required this.appointments,
  });

  final DateTime startsAt;
  final List<DayAppointment> appointments;

  bool get isParallel => appointments.length > 1;
}

String appointmentStartKey(DateTime startsAt) {
  return '${startsAt.year.toString().padLeft(4, '0')}-'
      '${startsAt.month.toString().padLeft(2, '0')}-'
      '${startsAt.day.toString().padLeft(2, '0')} '
      '${startsAt.hour.toString().padLeft(2, '0')}:'
      '${startsAt.minute.toString().padLeft(2, '0')}';
}

List<AppointmentTimeGroup> groupAppointmentsByStart(
  List<DayAppointment> appointments,
) {
  final groups = <String, AppointmentTimeGroup>{};
  final order = <String>[];
  for (final appointment in appointments) {
    final key = appointmentStartKey(appointment.startsAt);
    final existing = groups[key];
    if (existing == null) {
      groups[key] = AppointmentTimeGroup(
        startsAt: appointment.startsAt,
        appointments: [appointment],
      );
      order.add(key);
    } else {
      existing.appointments.add(appointment);
    }
  }
  return [for (final key in order) groups[key]!];
}

/// Prochain créneau (et les RDV qui démarrent à la même minute, cabines différentes).
List<DayAppointment> nextParallelAppointments(
  List<DayAppointment> appointments, {
  DateTime? now,
  DayAppointment? hint,
}) {
  final moment = now ?? DateTime.now();
  final horizon = moment.subtract(const Duration(minutes: 30));
  final upcoming = appointments.where((a) {
    if (a.isCancelled) return false;
    if (hint != null && appointmentStartKey(a.startsAt) == appointmentStartKey(hint.startsAt)) {
      return true;
    }
    return !a.endsAt.isBefore(moment) || !a.startsAt.isBefore(horizon);
  }).toList()
    ..sort((a, b) => a.startsAt.compareTo(b.startsAt));

  if (upcoming.isEmpty) return const [];

  final anchor = hint != null &&
          upcoming.any((a) => a.id == hint.id)
      ? hint.startsAt
      : upcoming.first.startsAt;
  final key = appointmentStartKey(anchor);
  return upcoming
      .where((a) => appointmentStartKey(a.startsAt) == key)
      .toList();
}

class AgendaStaffMember {
  const AgendaStaffMember({
    required this.id,
    required this.name,
    this.color,
  });

  final String id;
  final String name;
  final String? color;

  factory AgendaStaffMember.fromJson(Map<String, dynamic> json) {
    return AgendaStaffMember(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      color: json['color'] as String?,
    );
  }
}

class AgendaResource {
  const AgendaResource({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;

  factory AgendaResource.fromJson(Map<String, dynamic> json) {
    return AgendaResource(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
    );
  }
}

class AgendaWeekDay {
  const AgendaWeekDay({required this.date, required this.count});

  final String date;
  final int count;

  factory AgendaWeekDay.fromJson(Map<String, dynamic> json) {
    return AgendaWeekDay(
      date: json['date'] as String? ?? '',
      count: json['count'] as int? ?? 0,
    );
  }
}

class DayAgendaStats {
  const DayAgendaStats({
    required this.total,
    required this.scheduled,
    required this.completed,
    required this.cancelled,
    required this.noShow,
    required this.revenueCents,
  });

  final int total;
  final int scheduled;
  final int completed;
  final int cancelled;
  final int noShow;
  final int revenueCents;

  factory DayAgendaStats.fromJson(Map<String, dynamic> json) {
    return DayAgendaStats(
      total: json['total'] as int? ?? 0,
      scheduled: json['scheduled'] as int? ?? 0,
      completed: json['completed'] as int? ?? 0,
      cancelled: json['cancelled'] as int? ?? 0,
      noShow: json['noShow'] as int? ?? 0,
      revenueCents: json['revenueCents'] as int? ?? 0,
    );
  }
}

class DayAgenda {
  const DayAgenda({
    required this.date,
    required this.appointments,
    this.nextAppointment,
    this.tenantName,
    this.stats = const DayAgendaStats(
      total: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      revenueCents: 0,
    ),
    this.staff = const [],
    this.resources = const [],
    this.weekDays = const [],
  });

  final String date;
  final List<DayAppointment> appointments;
  final DayAppointment? nextAppointment;
  final String? tenantName;
  final DayAgendaStats stats;
  final List<AgendaStaffMember> staff;
  final List<AgendaResource> resources;
  final List<AgendaWeekDay> weekDays;

  factory DayAgenda.fromJson(Map<String, dynamic> json) {
    final list = (json['appointments'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => DayAppointment.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final nextRaw = json['nextAppointment'];
    final staffRaw = json['staff'] as List? ?? const [];
    final resourcesRaw = json['resources'] as List? ?? const [];
    final weekRaw = json['weekDays'] as List? ?? const [];
    return DayAgenda(
      date: json['date'] as String? ?? '',
      appointments: list,
      nextAppointment: nextRaw is Map
          ? DayAppointment.fromJson(Map<String, dynamic>.from(nextRaw))
          : null,
      tenantName: (json['tenant'] as Map?)?['name'] as String?,
      stats: DayAgendaStats.fromJson(
        Map<String, dynamic>.from(json['stats'] as Map? ?? const {}),
      ),
      staff: staffRaw
          .whereType<Map>()
          .map((e) => AgendaStaffMember.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      resources: resourcesRaw
          .whereType<Map>()
          .map((e) => AgendaResource.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      weekDays: weekRaw
          .whereType<Map>()
          .map((e) => AgendaWeekDay.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class DashboardTodaySummary {
  const DashboardTodaySummary({
    required this.revenueCents,
    required this.salesCount,
    required this.appointmentsScheduled,
    required this.appointmentsCompleted,
    required this.appointmentsCancelled,
    required this.appointmentsNoShow,
    required this.newClients,
    required this.cancellationRate,
    this.healthScore,
    this.mood = 'ok',
  });

  final int revenueCents;
  final int salesCount;
  final int appointmentsScheduled;
  final int appointmentsCompleted;
  final int appointmentsCancelled;
  final int appointmentsNoShow;
  final int newClients;
  final double cancellationRate;
  final int? healthScore;
  final String mood;

  factory DashboardTodaySummary.fromJson(Map<String, dynamic> json) {
    return DashboardTodaySummary(
      revenueCents: json['revenueCents'] as int? ?? 0,
      salesCount: json['salesCount'] as int? ?? 0,
      appointmentsScheduled: json['appointmentsScheduled'] as int? ?? 0,
      appointmentsCompleted: json['appointmentsCompleted'] as int? ?? 0,
      appointmentsCancelled: json['appointmentsCancelled'] as int? ?? 0,
      appointmentsNoShow: json['appointmentsNoShow'] as int? ?? 0,
      newClients: json['newClients'] as int? ?? 0,
      cancellationRate: (json['cancellationRate'] as num?)?.toDouble() ?? 0,
      healthScore: json['healthScore'] as int?,
      mood: json['mood'] as String? ?? 'ok',
    );
  }
}

class DashboardSeriesPoint {
  const DashboardSeriesPoint({
    required this.key,
    required this.label,
    required this.revenueCents,
    required this.salesCount,
    required this.appointments,
  });

  final String key;
  final String label;
  final int revenueCents;
  final int salesCount;
  final int appointments;

  factory DashboardSeriesPoint.fromJson(Map<String, dynamic> json) {
    return DashboardSeriesPoint(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      revenueCents: json['revenueCents'] as int? ?? 0,
      salesCount: json['salesCount'] as int? ?? 0,
      appointments: json['appointments'] as int? ?? 0,
    );
  }
}

class MobileDashboard {
  const MobileDashboard({
    required this.today,
    required this.weekRevenueCents,
    this.weekRevenueChangePct,
    required this.weekSalesCount,
    this.weekSalesChangePct,
    required this.weekAppointmentsTotal,
    required this.series,
    this.salesChannel = 'all',
    this.wooSalesAvailable = false,
  });

  final DashboardTodaySummary today;
  final int weekRevenueCents;
  final double? weekRevenueChangePct;
  final int weekSalesCount;
  final double? weekSalesChangePct;
  final int weekAppointmentsTotal;
  final List<DashboardSeriesPoint> series;
  final String salesChannel;
  final bool wooSalesAvailable;

  factory MobileDashboard.fromJson(Map<String, dynamic> json) {
    final week = json['week'] as Map? ?? const {};
    final seriesRaw = week['series'] as List? ?? const [];
    return MobileDashboard(
      today: DashboardTodaySummary.fromJson(
        Map<String, dynamic>.from(json['today'] as Map? ?? const {}),
      ),
      weekRevenueCents: week['revenueCents'] as int? ?? 0,
      weekRevenueChangePct: (week['revenueChangePct'] as num?)?.toDouble(),
      weekSalesCount: week['salesCount'] as int? ?? 0,
      weekSalesChangePct: (week['salesChangePct'] as num?)?.toDouble(),
      weekAppointmentsTotal: week['appointmentsTotal'] as int? ?? 0,
      series: seriesRaw
          .whereType<Map>()
          .map((e) => DashboardSeriesPoint.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      salesChannel: json['salesChannel'] as String? ?? 'all',
      wooSalesAvailable: json['wooSalesAvailable'] as bool? ?? false,
    );
  }
}

class TenantBranding {
  const TenantBranding({
    required this.displayName,
    required this.primaryColor,
    this.logoUrl,
  });

  final String displayName;
  final String primaryColor;
  final String? logoUrl;

  factory TenantBranding.fromJson(Map<String, dynamic> json) {
    return TenantBranding(
      displayName: json['displayName'] as String? ?? '',
      primaryColor: json['primaryColor'] as String? ?? '#0f172a',
      logoUrl: json['logoUrl'] as String?,
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
    this.itemsSoldQty = 0,
    this.servicesQty = 0,
    this.productsQty = 0,
    this.amountPaidCents = 0,
    this.cashSalesCents = 0,
    this.cardSalesCents = 0,
    this.byPaymentMethod = const {},
    this.paused = false,
    this.previousDay = false,
    this.openedCalendarDate,
    this.lastSaleAt,
    this.suggestedClosedAt,
  });

  final String id;
  final DateTime openedAt;
  final int openingFloatCents;
  final int salesCount;
  final int itemsSoldQty;
  final int servicesQty;
  final int productsQty;
  final int totalCents;
  final int amountPaidCents;
  final int expectedCashCents;
  final int cashSalesCents;
  final int cardSalesCents;
  final Map<String, int> byPaymentMethod;
  final bool paused;
  final bool previousDay;
  final String? openedCalendarDate;
  final DateTime? lastSaleAt;
  final DateTime? suggestedClosedAt;

  factory CashSessionSummary.fromJson(Map<String, dynamic> json) {
    return CashSessionSummary(
      id: json['id'] as String,
      openedAt: DateTime.parse(json['openedAt'] as String).toLocal(),
      openingFloatCents: _asInt(json['openingFloatCents']),
      salesCount: _asInt(json['salesCount']),
      itemsSoldQty: _asInt(json['itemsSoldQty']),
      servicesQty: _asInt(json['servicesQty']),
      productsQty: _asInt(json['productsQty']),
      totalCents: _asInt(json['totalCents']),
      amountPaidCents: _asInt(json['amountPaidCents']),
      expectedCashCents: _asInt(json['expectedCashCents']),
      cashSalesCents: _asInt(json['cashSalesCents']),
      cardSalesCents: _asInt(json['cardSalesCents']),
      byPaymentMethod: _asIntMap(json['byPaymentMethod']),
      paused: json['paused'] as bool? ?? false,
      previousDay: json['previousDay'] as bool? ?? false,
      openedCalendarDate: json['openedCalendarDate'] as String?,
      lastSaleAt: json['lastSaleAt'] == null
          ? null
          : DateTime.tryParse(json['lastSaleAt'] as String)?.toLocal(),
      suggestedClosedAt: json['suggestedClosedAt'] == null
          ? null
          : DateTime.tryParse(json['suggestedClosedAt'] as String)?.toLocal(),
    );
  }
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return 0;
}

Map<String, int> _asIntMap(dynamic raw) {
  if (raw is! Map) return const {};
  return {
    for (final entry in raw.entries)
      entry.key.toString(): _asInt(entry.value),
  };
}
