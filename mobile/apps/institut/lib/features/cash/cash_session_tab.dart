import 'dart:async';

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';
import 'session_duration.dart';

class CashOpenSessionView extends ConsumerStatefulWidget {
  const CashOpenSessionView({super.key, required this.session});

  final CashSessionSummary session;

  @override
  ConsumerState<CashOpenSessionView> createState() =>
      _CashOpenSessionViewState();
}

class _CashOpenSessionViewState extends ConsumerState<CashOpenSessionView> {
  Timer? _ticker;
  bool _busy = false;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _pauseOrResume() async {
    setState(() => _busy = true);
    try {
      if (widget.session.paused) {
        await resumeInstitutCashDay(ref);
      } else {
        await pauseInstitutCashDay(ref);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openCloseSheet() async {
    final report = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _CloseSessionSheet(session: widget.session),
    );
    if (report != null && report.isNotEmpty && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Clôture Z · $report')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final paused = session.paused;
    final caption = sessionOpenedCaption(
      openedAt: session.openedAt,
      previousDay: session.previousDay,
      paused: paused,
    );
    final mixHint = _articlesHint(session);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
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
                    decoration: BoxDecoration(
                      color: paused || session.previousDay
                          ? const Color(0xFFF59E0B)
                          : const Color(0xFF22C55E),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    paused ? 'Session en pause' : 'Session ouverte',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _black,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                caption,
                style: TextStyle(
                  color: paused || session.previousDay
                      ? const Color(0xFFB45309)
                      : const Color(0xFF404040),
                  fontSize: 14,
                  height: 1.35,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (paused) ...[
                const SizedBox(height: 8),
                const Text(
                  'Les ventes sont bloquées tant que la session est en pause.',
                  style: TextStyle(color: _muted, fontSize: 13, height: 1.35),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _StatTile(
                      label: 'Ventes',
                      value: '${session.salesCount}',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatTile(
                      label: 'Articles',
                      value: '${session.itemsSoldQty}',
                      hint: mixHint,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _StatTile(
                      label: 'CA TTC',
                      value: formatEuros(session.totalCents),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatTile(
                      label: 'Cash attendu',
                      value: formatEuros(session.expectedCashCents),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              _StatRow(
                label: 'Fond de caisse',
                value: formatEuros(session.openingFloatCents),
              ),
              if (session.byPaymentMethod.isNotEmpty) ...[
                const SizedBox(height: 8),
                const Divider(height: 1, color: Color(0xFFE8E8E8)),
                const SizedBox(height: 10),
                const Text(
                  'Par moyen de paiement',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF737373),
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 4),
                for (final entry in _sortedPayments(session.byPaymentMethod))
                  _StatRow(
                    label: _paymentLabel(entry.key),
                    value: formatEuros(entry.value),
                  ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _busy ? null : _pauseOrResume,
                style: OutlinedButton.styleFrom(
                  foregroundColor: _black,
                  side: const BorderSide(color: Color(0xFFD4D4D4)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(paused ? 'Reprendre' : 'Mettre en pause'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: _busy ? null : _openCloseSheet,
                style: FilledButton.styleFrom(
                  backgroundColor: _black,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Clôturer'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'La clôture enregistre un rapport Z. Un écart d’espèces demande une note.',
          style: TextStyle(color: _muted, fontSize: 12, height: 1.4),
        ),
      ],
    );
  }
}

class _CloseSessionSheet extends ConsumerStatefulWidget {
  const _CloseSessionSheet({required this.session});

  final CashSessionSummary session;

  @override
  ConsumerState<_CloseSessionSheet> createState() => _CloseSessionSheetState();
}

class _CloseSessionSheetState extends ConsumerState<_CloseSessionSheet> {
  late final TextEditingController _counted;
  late final TextEditingController _notes;
  bool _confirmed = false;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _counted = TextEditingController(
      text: (widget.session.expectedCashCents / 100).toStringAsFixed(2),
    );
    _notes = TextEditingController();
  }

  @override
  void dispose() {
    _counted.dispose();
    _notes.dispose();
    super.dispose();
  }

  int get _countedCents {
    final n = double.tryParse(_counted.text.replaceAll(',', '.'));
    if (n == null) return 0;
    return (n * 100).round();
  }

  int get _variance => _countedCents - widget.session.expectedCashCents;

  Future<void> _submit() async {
    if (_variance != 0 && _notes.text.trim().isEmpty) {
      setState(() => _error = 'Notez la cause de l’écart d’espèces.');
      return;
    }
    if (!_confirmed) {
      setState(() => _error = 'Confirmez la clôture pour continuer.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final report = await closeInstitutCashDay(
        ref,
        countedCashCents: _countedCents,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(report.isEmpty ? 'Z' : report);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final variance = _variance;
    final hasVariance = variance != 0;
    final inset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + inset),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFD4D4D4),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Clôturer la session',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0A0A0A),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Comptez les espèces du tiroir, puis confirmez. Ouverte à ${DateFormat.Hm().format(session.openedAt)}.',
              style: const TextStyle(
                color: Color(0xFF737373),
                fontSize: 13,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 16),
            _StatRow(
              label: 'Espèces attendues',
              value: formatEuros(session.expectedCashCents),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _counted,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
              ],
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Espèces comptées (€)',
                filled: true,
                fillColor: Color(0xFFF5F5F5),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              decoration: BoxDecoration(
                color: hasVariance
                    ? const Color(0xFFFFFBEB)
                    : const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: hasVariance
                      ? const Color(0xFFFDE68A)
                      : const Color(0xFFBBF7D0),
                ),
              ),
              child: Text(
                hasVariance
                    ? '${variance > 0 ? 'Excédent' : 'Manquant'} de ${formatEuros(variance.abs())}'
                    : 'Caisse équilibrée',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: hasVariance
                      ? const Color(0xFF92400E)
                      : const Color(0xFF166534),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notes,
              minLines: 2,
              maxLines: 4,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: hasVariance
                    ? 'Cause de l’écart (obligatoire)'
                    : 'Notes de clôture (facultatif)',
                filled: true,
                fillColor: const Color(0xFFF5F5F5),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _confirmed,
              onChanged: (v) => setState(() => _confirmed = v ?? false),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'Je confirme le comptage et la clôture Z',
                style: TextStyle(fontSize: 14),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0A0A0A),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Clôturer la journée'),
              ),
            ),
          ],
        ),
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

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value, this.hint});

  final String label;
  final String value;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F7F7),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Color(0xFF737373),
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0A0A0A),
            ),
          ),
          if (hint != null && hint!.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              hint!,
              style: const TextStyle(fontSize: 11, color: Color(0xFF737373)),
            ),
          ],
        ],
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

String? _articlesHint(CashSessionSummary session) {
  if (session.servicesQty == 0 && session.productsQty == 0) return null;
  final parts = <String>[];
  if (session.servicesQty > 0) {
    parts.add(
      '${session.servicesQty} prest.',
    );
  }
  if (session.productsQty > 0) {
    parts.add('${session.productsQty} prod.');
  }
  return parts.join(' · ');
}

const _paymentOrder = [
  'cash',
  'card',
  'stripe',
  'transfer',
  'voucher',
  'gift_card',
  'credit_note',
  'other',
];

const _paymentLabels = {
  'cash': 'Espèces',
  'card': 'CB',
  'stripe': 'Stripe',
  'transfer': 'Virement',
  'voucher': 'Bon',
  'gift_card': 'Bon-cadeau',
  'credit_note': 'Avoir',
  'mixed': 'Mixte',
  'other': 'Autre',
};

String _paymentLabel(String method) => _paymentLabels[method] ?? method;

List<MapEntry<String, int>> _sortedPayments(Map<String, int> methods) {
  final entries = methods.entries.where((e) => e.value != 0).toList();
  entries.sort((a, b) {
    final ia = _paymentOrder.indexOf(a.key);
    final ib = _paymentOrder.indexOf(b.key);
    final sa = ia < 0 ? 99 : ia;
    final sb = ib < 0 ? 99 : ib;
    if (sa != sb) return sa.compareTo(sb);
    return b.value.compareTo(a.value);
  });
  return entries;
}
