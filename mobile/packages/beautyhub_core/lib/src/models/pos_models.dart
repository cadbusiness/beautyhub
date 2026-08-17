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
  });

  final String currency;
  final String priceDisplay;
  final bool requireOpenSession;
  final PosPaymentMethods paymentMethods;

  factory PosSettingsSummary.fromJson(Map<String, dynamic> json) {
    return PosSettingsSummary(
      currency: json['currency'] as String? ?? 'eur',
      priceDisplay: json['priceDisplay'] as String? ?? 'ttc',
      requireOpenSession: json['requireOpenSession'] as bool? ?? false,
      paymentMethods: PosPaymentMethods.fromJson(
        json['paymentMethods'] as Map<String, dynamic>?,
      ),
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
    this.sessionOpenedAt,
    this.sessionIsPreviousDay = false,
  });

  final List<PosCatalogItem> catalog;
  final PosSettingsSummary settings;
  final List<PosOption> clients;
  final List<PosOption> staff;
  final bool sessionOpen;
  final bool requireOpenSession;
  final bool wooConnected;
  final List<PosOption> serviceCategories;
  final DateTime? sessionOpenedAt;
  final bool sessionIsPreviousDay;

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
        .map((e) {
          final map = Map<String, dynamic>.from(e);
          return PosOption(
            id: map['id'] as String? ?? '',
            label: map['name'] as String? ?? map['label'] as String? ?? '',
          );
        })
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
      sessionOpenedAt: json['sessionOpenedAt'] is String
          ? DateTime.tryParse(json['sessionOpenedAt'] as String)?.toLocal()
          : null,
      sessionIsPreviousDay: json['sessionIsPreviousDay'] as bool? ?? false,
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
    this.rewards = const [],
  });

  final bool active;
  final int balance;
  final String? programName;
  final String pointsLabel;
  final int valueCents;
  final List<PosLoyaltyReward> rewards;

  factory PosClientLoyalty.fromJson(Map<String, dynamic> json) {
    return PosClientLoyalty(
      active: json['active'] as bool? ?? false,
      balance: (json['balance'] as num?)?.toInt() ?? 0,
      programName: json['program_name'] as String?,
      pointsLabel: json['points_label'] as String? ?? 'points',
      valueCents: (json['value_cents'] as num?)?.toInt() ?? 0,
      rewards: (json['rewards'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => PosLoyaltyReward.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
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
