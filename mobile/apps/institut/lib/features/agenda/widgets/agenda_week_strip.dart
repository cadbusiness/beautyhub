import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class AgendaWeekStrip extends StatelessWidget {
  const AgendaWeekStrip({
    super.key,
    required this.selectedDate,
    required this.weekDays,
    required this.onSelect,
  });

  final DateTime selectedDate;
  final List<({String date, int count})> weekDays;
  final ValueChanged<DateTime> onSelect;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  DateTime _parseDate(String ymd) {
    final parts = ymd.split('-');
    return DateTime(
      int.parse(parts[0]),
      int.parse(parts[1]),
      int.parse(parts[2]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dayFmt = DateFormat('E', 'fr_FR');

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
      child: Row(
        children: [
          for (final item in weekDays)
            Expanded(
              child: _DayCell(
                date: _parseDate(item.date),
                label: dayFmt.format(_parseDate(item.date)).replaceAll('.', ''),
                selected: _sameDay(_parseDate(item.date), selectedDate),
                hasAppointments: item.count > 0,
                onTap: () => onSelect(_parseDate(item.date)),
              ),
            ),
        ],
      ),
    );
  }

  bool _sameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.label,
    required this.selected,
    required this.hasAppointments,
    required this.onTap,
  });

  final DateTime date;
  final String label;
  final bool selected;
  final bool hasAppointments;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          children: [
            Text(
              label.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
                color: selected ? AgendaWeekStrip._black : AgendaWeekStrip._muted,
              ),
            ),
            const SizedBox(height: 6),
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? AgendaWeekStrip._black : Colors.transparent,
                shape: BoxShape.circle,
              ),
              child: Text(
                '${date.day}',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AgendaWeekStrip._black,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                color: hasAppointments
                    ? (selected
                        ? AgendaWeekStrip._black
                        : const Color(0xFFB0B0B0))
                    : Colors.transparent,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
