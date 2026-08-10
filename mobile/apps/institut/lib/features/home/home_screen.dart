import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(bootstrapProvider);
    final dayAsync = ref.watch(dayAgendaProvider);
    final cashAsync = ref.watch(cashSessionProvider);
    final timeFmt = DateFormat.Hm();

    return Scaffold(
      appBar: AppBar(title: Text(bootstrap.appName)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dayAgendaProvider);
          ref.invalidate(cashSessionProvider);
          await Future.wait([
            ref.read(dayAgendaProvider.future),
            ref.read(cashSessionProvider.future),
          ]);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            dayAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: Text('$e'),
              ),
              data: (day) {
                final next = day.nextAppointment;
                final rest = day.appointments
                    .where((a) => next == null || a.id != next.id)
                    .take(5)
                    .toList();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                      child: Text(
                        'Aujourd’hui',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
                    if (next == null)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text('Aucun prochain rendez-vous.'),
                      )
                    else
                      _NextCard(appointment: next, timeFmt: timeFmt),
                    if (rest.isNotEmpty) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                        child: Text(
                          'Suite de la journée',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      ...rest.map(
                        (a) => ListTile(
                          dense: true,
                          title: Text(a.clientName),
                          subtitle: Text(a.serviceName),
                          trailing: Text(timeFmt.format(a.startsAt)),
                        ),
                      ),
                    ],
                  ],
                );
              },
            ),
            const Divider(height: 32),
            cashAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Caisse : $e'),
              ),
              data: (session) {
                if (session == null) {
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Caisse',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        const Text('Aucune session ouverte.'),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () => context.go('/app/cash'),
                          child: const Text('Ouvrir la caisse'),
                        ),
                      ],
                    ),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Caisse ouverte',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Depuis ${DateFormat.Hm().format(session.openedAt)} · '
                        '${session.salesCount} ventes · '
                        '${formatEuros(session.totalCents)}',
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: () => context.go('/app/cash'),
                        child: const Text('Voir la caisse'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _NextCard extends StatelessWidget {
  const _NextCard({required this.appointment, required this.timeFmt});

  final DayAppointment appointment;
  final DateFormat timeFmt;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Prochain RDV',
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.secondary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${timeFmt.format(appointment.startsAt)} · ${appointment.clientName}',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(appointment.serviceName),
          if (appointment.staffName != null)
            Text(
              appointment.staffName!,
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}
