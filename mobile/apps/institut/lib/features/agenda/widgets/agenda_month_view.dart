import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';

/// Vue mois : grille 7 × 6, tap sur un jour → sélectionne + bascule en vue jour.
class AgendaMonthView extends ConsumerWidget {
  const AgendaMonthView({
    super.key,
    required this.anchor,
    required this.selected,
  });

  final DateTime anchor;
  final DateTime selected;

  static const _muted = Color(0xFF737373);
  static const _line = Color(0xFFE8E8E8);

  DateTime _startOfMonth(DateTime d) => DateTime(d.year, d.month, 1);

  DateTime _gridStart(DateTime monthStart) {
    final wd = monthStart.weekday;
    return monthStart.subtract(Duration(days: wd - 1));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final monthStart = _startOfMonth(anchor);
    final gridStart = _gridStart(monthStart);
    final cells =
        List<DateTime>.generate(42, (i) => gridStart.add(Duration(days: i)));
    final from = cells.first;
    final to = cells.last;
    final rangeAsync =
        ref.watch(agendaRangeProvider(AgendaRangeArgs(from: from, to: to)));
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return rangeAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          'Impossible de charger le mois.\n$e',
          textAlign: TextAlign.center,
          style: const TextStyle(color: _muted),
        ),
      ),
      data: (range) {
        final counts = <String, int>{};
        for (final appt in range.appointments) {
          if (appt.isCancelled) continue;
          final key = _key(appt.startsAt);
          counts[key] = (counts[key] ?? 0) + 1;
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _WeekdaysRow(),
            const Divider(height: 1, color: _line),
            LayoutBuilder(
              builder: (context, constraints) {
                final cellWidth = constraints.maxWidth / 7;
                final cellHeight = cellWidth * 0.95;
                return SizedBox(
                  height: cellHeight * 6,
                  child: Column(
                    children: [
                      for (var row = 0; row < 6; row++)
                        SizedBox(
                          height: cellHeight,
                          child: Row(
                            children: [
                              for (var col = 0; col < 7; col++)
                                Expanded(
                                  child: _MonthCell(
                                    day: cells[row * 7 + col],
                                    monthAnchor: anchor,
                                    isSelected: _sameDay(
                                      cells[row * 7 + col],
                                      selected,
                                    ),
                                    isToday: _sameDay(
                                      cells[row * 7 + col],
                                      today,
                                    ),
                                    count: counts[_keyFromDate(
                                          cells[row * 7 + col],
                                        )] ??
                                        0,
                                    onTap: () {
                                      ref
                                          .read(
                                            selectedAgendaDateProvider.notifier,
                                          )
                                          .state = cells[row * 7 + col];
                                      ref
                                          .read(
                                            agendaViewModeProvider.notifier,
                                          )
                                          .state = AgendaViewMode.day;
                                    },
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }

  String _key(DateTime iso) {
    final local = iso.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
  }

  String _keyFromDate(DateTime d) {
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _WeekdaysRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat.E('fr_FR');
    final monday = DateTime(2024, 1, 1);
    return Row(
      children: [
        for (var i = 0; i < 7; i++)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                fmt.format(monday.add(Duration(days: i))).toUpperCase(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  color: Color(0xFF737373),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MonthCell extends StatelessWidget {
  const _MonthCell({
    required this.day,
    required this.monthAnchor,
    required this.isSelected,
    required this.isToday,
    required this.count,
    required this.onTap,
  });

  final DateTime day;
  final DateTime monthAnchor;
  final bool isSelected;
  final bool isToday;
  final int count;
  final VoidCallback onTap;

  static const _muted = Color(0xFF9CA3AF);
  static const _black = Color(0xFF0A0A0A);
  static const _line = Color(0xFFE8E8E8);
  static const _accent = Color(0xFF6D28D9);

  @override
  Widget build(BuildContext context) {
    final inMonth = day.month == monthAnchor.month;
    final textColor = inMonth ? _black : _muted;
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(
            right: BorderSide(color: _line, width: 0.5),
            bottom: BorderSide(color: _line, width: 0.5),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isSelected
                      ? _black
                      : isToday
                          ? _accent
                          : Colors.transparent,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '${day.day}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isToday || isSelected
                        ? FontWeight.w700
                        : FontWeight.w500,
                    color: (isSelected || isToday) ? Colors.white : textColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            if (count > 0)
              Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEDE9FE),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$count',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: _accent,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
