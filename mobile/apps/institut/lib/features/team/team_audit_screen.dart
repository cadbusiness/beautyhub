import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';

final institutTeamAuditProvider =
    FutureProvider.autoDispose<List<InstTeamAuditRow>>((ref) async {
  final token = ref.watch(accessTokenProvider);
  final tenantId = ref.watch(selectedTenantIdProvider);
  if (token == null || tenantId == null) {
    throw StateError('Session ou institut manquant');
  }
  return ref.read(mobileApiProvider).fetchInstitutTeamAudit(
        accessToken: token,
        tenantId: tenantId,
      );
});

class TeamAuditScreen extends ConsumerWidget {
  const TeamAuditScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(institutTeamAuditProvider);
    final fmt = DateFormat('dd/MM HH:mm');
    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F7),
      appBar: const InstitutTopBar(
        title: 'Journal',
        subtitle: 'Actions équipe',
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(institutTeamAuditProvider);
          await ref.read(institutTeamAuditProvider.future);
        },
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            children: [
              Text('$e', textAlign: TextAlign.center),
            ],
          ),
          data: (rows) {
            if (rows.isEmpty) {
              return const Center(child: Text('Aucune action pour l’instant.'));
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final row = rows[i];
                return Container(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEDEDED)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.actionLabel,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [
                          if (row.targetName != null) row.targetName!,
                          if (row.actorEmail != null) row.actorEmail!,
                          fmt.format(row.createdAt),
                        ].join(' · '),
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF737373),
                        ),
                      ),
                    ],
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
