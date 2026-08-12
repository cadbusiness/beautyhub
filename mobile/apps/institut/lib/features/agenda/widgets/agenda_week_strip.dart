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
    final today = DateTime.now();
    final todayKey =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: weekDays.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = weekDays[index];
          final date = _parseDate(item.date);
          final selected = date.year == selectedDate.year &&
              date.month == selectedDate.month &&
              date.day == selectedDate.day;
          final isToday = item.date == todayKey;
          final label = dayFmt.format(date).replaceAll('.', '');

          return Material(
            color: selected ? _black : Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: () => onSelect(date),
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: 52,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: selected
                      ? null
                      : Border.all(
                          color: isToday ? _black : const Color(0xFFE8E8E8),
                          width: isToday ? 1.5 : 1,
                        ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      label.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.4,
                        color: selected
                            ? Colors.white.withValues(alpha: 0.7)
                            : _muted,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${date.day}',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: selected ? Colors.white : _black,
                      ),
                    ),
                    if (item.count > 0) ...[
                      const SizedBox(height: 4),
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: selected
                              ? Colors.white
                              : const Color(0xFF0A0A0A),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
