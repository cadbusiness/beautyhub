import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

/// Thème institut : noir, sans accent bleu du bootstrap marque blanche.
ThemeData institutAppTheme(MobileBranding branding) {
  const black = Color(0xFF0A0A0A);
  const charcoal = Color(0xFF171717);

  return ThemeData(
    useMaterial3: true,
    colorScheme: const ColorScheme.light(
      primary: black,
      onPrimary: Colors.white,
      secondary: charcoal,
      onSecondary: Colors.white,
      surface: Colors.white,
      onSurface: black,
    ),
    scaffoldBackgroundColor: const Color(0xFFF5F5F5),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: black,
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 64,
      backgroundColor: Colors.white,
      indicatorColor: const Color(0xFFE5E5E5),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: black, size: 26);
        }
        return IconThemeData(color: Colors.grey.shade500, size: 24);
      }),
    ),
    tabBarTheme: const TabBarThemeData(
      labelColor: black,
      unselectedLabelColor: Color(0xFF737373),
      indicatorColor: black,
      dividerColor: Color(0xFFE5E5E5),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: black,
        foregroundColor: Colors.white,
      ),
    ),
  );
}
