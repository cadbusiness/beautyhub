import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';
import '../agenda_colors.dart';
import 'appointment_detail_sheet.dart';

const int _hourStart = 8;
const int _hourEnd = 20;
const double _slotHeight = 46;
const double _hourColumnWidth = 34;

/// Seuil au-delà duquel on affiche les 7 jours d'un coup (tablette / iPad).
/// En-dessous (téléphone) on montre 4 colonnes larges + scroll horizontal.
const double _fullWeekBreakpoint = 640;

/// Vue semaine grille horaire.
///
/// - Téléphone (< 640 px) : 4 jours visibles à la fois, scroll horizontal.
///   Le header des jours et la grille sont scrollés en synchronisation.
/// - Tablette/iPad (≥ 640 px) : les 7 jours occupent tout l'espace,
///   colonnes réparties équitablement, pas de scroll horizontal.
/// Le scroll vertical (heures) est indépendant.
class AgendaWeekView extends ConsumerStatefulWidget {
  const AgendaWeekView({
    super.key,
    required this.anchor,
    this.staffFilter,
    this.resourceFilter,
  });

  final DateTime anchor;
  final String? staffFilter;
  final String? resourceFilter;

  @override
  ConsumerState<AgendaWeekView> createState() => _AgendaWeekViewState();
}

class _AgendaWeekViewState extends ConsumerState<AgendaWeekView> {
  final _verticalCtrl = ScrollController();
  final _headerCtrl = ScrollController();
  final _gridCtrl = ScrollController();
  bool _syncing = false;

  static const _line = Color(0xFFE8E8E8);
  static const _muted = Color(0xFF737373);

  @override
  void initState() {
    super.initState();
    _headerCtrl.addListener(_syncFromHeader);
    _gridCtrl.addListener(_syncFromGrid);
  }

  @override
  void dispose() {
    _headerCtrl.removeListener(_syncFromHeader);
    _gridCtrl.removeListener(_syncFromGrid);
    _headerCtrl.dispose();
    _gridCtrl.dispose();
    _verticalCtrl.dispose();
    super.dispose();
  }

  void _syncFromHeader() {
    if (_syncing) return;
    if (!_gridCtrl.hasClients) return;
    if (_gridCtrl.offset == _headerCtrl.offset) return;
    _syncing = true;
    _gridCtrl.jumpTo(_headerCtrl.offset);
    _syncing = false;
  }

  void _syncFromGrid() {
    if (_syncing) return;
    if (!_headerCtrl.hasClients) return;
    if (_headerCtrl.offset == _gridCtrl.offset) return;
    _syncing = true;
    _headerCtrl.jumpTo(_gridCtrl.offset);
    _syncing = false;
  }

  DateTime _mondayOf(DateTime d) {
    final day = DateTime(d.year, d.month, d.day);
    return day.subtract(Duration(days: day.weekday - 1));
  }

  bool _matches(DayAppointment a) {
    if (widget.staffFilter != null && a.staffId != widget.staffFilter) {
      return false;
    }
    if (widget.resourceFilter != null && a.resourceId != widget.resourceFilter) {
      return false;
    }
    return true;
  }

  String _dateKey(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final monday = _mondayOf(widget.anchor);
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
          if (!_matches(appt)) continue;
          final key = _dateKey(appt.startsAt.toLocal());
          byDay.putIfAbsent(key, () => []).add(appt);
        }
        final gridHeight = (_hourEnd - _hourStart) * _slotHeight;

        return LayoutBuilder(builder: (context, constraints) {
          final availableWidth = constraints.maxWidth - _hourColumnWidth;
          final isTablet = constraints.maxWidth >= _fullWeekBreakpoint;
          // Téléphone : 4 colonnes visibles, chaque colonne = un quart de
          // l'espace disponible. Tablette : toutes visibles.
          final visibleDays = isTablet ? 7 : 4;
          final dayColumnWidth = availableWidth / visibleDays;
          final totalDaysWidth = dayColumnWidth * 7;
          final horizontalPhysics = isTablet
              ? const NeverScrollableScrollPhysics()
              : const ClampingScrollPhysics();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _WeekHeader(
                days: days,
                selectedDate: selectedDate,
                today: today,
                controller: _headerCtrl,
                physics: horizontalPhysics,
                dayColumnWidth: dayColumnWidth,
                onSelect: (d) {
                  ref.read(selectedAgendaDateProvider.notifier).state = d;
                  ref.read(agendaViewModeProvider.notifier).state =
                      AgendaViewMode.day;
                },
              ),
              const Divider(height: 1, color: _line),
              Expanded(
                child: SingleChildScrollView(
                  controller: _verticalCtrl,
                  primary: false,
                  child: SizedBox(
                    height: gridHeight,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _HourColumn(),
                        Expanded(
                          child: SingleChildScrollView(
                            controller: _gridCtrl,
                            primary: false,
                            physics: horizontalPhysics,
                            scrollDirection: Axis.horizontal,
                            child: SizedBox(
                              width: totalDaysWidth,
                              height: gridHeight,
                              child: Row(
                                children: [
                                  for (final day in days)
                                    SizedBox(
                                      width: dayColumnWidth,
                                      child: _DayColumn(
                                        day: day,
                                        today: today,
                                        appointments:
                                            byDay[_dateKey(day)] ?? const [],
                                        onTapAppointment: (a) =>
                                            showAppointmentDetailSheet(
                                          context,
                                          ref,
                                          a,
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
                ),
              ),
            ],
          );
        });
      },
    );
  }
}

class _WeekHeader extends StatelessWidget {
  const _WeekHeader({
    required this.days,
    required this.selectedDate,
    required this.today,
    required this.onSelect,
    required this.controller,
    required this.physics,
    required this.dayColumnWidth,
  });

  final List<DateTime> days;
  final DateTime selectedDate;
  final DateTime today;
  final ValueChanged<DateTime> onSelect;
  final ScrollController controller;
  final ScrollPhysics physics;
  final double dayColumnWidth;

  @override
  Widget build(BuildContext context) {
    final dayFmt = DateFormat.E('fr_FR');
    return SizedBox(
      height: 64,
      child: Row(
        children: [
          const SizedBox(width: _hourColumnWidth),
          Expanded(
            child: SingleChildScrollView(
              controller: controller,
              primary: false,
              physics: physics,
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: dayColumnWidth * 7,
                child: Row(
                  children: [
                    for (final d in days)
                      SizedBox(
                        width: dayColumnWidth,
                        child: InkWell(
                          onTap: () => onSelect(d),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  _shortWeekday(dayFmt.format(d)),
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.3,
                                    color: Color(0xFF737373),
                                  ),
                                ),
                                const SizedBox(height: 3),
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
            ),
          ),
        ],
      ),
    );
  }

  String _shortWeekday(String s) {
    if (s.isEmpty) return s;
    return s.substring(0, s.length >= 3 ? 3 : s.length).toUpperCase();
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
                padding: const EdgeInsets.only(top: 2, right: 4),
                child: Text(
                  '${h.toString().padLeft(2, '0')}h',
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 9,
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
      child: LayoutBuilder(builder: (context, constraints) {
        final columnWidth = constraints.maxWidth;
        return Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Column(
              children: [
                for (var h = _hourStart; h < _hourEnd; h++)
                  SizedBox(
                    height: _slotHeight,
                    child: Container(
                      decoration: const BoxDecoration(
                        border:
                            Border(bottom: BorderSide(color: _line, width: 0.4)),
                      ),
                    ),
                  ),
              ],
            ),
            for (final layout in layouts)
              Positioned(
                top: _positionTop(layout.appt, pxPerMin, totalMinutes),
                height: _positionHeight(layout.appt, pxPerMin),
                left: (layout.lane / layout.laneCount) * columnWidth,
                width: columnWidth / layout.laneCount,
                child: _WeekBlock(
                  appointment: layout.appt,
                  onTap: () => onTapAppointment(layout.appt),
                ),
              ),
          ],
        );
      }),
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

  String _firstName(String full) {
    final trimmed = full.trim();
    if (trimmed.isEmpty) return trimmed;
    final space = trimmed.indexOf(' ');
    return space < 0 ? trimmed : trimmed.substring(0, space);
  }

  @override
  Widget build(BuildContext context) {
    final accent = agendaAccentColor(appointment);
    final cancelled = appointment.isCancelled;
    final firstName = _firstName(appointment.clientName);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 1, vertical: 1),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(4),
          child: Opacity(
            opacity: cancelled ? 0.55 : 1,
            child: LayoutBuilder(builder: (context, constraints) {
              // Pas d'heure sur les blocs : l'échelle temporelle à gauche
              // + la position verticale la donnent déjà. Dupliquer l'heure
              // rendait illisible les zones denses (plusieurs "11:20" empilés).
              // On affiche juste le prénom si la case est assez grande.
              final w = constraints.maxWidth;
              final h = constraints.maxHeight;
              final hasRoom = w >= 44 && h >= 22 && firstName.isNotEmpty;
              return ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.28),
                    border: Border(left: BorderSide(color: accent, width: 2.5)),
                  ),
                  alignment: Alignment.topLeft,
                  padding: const EdgeInsets.fromLTRB(4, 2, 3, 2),
                  child: hasRoom
                      ? Text(
                          firstName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          softWrap: false,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            height: 1.1,
                            color: Color(0xFF0A0A0A),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
