import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import 'widgets/agenda_appointment_card.dart';
import 'widgets/agenda_staff_filter.dart';
import 'widgets/agenda_stats_strip.dart';
import 'widgets/agenda_week_strip.dart';
import 'widgets/appointment_detail_sheet.dart';
import 'widgets/appointment_form_sheet.dart';

class AgendaScreen extends ConsumerWidget {
  const AgendaScreen({super.key});

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  String _formatSelectedDate(DateTime date) {
    final fmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final label = fmt.format(date);
    return label[0].toUpperCase() + label.substring(1);
  }

  List<DayAppointment> _filterAppointments(
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
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dayAgendaProvider);
          await ref.read(dayAgendaProvider.future);
        },
        child: dayAsync.when(
          loading: () => CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverFillRemaining(
                child: Column(
                  children: [
                    SafeArea(
                      bottom: false,
                      child: _AgendaHeader(
                        selectedDate: selectedDate,
                        subtitle: _formatSelectedDate(selectedDate),
                        onPrevious: () {},
                        onNext: () {},
                        onToday: () {},
                      ),
                    ),
                    const Expanded(
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ],
                ),
              ),
            ],
          ),
          error: (e, _) => CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverFillRemaining(
                hasScrollBody: false,
                child: Column(
                  children: [
                    SafeArea(
                      bottom: false,
                      child: _AgendaHeader(
                        selectedDate: selectedDate,
                        subtitle: _formatSelectedDate(selectedDate),
                        onPrevious: () {},
                        onNext: () {},
                        onToday: () {},
                      ),
                    ),
                    Expanded(
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            'Impossible de charger l’agenda.\n$e',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: _muted),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          data: (day) {
            final filtered = _filterAppointments(
              day.appointments,
              staffFilter,
              resourceFilter,
            );
            final groups = groupAppointmentsByStart(filtered);
            final weekDays = day.weekDays
                .map((d) => (date: d.date, count: d.count))
                .toList();
            final hasFilter = staffFilter != null || resourceFilter != null;

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: SafeArea(
                    bottom: false,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _AgendaHeader(
                          selectedDate: selectedDate,
                          subtitle: _formatSelectedDate(selectedDate),
                          onPrevious: () {
                            ref
                                .read(selectedAgendaDateProvider.notifier)
                                .state = selectedDate
                                    .subtract(const Duration(days: 1));
                          },
                          onNext: () {
                            ref
                                .read(selectedAgendaDateProvider.notifier)
                                .state =
                                selectedDate.add(const Duration(days: 1));
                          },
                          onToday: () {
                            final now = DateTime.now();
                            ref
                                    .read(selectedAgendaDateProvider.notifier)
                                    .state =
                                DateTime(now.year, now.month, now.day);
                          },
                        ),
                        if (weekDays.isNotEmpty)
                          AgendaWeekStrip(
                            selectedDate: selectedDate,
                            weekDays: weekDays,
                            onSelect: (date) {
                              ref
                                  .read(selectedAgendaDateProvider.notifier)
                                  .state = date;
                            },
                          ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 8, 12, 8),
                          child: Row(
                            children: [
                              AgendaStatsStrip(stats: day.stats),
                              const Spacer(),
                              AgendaResourceFilter(
                                resources: day.resources,
                                selectedResourceId: resourceFilter,
                                onChanged: (id) {
                                  ref
                                      .read(
                                        selectedResourceFilterProvider.notifier,
                                      )
                                      .state = id;
                                },
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
                          child: AgendaStaffFilter(
                            staff: day.staff,
                            selectedStaffId: staffFilter,
                            onChanged: (id) {
                              ref
                                  .read(selectedStaffFilterProvider.notifier)
                                  .state = id;
                            },
                          ),
                        ),
                        if (hasFilter)
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Padding(
                              padding: const EdgeInsets.only(left: 12),
                              child: TextButton(
                                onPressed: () {
                                  ref
                                      .read(
                                        selectedStaffFilterProvider.notifier,
                                      )
                                      .state = null;
                                  ref
                                      .read(
                                        selectedResourceFilterProvider.notifier,
                                      )
                                      .state = null;
                                },
                                child: const Text('Tout voir'),
                              ),
                            ),
                          ),
                        const Divider(height: 1, color: Color(0xFFE8E8E8)),
                      ],
                    ),
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
      ),
    );
  }
}

class _AgendaHeader extends StatelessWidget {
  const _AgendaHeader({
    required this.selectedDate,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
    this.subtitle,
  });

  final DateTime selectedDate;
  final String? subtitle;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToday;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final isToday = selectedDate.year == now.year &&
        selectedDate.month == now.month &&
        selectedDate.day == now.day;

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
              subtitle ?? 'Agenda',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0A0A0A),
              ),
            ),
          ),
          if (!isToday)
            TextButton(onPressed: onToday, child: const Text('Auj.'))
          else
            const SizedBox(width: 12),
          IconButton(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}
