import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import 'widgets/agenda_appointment_card.dart';
import 'widgets/agenda_month_view.dart';
import 'widgets/agenda_staff_filter.dart';
import 'widgets/agenda_stats_strip.dart';
import 'widgets/agenda_week_strip.dart';
import 'widgets/agenda_week_view.dart';
import 'widgets/appointment_detail_sheet.dart';
import 'widgets/appointment_form_sheet.dart';

class AgendaScreen extends ConsumerWidget {
  const AgendaScreen({super.key});

  static const _black = Color(0xFF0A0A0A);

  String _formatDayTitle(DateTime date) {
    final fmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final label = fmt.format(date);
    return label[0].toUpperCase() + label.substring(1);
  }

  String _formatWeekTitle(DateTime date) {
    final monday = date.subtract(Duration(days: date.weekday - 1));
    final sunday = monday.add(const Duration(days: 6));
    final sameMonth = monday.month == sunday.month;
    final sameYear = monday.year == sunday.year;
    if (sameMonth) {
      final fmt = DateFormat('MMMM yyyy', 'fr_FR');
      final month = fmt.format(monday);
      return '${monday.day}–${sunday.day} $month';
    }
    if (sameYear) {
      final dayMonth = DateFormat('d MMM', 'fr_FR');
      final yearFmt = DateFormat('yyyy', 'fr_FR');
      return '${dayMonth.format(monday)} – ${dayMonth.format(sunday)} ${yearFmt.format(monday)}';
    }
    final long = DateFormat('d MMM yyyy', 'fr_FR');
    return '${long.format(monday)} – ${long.format(sunday)}';
  }

  String _formatMonthTitle(DateTime date) {
    final fmt = DateFormat('MMMM yyyy', 'fr_FR');
    final label = fmt.format(date);
    return label[0].toUpperCase() + label.substring(1);
  }

  void _shiftDate(WidgetRef ref, AgendaViewMode view, int direction) {
    final current = ref.read(selectedAgendaDateProvider);
    DateTime next;
    switch (view) {
      case AgendaViewMode.day:
        next = current.add(Duration(days: direction));
        break;
      case AgendaViewMode.week:
        next = current.add(Duration(days: 7 * direction));
        break;
      case AgendaViewMode.month:
        next = DateTime(
          current.year,
          current.month + direction,
          1,
        );
        break;
    }
    ref.read(selectedAgendaDateProvider.notifier).state = next;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedAgendaDateProvider);
    final view = ref.watch(agendaViewModeProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      floatingActionButton: FloatingActionButton(
        onPressed: () => showCreateAppointmentSheet(
          context,
          ref,
          initialDate: selectedDate,
        ),
        backgroundColor: _black,
        foregroundColor: Colors.white,
        elevation: 0,
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _AgendaHeader(
              subtitle: switch (view) {
                AgendaViewMode.day => _formatDayTitle(selectedDate),
                AgendaViewMode.week => _formatWeekTitle(selectedDate),
                AgendaViewMode.month => _formatMonthTitle(selectedDate),
              },
              onPrevious: () => _shiftDate(ref, view, -1),
              onNext: () => _shiftDate(ref, view, 1),
              onToday: () {
                final now = DateTime.now();
                ref.read(selectedAgendaDateProvider.notifier).state =
                    DateTime(now.year, now.month, now.day);
              },
            ),
            _ViewSwitcher(
              current: view,
              onChanged: (next) {
                ref.read(agendaViewModeProvider.notifier).state = next;
              },
            ),
            const Divider(height: 1, color: Color(0xFFE8E8E8)),
            Expanded(
              child: switch (view) {
                AgendaViewMode.day => const _DayView(),
                AgendaViewMode.week => AgendaWeekView(
                    anchor: selectedDate,
                    staffFilter: ref.watch(selectedStaffFilterProvider),
                    resourceFilter: ref.watch(selectedResourceFilterProvider),
                  ),
                AgendaViewMode.month => AgendaMonthView(
                    anchor: selectedDate,
                    selected: selectedDate,
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _DayView extends ConsumerWidget {
  const _DayView();

  static const _muted = Color(0xFF737373);

  List<DayAppointment> _filter(
    List<DayAppointment> appointments,
    String? staffId,
    String? resourceId,
  ) {
    return appointments.where((a) {
      if (staffId != null && a.staffId != staffId) return false;
      if (resourceId != null && a.resourceId != resourceId) return false;
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedAgendaDateProvider);
    final staffFilter = ref.watch(selectedStaffFilterProvider);
    final resourceFilter = ref.watch(selectedResourceFilterProvider);
    final dayAsync = ref.watch(dayAgendaProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(dayAgendaProvider);
        await ref.read(dayAgendaProvider.future);
      },
      child: dayAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Impossible de charger l’agenda.\n$e',
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted),
              ),
            ),
          ],
        ),
        data: (day) {
          final filtered = _filter(day.appointments, staffFilter, resourceFilter);
          final groups = groupAppointmentsByStart(filtered);
          final weekDays = day.weekDays
              .map((d) => (date: d.date, count: d.count))
              .toList();
          final hasFilter = staffFilter != null || resourceFilter != null;

          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (weekDays.isNotEmpty)
                      AgendaWeekStrip(
                        selectedDate: selectedDate,
                        weekDays: weekDays,
                        onSelect: (date) {
                          ref.read(selectedAgendaDateProvider.notifier).state =
                              date;
                        },
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                      child: AgendaStatsStrip(stats: day.stats),
                    ),
                    AgendaFilters(
                      staff: day.staff,
                      resources: day.resources,
                      selectedStaffId: staffFilter,
                      selectedResourceId: resourceFilter,
                      onStaffChanged: (id) {
                        ref.read(selectedStaffFilterProvider.notifier).state =
                            id;
                      },
                      onResourceChanged: (id) {
                        ref
                            .read(selectedResourceFilterProvider.notifier)
                            .state = id;
                      },
                      onClear: () {
                        ref.read(selectedStaffFilterProvider.notifier).state =
                            null;
                        ref
                            .read(selectedResourceFilterProvider.notifier)
                            .state = null;
                      },
                    ),
                    const Divider(height: 1, color: Color(0xFFE8E8E8)),
                  ],
                ),
              ),
              if (filtered.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            hasFilter
                                ? 'Aucun rendez-vous pour ce filtre.'
                                : 'Aucun rendez-vous ce jour.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 15,
                              color: _muted,
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextButton(
                            onPressed: () => showCreateAppointmentSheet(
                              context,
                              ref,
                              initialDate: selectedDate,
                            ),
                            child: const Text('Ajouter un rendez-vous'),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      return AgendaTimeGroup(
                        group: groups[index],
                        showDivider: index < groups.length - 1,
                        onTap: (appointment) => showAppointmentDetailSheet(
                          context,
                          ref,
                          appointment,
                        ),
                      );
                    },
                    childCount: groups.length,
                  ),
                ),
              const SliverToBoxAdapter(child: SizedBox(height: 88)),
            ],
          );
        },
      ),
    );
  }
}

class _AgendaHeader extends StatelessWidget {
  const _AgendaHeader({
    required this.subtitle,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
  });

  final String subtitle;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToday;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: onPrevious,
            icon: const Icon(Icons.chevron_left),
          ),
          Expanded(
            child: Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0A0A0A),
              ),
            ),
          ),
          TextButton(onPressed: onToday, child: const Text('Auj.')),
          IconButton(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

class _ViewSwitcher extends StatelessWidget {
  const _ViewSwitcher({required this.current, required this.onChanged});

  final AgendaViewMode current;
  final ValueChanged<AgendaViewMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          children: [
            for (final entry in const [
              (AgendaViewMode.day, 'Jour'),
              (AgendaViewMode.week, 'Semaine'),
              (AgendaViewMode.month, 'Mois'),
            ])
              Expanded(
                child: GestureDetector(
                  onTap: () => onChanged(entry.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 140),
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: current == entry.$1 ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: current == entry.$1
                          ? [
                              const BoxShadow(
                                color: Color(0x1A000000),
                                blurRadius: 4,
                                offset: Offset(0, 1),
                              ),
                            ]
                          : null,
                    ),
                    child: Text(
                      entry.$2,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: current == entry.$1
                            ? const Color(0xFF0A0A0A)
                            : const Color(0xFF737373),
                      ),
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
