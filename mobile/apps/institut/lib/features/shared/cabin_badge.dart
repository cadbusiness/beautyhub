import 'package:flutter/material.dart';

class CabinBadge extends StatelessWidget {
  const CabinBadge({
    super.key,
    required this.label,
    this.compact = false,
    this.onDark = false,
  });

  final String label;
  final bool compact;
  final bool onDark;

  static const _palette = [
    Color(0xFF1E3A5F),
    Color(0xFF3D5A3D),
    Color(0xFF6B3E26),
    Color(0xFF4A3F6B),
    Color(0xFF1F4E5F),
    Color(0xFF5C3D2E),
  ];

  Color get _tone {
    var hash = 0;
    for (final unit in label.codeUnits) {
      hash = 0x1fffffff & (hash + unit);
      hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
      hash ^= hash >> 6;
    }
    return _palette[hash.abs() % _palette.length];
  }

  @override
  Widget build(BuildContext context) {
    final tone = _tone;
    final bg = onDark ? Colors.white.withValues(alpha: 0.14) : tone.withValues(alpha: 0.12);
    final fg = onDark ? Colors.white : tone;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 7 : 8,
        vertical: compact ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: onDark
            ? Border.all(color: Colors.white.withValues(alpha: 0.18))
            : null,
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: compact ? 10 : 11,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}
