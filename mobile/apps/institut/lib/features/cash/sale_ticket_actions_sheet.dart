import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/app_sheet.dart';
import '../shared/money.dart';

enum TicketActionIntent { credit, refund, replace }

const _black = Color(0xFF0A0A0A);
const _muted = Color(0xFF737373);
const _fill = Color(0xFFF5F5F5);
const _border = Color(0xFFE8E8E8);

const _reasonPresets = [
  'Insatisfaction / geste commercial',
  'Produit ou prestation non conforme',
  'Annulation',
  'Erreur de caisse',
  'Remplacement',
  'Remboursement client',
];

class TicketActionOutcome {
  const TicketActionOutcome({
    required this.creditNumber,
    required this.replace,
    this.documentId,
  });

  final String creditNumber;
  final bool replace;
  final String? documentId;
}

Future<TicketActionOutcome?> showSaleTicketActionsSheet({
  required BuildContext context,
  required InstSale sale,
}) {
  return showAppSheet<TicketActionOutcome>(
    context: context,
    builder: (_) => _SaleTicketActionsSheet(sale: sale),
  );
}

class _SaleTicketActionsSheet extends ConsumerStatefulWidget {
  const _SaleTicketActionsSheet({required this.sale});
  final InstSale sale;

  @override
  ConsumerState<_SaleTicketActionsSheet> createState() =>
      _SaleTicketActionsSheetState();
}

class _SaleTicketActionsSheetState
    extends ConsumerState<_SaleTicketActionsSheet> {
  TicketActionIntent _intent = TicketActionIntent.credit;
  String _settlement = 'cash';
  late final TextEditingController _amount;
  late final TextEditingController _reason;
  bool _submitting = false;
  String? _error;

  InstSale get sale => widget.sale;

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(text: _eurosInput(sale.refundableCents));
    _reason = TextEditingController();
    final hasCash = sale.payments.any((p) => p.method == 'cash');
    _settlement = hasCash ? 'cash' : 'card';
  }

  @override
  void dispose() {
    _amount.dispose();
    _reason.dispose();
    super.dispose();
  }

  int get _amountCents {
    final n = double.tryParse(
      _amount.text.trim().replaceAll(' ', '').replaceAll('€', '').replaceAll(',', '.'),
    );
    if (n == null) return 0;
    return (n * 100).round();
  }

  String get _settlementForApi {
    if (_intent == TicketActionIntent.refund) return _settlement;
    return 'credit';
  }

  String get _intentForApi {
    switch (_intent) {
      case TicketActionIntent.refund:
        return 'refund';
      case TicketActionIntent.replace:
        return 'replacement';
      case TicketActionIntent.credit:
        return 'credit';
    }
  }

  Future<void> _submit() async {
    final reason = _reason.text.trim();
    if (reason.length < 3) {
      setState(() => _error = 'Le motif est obligatoire (3 caractères min.).');
      return;
    }
    if (_amountCents <= 0 || _amountCents > sale.refundableCents) {
      setState(
        () => _error =
            'Montant invalide. Maximum ${formatEuros(sale.refundableCents)}.',
      );
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) {
        throw StateError('Session ou institut manquant');
      }
      final result = await ref.read(mobileApiProvider).createSaleCreditNote(
            accessToken: token,
            tenantId: tenantId,
            saleId: sale.id,
            amountCents: _amountCents,
            reason: reason,
            settlement: _settlementForApi,
            intent: _intentForApi,
          );
      if (!mounted) return;
      if (_intent == TicketActionIntent.replace) {
        ref.read(cashInitialTabProvider.notifier).state = 1;
      }
      Navigator.of(context).pop(
        TicketActionOutcome(
          creditNumber: result.creditNumber,
          replace: _intent == TicketActionIntent.replace,
          documentId: result.documentId,
        ),
      );
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
              'Action sur le ticket',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: _black,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Le ticket d’origine n’est jamais modifié ni supprimé. Toute correction passe par un avoir (note de crédit).',
              style: TextStyle(fontSize: 13, height: 1.4, color: _muted),
            ),
            const SizedBox(height: 16),
            _IntentTile(
              selected: _intent == TicketActionIntent.credit,
              title: 'Avoir',
              subtitle: 'La cliente utilise le montant sur un prochain achat.',
              onTap: () => setState(() => _intent = TicketActionIntent.credit),
            ),
            const SizedBox(height: 8),
            _IntentTile(
              selected: _intent == TicketActionIntent.refund,
              title: 'Remboursement',
              subtitle:
                  'Avoir + restitution de l’argent. Le TPE se fait à part.',
              onTap: () => setState(() => _intent = TicketActionIntent.refund),
            ),
            const SizedBox(height: 8),
            _IntentTile(
              selected: _intent == TicketActionIntent.replace,
              title: 'Remplacement',
              subtitle:
                  'Avoir sur l’article rendu, puis encaissement du nouvel article.',
              onTap: () => setState(() => _intent = TicketActionIntent.replace),
            ),
            if (_intent == TicketActionIntent.refund) ...[
              const SizedBox(height: 14),
              const Text(
                'RESTITUTION',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                  color: _muted,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _ChoiceChip(
                      label: 'Espèces',
                      selected: _settlement == 'cash',
                      onTap: () => setState(() => _settlement = 'cash'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _ChoiceChip(
                      label: 'Carte (TPE)',
                      selected: _settlement == 'card',
                      onTap: () => setState(() => _settlement = 'card'),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Text(
              'Montant · restant ${formatEuros(sale.refundableCents)}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _muted,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: _fieldDecoration(hint: '0,00'),
            ),
            const SizedBox(height: 14),
            const Text(
              'Motif (obligatoire)',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _muted,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final preset in _reasonPresets)
                  _ChoiceChip(
                    label: preset,
                    selected: _reason.text == preset,
                    onTap: () => setState(() => _reason.text = preset),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _reason,
              minLines: 2,
              maxLines: 3,
              onChanged: (_) => setState(() {}),
              decoration: _fieldDecoration(
                hint: 'Insatisfaction, produit défectueux, erreur de caisse…',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: _black,
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
                    : Text(_submitLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String get _submitLabel {
    switch (_intent) {
      case TicketActionIntent.refund:
        return 'Émettre l’avoir et rembourser';
      case TicketActionIntent.replace:
        return 'Émettre l’avoir puis remplacer';
      case TicketActionIntent.credit:
        return 'Émettre l’avoir';
    }
  }
}

String _eurosInput(int cents) {
  final whole = cents ~/ 100;
  final frac = (cents.abs() % 100).toString().padLeft(2, '0');
  return '$whole,$frac';
}

InputDecoration _fieldDecoration({required String hint}) {
  return InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
    filled: true,
    fillColor: _fill,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _black, width: 1.2),
    ),
  );
}

class _IntentTile extends StatelessWidget {
  const _IntentTile({
    required this.selected,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool selected;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFF4F4F5) : _fill,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? _black : _border,
              width: selected ? 1.4 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                size: 18,
                color: selected ? _black : _muted,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: _black,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(fontSize: 12, height: 1.35, color: _muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChoiceChip extends StatelessWidget {
  const _ChoiceChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? _black : Colors.white,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: selected ? _black : _border),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : _black,
            ),
          ),
        ),
      ),
    );
  }
}
