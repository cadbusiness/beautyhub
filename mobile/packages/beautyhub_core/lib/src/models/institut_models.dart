// Modèles pour les écrans institut (clients, historique ventes, équipe, tenant).

class InstClient {
  const InstClient({
    required this.id,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.marketingOptIn,
    required this.tags,
    required this.hasAccount,
    required this.createdAt,
    this.dateOfBirth,
    this.addressLine1,
    this.addressLine2,
    this.city,
    this.postalCode,
    this.country,
    this.notes,
  });

  final String id;
  final String? fullName;
  final String? email;
  final String? phone;
  final String? dateOfBirth;
  final String? addressLine1;
  final String? addressLine2;
  final String? city;
  final String? postalCode;
  final String? country;
  final String? notes;
  final bool marketingOptIn;
  final List<String> tags;
  final bool hasAccount;
  final DateTime createdAt;

  factory InstClient.fromJson(Map<String, dynamic> json) {
    final tags = (json['tags'] as List?)
            ?.whereType<String>()
            .toList(growable: false) ??
        const <String>[];
    return InstClient(
      id: json['id'] as String,
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      dateOfBirth: json['dateOfBirth'] as String?,
      addressLine1: json['addressLine1'] as String?,
      addressLine2: json['addressLine2'] as String?,
      city: json['city'] as String?,
      postalCode: json['postalCode'] as String?,
      country: json['country'] as String?,
      notes: json['notes'] as String?,
      marketingOptIn: json['marketingOptIn'] as bool? ?? false,
      tags: tags,
      hasAccount: json['hasAccount'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
    );
  }

  Map<String, dynamic> toWriteJson({bool includeCreateAccount = false}) {
    return {
      'fullName': fullName,
      'email': email,
      'phone': phone,
      'dateOfBirth': dateOfBirth,
      'addressLine1': addressLine1,
      'addressLine2': addressLine2,
      'city': city,
      'postalCode': postalCode,
      'country': country,
      'notes': notes,
      'tags': tags,
      'marketingOptIn': marketingOptIn,
      if (includeCreateAccount) 'createAccount': true,
    };
  }

  String get displayName {
    if (fullName != null && fullName!.isNotEmpty) return fullName!;
    if (email != null && email!.isNotEmpty) return email!;
    if (phone != null && phone!.isNotEmpty) return phone!;
    return 'Cliente';
  }

  String? get subtitle {
    if (email != null && email!.isNotEmpty) return email;
    if (phone != null && phone!.isNotEmpty) return phone;
    return null;
  }

  String get addressOneLine {
    final parts = <String>[];
    if (addressLine1 != null && addressLine1!.isNotEmpty) parts.add(addressLine1!);
    if (addressLine2 != null && addressLine2!.isNotEmpty) parts.add(addressLine2!);
    final cityLine = [
      if (postalCode != null && postalCode!.isNotEmpty) postalCode!,
      if (city != null && city!.isNotEmpty) city!,
    ].join(' ');
    if (cityLine.isNotEmpty) parts.add(cityLine);
    if (country != null && country!.isNotEmpty) parts.add(country!);
    return parts.join(', ');
  }

  bool get hasAddress => addressOneLine.isNotEmpty;

  /// Dernier mot du nom, accents pliés — même règle que `clients.last_name_sort`.
  String get lastNameSort {
    final name = (fullName ?? '').trim();
    if (name.isEmpty) return '~';
    final parts = name.split(RegExp(r'\s+'));
    final last = parts.isEmpty ? '' : parts.last;
    final folded = _foldLastName(last);
    return folded.isEmpty ? '~' : folded;
  }

  /// Lettre d'annuaire (`A`–`Z` ou `#`).
  String get lastNameLetter {
    final key = lastNameSort;
    if (key.isEmpty || key.startsWith('~')) return '#';
    final c = key[0].toUpperCase();
    if (c.compareTo('A') >= 0 && c.compareTo('Z') <= 0) return c;
    return '#';
  }
}

const _lastNameFoldFrom =
    'àáâäãåçéèêëìíîïñòóôöõùúûüýÿÀÁÂÄÃÅÇÉÈÊËÌÍÎÏÑÒÓÔÖÕÙÚÛÜÝŸ';
const _lastNameFoldTo =
    'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy';

String _foldLastName(String input) {
  final buf = StringBuffer();
  for (final rune in input.runes) {
    final ch = String.fromCharCode(rune);
    final i = _lastNameFoldFrom.indexOf(ch);
    buf.write(i >= 0 ? _lastNameFoldTo[i] : ch);
  }
  return buf.toString().toLowerCase();
}

class InstClientPage {
  const InstClientPage({required this.items, required this.nextCursor});
  final List<InstClient> items;
  final String? nextCursor;
}

class InstSaleItem {
  const InstSaleItem({
    required this.name,
    required this.quantity,
    required this.unitPriceCents,
    required this.lineTotalCents,
    required this.lineVatCents,
    required this.discountCents,
    required this.itemType,
    required this.wooCategories,
    required this.isGiftCard,
    this.imageUrl,
    this.sku,
    this.durationMin,
    this.color,
    this.description,
    this.source,
    this.wooId,
    this.stockQuantity,
  });

  final String name;
  final int quantity;
  final int unitPriceCents;
  final int lineTotalCents;
  final int lineVatCents;
  final int discountCents;

  /// `service`, `product`, `extra`, `giftcard`, `custom`…
  final String itemType;

  final String? imageUrl;

  /// Produit uniquement.
  final String? sku;
  final String? source;
  final int? wooId;
  final int? stockQuantity;
  final List<String> wooCategories;
  final bool isGiftCard;

  /// Prestation uniquement.
  final int? durationMin;
  final String? color;
  final String? description;

  bool get isService => itemType == 'service';
  bool get isProduct => itemType == 'product' || itemType == 'giftcard';

  factory InstSaleItem.fromJson(Map<String, dynamic> json) => InstSaleItem(
        name: json['name'] as String? ?? '',
        quantity: json['quantity'] as int? ?? 0,
        unitPriceCents: json['unitPriceCents'] as int? ?? 0,
        lineTotalCents: json['lineTotalCents'] as int? ?? 0,
        lineVatCents: json['lineVatCents'] as int? ?? 0,
        discountCents: json['discountCents'] as int? ?? 0,
        itemType: json['itemType'] as String? ?? '',
        imageUrl: json['imageUrl'] as String?,
        sku: json['sku'] as String?,
        durationMin: json['durationMin'] as int?,
        color: json['color'] as String?,
        description: json['description'] as String?,
        source: json['source'] as String?,
        wooId: json['wooId'] as int?,
        stockQuantity: json['stockQuantity'] as int?,
        wooCategories: (json['wooCategories'] as List?)
                ?.whereType<String>()
                .toList(growable: false) ??
            const <String>[],
        isGiftCard: json['isGiftCard'] as bool? ?? false,
      );
}

class InstSalePayment {
  const InstSalePayment({required this.method, required this.amountCents});
  final String method;
  final int amountCents;

  factory InstSalePayment.fromJson(Map<String, dynamic> json) =>
      InstSalePayment(
        method: json['method'] as String? ?? '',
        amountCents: json['amountCents'] as int? ?? 0,
      );
}

class InstSaleDocumentRef {
  const InstSaleDocumentRef({
    required this.id,
    required this.docType,
    required this.docNumber,
  });

  final String id;
  final String docType;
  final String docNumber;

  factory InstSaleDocumentRef.fromJson(Map<String, dynamic> json) =>
      InstSaleDocumentRef(
        id: json['id'] as String,
        docType: json['docType'] as String? ?? '',
        docNumber: json['docNumber'] as String? ?? '',
      );

  String get shortLabel {
    switch (docType) {
      case 'invoice':
        return 'Facture';
      case 'delivery_note':
        return 'Bon';
      case 'credit_note':
        return 'Avoir';
      case 'ticket':
        return 'Ticket';
      default:
        return docType;
    }
  }
}

class InstSale {
  const InstSale({
    required this.id,
    required this.ticketNumber,
    required this.totalCents,
    required this.amountPaidCents,
    required this.status,
    required this.paymentMethod,
    required this.createdAt,
    required this.itemsCount,
    required this.itemsSummary,
    required this.items,
    required this.payments,
    this.notes,
    this.clientLabel,
    this.clientEmail,
    this.calendarDate,
    this.documents = const [],
    this.creditedCents = 0,
  });

  final String id;
  final String? ticketNumber;
  final int totalCents;
  final int amountPaidCents;
  final String status;
  final String paymentMethod;
  final String? notes;
  final DateTime createdAt;
  final String? clientLabel;
  final String? clientEmail;
  final int itemsCount;
  final String itemsSummary;
  final List<InstSaleItem> items;
  final List<InstSalePayment> payments;
  final String? calendarDate;
  final List<InstSaleDocumentRef> documents;
  final int creditedCents;

  int get refundableCents {
    final left = amountPaidCents - creditedCents;
    return left < 0 ? 0 : left;
  }

  bool get canIssueCredit => status != 'refunded' && refundableCents > 0;

  factory InstSale.fromJson(Map<String, dynamic> json) {
    return InstSale(
      id: json['id'] as String,
      ticketNumber: json['ticketNumber'] as String?,
      totalCents: json['totalCents'] as int? ?? 0,
      amountPaidCents: json['amountPaidCents'] as int? ?? 0,
      status: json['status'] as String? ?? 'paid',
      paymentMethod: json['paymentMethod'] as String? ?? '',
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      clientLabel: json['clientLabel'] as String?,
      clientEmail: json['clientEmail'] as String?,
      itemsCount: json['itemsCount'] as int? ?? 0,
      itemsSummary: json['itemsSummary'] as String? ?? '',
      items: (json['items'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstSaleItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      payments: (json['payments'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstSalePayment.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      calendarDate: json['calendarDate'] as String?,
      documents: (json['documents'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstSaleDocumentRef.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      creditedCents: json['creditedCents'] as int? ?? 0,
    );
  }
}

class InstSalePage {
  const InstSalePage({
    required this.items,
    required this.nextCursor,
    this.today,
  });
  final List<InstSale> items;
  final String? nextCursor;
  final String? today;
}

class InstSaleDocument {
  const InstSaleDocument({
    required this.id,
    required this.docType,
    required this.docNumber,
    required this.status,
    required this.issuedAt,
    required this.amountCents,
    this.saleId,
    this.calendarDate,
    this.clientLabel,
  });

  final String id;
  final String docType;
  final String docNumber;
  final String status;
  final DateTime issuedAt;
  final int amountCents;
  final String? saleId;
  final String? calendarDate;
  final String? clientLabel;

  factory InstSaleDocument.fromJson(Map<String, dynamic> json) {
    return InstSaleDocument(
      id: json['id'] as String,
      docType: json['docType'] as String? ?? '',
      docNumber: json['docNumber'] as String? ?? '',
      status: json['status'] as String? ?? '',
      issuedAt: DateTime.parse(json['issuedAt'] as String).toLocal(),
      amountCents: json['amountCents'] as int? ?? 0,
      saleId: json['saleId'] as String?,
      calendarDate: json['calendarDate'] as String?,
      clientLabel: json['clientLabel'] as String?,
    );
  }

  String get typeLabel {
    switch (docType) {
      case 'invoice':
        return 'Facture';
      case 'delivery_note':
        return 'Bon de livraison';
      case 'credit_note':
        return 'Avoir';
      case 'ticket':
        return 'Ticket';
      default:
        return docType;
    }
  }
}

class InstDocumentPage {
  const InstDocumentPage({
    required this.items,
    required this.nextCursor,
    this.today,
  });
  final List<InstSaleDocument> items;
  final String? nextCursor;
  final String? today;
}

class InstStaffMember {
  const InstStaffMember({
    required this.id,
    required this.fullName,
    required this.email,
    required this.avatarUrl,
    required this.color,
    required this.isActive,
    required this.hasSchedule,
    required this.hasAccount,
  });

  final String id;
  final String fullName;
  final String? email;
  final String? avatarUrl;
  final String? color;
  final bool isActive;
  final bool hasSchedule;
  final bool hasAccount;

  factory InstStaffMember.fromJson(Map<String, dynamic> json) {
    return InstStaffMember(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      color: json['color'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      hasSchedule: json['hasSchedule'] as bool? ?? false,
      hasAccount: json['hasAccount'] as bool? ?? false,
    );
  }
}

class InstTenantContact {
  const InstTenantContact({this.email, this.phone, this.website});
  final String? email;
  final String? phone;
  final String? website;

  factory InstTenantContact.fromJson(Map<String, dynamic> json) =>
      InstTenantContact(
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        website: json['website'] as String?,
      );

  bool get isEmpty => email == null && phone == null && website == null;

  Map<String, dynamic> toJson() => {
        'email': email,
        'phone': phone,
        'website': website,
      };
}

class InstTenantAddress {
  const InstTenantAddress({
    this.line1,
    this.line2,
    this.city,
    this.postalCode,
    this.country,
  });

  final String? line1;
  final String? line2;
  final String? city;
  final String? postalCode;
  final String? country;

  factory InstTenantAddress.fromJson(Map<String, dynamic> json) =>
      InstTenantAddress(
        line1: json['line1'] as String?,
        line2: json['line2'] as String?,
        city: json['city'] as String?,
        postalCode: json['postalCode'] as String?,
        country: json['country'] as String?,
      );

  bool get isEmpty =>
      line1 == null &&
      line2 == null &&
      city == null &&
      postalCode == null &&
      country == null;

  String get oneLine {
    final parts = <String>[];
    if (line1 != null && line1!.isNotEmpty) parts.add(line1!);
    if (line2 != null && line2!.isNotEmpty) parts.add(line2!);
    final cityLine = [
      if (postalCode != null && postalCode!.isNotEmpty) postalCode!,
      if (city != null && city!.isNotEmpty) city!,
    ].join(' ');
    if (cityLine.isNotEmpty) parts.add(cityLine);
    if (country != null && country!.isNotEmpty) parts.add(country!);
    return parts.join(', ');
  }

  Map<String, dynamic> toJson() => {
        'line1': line1,
        'line2': line2,
        'city': city,
        'postalCode': postalCode,
        'country': country,
      };
}

class InstOpeningSlot {
  const InstOpeningSlot({required this.start, required this.end});
  final String start;
  final String end;

  factory InstOpeningSlot.fromJson(Map<String, dynamic> json) =>
      InstOpeningSlot(
        start: json['start'] as String? ?? '',
        end: json['end'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'start': start, 'end': end};
}

class InstOpeningDay {
  const InstOpeningDay({
    required this.weekday,
    required this.label,
    required this.slots,
  });

  final int weekday;
  final String label;
  final List<InstOpeningSlot> slots;

  factory InstOpeningDay.fromJson(Map<String, dynamic> json) {
    return InstOpeningDay(
      weekday: json['weekday'] as int? ?? 0,
      label: json['label'] as String? ?? '',
      slots: (json['slots'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstOpeningSlot.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
    );
  }

  Map<String, dynamic> toJson() => {
        'weekday': weekday,
        'slots': slots.map((s) => s.toJson()).toList(growable: false),
      };
}

class InstTenantCounts {
  const InstTenantCounts({
    required this.activeStaff,
    required this.activeServices,
    required this.clients,
  });

  final int activeStaff;
  final int activeServices;
  final int clients;

  factory InstTenantCounts.fromJson(Map<String, dynamic> json) =>
      InstTenantCounts(
        activeStaff: json['activeStaff'] as int? ?? 0,
        activeServices: json['activeServices'] as int? ?? 0,
        clients: json['clients'] as int? ?? 0,
      );
}

class InstTenantInfo {
  const InstTenantInfo({
    required this.id,
    required this.name,
    required this.slug,
    required this.displayName,
    required this.openingHours,
    required this.contact,
    required this.address,
    required this.counts,
    this.description,
    this.logoUrl,
    this.primaryColor,
    this.customDomain,
  });

  final String id;
  final String name;
  final String slug;
  final String displayName;
  final String? description;
  final String? logoUrl;
  final String? primaryColor;
  final String? customDomain;
  final InstTenantContact contact;
  final InstTenantAddress address;
  final List<InstOpeningDay> openingHours;
  final InstTenantCounts counts;

  factory InstTenantInfo.fromJson(Map<String, dynamic> json) {
    return InstTenantInfo(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      description: json['description'] as String?,
      logoUrl: json['logoUrl'] as String?,
      primaryColor: json['primaryColor'] as String?,
      customDomain: json['customDomain'] as String?,
      contact: InstTenantContact.fromJson(
        Map<String, dynamic>.from((json['contact'] as Map?) ?? const {}),
      ),
      address: InstTenantAddress.fromJson(
        Map<String, dynamic>.from((json['address'] as Map?) ?? const {}),
      ),
      openingHours: (json['openingHours'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstOpeningDay.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      counts: InstTenantCounts.fromJson(
        Map<String, dynamic>.from((json['counts'] as Map?) ?? const {}),
      ),
    );
  }
}

int _asInt(Object? value) => (value as num?)?.toInt() ?? 0;

class InstLoyaltyProgramRef {
  const InstLoyaltyProgramRef({
    required this.id,
    required this.name,
    required this.isActive,
    required this.pointsLabel,
  });

  final String id;
  final String name;
  final bool isActive;
  final String pointsLabel;

  factory InstLoyaltyProgramRef.fromJson(Map<String, dynamic> json) =>
      InstLoyaltyProgramRef(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        isActive: json['isActive'] as bool? ?? false,
        pointsLabel: json['pointsLabel'] as String? ?? 'points',
      );
}

class InstLoyaltyNextReward {
  const InstLoyaltyNextReward({
    required this.name,
    required this.pointsCost,
    required this.missing,
  });

  final String name;
  final int pointsCost;
  final int missing;

  factory InstLoyaltyNextReward.fromJson(Map<String, dynamic> json) =>
      InstLoyaltyNextReward(
        name: json['name'] as String? ?? '',
        pointsCost: _asInt(json['pointsCost']),
        missing: _asInt(json['missing']),
      );
}

class InstClientLoyaltyCard {
  const InstClientLoyaltyCard({
    required this.balance,
    required this.pointsLabel,
    required this.lifetimeEarned,
    required this.lifetimeRedeemed,
    required this.valueCents,
    required this.programs,
    this.assignedProgramId,
    this.programId,
    this.programName,
    this.nextReward,
    this.creditEnabled = false,
    this.creditRateBps = 0,
  });

  final String? assignedProgramId;
  final String? programId;
  final String? programName;
  final String pointsLabel;
  final int balance;
  final int lifetimeEarned;
  final int lifetimeRedeemed;
  final InstLoyaltyNextReward? nextReward;
  final int valueCents;
  final bool creditEnabled;
  final int creditRateBps;
  final List<InstLoyaltyProgramRef> programs;

  factory InstClientLoyaltyCard.fromJson(Map<String, dynamic> json) {
    final next = json['nextReward'];
    return InstClientLoyaltyCard(
      assignedProgramId: json['assignedProgramId'] as String?,
      programId: json['programId'] as String?,
      programName: json['programName'] as String?,
      pointsLabel: json['pointsLabel'] as String? ?? 'points',
      balance: _asInt(json['balance']),
      lifetimeEarned: _asInt(json['lifetimeEarned']),
      lifetimeRedeemed: _asInt(json['lifetimeRedeemed']),
      valueCents: _asInt(json['valueCents']),
      creditEnabled: json['creditEnabled'] as bool? ?? false,
      creditRateBps: _asInt(json['creditRateBps']),
      nextReward: next is Map
          ? InstLoyaltyNextReward.fromJson(Map<String, dynamic>.from(next))
          : null,
      programs: (json['programs'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstLoyaltyProgramRef.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
    );
  }
}

class InstLoyaltyLedgerEntry {
  const InstLoyaltyLedgerEntry({
    required this.id,
    required this.type,
    required this.pointsDelta,
    required this.balanceAfter,
    required this.createdAt,
    this.source,
  });

  final String id;
  final String type;
  final int pointsDelta;
  final int balanceAfter;
  final DateTime createdAt;
  final String? source;

  factory InstLoyaltyLedgerEntry.fromJson(Map<String, dynamic> json) =>
      InstLoyaltyLedgerEntry(
        id: json['id'] as String,
        type: json['type'] as String? ?? '',
        pointsDelta: _asInt(json['pointsDelta']),
        balanceAfter: _asInt(json['balanceAfter']),
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
        source: json['source'] as String?,
      );
}

class InstClientLoyaltyDetail {
  const InstClientLoyaltyDetail({
    required this.card,
    required this.ledger,
  });

  final InstClientLoyaltyCard card;
  final List<InstLoyaltyLedgerEntry> ledger;

  factory InstClientLoyaltyDetail.fromJson(Map<String, dynamic> json) =>
      InstClientLoyaltyDetail(
        card: InstClientLoyaltyCard.fromJson(
          Map<String, dynamic>.from((json['card'] as Map?) ?? const {}),
        ),
        ledger: (json['ledger'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstLoyaltyLedgerEntry.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
      );
}

class InstClientStats {
  const InstClientStats({
    required this.appointmentCount,
    required this.completedCount,
    required this.upcomingCount,
    required this.totalSpentCents,
    required this.saleCount,
    required this.loyaltyPoints,
    this.bookingRate,
  });

  final int appointmentCount;
  final int completedCount;
  final int upcomingCount;
  final int? bookingRate;
  final int totalSpentCents;
  final int saleCount;
  final int loyaltyPoints;

  factory InstClientStats.fromJson(Map<String, dynamic> json) => InstClientStats(
        appointmentCount: _asInt(json['appointmentCount']),
        completedCount: _asInt(json['completedCount']),
        upcomingCount: _asInt(json['upcomingCount']),
        bookingRate: (json['bookingRate'] as num?)?.toInt(),
        totalSpentCents: _asInt(json['totalSpentCents']),
        saleCount: _asInt(json['saleCount']),
        loyaltyPoints: _asInt(json['loyaltyPoints']),
      );
}

class InstClientTopService {
  const InstClientTopService({
    required this.serviceName,
    required this.count,
  });

  final String serviceName;
  final int count;

  factory InstClientTopService.fromJson(Map<String, dynamic> json) =>
      InstClientTopService(
        serviceName: json['serviceName'] as String? ?? '',
        count: _asInt(json['count']),
      );
}

class InstClientDossier {
  const InstClientDossier({
    required this.client,
    required this.stats,
    required this.loyalty,
    this.topServices = const [],
  });

  final InstClient client;
  final InstClientStats stats;
  final InstClientLoyaltyCard loyalty;
  final List<InstClientTopService> topServices;

  factory InstClientDossier.fromJson(Map<String, dynamic> json) =>
      InstClientDossier(
        client: InstClient.fromJson(
          Map<String, dynamic>.from((json['client'] as Map?) ?? const {}),
        ),
        stats: InstClientStats.fromJson(
          Map<String, dynamic>.from((json['stats'] as Map?) ?? const {}),
        ),
        loyalty: InstClientLoyaltyCard.fromJson(
          Map<String, dynamic>.from((json['loyalty'] as Map?) ?? const {}),
        ),
        topServices: (json['topServices'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstClientTopService.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
      );
}

class InstClientAppointment {
  const InstClientAppointment({
    required this.id,
    required this.startsAt,
    required this.status,
    this.endsAt,
    this.priceCents,
    this.serviceName,
    this.staffName,
  });

  final String id;
  final DateTime startsAt;
  final DateTime? endsAt;
  final String status;
  final int? priceCents;
  final String? serviceName;
  final String? staffName;

  factory InstClientAppointment.fromJson(Map<String, dynamic> json) =>
      InstClientAppointment(
        id: json['id'] as String,
        startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
        endsAt: json['endsAt'] is String
            ? DateTime.parse(json['endsAt'] as String).toLocal()
            : null,
        status: json['status'] as String? ?? '',
        priceCents: (json['priceCents'] as num?)?.toInt(),
        serviceName: json['serviceName'] as String?,
        staffName: json['staffName'] as String?,
      );
}

class InstClientAppointmentsPage {
  const InstClientAppointmentsPage({
    required this.upcoming,
    required this.past,
  });

  final List<InstClientAppointment> upcoming;
  final List<InstClientAppointment> past;

  factory InstClientAppointmentsPage.fromJson(Map<String, dynamic> json) =>
      InstClientAppointmentsPage(
        upcoming: (json['upcoming'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstClientAppointment.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
        past: (json['past'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstClientAppointment.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
      );
}

class InstClientSaleItem {
  const InstClientSaleItem({
    required this.name,
    required this.quantity,
    required this.unitPriceCents,
  });

  final String name;
  final int quantity;
  final int unitPriceCents;

  factory InstClientSaleItem.fromJson(Map<String, dynamic> json) =>
      InstClientSaleItem(
        name: json['name'] as String? ?? '',
        quantity: _asInt(json['quantity']),
        unitPriceCents: _asInt(json['unitPriceCents']),
      );
}

class InstClientSale {
  const InstClientSale({
    required this.id,
    required this.totalCents,
    required this.status,
    required this.createdAt,
    this.ticketNumber,
    this.paymentMethod,
    this.items = const [],
  });

  final String id;
  final String? ticketNumber;
  final int totalCents;
  final String status;
  final String? paymentMethod;
  final DateTime createdAt;
  final List<InstClientSaleItem> items;

  factory InstClientSale.fromJson(Map<String, dynamic> json) => InstClientSale(
        id: json['id'] as String,
        ticketNumber: json['ticketNumber'] as String?,
        totalCents: _asInt(json['totalCents']),
        status: json['status'] as String? ?? '',
        paymentMethod: json['paymentMethod'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
        items: (json['items'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstClientSaleItem.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
      );
}

class InstLoyaltyEarnRule {
  const InstLoyaltyEarnRule({
    required this.id,
    required this.name,
    required this.isActive,
    required this.sourceType,
    required this.calcMode,
    required this.pointsValue,
    required this.minAmountCents,
  });

  final String id;
  final String name;
  final bool isActive;
  final String sourceType;
  final String calcMode;
  final int pointsValue;
  final int minAmountCents;

  factory InstLoyaltyEarnRule.fromJson(Map<String, dynamic> json) =>
      InstLoyaltyEarnRule(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        isActive: json['isActive'] as bool? ?? true,
        sourceType: json['sourceType'] as String? ?? '',
        calcMode: json['calcMode'] as String? ?? '',
        pointsValue: _asInt(json['pointsValue']),
        minAmountCents: _asInt(json['minAmountCents']),
      );
}

class InstLoyaltyRewardAdmin {
  const InstLoyaltyRewardAdmin({
    required this.id,
    required this.name,
    required this.isActive,
    required this.rewardType,
    required this.pointsCost,
    required this.newServiceOnly,
    this.description,
    this.discountPercent,
    this.discountCents,
    this.serviceId,
  });

  final String id;
  final String name;
  final String? description;
  final bool isActive;
  final String rewardType;
  final int pointsCost;
  final int? discountPercent;
  final int? discountCents;
  final String? serviceId;
  final bool newServiceOnly;

  factory InstLoyaltyRewardAdmin.fromJson(Map<String, dynamic> json) =>
      InstLoyaltyRewardAdmin(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        isActive: json['isActive'] as bool? ?? true,
        rewardType: json['rewardType'] as String? ?? '',
        pointsCost: _asInt(json['pointsCost']),
        discountPercent: (json['discountPercent'] as num?)?.toInt(),
        discountCents: (json['discountCents'] as num?)?.toInt(),
        serviceId: json['serviceId'] as String?,
        newServiceOnly: json['newServiceOnly'] as bool? ?? false,
      );
}

class InstLoyaltyServiceOption {
  const InstLoyaltyServiceOption({required this.id, required this.name});
  final String id;
  final String name;

  factory InstLoyaltyServiceOption.fromJson(Map<String, dynamic> json) =>
      InstLoyaltyServiceOption(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
      );
}

class InstLoyaltyProgramAdmin {
  const InstLoyaltyProgramAdmin({
    required this.id,
    required this.name,
    required this.isActive,
    required this.pointsLabel,
    required this.birthdayBonusPoints,
    required this.portalVisible,
    required this.referralPoints,
    required this.sameDayRebookPoints,
    required this.birthdayAutoEnabled,
    this.creditEnabled = false,
    this.creditRateBps = 0,
  });

  final String id;
  final String name;
  final bool isActive;
  final String pointsLabel;
  final int birthdayBonusPoints;
  final bool portalVisible;
  final int referralPoints;
  final int sameDayRebookPoints;
  final bool birthdayAutoEnabled;
  final bool creditEnabled;
  final int creditRateBps;

  factory InstLoyaltyProgramAdmin.fromJson(Map<String, dynamic> json) =>
      InstLoyaltyProgramAdmin(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        isActive: json['isActive'] as bool? ?? false,
        pointsLabel: json['pointsLabel'] as String? ?? 'points',
        birthdayBonusPoints: _asInt(json['birthdayBonusPoints']),
        portalVisible: json['portalVisible'] as bool? ?? true,
        referralPoints: _asInt(json['referralPoints']),
        sameDayRebookPoints: _asInt(json['sameDayRebookPoints']),
        birthdayAutoEnabled: json['birthdayAutoEnabled'] as bool? ?? false,
        creditEnabled: json['creditEnabled'] as bool? ?? false,
        creditRateBps: _asInt(json['creditRateBps']),
      );
}

class InstLoyaltyAdminSnapshot {
  const InstLoyaltyAdminSnapshot({
    required this.program,
    required this.programs,
    required this.rules,
    required this.rewards,
    required this.wooConnected,
    this.services = const [],
    this.clientsWithPoints = 0,
    this.totalPointsOutstanding = 0,
  });

  final InstLoyaltyProgramAdmin program;
  final List<InstLoyaltyProgramRef> programs;
  final List<InstLoyaltyEarnRule> rules;
  final List<InstLoyaltyRewardAdmin> rewards;
  final bool wooConnected;
  final List<InstLoyaltyServiceOption> services;
  final int clientsWithPoints;
  final int totalPointsOutstanding;

  factory InstLoyaltyAdminSnapshot.fromJson(Map<String, dynamic> json) {
    final stats = Map<String, dynamic>.from((json['stats'] as Map?) ?? const {});
    final integrations =
        Map<String, dynamic>.from((json['integrations'] as Map?) ?? const {});
    return InstLoyaltyAdminSnapshot(
      program: InstLoyaltyProgramAdmin.fromJson(
        Map<String, dynamic>.from((json['program'] as Map?) ?? const {}),
      ),
      programs: (json['programs'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstLoyaltyProgramRef.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      rules: (json['rules'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstLoyaltyEarnRule.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      rewards: (json['rewards'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstLoyaltyRewardAdmin.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      wooConnected: integrations['woocommerce'] as bool? ?? false,
      services: (json['services'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => InstLoyaltyServiceOption.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      clientsWithPoints: _asInt(stats['clientsWithPoints']),
      totalPointsOutstanding: _asInt(stats['totalPointsOutstanding']),
    );
  }
}

class InstPromo {
  const InstPromo({
    required this.id,
    required this.code,
    required this.name,
    required this.discountType,
    required this.isActive,
    required this.status,
    required this.channelWoo,
    required this.channelBooking,
    required this.channelPos,
    required this.usageCount,
    required this.minOrderCents,
    this.description,
    this.discountPercent,
    this.discountCents,
    this.startsAt,
    this.endsAt,
    this.usageLimit,
    this.usageLimitPerClient,
  });

  final String id;
  final String code;
  final String name;
  final String? description;
  final String discountType;
  final int? discountPercent;
  final int? discountCents;
  final int minOrderCents;
  final String? startsAt;
  final String? endsAt;
  final int usageCount;
  final int? usageLimit;
  final int? usageLimitPerClient;
  final bool channelWoo;
  final bool channelBooking;
  final bool channelPos;
  final bool isActive;
  final String status;

  factory InstPromo.fromJson(Map<String, dynamic> json) => InstPromo(
        id: json['id'] as String? ?? '',
        code: json['code'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        discountType: json['discountType'] as String? ?? 'percent',
        discountPercent: json['discountPercent'] == null
            ? null
            : _asInt(json['discountPercent']),
        discountCents: json['discountCents'] == null
            ? null
            : _asInt(json['discountCents']),
        minOrderCents: _asInt(json['minOrderCents']),
        startsAt: json['startsAt'] as String?,
        endsAt: json['endsAt'] as String?,
        usageCount: _asInt(json['usageCount']),
        usageLimit:
            json['usageLimit'] == null ? null : _asInt(json['usageLimit']),
        usageLimitPerClient: json['usageLimitPerClient'] == null
            ? null
            : _asInt(json['usageLimitPerClient']),
        channelWoo: json['channelWoo'] as bool? ?? false,
        channelBooking: json['channelBooking'] as bool? ?? false,
        channelPos: json['channelPos'] as bool? ?? false,
        isActive: json['isActive'] as bool? ?? false,
        status: json['status'] as String? ?? 'inactive',
      );
}

class InstTaxOption {
  const InstTaxOption({
    required this.id,
    required this.label,
    this.bps,
    this.band,
  });

  final String id;
  final String label;
  final int? bps;
  final String? band;

  factory InstTaxOption.fromJson(Map<String, dynamic> json) => InstTaxOption(
        id: json['id'] as String? ?? json['code'] as String? ?? '',
        label: json['label'] as String? ?? '',
        bps: json['bps'] == null ? null : _asInt(json['bps']),
        band: json['band'] as String?,
      );
}

class InstTaxCountry {
  const InstTaxCountry({
    required this.code,
    required this.label,
    required this.vatName,
    required this.companyIdLabel,
    required this.vatNumberLabel,
    required this.regimes,
    required this.rates,
  });

  final String code;
  final String label;
  final String vatName;
  final String companyIdLabel;
  final String vatNumberLabel;
  final List<InstTaxOption> regimes;
  final List<InstTaxOption> rates;

  factory InstTaxCountry.fromJson(Map<String, dynamic> json) => InstTaxCountry(
        code: json['code'] as String? ?? '',
        label: json['label'] as String? ?? '',
        vatName: json['vatName'] as String? ?? 'TVA',
        companyIdLabel: json['companyIdLabel'] as String? ?? 'SIRET',
        vatNumberLabel: json['vatNumberLabel'] as String? ?? 'N° TVA',
        regimes: (json['regimes'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstTaxOption.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
        rates: (json['rates'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstTaxOption.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
      );
}

class InstPosFiscalCatalog {
  const InstPosFiscalCatalog({
    required this.vatName,
    required this.companyIdLabel,
    required this.vatNumberLabel,
    required this.countries,
    required this.regimes,
    required this.rates,
  });

  final String vatName;
  final String companyIdLabel;
  final String vatNumberLabel;
  final List<InstTaxCountry> countries;
  final List<InstTaxOption> regimes;
  final List<InstTaxOption> rates;

  InstTaxCountry? country(String code) {
    for (final item in countries) {
      if (item.code == code) return item;
    }
    return countries.isEmpty ? null : countries.first;
  }

  factory InstPosFiscalCatalog.fromJson(Map<String, dynamic> json) =>
      InstPosFiscalCatalog(
        vatName: json['vatName'] as String? ?? 'TVA',
        companyIdLabel: json['companyIdLabel'] as String? ?? 'SIRET',
        vatNumberLabel: json['vatNumberLabel'] as String? ?? 'N° TVA',
        countries: (json['countries'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstTaxCountry.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
        regimes: (json['regimes'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstTaxOption.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
        rates: (json['rates'] as List? ?? const [])
            .whereType<Map>()
            .map((e) => InstTaxOption.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
      );
}

class InstPosFiscalSettings {
  const InstPosFiscalSettings({
    required this.countryCode,
    required this.currency,
    required this.fiscalRegime,
    required this.priceDisplay,
    required this.vatExempt,
    required this.defaultVatRateBps,
    required this.serviceVatRateBps,
    required this.productVatRateBps,
    required this.catalog,
    this.legalName,
    this.legalAddress,
    this.vatNumber,
    this.siret,
    this.ticketHeader,
    this.ticketFooter,
  });

  final String countryCode;
  final String currency;
  final String fiscalRegime;
  final String priceDisplay;
  final bool vatExempt;
  final int defaultVatRateBps;
  final int serviceVatRateBps;
  final int productVatRateBps;
  final String? legalName;
  final String? legalAddress;
  final String? vatNumber;
  final String? siret;
  final String? ticketHeader;
  final String? ticketFooter;
  final InstPosFiscalCatalog catalog;

  String get serviceVatLabel =>
      '${(serviceVatRateBps / 100).toStringAsFixed(serviceVatRateBps % 100 == 0 ? 0 : 1)} %';

  String get productVatLabel =>
      '${(productVatRateBps / 100).toStringAsFixed(productVatRateBps % 100 == 0 ? 0 : 1)} %';

  factory InstPosFiscalSettings.fromJson(Map<String, dynamic> json) =>
      InstPosFiscalSettings(
        countryCode: json['countryCode'] as String? ?? 'FR',
        currency: json['currency'] as String? ?? 'eur',
        fiscalRegime: json['fiscalRegime'] as String? ?? 'standard',
        priceDisplay: json['priceDisplay'] as String? ?? 'ttc',
        vatExempt: json['vatExempt'] as bool? ?? false,
        defaultVatRateBps: _asInt(json['defaultVatRateBps']),
        serviceVatRateBps: _asInt(json['serviceVatRateBps']),
        productVatRateBps: _asInt(json['productVatRateBps']),
        legalName: json['legalName'] as String?,
        legalAddress: json['legalAddress'] as String?,
        vatNumber: json['vatNumber'] as String?,
        siret: json['siret'] as String?,
        ticketHeader: json['ticketHeader'] as String?,
        ticketFooter: json['ticketFooter'] as String?,
        catalog: InstPosFiscalCatalog.fromJson(
          Map<String, dynamic>.from(json['catalog'] as Map? ?? const {}),
        ),
      );
}

class ServiceExtraConfig {
  const ServiceExtraConfig({
    required this.extraServiceId,
    required this.name,
    required this.durationMin,
    required this.priceCents,
    this.description,
    this.imageUrl,
    this.minQty = 0,
    this.maxQty = 1,
    this.sortOrder = 0,
  });

  final String extraServiceId;
  final String name;
  final String? description;
  final int durationMin;
  final int priceCents;
  final String? imageUrl;
  final int minQty;
  final int maxQty;
  final int sortOrder;

  factory ServiceExtraConfig.fromJson(Map<String, dynamic> json) {
    return ServiceExtraConfig(
      extraServiceId:
          json['extra_service_id'] as String? ?? json['extraServiceId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      durationMin: (json['duration_min'] as num?)?.toInt() ??
          (json['durationMin'] as num?)?.toInt() ??
          0,
      priceCents: (json['price_cents'] as num?)?.toInt() ??
          (json['priceCents'] as num?)?.toInt() ??
          0,
      imageUrl: json['image_url'] as String? ?? json['imageUrl'] as String?,
      minQty: (json['min_qty'] as num?)?.toInt() ?? (json['minQty'] as num?)?.toInt() ?? 0,
      maxQty: (json['max_qty'] as num?)?.toInt() ?? (json['maxQty'] as num?)?.toInt() ?? 1,
      sortOrder:
          (json['sort_order'] as num?)?.toInt() ?? (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}

class BookingExtraLine {
  const BookingExtraLine({
    required this.serviceId,
    required this.quantity,
  });

  final String serviceId;
  final int quantity;

  Map<String, dynamic> toJson() => {
        'service_id': serviceId,
        'quantity': quantity,
      };
}

class RecurrenceOccurrencePreview {
  const RecurrenceOccurrencePreview({
    required this.date,
    required this.startsAt,
    required this.endsAt,
    required this.isFirst,
    required this.conflict,
    this.kind,
    this.reason,
    this.otherClientName,
    this.otherServiceName,
  });

  final String date;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool isFirst;
  final bool conflict;
  final String? kind;
  final String? reason;
  final String? otherClientName;
  final String? otherServiceName;

  factory RecurrenceOccurrencePreview.fromJson(Map<String, dynamic> json) {
    return RecurrenceOccurrencePreview(
      date: json['date'] as String? ?? '',
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      isFirst: json['isFirst'] as bool? ?? false,
      conflict: json['conflict'] as bool? ?? false,
      kind: json['kind'] as String?,
      reason: json['reason'] as String?,
      otherClientName: json['otherClientName'] as String?,
      otherServiceName: json['otherServiceName'] as String?,
    );
  }
}

class RecurrencePreview {
  const RecurrencePreview({
    required this.frequency,
    required this.durationMin,
    required this.freeCount,
    required this.conflictCount,
    required this.occurrences,
  });

  final String frequency;
  final int durationMin;
  final int freeCount;
  final int conflictCount;
  final List<RecurrenceOccurrencePreview> occurrences;

  factory RecurrencePreview.fromJson(Map<String, dynamic> json) {
    return RecurrencePreview(
      frequency: json['frequency'] as String? ?? 'none',
      durationMin: (json['durationMin'] as num?)?.toInt() ?? 0,
      freeCount: (json['freeCount'] as num?)?.toInt() ?? 0,
      conflictCount: (json['conflictCount'] as num?)?.toInt() ?? 0,
      occurrences: (json['occurrences'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (e) => RecurrenceOccurrencePreview.fromJson(
              Map<String, dynamic>.from(e),
            ),
          )
          .toList(),
    );
  }
}

class AppointmentLineInput {
  const AppointmentLineInput({
    required this.serviceId,
    this.extras = const [],
    this.staffId,
    this.resourceId,
  });

  final String serviceId;
  final List<BookingExtraLine> extras;
  final String? staffId;
  final String? resourceId;

  Map<String, dynamic> toJson() => {
        'serviceId': serviceId,
        'extras': extras.map((e) => e.toJson()).toList(),
        if (staffId != null && staffId!.isNotEmpty) 'staffId': staffId,
        if (resourceId != null && resourceId!.isNotEmpty) 'resourceId': resourceId,
      };
}
