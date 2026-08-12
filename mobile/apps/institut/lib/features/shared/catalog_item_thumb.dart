import 'package:flutter/material.dart';

class CatalogItemThumb extends StatelessWidget {
  const CatalogItemThumb({
    super.key,
    this.imageUrl,
    this.colorHex,
    required this.category,
    this.size = 48,
  });

  final String? imageUrl;
  final String? colorHex;
  final String category;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim();
    if (url != null && url.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _fallback(context),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return SizedBox(
              width: size,
              height: size,
              child: const Center(
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            );
          },
        ),
      );
    }
    return _fallback(context);
  }

  Widget _fallback(BuildContext context) {
    final color = _parseColor(colorHex) ??
        switch (category) {
          'service' => const Color(0xFF525252),
          'woocommerce' => const Color(0xFF7C3AED),
          _ => const Color(0xFF737373),
        };

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Icon(
        switch (category) {
          'service' => Icons.spa_outlined,
          'woocommerce' => Icons.shopping_bag_outlined,
          _ => Icons.inventory_2_outlined,
        },
        color: color,
        size: size * 0.45,
      ),
    );
  }

  Color? _parseColor(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    var value = raw.replaceFirst('#', '');
    if (value.length == 6) value = 'FF$value';
    if (value.length != 8) return null;
    final intValue = int.tryParse(value, radix: 16);
    if (intValue == null) return null;
    return Color(intValue);
  }
}
