import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/session_providers.dart';

class TenantPickerScreen extends ConsumerWidget {
  const TenantPickerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenantsAsync = ref.watch(tenantsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Choisir un institut')),
      body: tenantsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$e', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => ref.invalidate(tenantsProvider),
                  child: const Text('Réessayer'),
                ),
              ],
            ),
          ),
        ),
        data: (tenants) {
          if (tenants.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Aucun institut accessible pour ce compte.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView.separated(
            itemCount: tenants.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final t = tenants[index];
              return ListTile(
                title: Text(t.name),
                subtitle: Text(t.slug),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await ref
                      .read(selectedTenantIdProvider.notifier)
                      .select(t.id);
                  if (context.mounted) context.go('/app');
                },
              );
            },
          );
        },
      ),
    );
  }
}
