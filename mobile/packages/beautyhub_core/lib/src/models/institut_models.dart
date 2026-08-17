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
