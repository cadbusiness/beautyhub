import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';

class TenantPickerScreen extends ConsumerWidget {
  const TenantPickerScreen({super.key});

  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);

  void _leave(BuildContext context) {
    if (Navigator.of(context).canPop()) {
      context.pop();
      return;
    }
    context.go('/app/more');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenantsAsync = ref.watch(tenantsProvider);
    final selectedId = ref.watch(selectedTenantIdProvider);
    final canGoBack = selectedId != null && selectedId.isNotEmpty;

    return Scaffold(
      backgroundColor: _bg,
      appBar: InstitutTopBar(
        title: 'Choisir un institut',
        subtitle: canGoBack ? 'Ou revenir sans changer' : null,
        showBack: canGoBack,
        onBack: canGoBack ? () => _leave(context) : null,
      ),
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
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Aucun institut accessible pour ce compte.',
                      textAlign: TextAlign.center,
                    ),
                    if (canGoBack) ...[
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => _leave(context),
                        child: const Text('Retour'),
                      ),
                    ],
                  ],
                ),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _border),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < tenants.length; i++) ...[
                      if (i > 0)
                        const Divider(
                          height: 1,
                          thickness: 1,
                          color: Color(0xFFF1F1F1),
                          indent: 16,
                        ),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () async {
                            await ref
                                .read(selectedTenantIdProvider.notifier)
                                .select(tenants[i].id);
                            if (context.mounted) context.go('/app');
                          },
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        tenants[i].name,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                          color: _black,
                                        ),
                                      ),
                                      if (tenants[i].id == selectedId) ...[
                                        const SizedBox(height: 2),
                                        const Text(
                                          'Institut actuel',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: _muted,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                Icon(
                                  tenants[i].id == selectedId
                                      ? Icons.check_rounded
                                      : Icons.chevron_right_rounded,
                                  color: tenants[i].id == selectedId
                                      ? _black
                                      : const Color(0xFFB5B5B5),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (canGoBack) ...[
                const SizedBox(height: 20),
                TextButton(
                  onPressed: () => _leave(context),
                  child: const Text('Rester sur cet institut'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
