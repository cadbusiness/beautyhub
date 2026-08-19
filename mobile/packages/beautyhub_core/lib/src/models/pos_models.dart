class PosCatalogItem {
  const PosCatalogItem({
    required this.key,
    required this.type,
    required this.id,
    required this.name,
    required this.priceCents,
    required this.category,
    this.imageUrl,
    this.color,
    this.durationMin,
    this.sku,
    this.wooCategories = const [],
    this.wooBrands = const [],
    this.wooSoins = const [],
    this.serviceCategoryId,
    this.serviceCategoryName,
    this.productCategoryId,
    this.productCategoryName,
    this.soldQty = 0,
    this.description,
    this.stockQuantity,
    this.wooId,
    this.source,
    this.visibility,
  });

  final String key;
  final String type;
  final String id;
  final String name;
  final int priceCents;
  final String category;
  final String? imageUrl;
  final String? color;
  final int? durationMin;
  final String? sku;
  final List<String> wooCategories;
  final List<String> wooBrands;
  final List<String> wooSoins;
  final String? serviceCategoryId;
  final String? serviceCategoryName;
  final String? productCategoryId;
  final String? productCategoryName;
  final int soldQty;
  final String? description;
  final int? stockQuantity;
  final int? wooId;
  final String? source;
  final String? visibility;

  factory PosCatalogItem.fromJson(Map<String, dynamic> json) {
    return PosCatalogItem(
      key: json['key'] as String,
      type: json['type'] as String,
      id: json['id'] as String,
      name: json['name'] as String,
      priceCents: json['priceCents'] as int? ?? 0,
      category: json['category'] as String? ?? 'internal',
      imageUrl: json['imageUrl'] as String?,
      color: json['color'] as String?,
      durationMin: json['durationMin'] as int?,
      sku: json['sku'] as String?,
      wooCategories: (json['wooCategories'] as List? ?? const [])
          .map((e) => e.toString())
          .toList(),
      wooBrands: (json['wooBrands'] as List? ?? const [])
          .map((e) => e.toString())
          .toList(),
      wooSoins: (json['wooSoins'] as List? ?? const [])
          .map((e) => e.toString())
          .toList(),
      serviceCategoryId: json['serviceCategoryId'] as String?,
      serviceCategoryName: json['serviceCategoryName'] as String?,
      productCategoryId: json['productCategoryId'] as String?,
      productCategoryName: json['productCategoryName'] as String?,
      soldQty: (json['soldQty'] as num?)?.toInt() ?? 0,
      description: json['description'] as String?,
      stockQuantity: json['stockQuantity'] as int?,
      wooId: json['wooId'] as int?,
      source: json['source'] as String?,
      visibility: json['visibility'] as String?,
    );
  }

  String get categoryLabel {
    switch (category) {
      case 'service':
        return 'Prestation';
      case 'woocommerce':
        return 'WooCommerce';
      case 'internal':
        return 'Produit interne';
      default:
        return category;
    }
  }
}

class PosOption {
  const PosOption({required this.id, required this.label});

  final String id;
  final String label;

  factory PosOption.fromJson(Map<String, dynamic> json) {
    return PosOption(
      id: json['id'] as String,
      label: json['label'] as String? ?? '',
    );
  }
}

PosOption _categoryOptionFromJson(Map<dynamic, dynamic> raw) {
  final map = Map<String, dynamic>.from(raw);
  return PosOption(
    id: map['id'] as String? ?? '',
    label: map['name'] as String? ?? map['label'] as String? ?? '',
  );
}

class PosPaymentMethods {
  const PosPaymentMethods({
    required this.cash,
    required this.card,
    required this.transfer,
    required this.giftCard,
    required this.stripe,
  });

  final bool cash;
  final bool card;
  final bool transfer;
  final bool giftCard;
  final bool stripe;

  factory PosPaymentMethods.fromJson(Map<String, dynamic>? json) {
    final m = json ?? const {};
    return PosPaymentMethods(
      cash: m['cash'] as bool? ?? true,
      card: m['card'] as bool? ?? true,
      transfer: m['transfer'] as bool? ?? false,
      giftCard: m['gift_card'] as bool? ?? false,
      stripe: m['stripe'] as bool? ?? false,
    );
  }
}

class PosSettingsSummary {
  const PosSettingsSummary({
    required this.currency,
    required this.priceDisplay,
    required this.requireOpenSession,
    required this.paymentMethods,
    this.discountReasons = defaultDiscountReasons,
  });

  static const defaultDiscountReasons = [
    'Geste commercial',
    'Promotion',
    'Fidélité',
    'Erreur de prix',
    'Personnel',
  ];

  final String currency;
  final String priceDisplay;
  final bool requireOpenSession;
  final PosPaymentMethods paymentMethods;
  final List<String> discountReasons;

  factory PosSettingsSummary.fromJson(Map<String, dynamic> json) {
    final raw = json['discountReasons'];
    final reasons = raw is List
        ? raw.whereType<String>().map((e) => e.trim()).where((e) => e.isNotEmpty).toList()
        : const <String>[];
    return PosSettingsSummary(
      currency: json['currency'] as String? ?? 'eur',
      priceDisplay: json['priceDisplay'] as String? ?? 'ttc',
      requireOpenSession: json['requireOpenSession'] as bool? ?? false,
      paymentMethods: PosPaymentMethods.fromJson(
        json['paymentMethods'] as Map<String, dynamic>?,
      ),
      discountReasons:
          reasons.isNotEmpty ? reasons : defaultDiscountReasons,
    );
  }
}

class PosContext {
  const PosContext({
    required this.catalog,
    required this.settings,
    required this.clients,
    required this.staff,
    required this.sessionOpen,
    required this.requireOpenSession,
    required this.wooConnected,
    this.serviceCategories = const [],
    this.productCategories = const [],
    this.sessionOpenedAt,
    this.sessionIsPreviousDay = false,
    this.sessionPaused = false,
    this.currentStaffId,
  });

  final List<PosCatalogItem> catalog;
  final PosSettingsSummary settings;
  final List<PosOption> clients;
  final List<PosOption> staff;
  final bool sessionOpen;
  final bool requireOpenSession;
  final bool wooConnected;
  final List<PosOption> serviceCategories;
  final List<PosOption> productCategories;
  final DateTime? sessionOpenedAt;
  final bool sessionIsPreviousDay;
  final bool sessionPaused;
  final String? currentStaffId;

  factory PosContext.fromJson(Map<String, dynamic> json) {
    final catalog = (json['catalog'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => PosCatalogItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final clients = (json['clients'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => PosOption.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final staff = (json['staff'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => PosOption.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final serviceCategories = (json['serviceCategories'] as List? ?? const [])
        .whereType<Map>()
        .map(_categoryOptionFromJson)
        .where((c) => c.id.isNotEmpty && c.label.isNotEmpty)
        .toList();
    final productCategories = (json['productCategories'] as List? ?? const [])
        .whereType<Map>()
        .map(_categoryOptionFromJson)
        .where((c) => c.id.isNotEmpty && c.label.isNotEmpty)
        .toList();

    return PosContext(
      catalog: catalog,
      settings: PosSettingsSummary.fromJson(
        json['settings'] as Map<String, dynamic>? ?? {},
      ),
      clients: clients,
      staff: staff,
      sessionOpen: json['sessionOpen'] as bool? ?? false,
      requireOpenSession: json['requireOpenSession'] as bool? ?? false,
      wooConnected: json['wooConnected'] as bool? ?? false,
      serviceCategories: serviceCategories,
      productCategories: productCategories,
      sessionOpenedAt: json['sessionOpenedAt'] is String
          ? DateTime.tryParse(json['sessionOpenedAt'] as String)?.toLocal()
          : null,
      sessionIsPreviousDay: json['sessionIsPreviousDay'] as bool? ?? false,
      sessionPaused: json['sessionPaused'] as bool? ?? false,
      currentStaffId: json['currentStaffId'] as String?,
    );
  }
}

class PosLoyaltyReward {
  const PosLoyaltyReward({
    required this.id,
    required this.name,
    required this.pointsCost,
    required this.rewardType,
    this.discountPercent,
    this.discountCents,
    this.eligible = false,
  });

  final String id;
  final String name;
  final int pointsCost;
  final String rewardType;
  final int? discountPercent;
  final int? discountCents;
  final bool eligible;

  factory PosLoyaltyReward.fromJson(Map<String, dynamic> json) {
    return PosLoyaltyReward(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      pointsCost: (json['points_cost'] as num?)?.toInt() ?? 0,
      rewardType: json['reward_type'] as String? ?? 'discount_fixed',
      discountPercent: (json['discount_percent'] as num?)?.toInt(),
      discountCents: (json['discount_cents'] as num?)?.toInt(),
      eligible: json['eligible'] as bool? ?? false,
    );
  }

  int discountForSubtotal(int subtotalCents) {
    if (subtotalCents <= 0) return 0;
    if (rewardType == 'discount_percent' && (discountPercent ?? 0) > 0) {
      final value = (subtotalCents * discountPercent! / 100).round();
      return value > subtotalCents ? subtotalCents : value;
    }
    if (rewardType == 'discount_fixed' && (discountCents ?? 0) > 0) {
      return discountCents! > subtotalCents ? subtotalCents : discountCents!;
    }
    return 0;
  }
}

class PosClientLoyalty {
  const PosClientLoyalty({
    required this.active,
    required this.balance,
    this.programName,
    this.pointsLabel = 'points',
    this.valueCents = 0,
    this.creditEnabled = false,
    this.rewards = const [],
  });

  final bool active;
  final int balance;
  final String? programName;
  final String pointsLabel;
  final int valueCents;
  final bool creditEnabled;
  final List<PosLoyaltyReward> rewards;

  factory PosClientLoyalty.fromJson(Map<String, dynamic> json) {
    return PosClientLoyalty(
      active: json['active'] as bool? ?? false,
      balance: (json['balance'] as num?)?.toInt() ?? 0,
      programName: json['program_name'] as String?,
      pointsLabel: json['points_label'] as String? ?? 'points',
      valueCents: (json['value_cents'] as num?)?.toInt() ?? 0,
      creditEnabled: json['credit_enabled'] as bool? ?? false,
      rewards: (json['rewards'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => PosLoyaltyReward.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class PosCartSnapshot {
  const PosCartSnapshot({
    required this.id,
    required this.label,
    required this.status,
    required this.lines,
    required this.priceOverrides,
    required this.itemCount,
    required this.lockedByOther,
    required this.updatedAt,
    this.clientId,
    this.clientName,
    this.appointmentId,
    this.staffId,
    this.staffName,
    this.discountKind,
    this.discountValue,
    this.discountReason,
    this.cartDiscountCents = 0,
    this.notes,
    this.lockedBy,
    this.lockedByName,
    this.lockedAt,
    this.createdBy,
    this.lineStaff = const {},
  });

  final String id;
  final String label;
  final String status;
  final String? clientId;
  final String? clientName;
  final String? appointmentId;
  final String? staffId;
  final String? staffName;
  final Map<String, int> lines;
  final Map<String, int> priceOverrides;
  final String? discountKind;
  final double? discountValue;
  final String? discountReason;
  final int cartDiscountCents;
  final String? notes;
  final int itemCount;
  final String? lockedBy;
  final String? lockedByName;
  final String? lockedAt;
  final bool lockedByOther;
  final String? createdBy;
  final String updatedAt;
  final Map<String, String> lineStaff;

  factory PosCartSnapshot.fromJson(Map<String, dynamic> json) {
    return PosCartSnapshot(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? 'Panier',
      status: json['status'] as String? ?? 'open',
      clientId: json['clientId'] as String?,
      clientName: json['clientName'] as String?,
      appointmentId: json['appointmentId'] as String?,
      staffId: json['staffId'] as String?,
      staffName: json['staffName'] as String?,
      lines: _intMap(json['lines']),
      priceOverrides: _intMap(json['priceOverrides']),
      discountKind: json['discountKind'] as String?,
      discountValue: (json['discountValue'] as num?)?.toDouble(),
      discountReason: json['discountReason'] as String?,
      cartDiscountCents: (json['cartDiscountCents'] as num?)?.toInt() ?? 0,
      notes: json['notes'] as String?,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      lockedBy: json['lockedBy'] as String?,
      lockedByName: json['lockedByName'] as String?,
      lockedAt: json['lockedAt'] as String?,
      lockedByOther: json['lockedByOther'] as bool? ?? false,
      createdBy: json['createdBy'] as String?,
      updatedAt: json['updatedAt'] as String? ?? '',
      lineStaff: _stringMap(json['lineStaff']),
    );
  }
}

Map<String, String> _stringMap(dynamic raw) {
  if (raw is! Map) return const {};
  final out = <String, String>{};
  for (final entry in raw.entries) {
    final value = entry.value;
    if (value is String && value.isNotEmpty) {
      out[entry.key.toString()] = value;
    }
  }
  return out;
}

Map<String, int> _intMap(dynamic raw) {
  if (raw is! Map) return const {};
  final out = <String, int>{};
  for (final entry in raw.entries) {
    final qty = (entry.value as num?)?.toInt() ?? 0;
    if (qty > 0) out['${entry.key}'] = qty;
  }
  return out;
}

class PosCheckoutResult {
  const PosCheckoutResult({
    required this.saleId,
    required this.ticketNumber,
    required this.status,
    required this.totalCents,
    required this.amountPaidCents,
  });

  final String saleId;
  final String? ticketNumber;
  final String status;
  final int totalCents;
  final int amountPaidCents;

  factory PosCheckoutResult.fromJson(Map<String, dynamic> json) {
    return PosCheckoutResult(
      saleId: json['saleId'] as String,
      ticketNumber: json['ticketNumber'] as String?,
      status: json['status'] as String? ?? 'paid',
      totalCents: json['totalCents'] as int? ?? 0,
      amountPaidCents: json['amountPaidCents'] as int? ?? 0,
    );
  }
}
