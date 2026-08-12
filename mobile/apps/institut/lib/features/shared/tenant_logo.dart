import 'package:flutter/material.dart';

class TenantLogoAvatar extends StatelessWidget {
  const TenantLogoAvatar({
    super.key,
    this.logoUrl,
    required this.label,
    this.size = 44,
    this.primaryColor = const Color(0xFF0A0A0A),
  });

  final String? logoUrl;
  final String label;
  final double size;
  final Color primaryColor;

  @override
  Widget build(BuildContext context) {
    final url = logoUrl?.trim();
    if (url != null && url.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          url,
          width: size,
          height: size,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _Fallback(
            label: label,
            size: size,
            color: primaryColor,
          ),
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

    return _Fallback(label: label, size: size, color: primaryColor);
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({
    required this.label,
    required this.size,
    required this.color,
  });

  final String label;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final initial = label.trim().isNotEmpty ? label.trim()[0].toUpperCase() : '?';
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.38,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class DashboardBrandingHeader extends StatelessWidget {
  const DashboardBrandingHeader({
    super.key,
    required this.displayName,
    required this.dateLabel,
    this.logoUrl,
    this.subtitle,
  });

  final String displayName;
  final String dateLabel;
  final String? logoUrl;
  final String? subtitle;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    final capitalizedDate =
        dateLabel.isNotEmpty ? dateLabel[0].toUpperCase() + dateLabel.substring(1) : dateLabel;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        TenantLogoAvatar(
          logoUrl: logoUrl,
          label: displayName,
          size: 48,
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                displayName,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _black,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                capitalizedDate,
                style: const TextStyle(
                  fontSize: 14,
                  color: _muted,
                ),
              ),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: const TextStyle(fontSize: 12, color: _muted),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
