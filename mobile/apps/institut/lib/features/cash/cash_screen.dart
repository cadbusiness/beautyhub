import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';
import 'cash_header.dart';
import 'pos_sale_tab.dart';
import 'sales_history_tab.dart';

class CashScreen extends ConsumerStatefulWidget {
  const CashScreen({super.key});

  @override
  ConsumerState<CashScreen> createState() => _CashScreenState();
}

class _CashScreenState extends ConsumerState<CashScreen> {
  final _floatController = TextEditingController();
  bool _opening = false;
  bool _showFloat = false;
  String? _error;
  int _tabIndex = 1;

  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  void dispose() {
    _floatController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(cashSessionProvider);
    ref.invalidate(posContextProvider);
    await Future.wait([
      ref.read(cashSessionProvider.future),
      ref.read(posContextProvider.future),
    ]);
  }

  Future<void> _open({bool withFloat = false}) async {
    setState(() {
      _opening = true;
      _error = null;
    });
    try {
      final euros = withFloat
          ? (double.tryParse(_floatController.text.replaceAll(',', '.')) ?? 0)
          : 0.0;
      final cents = (euros * 100).round();
      await openInstitutCashDay(ref, openingFloatCents: cents);
      await _refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(cashInitialTabProvider, (prev, next) {
      if (next != _tabIndex && mounted) {
        setState(() => _tabIndex = next);
      }
    });

    final cashAsync = ref.watch(cashSessionProvider);

    return Scaffold(
      backgroundColor: _bg,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CashScreenHeader(
            selectedIndex: _tabIndex,
            onChanged: (i) {
              ref.read(cashInitialTabProvider.notifier).state = i;
              setState(() => _tabIndex = i);
            },
          ),
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: [
                RefreshIndicator(
                  onRefresh: _refresh,
                  child: cashAsync.when(
                    skipLoadingOnReload: true,
                    skipLoadingOnRefresh: true,
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
                            _SessionCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF22C55E),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Session ouverte',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: _black,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Depuis ${DateFormat.Hm().format(session.openedAt)}',
                                    style: const TextStyle(color: _muted, fontSize: 13),
                                  ),
                                  const SizedBox(height: 16),
                                  _StatRow(
                                    label: 'Fond de caisse',
                                    value: formatEuros(session.openingFloatCents),
                                  ),
                                  _StatRow(label: 'Ventes', value: '${session.salesCount}'),
                                  _StatRow(
                                    label: 'Total encaissé',
                                    value: formatEuros(session.totalCents),
                                  ),
                                  _StatRow(
                                    label: 'Cash attendu',
                                    value: formatEuros(session.expectedCashCents),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Clôture Z et bons avancés restent sur le web.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: _muted,
                                  ),
                            ),
                          ],
                        );
                      }

                      return ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        children: [
                          _SessionCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Caisse fermée',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: _black,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'Ouvrez la journée pour encaisser. Le fond de caisse est facultatif.',
                                  style: TextStyle(color: _muted, fontSize: 13, height: 1.35),
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'Ouvrir la journée → fond si besoin → encaisser',
                                  style: TextStyle(color: _muted, fontSize: 12),
                                ),
                                const SizedBox(height: 16),
                                SizedBox(
                                  width: double.infinity,
                                  child: FilledButton(
                                    onPressed: _opening ? null : () => _open(),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: _black,
                                      foregroundColor: Colors.white,
                                    ),
                                    child: _opening
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Text('Ouvrir sans fond'),
                                  ),
                                ),
                                if (_showFloat) ...[
                                  const SizedBox(height: 16),
                                  TextField(
                                    controller: _floatController,
                                    keyboardType: const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                    inputFormatters: [
                                      FilteringTextInputFormatter.allow(
                                        RegExp(r'[0-9.,]'),
                                      ),
                                    ],
                                    decoration: const InputDecoration(
                                      labelText: 'Fond de caisse (€) — facultatif',
                                      hintText: '0',
                                      filled: true,
                                      fillColor: Colors.white,
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  SizedBox(
                                    width: double.infinity,
                                    child: OutlinedButton(
                                      onPressed: _opening
                                          ? null
                                          : () => _open(withFloat: true),
                                      child: const Text('Ouvrir avec ce fond'),
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () =>
                                        setState(() => _showFloat = false),
                                    child: const Text('Pas de fond'),
                                  ),
                                ] else
                                  TextButton(
                                    onPressed: () =>
                                        setState(() => _showFloat = true),
                                    child: const Text('Ajouter un fond de caisse'),
                                  ),
                                if (_error != null) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    _error!,
                                    style: TextStyle(
                                      color: Theme.of(context).colorScheme.error,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                RefreshIndicator(
                  onRefresh: _refresh,
                  child: const PosSaleTab(),
                ),
                SalesHistoryTab(active: _tabIndex == 2),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEBEBEB)),
      ),
      child: child,
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
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Color(0xFF525252), fontSize: 14),
            ),
          ),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
        ],
      ),
    );
  }
}
