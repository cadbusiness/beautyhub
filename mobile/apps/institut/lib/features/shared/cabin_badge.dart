import 'package:flutter/material.dart';

import '../agenda/agenda_format.dart';

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

  @override
  Widget build(BuildContext context) {
    final short = shortCabinLabel(label);
    final tone = Color(cabinToneValue(label));
    final bg = onDark ? Colors.white.withValues(alpha: 0.14) : tone.withValues(alpha: 0.10);
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
        short,
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

class CabinMark extends StatelessWidget {
  const CabinMark({
    super.key,
    required this.label,
    this.size = 22,
  });

  final String label;
  final double size;

  @override
  Widget build(BuildContext context) {
    final short = shortCabinLabel(label);
    final tone = Color(cabinToneValue(label));

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.10),
        shape: BoxShape.circle,
      ),
      child: Text(
        short,
        maxLines: 1,
        overflow: TextOverflow.clip,
        softWrap: false,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: short.length > 2 ? 9 : 11,
          fontWeight: FontWeight.w700,
          height: 1,
          color: tone,
        ),
      ),
    );
  }
}
