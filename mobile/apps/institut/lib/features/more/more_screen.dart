import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../state/session_providers.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(bootstrapProvider);
    final tenantId = ref.watch(selectedTenantIdProvider);
    final tenants = ref.watch(tenantsProvider).valueOrNull ?? const [];
    final tenant = tenants.where((t) => t.id == tenantId).firstOrNull;
    final email = Supabase.instance.client.auth.currentUser?.email;

    return Scaffold(
      appBar: AppBar(title: const Text('Plus')),
      body: ListView(
        children: [
          ListTile(
            title: Text(bootstrap.appName),
            subtitle: Text(tenant?.name ?? 'Aucun institut'),
          ),
          if (email != null)
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(email),
            ),
          ListTile(
            leading: const Icon(Icons.storefront_outlined),
            title: const Text('Changer d’institut'),
            onTap: () => context.go('/tenants'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Se déconnecter'),
            onTap: () async {
              await ref.read(selectedTenantIdProvider.notifier).select(null);
              await Supabase.instance.client.auth.signOut();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}
