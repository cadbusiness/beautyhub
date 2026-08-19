import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';

class AgendaStatsStrip extends StatelessWidget {
  const AgendaStatsStrip({super.key, required this.stats});

  final DayAgendaStats stats;

  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      stats.scheduled == 1 ? '1 prévu' : '${stats.scheduled} prévus',
      if (stats.completed > 0)
        stats.completed == 1 ? '1 terminé' : '${stats.completed} terminés',
    ];

    return Text(
      parts.join('  ·  '),
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: _muted,
      ),
    );
  }
}
