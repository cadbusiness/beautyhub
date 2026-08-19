import 'package:flutter/material.dart';

/// Feuille modale pleine largeur — évite le cadre 640 px centré sur iPad.
Future<T?> showAppSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = true,
  bool useSafeArea = true,
  Color backgroundColor = Colors.white,
  double? maxHeightFactor,
}) {
  final size = MediaQuery.sizeOf(context);
  final tablet = size.shortestSide >= 600;
  final heightFactor = maxHeightFactor ?? (tablet ? 0.92 : 0.94);

  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    useSafeArea: useSafeArea,
    backgroundColor: backgroundColor,
    barrierColor: const Color(0x99000000),
    constraints: BoxConstraints(
      minWidth: size.width,
      maxWidth: size.width,
      maxHeight: size.height * heightFactor,
    ),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: builder,
  );
}
