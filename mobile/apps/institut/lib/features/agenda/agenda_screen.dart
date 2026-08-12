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

  static const _bg = Color(0xFFF5F5F5);
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
  ) {
    if (staffId == null) return appointments;
    return appointments.where((a) => a.staffId == staffId).toList();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedAgendaDateProvider);
    final staffFilter = ref.watch(selectedStaffFilterProvider);
    final dayAsync = ref.watch(dayAgendaProvider);

    return Scaffold(
      backgroundColor: _bg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showCreateAppointmentSheet(
          context,
          ref,
          initialDate: selectedDate,
        ),
        backgroundColor: _black,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Nouveau'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dayAgendaProvider);
          await ref.read(dayAgendaProvider.future);
        },
        child: dayAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              _AgendaHeader(
                selectedDate: selectedDate,
                onPrevious: () {},
                onNext: () {},
                onToday: () {},
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text('$e', textAlign: TextAlign.center),
              ),
            ],
          ),
          data: (day) {
            final filtered =
                _filterAppointments(day.appointments, staffFilter);
            final weekDays = day.weekDays
                .map((d) => (date: d.date, count: d.count))
                .toList();

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
                        if (weekDays.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          AgendaWeekStrip(
                            selectedDate: selectedDate,
                            weekDays: weekDays,
                            onSelect: (date) {
                              ref
                                  .read(selectedAgendaDateProvider.notifier)
                                  .state = date;
                            },
                          ),
                        ],
                        const SizedBox(height: 16),
                        AgendaStatsStrip(stats: day.stats),
                        const SizedBox(height: 14),
                        AgendaStaffFilter(
                          staff: day.staff,
                          selectedStaffId: staffFilter,
                          onChanged: (id) {
                            ref
                                .read(selectedStaffFilterProvider.notifier)
                                .state = id;
                          },
                        ),
                        const SizedBox(height: 16),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Row(
                            children: [
                              Text(
                                '${filtered.length} rendez-vous',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: _black,
                                ),
                              ),
                              const Spacer(),
                              if (staffFilter != null)
                                TextButton(
                                  onPressed: () {
                                    ref
                                        .read(
                                          selectedStaffFilterProvider.notifier,
                                        )
                                        .state = null;
                                  },
                                  child: const Text('Tout voir'),
                                ),
                            ],
                          ),
                        ),
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
                            Icon(
                              Icons.event_busy_outlined,
                              size: 40,
                              color: Colors.grey.shade400,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              staffFilter != null
                                  ? 'Aucun rendez-vous pour ce membre.'
                                  : 'Aucun rendez-vous ce jour.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 15,
                                color: _muted,
                              ),
                            ),
                            const SizedBox(height: 16),
                            OutlinedButton(
                              onPressed: () => showCreateAppointmentSheet(
                                context,
                                ref,
                                initialDate: selectedDate,
                              ),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _black,
                                side: const BorderSide(color: _black),
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
                        final appointment = filtered[index];
                        return AgendaAppointmentCard(
                          appointment: appointment,
                          onTap: () => showAppointmentDetailSheet(
                            context,
                            ref,
                            appointment,
                          ),
                        );
                      },
                      childCount: filtered.length,
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
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: onPrevious,
            icon: const Icon(Icons.chevron_left),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text(
                  'Agenda',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0A0A0A),
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF737373),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (!isToday)
            TextButton(onPressed: onToday, child: const Text('Auj.'))
          else
            const SizedBox(width: 48),
          IconButton(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}
