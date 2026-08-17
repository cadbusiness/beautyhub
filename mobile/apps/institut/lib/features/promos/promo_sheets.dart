import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';

const _black = Color(0xFF0A0A0A);
const _fill = Color(0xFFF5F5F5);

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

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 36,
        height: 4,
        decoration: BoxDecoration(
          color: const Color(0xFFE5E5E5),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: Color(0xFF404040),
      ),
    );
  }
}

Future<bool?> showPromoSheet(
  BuildContext context,
  WidgetRef ref, {
  InstPromo? promo,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _PromoSheet(promo: promo),
  );
}

class _PromoSheet extends ConsumerStatefulWidget {
  const _PromoSheet({this.promo});
  final InstPromo? promo;

  @override
  ConsumerState<_PromoSheet> createState() => _PromoSheetState();
}

class _PromoSheetState extends ConsumerState<_PromoSheet> {
  late final _code = TextEditingController(text: widget.promo?.code ?? '');
  late final _name = TextEditingController(text: widget.promo?.name ?? '');
  late final _description =
      TextEditingController(text: widget.promo?.description ?? '');
  late final _percent = TextEditingController(
    text: widget.promo?.discountPercent?.toString() ?? '10',
  );
  late final _euros = TextEditingController(
    text: widget.promo?.discountCents != null
        ? (widget.promo!.discountCents! / 100).toStringAsFixed(2)
        : '10.00',
  );
  late final _minOrder = TextEditingController(
    text: widget.promo != null && widget.promo!.minOrderCents > 0
        ? (widget.promo!.minOrderCents / 100).toStringAsFixed(2)
        : '',
  );
  late final _usageLimit = TextEditingController(
    text: widget.promo?.usageLimit?.toString() ?? '',
  );
  late final _perClient = TextEditingController(
    text: widget.promo?.usageLimitPerClient?.toString() ?? '',
  );

  late String _discountType = widget.promo?.discountType ?? 'percent';
  late bool _woo = widget.promo?.channelWoo ?? true;
  late bool _booking = widget.promo?.channelBooking ?? true;
  late bool _pos = widget.promo?.channelPos ?? true;
  late bool _active = widget.promo?.isActive ?? true;
  DateTime? _starts;
  DateTime? _ends;
  bool _saving = false;
  String? _error;

  static DateTime? _parseDate(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  @override
  void initState() {
    super.initState();
    _starts = _parseDate(widget.promo?.startsAt);
    _ends = _parseDate(widget.promo?.endsAt);
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _description.dispose();
    _percent.dispose();
    _euros.dispose();
    _minOrder.dispose();
    _usageLimit.dispose();
    _perClient.dispose();
    super.dispose();
  }

  int? _positiveInt(String raw) {
    final n = int.tryParse(raw.trim());
    if (n == null || n <= 0) return null;
    return n;
  }

  Future<void> _pickDate({required bool start}) async {
    final initial = (start ? _starts : _ends) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _starts = picked;
      } else {
        _ends = picked;
      }
    });
  }

  Future<void> _submit() async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;
    final code = _code.text.trim();
    final name = _name.text.trim();
    if (code.isEmpty || name.isEmpty) {
      setState(() => _error = 'Code et nom requis.');
      return;
    }
    if (!_woo && !_booking && !_pos) {
      setState(() => _error = 'Choisissez au moins un canal.');
      return;
    }

    int? discountPercent;
    int? discountCents;
    if (_discountType == 'percent') {
      discountPercent = int.tryParse(_percent.text.trim());
    } else {
      final n = double.tryParse(_euros.text.trim().replaceAll(',', '.'));
      discountCents = n == null ? null : (n * 100).round();
    }

    final minEuros = double.tryParse(_minOrder.text.trim().replaceAll(',', '.'));
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(mobileApiProvider).savePromo(
            accessToken: token,
            tenantId: tenantId,
            promoId: widget.promo?.id,
            code: code,
            name: name,
            description: _description.text.trim().isEmpty
                ? null
                : _description.text.trim(),
            discountType: _discountType,
            discountPercent: discountPercent,
            discountCents: discountCents,
            minOrderCents: minEuros == null || minEuros <= 0
                ? 0
                : (minEuros * 100).round(),
            startsAt: _starts?.toUtc().toIso8601String(),
            endsAt: _ends?.toUtc().toIso8601String(),
            usageLimit: _positiveInt(_usageLimit.text),
            usageLimitPerClient: _positiveInt(_perClient.text),
            channelWoo: _woo,
            channelBooking: _booking,
            channelPos: _pos,
            isActive: _active,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString();
        });
      }
    }
  }

  String _dateLabel(DateTime? value) {
    if (value == null) return 'Aucune';
    final d = value.toLocal();
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SheetHandle(),
            const SizedBox(height: 16),
            Text(
              widget.promo == null ? 'Nouvelle promo' : 'Modifier la promo',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _black,
              ),
            ),
            const SizedBox(height: 16),
            const _FieldLabel('Code'),
            const SizedBox(height: 6),
            TextField(
              controller: _code,
              textCapitalization: TextCapitalization.characters,
              decoration: _fieldDecoration(hint: 'BIENVENUE10'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Nom'),
            const SizedBox(height: 6),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.sentences,
              decoration: _fieldDecoration(hint: 'Bienvenue −10 %'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Description'),
            const SizedBox(height: 6),
            TextField(
              controller: _description,
              decoration: _fieldDecoration(hint: 'Optionnel'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Remise'),
            const SizedBox(height: 8),
            Row(
              children: [
                ChoiceChip(
                  label: const Text('%'),
                  selected: _discountType == 'percent',
                  onSelected: (_) => setState(() => _discountType = 'percent'),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('€'),
                  selected: _discountType == 'fixed',
                  onSelected: (_) => setState(() => _discountType = 'fixed'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_discountType == 'percent')
              TextField(
                controller: _percent,
                keyboardType: TextInputType.number,
                decoration: _fieldDecoration(hint: '10'),
              )
            else
              TextField(
                controller: _euros,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: _fieldDecoration(hint: '10,00'),
              ),
            const SizedBox(height: 14),
            const _FieldLabel('Minimum de commande (€)'),
            const SizedBox(height: 6),
            TextField(
              controller: _minOrder,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: _fieldDecoration(hint: '0'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Limite d’usages'),
            const SizedBox(height: 6),
            TextField(
              controller: _usageLimit,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration(hint: 'Illimité'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Limite par cliente'),
            const SizedBox(height: 6),
            TextField(
              controller: _perClient,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration(hint: 'Illimité'),
            ),
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Début'),
              subtitle: Text(_dateLabel(_starts)),
              trailing: TextButton(
                onPressed: () => _pickDate(start: true),
                child: const Text('Choisir'),
              ),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Fin'),
              subtitle: Text(_dateLabel(_ends)),
              trailing: TextButton(
                onPressed: () => _pickDate(start: false),
                child: const Text('Choisir'),
              ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Caisse'),
              value: _pos,
              onChanged: (v) => setState(() => _pos = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Réservation'),
              value: _booking,
              onChanged: (v) => setState(() => _booking = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Boutique en ligne'),
              value: _woo,
              onChanged: (v) => setState(() => _woo = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Promo active'),
              value: _active,
              onChanged: (v) => setState(() => _active = v),
            ),
            if (_error != null) ...[
              Text(
                _error!,
                style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13),
              ),
              const SizedBox(height: 10),
            ],
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: _black,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: Colors.white,
                        ),
                      )
                    : Text(widget.promo == null ? 'Créer' : 'Enregistrer'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
