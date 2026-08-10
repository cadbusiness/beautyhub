import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';

class CashScreen extends ConsumerStatefulWidget {
  const CashScreen({super.key});

  @override
  ConsumerState<CashScreen> createState() => _CashScreenState();
}

class _CashScreenState extends ConsumerState<CashScreen> {
  final _floatController = TextEditingController(text: '0');
  bool _opening = false;
  String? _error;

  @override
  void dispose() {
    _floatController.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      _opening = true;
      _error = null;
    });
    try {
      final euros = double.tryParse(_floatController.text.replaceAll(',', '.')) ?? 0;
      final cents = (euros * 100).round();
      await ref.read(mobileApiProvider).openCashSession(
            accessToken: token,
            tenantId: tenantId,
            openingFloatCents: cents,
          );
      ref.invalidate(cashSessionProvider);
      await ref.read(cashSessionProvider.future);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cashAsync = ref.watch(cashSessionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Caisse')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(cashSessionProvider);
          await ref.read(cashSessionProvider.future);
        },
        child: cashAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [Text('$e')],
          ),
          data: (session) {
            if (session != null) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Session ouverte',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Depuis ${DateFormat.Hm().format(session.openedAt)}',
                  ),
                  const SizedBox(height: 16),
                  _StatRow(label: 'Fond de caisse', value: formatEuros(session.openingFloatCents)),
                  _StatRow(label: 'Ventes', value: '${session.salesCount}'),
                  _StatRow(label: 'Total encaissé', value: formatEuros(session.totalCents)),
                  _StatRow(label: 'Cash attendu', value: formatEuros(session.expectedCashCents)),
                  const SizedBox(height: 16),
                  Text(
                    'Fermeture et encaissement complets restent sur le web pour cette version.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              );
            }

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Ouvrir la caisse',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 8),
                const Text('Indiquez le fond de caisse en euros.'),
                const SizedBox(height: 16),
                TextField(
                  controller: _floatController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Fond de caisse (€)',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _opening ? null : _open,
                  child: _opening
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Ouvrir la session'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
