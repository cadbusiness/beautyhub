import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';

class AgendaScreen extends ConsumerWidget {
  const AgendaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dayAsync = ref.watch(dayAgendaProvider);
    final timeFmt = DateFormat.Hm();

    return Scaffold(
      appBar: AppBar(title: const Text('Agenda')),
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
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text('$e', textAlign: TextAlign.center),
              ),
            ],
          ),
          data: (day) {
            if (day.appointments.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('Aucun rendez-vous aujourd’hui.')),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: day.appointments.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final a = day.appointments[index];
                final cancelled =
                    a.status == 'cancelled' || a.status == 'no_show';
                return ListTile(
                  leading: Text(
                    timeFmt.format(a.startsAt),
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          decoration:
                              cancelled ? TextDecoration.lineThrough : null,
                        ),
                  ),
                  title: Text(
                    a.clientName,
                    style: TextStyle(
                      decoration: cancelled ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  subtitle: Text(
                    [
                      a.serviceName,
                      if (a.staffName != null) a.staffName!,
                      a.status,
                    ].join(' · '),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
