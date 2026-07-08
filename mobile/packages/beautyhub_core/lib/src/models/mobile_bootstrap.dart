class MobileBootstrap {
  const MobileBootstrap({
    required this.appId,
    required this.audience,
    required this.scopeType,
    required this.appName,
    required this.appSlug,
    required this.deepLinkScheme,
    required this.branding,
    required this.brand,
    required this.tenant,
    required this.api,
    required this.features,
  });

  final String appId;
  final String audience;
  final String scopeType;
  final String appName;
  final String appSlug;
  final String? deepLinkScheme;
  final MobileBranding branding;
  final MobileBrand brand;
  final MobileTenant? tenant;
  final MobileApiConfig api;
  final MobileFeatures features;

  factory MobileBootstrap.fromJson(Map<String, dynamic> json) {
    return MobileBootstrap(
      appId: json['appId'] as String,
      audience: json['audience'] as String,
      scopeType: json['scopeType'] as String,
      appName: json['appName'] as String,
      appSlug: json['appSlug'] as String,
      deepLinkScheme: json['deepLinkScheme'] as String?,
      branding: MobileBranding.fromJson(
        json['branding'] as Map<String, dynamic>? ?? {},
      ),
      brand: MobileBrand.fromJson(json['brand'] as Map<String, dynamic>),
      tenant: json['tenant'] == null
          ? null
          : MobileTenant.fromJson(json['tenant'] as Map<String, dynamic>),
      api: MobileApiConfig.fromJson(json['api'] as Map<String, dynamic>),
      features: MobileFeatures.fromJson(
        json['features'] as Map<String, dynamic>? ?? {},
      ),
    );
  }
}

class MobileBranding {
  const MobileBranding({
    this.primaryColor,
    this.accentColor,
    this.backgroundColor,
    this.logoUrl,
    this.iconUrl,
    this.splashImageUrl,
    this.fontFamily,
  });

  final String? primaryColor;
  final String? accentColor;
  final String? backgroundColor;
  final String? logoUrl;
  final String? iconUrl;
  final String? splashImageUrl;
  final String? fontFamily;

  factory MobileBranding.fromJson(Map<String, dynamic> json) {
    return MobileBranding(
      primaryColor: json['primaryColor'] as String?,
      accentColor: json['accentColor'] as String?,
      backgroundColor: json['backgroundColor'] as String?,
      logoUrl: json['logoUrl'] as String?,
      iconUrl: json['iconUrl'] as String?,
      splashImageUrl: json['splashImageUrl'] as String?,
      fontFamily: json['fontFamily'] as String?,
    );
  }
}

class MobileBrand {
  const MobileBrand({
    required this.id,
    required this.name,
    required this.slug,
  });

  final String id;
  final String name;
  final String slug;

  factory MobileBrand.fromJson(Map<String, dynamic> json) {
    return MobileBrand(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
    );
  }
}

class MobileTenant {
  const MobileTenant({
    required this.id,
    required this.name,
    required this.slug,
  });

  final String id;
  final String name;
  final String slug;

  factory MobileTenant.fromJson(Map<String, dynamic> json) {
    return MobileTenant(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
    );
  }
}

class MobileApiConfig {
  const MobileApiConfig({
    required this.baseUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
  });

  final String baseUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;

  factory MobileApiConfig.fromJson(Map<String, dynamic> json) {
    return MobileApiConfig(
      baseUrl: json['baseUrl'] as String,
      supabaseUrl: json['supabaseUrl'] as String,
      supabaseAnonKey: json['supabaseAnonKey'] as String,
    );
  }
}

class MobileFeatures {
  const MobileFeatures({required this.modules});

  final List<String> modules;

  factory MobileFeatures.fromJson(Map<String, dynamic> json) {
    final raw = json['modules'];
    return MobileFeatures(
      modules: raw is List ? raw.map((e) => e.toString()).toList() : const [],
    );
  }
}
