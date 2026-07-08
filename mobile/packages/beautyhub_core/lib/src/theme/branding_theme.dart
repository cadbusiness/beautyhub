import 'package:flutter/material.dart';

import '../models/mobile_bootstrap.dart';

Color? parseHexColor(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  var value = raw.replaceFirst('#', '');
  if (value.length == 6) value = 'FF$value';
  if (value.length != 8) return null;
  final intValue = int.tryParse(value, radix: 16);
  if (intValue == null) return null;
  return Color(intValue);
}

ThemeData themeFromBranding(MobileBranding branding) {
  final primary = parseHexColor(branding.primaryColor) ?? const Color(0xFF0F172A);
  final accent = parseHexColor(branding.accentColor) ?? const Color(0xFF6366F1);
  final background = parseHexColor(branding.backgroundColor);

  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: accent,
      surface: background ?? Colors.white,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: primary,
      foregroundColor: Colors.white,
      centerTitle: true,
    ),
  );
}
