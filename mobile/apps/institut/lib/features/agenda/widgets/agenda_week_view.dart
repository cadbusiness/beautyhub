import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';
import '../agenda_colors.dart';
import 'appointment_detail_sheet.dart';

const int _hourStart = 8;
const int _hourEnd = 20;
const double _slotHeight = 44;
const double _hourColumnWidth = 44;

/// Vue semaine grille horaire (7 colonnes, une par jour).
class AgendaWeekView extends ConsumerWidget {
  const AgendaWeekView({
    super.key,
    required this.anchor,
    this.staffFilter,
    this.resourceFilter,
  });

  final DateTime anchor;
  final String? staffFilter;
  final String? resourceFilter;

  static const _line = Color(0xFFE8E8E8);
  static const _muted = Color(0xFF737373);

  DateTime _mondayOf(DateTime d) {
    final day = DateTime(d.year, d.month, d.day);
    return day.subtract(Duration(days: day.weekday - 1));
  }

  bool _matchesFilter(DayAppointment a) {
    if (staffFilter != null && a.staffId != staffFilter) return false;
    if (resourceFilter != null && a.resourceId != resourceFilter) return false;
    return true;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final monday = _mondayOf(anchor);
    final sunday = monday.add(const Duration(days: 6));
    final rangeAsync = ref.watch(
      agendaRangeProvider(AgendaRangeArgs(from: monday, to: sunday)),
    );
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final selectedDate = ref.watch(selectedAgendaDateProvider);

    return rangeAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          'Impossible de charger la semaine.\n$e',
          textAlign: TextAlign.center,
          style: const TextStyle(color: _muted),
        ),
      ),
      data: (range) {
        final days =
            List<DateTime>.generate(7, (i) => monday.add(Duration(days: i)));
        final byDay = <String, List<DayAppointment>>{};
        for (final appt in range.appointments) {
          if (!_matchesFilter(appt)) continue;
          final key = _dateKey(appt.startsAt.toLocal());
          byDay.putIfAbsent(key, () => []).add(appt);
        }
        final totalRows = (_hourEnd - _hourStart);
        final gridHeight = totalRows * _slotHeight;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _WeekHeader(
              days: days,
              selectedDate: selectedDate,
              today: today,
              onSelect: (d) {
                ref.read(selectedAgendaDateProvider.notifier).state = d;
                ref.read(agendaViewModeProvider.notifier).state =
                    AgendaViewMode.day;
              },
            ),
            const Divider(height: 1, color: _line),
            Expanded(
              child: SingleChildScrollView(
                child: SizedBox(
                  height: gridHeight,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _HourColumn(),
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final day in days)
                              Expanded(
                                child: _DayColumn(
                                  day: day,
                                  today: today,
                                  appointments: byDay[_dateKey(day)] ?? const [],
                                  onTapAppointment: (a) {
                                    showAppointmentDetailSheet(context, ref, a);
                                  },
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _dateKey(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _WeekHeader extends StatelessWidget {
  const _WeekHeader({
    required this.days,
    required this.selectedDate,
    required this.today,
    required this.onSelect,
  });

  final List<DateTime> days;
  final DateTime selectedDate;
  final DateTime today;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final dayFmt = DateFormat.E('fr_FR');
    return Row(
      children: [
        const SizedBox(width: _hourColumnWidth),
        Expanded(
          child: Row(
            children: [
              for (final d in days)
                Expanded(
                  child: InkWell(
                    onTap: () => onSelect(d),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        children: [
                          Text(
                            dayFmt.format(d).toUpperCase(),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: Color(0xFF737373),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            width: 26,
                            height: 26,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _sameDay(d, selectedDate)
                                  ? const Color(0xFF0A0A0A)
                                  : _sameDay(d, today)
                                      ? const Color(0xFF6D28D9)
                                      : Colors.transparent,
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${d.day}',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: (_sameDay(d, selectedDate) ||
                                        _sameDay(d, today))
                                    ? Colors.white
                                    : const Color(0xFF0A0A0A),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _HourColumn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _hourColumnWidth,
      child: Column(
        children: [
          for (var h = _hourStart; h < _hourEnd; h++)
            SizedBox(
              height: _slotHeight,
              child: Padding(
                padding: const EdgeInsets.only(top: 2, right: 6),
                child: Text(
                  '${h.toString().padLeft(2, '0')}h',
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFF737373),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DayColumn extends StatelessWidget {
  const _DayColumn({
    required this.day,
    required this.today,
    required this.appointments,
    required this.onTapAppointment,
  });

  final DateTime day;
  final DateTime today;
  final List<DayAppointment> appointments;
  final ValueChanged<DayAppointment> onTapAppointment;

  static const _line = Color(0xFFE8E8E8);

  @override
  Widget build(BuildContext context) {
    final totalMinutes = (_hourEnd - _hourStart) * 60;
    final pxPerMin = _slotHeight / 60;
    final layouts = _buildLayout(appointments);
    final isToday = day.year == today.year &&
        day.month == today.month &&
        day.day == today.day;

    return Container(
      decoration: BoxDecoration(
        color: isToday ? const Color(0xFFFAF5FF) : Colors.transparent,
        border: const Border(
          left: BorderSide(color: _line, width: 0.5),
        ),
      ),
      child: Stack(
        children: [
          Column(
            children: [
              for (var h = _hourStart; h < _hourEnd; h++)
                SizedBox(
                  height: _slotHeight,
                  child: Container(
                    decoration: const BoxDecoration(
                      border: Border(bottom: BorderSide(color: _line, width: 0.4)),
                    ),
                  ),
                ),
            ],
          ),
          for (final layout in layouts)
            Positioned(
              top: _positionTop(layout.appt, pxPerMin, totalMinutes),
              height: _positionHeight(layout.appt, pxPerMin),
              left: (layout.lane / layout.laneCount) * 100,
              right: ((layout.laneCount - layout.lane - 1) / layout.laneCount) *
                  100,
              child: _WeekBlock(
                appointment: layout.appt,
                onTap: () => onTapAppointment(layout.appt),
              ),
            ),
        ],
      ),
    );
  }

  double _positionTop(DayAppointment appt, double pxPerMin, int totalMinutes) {
    final local = appt.startsAt.toLocal();
    final minutes = local.hour * 60 + local.minute - _hourStart * 60;
    final clamped = minutes.clamp(0, totalMinutes).toDouble();
    return clamped * pxPerMin;
  }

  double _positionHeight(DayAppointment appt, double pxPerMin) {
    final duration = appt.endsAt.toLocal().difference(appt.startsAt.toLocal());
    final minutes = duration.inMinutes.clamp(15, 24 * 60);
    return minutes * pxPerMin;
  }
}

class _LayoutSlot {
  const _LayoutSlot({
    required this.appt,
    required this.lane,
    required this.laneCount,
  });
  final DayAppointment appt;
  final int lane;
  final int laneCount;
}

List<_LayoutSlot> _buildLayout(List<DayAppointment> appointments) {
  if (appointments.isEmpty) return const [];
  final sorted = [...appointments]
    ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
  final clusters = <List<DayAppointment>>[];
  var current = <DayAppointment>[];
  DateTime? currentEnd;
  for (final appt in sorted) {
    if (current.isEmpty || appt.startsAt.isBefore(currentEnd!)) {
      current.add(appt);
      final end = appt.endsAt;
      if (currentEnd == null || end.isAfter(currentEnd)) {
        currentEnd = end;
      }
    } else {
      clusters.add(current);
      current = [appt];
      currentEnd = appt.endsAt;
    }
  }
  if (current.isNotEmpty) clusters.add(current);

  final result = <_LayoutSlot>[];
  for (final cluster in clusters) {
    final laneEnds = <DateTime>[];
    final assigned = <_LayoutSlot>[];
    for (final appt in cluster) {
      var lane = -1;
      for (var i = 0; i < laneEnds.length; i++) {
        if (!laneEnds[i].isAfter(appt.startsAt)) {
          lane = i;
          break;
        }
      }
      if (lane == -1) {
        lane = laneEnds.length;
        laneEnds.add(appt.endsAt);
      } else {
        laneEnds[lane] = appt.endsAt;
      }
      assigned.add(_LayoutSlot(appt: appt, lane: lane, laneCount: 0));
    }
    final laneCount = laneEnds.length;
    for (final slot in assigned) {
      result.add(_LayoutSlot(
        appt: slot.appt,
        lane: slot.lane,
        laneCount: laneCount,
      ));
    }
  }
  return result;
}

class _WeekBlock extends StatelessWidget {
  const _WeekBlock({required this.appointment, required this.onTap});

  final DayAppointment appointment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = agendaAccentColor(appointment);
    final pastel = agendaPastel(accent);
    final cancelled = appointment.isCancelled;
    final timeFmt = DateFormat.Hm();
    final startLabel = timeFmt.format(appointment.startsAt.toLocal());
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 1, vertical: 1),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: Opacity(
            opacity: cancelled ? 0.55 : 1,
            child: Container(
              decoration: BoxDecoration(
                color: pastel,
                borderRadius: BorderRadius.circular(6),
                border: Border(left: BorderSide(color: accent, width: 3)),
              ),
              padding: const EdgeInsets.fromLTRB(4, 3, 4, 3),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    startLabel,
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0A0A0A),
                    ),
                  ),
                  Text(
                    appointment.clientName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF0A0A0A),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
