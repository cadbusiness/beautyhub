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
  });

  final List<PosCatalogItem> catalog;
  final PosSettingsSummary settings;
  final List<PosOption> clients;
  final List<PosOption> staff;
  final bool sessionOpen;
  final bool requireOpenSession;
  final bool wooConnected;

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
