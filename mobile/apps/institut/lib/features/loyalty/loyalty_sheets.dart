import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import 'loyalty_labels.dart';

const _black = Color(0xFF0A0A0A);
const _muted = Color(0xFF737373);
const _fill = Color(0xFFF5F5F5);
const _border = Color(0xFFE8E8E8);

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

class _SheetSubmit extends StatelessWidget {
  const _SheetSubmit({
    required this.label,
    required this.saving,
    required this.onPressed,
  });

  final String label;
  final bool saving;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: _black,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: saving
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: Colors.white,
                ),
              )
            : Text(label),
      ),
    );
  }
}

class _ChoiceChip extends StatelessWidget {
  const _ChoiceChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.enabled = true,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6, bottom: 6),
      child: Material(
        color: !enabled
            ? const Color(0xFFF3F4F6)
            : selected
                ? _black
                : Colors.white,
        borderRadius: BorderRadius.circular(99),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(99),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              border: Border.all(
                color: selected ? _black : _border,
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: !enabled
                    ? const Color(0xFFA3A3A3)
                    : selected
                        ? Colors.white
                        : _muted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

Future<String?> showLoyaltyNameSheet(
  BuildContext context, {
  required String title,
  required String hint,
  String? initial,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _NameSheet(title: title, hint: hint, initial: initial),
  );
}

class _NameSheet extends StatefulWidget {
  const _NameSheet({
    required this.title,
    required this.hint,
    this.initial,
  });

  final String title;
  final String hint;
  final String? initial;

  @override
  State<_NameSheet> createState() => _NameSheetState();
}

class _NameSheetState extends State<_NameSheet> {
  late final _name = TextEditingController(text: widget.initial ?? '');

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _SheetHandle(),
          const SizedBox(height: 16),
          Text(
            widget.title,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: _black,
            ),
          ),
          const SizedBox(height: 16),
          const _FieldLabel('Nom'),
          const SizedBox(height: 6),
          TextField(
            controller: _name,
            autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            decoration: _fieldDecoration(hint: widget.hint),
          ),
          const SizedBox(height: 18),
          _SheetSubmit(
            label: 'Enregistrer',
            saving: false,
            onPressed: () {
              final value = _name.text.trim();
              if (value.isEmpty) return;
              Navigator.pop(context, value);
            },
          ),
        ],
      ),
    );
  }
}

Future<bool> showLoyaltySettingsSheet(
  BuildContext context,
  WidgetRef ref, {
  required InstLoyaltyProgramAdmin program,
}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _SettingsSheet(program: program),
  );
  return saved == true;
}

class _SettingsSheet extends ConsumerStatefulWidget {
  const _SettingsSheet({required this.program});
  final InstLoyaltyProgramAdmin program;

  @override
  ConsumerState<_SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends ConsumerState<_SettingsSheet> {
  late final _name = TextEditingController(text: widget.program.name);
  late final _label = TextEditingController(text: widget.program.pointsLabel);
  late final _birthday =
      TextEditingController(text: '${widget.program.birthdayBonusPoints}');
  late final _referral =
      TextEditingController(text: '${widget.program.referralPoints}');
  late final _rebook =
      TextEditingController(text: '${widget.program.sameDayRebookPoints}');
  late bool _active = widget.program.isActive;
  late bool _birthdayAuto = widget.program.birthdayAutoEnabled;
  late bool _portal = widget.program.portalVisible;
  late bool _credit = widget.program.creditEnabled;
  late final _creditRate = TextEditingController(
    text: (widget.program.creditRateBps / 100).toString(),
  );
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _label.dispose();
    _birthday.dispose();
    _referral.dispose();
    _rebook.dispose();
    _creditRate.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;
    final name = _name.text.trim();
    final pointsLabel = _label.text.trim();
    if (name.isEmpty || pointsLabel.isEmpty) {
      setState(() => _error = 'Nom et libellé requis.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(mobileApiProvider).saveLoyaltyProgramSettings(
            accessToken: token,
            tenantId: tenantId,
            programId: widget.program.id,
            name: name,
            pointsLabel: pointsLabel,
            isActive: _active,
            birthdayBonusPoints: int.tryParse(_birthday.text.trim()) ?? 0,
            birthdayAutoEnabled: _birthdayAuto,
            portalVisible: _portal,
            referralPoints: int.tryParse(_referral.text.trim()) ?? 0,
            sameDayRebookPoints: int.tryParse(_rebook.text.trim()) ?? 0,
            creditEnabled: _credit,
            creditRateBps: (() {
              final n = double.tryParse(
                    _creditRate.text.trim().replaceAll(',', '.'),
                  ) ??
                  0;
              return (n * 100).round();
            })(),
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
            const Text(
              'Réglages',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _black,
              ),
            ),
            const SizedBox(height: 16),
            const _FieldLabel('Nom du programme'),
            const SizedBox(height: 6),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.sentences,
              decoration: _fieldDecoration(hint: 'Fidélité institut'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Libellé des points'),
            const SizedBox(height: 6),
            TextField(
              controller: _label,
              decoration: _fieldDecoration(hint: 'points'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Bonus anniversaire'),
            const SizedBox(height: 6),
            TextField(
              controller: _birthday,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration(hint: '0'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Envoi automatique du bonus'),
              value: _birthdayAuto,
              onChanged: (v) => setState(() => _birthdayAuto = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Visible sur le portail cliente'),
              value: _portal,
              onChanged: (v) => setState(() => _portal = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Programme actif'),
              value: _active,
              onChanged: (v) => setState(() => _active = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Bon en euros'),
              subtitle: const Text(
                '17,50 € pour 500 € = 3,5 %. Utilisable en tout ou partie.',
              ),
              value: _credit,
              onChanged: (v) => setState(() => _credit = v),
            ),
            if (_credit) ...[
              const _FieldLabel('Taux du bon (%)'),
              const SizedBox(height: 6),
              TextField(
                controller: _creditRate,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: _fieldDecoration(hint: '3,5'),
              ),
            ],
            const _FieldLabel('Points parrainage'),
            const SizedBox(height: 6),
            TextField(
              controller: _referral,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration(hint: '0'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Bonus rebook jour même'),
            const SizedBox(height: 6),
            TextField(
              controller: _rebook,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration(hint: '0'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Color(0xFFDC2626))),
            ],
            const SizedBox(height: 18),
            _SheetSubmit(
              label: 'Enregistrer',
              saving: _saving,
              onPressed: _saving ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

Future<bool> showLoyaltyRuleSheet(
  BuildContext context,
  WidgetRef ref, {
  required String programId,
  required bool wooConnected,
  InstLoyaltyEarnRule? rule,
}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _RuleSheet(
      programId: programId,
      wooConnected: wooConnected,
      rule: rule,
    ),
  );
  return saved == true;
}

class _RuleSheet extends ConsumerStatefulWidget {
  const _RuleSheet({
    required this.programId,
    required this.wooConnected,
    this.rule,
  });

  final String programId;
  final bool wooConnected;
  final InstLoyaltyEarnRule? rule;

  @override
  ConsumerState<_RuleSheet> createState() => _RuleSheetState();
}

class _RuleSheetState extends ConsumerState<_RuleSheet> {
  late final _name = TextEditingController(text: widget.rule?.name ?? '');
  late final _points = TextEditingController(
    text: widget.rule != null ? '${widget.rule!.pointsValue}' : '10',
  );
  late final _min = TextEditingController(
    text: widget.rule == null
        ? '0'
        : (widget.rule!.minAmountCents / 100).toStringAsFixed(
            widget.rule!.minAmountCents % 100 == 0 ? 0 : 2,
          ),
  );
  late String _source = widget.rule?.sourceType ?? 'appointment_completed';
  late String _calc = widget.rule?.calcMode ?? 'fixed_per_event';
  late bool _active = widget.rule?.isActive ?? true;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _points.dispose();
    _min.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;
    final name = _name.text.trim();
    final points = num.tryParse(_points.text.trim().replaceAll(',', '.'));
    if (name.isEmpty || points == null || points <= 0) {
      setState(() => _error = 'Nom et points requis.');
      return;
    }
    final minEuros = double.tryParse(_min.text.trim().replaceAll(',', '.')) ?? 0;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(mobileApiProvider).saveLoyaltyRule(
            accessToken: token,
            tenantId: tenantId,
            programId: widget.programId,
            id: widget.rule?.id,
            name: name,
            sourceType: _source,
            calcMode: _calc,
            pointsValue: points,
            minAmountCents: (minEuros * 100).round(),
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
              widget.rule == null ? 'Nouvelle règle' : 'Modifier la règle',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _black,
              ),
            ),
            const SizedBox(height: 16),
            const _FieldLabel('Nom'),
            const SizedBox(height: 6),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.sentences,
              decoration: _fieldDecoration(hint: 'Points par visite'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Basé sur'),
            const SizedBox(height: 8),
            Wrap(
              children: [
                _ChoiceChip(
                  label: loyaltySourceLabel('appointment_completed'),
                  selected: _source == 'appointment_completed',
                  onTap: () => setState(() {
                    _source = 'appointment_completed';
                    _calc = 'fixed_per_event';
                  }),
                ),
                _ChoiceChip(
                  label: loyaltySourceLabel('pos_sale'),
                  selected: _source == 'pos_sale',
                  onTap: () => setState(() => _source = 'pos_sale'),
                ),
                _ChoiceChip(
                  label: widget.wooConnected
                      ? loyaltySourceLabel('woocommerce_order')
                      : 'WooCommerce (non connecté)',
                  selected: _source == 'woocommerce_order',
                  enabled: widget.wooConnected,
                  onTap: () => setState(() => _source = 'woocommerce_order'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const _FieldLabel('Calcul'),
            const SizedBox(height: 8),
            Wrap(
              children: [
                _ChoiceChip(
                  label: loyaltyCalcLabel('fixed_per_event'),
                  selected: _calc == 'fixed_per_event',
                  onTap: () => setState(() => _calc = 'fixed_per_event'),
                ),
                if (_source != 'appointment_completed')
                  _ChoiceChip(
                    label: loyaltyCalcLabel('per_euro_spent'),
                    selected: _calc == 'per_euro_spent',
                    onTap: () => setState(() => _calc = 'per_euro_spent'),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            _FieldLabel(
              _calc == 'per_euro_spent' ? 'Points par euro' : 'Points',
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _points,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: _fieldDecoration(hint: '10'),
            ),
            if (_source != 'appointment_completed') ...[
              const SizedBox(height: 14),
              const _FieldLabel('Montant minimum (€)'),
              const SizedBox(height: 6),
              TextField(
                controller: _min,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: _fieldDecoration(hint: '0'),
              ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Règle active'),
              value: _active,
              onChanged: (v) => setState(() => _active = v),
            ),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Color(0xFFDC2626))),
            const SizedBox(height: 12),
            _SheetSubmit(
              label: 'Enregistrer',
              saving: _saving,
              onPressed: _saving ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

Future<bool> showLoyaltyRewardSheet(
  BuildContext context,
  WidgetRef ref, {
  required String programId,
  required List<InstLoyaltyServiceOption> services,
  InstLoyaltyRewardAdmin? reward,
}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _RewardSheet(
      programId: programId,
      services: services,
      reward: reward,
    ),
  );
  return saved == true;
}

class _RewardSheet extends ConsumerStatefulWidget {
  const _RewardSheet({
    required this.programId,
    required this.services,
    this.reward,
  });

  final String programId;
  final List<InstLoyaltyServiceOption> services;
  final InstLoyaltyRewardAdmin? reward;

  @override
  ConsumerState<_RewardSheet> createState() => _RewardSheetState();
}

class _RewardSheetState extends ConsumerState<_RewardSheet> {
  late final _name = TextEditingController(text: widget.reward?.name ?? '');
  late final _description =
      TextEditingController(text: widget.reward?.description ?? '');
  late final _cost = TextEditingController(
    text: widget.reward != null ? '${widget.reward!.pointsCost}' : '100',
  );
  late final _percent = TextEditingController(
    text: '${widget.reward?.discountPercent ?? 10}',
  );
  late final _amount = TextEditingController(
    text: widget.reward?.discountCents == null
        ? '10'
        : (widget.reward!.discountCents! / 100).toStringAsFixed(2),
  );
  late String _type = widget.reward?.rewardType ?? 'discount_percent';
  late String? _serviceId = widget.reward?.serviceId;
  late bool _active = widget.reward?.isActive ?? true;
  late bool _newOnly = widget.reward?.newServiceOnly ?? false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _cost.dispose();
    _percent.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;
    final name = _name.text.trim();
    final cost = num.tryParse(_cost.text.trim().replaceAll(',', '.'));
    if (name.isEmpty || cost == null || cost <= 0) {
      setState(() => _error = 'Nom et coût requis.');
      return;
    }
    if (_type == 'free_service' && (_serviceId == null || _serviceId!.isEmpty)) {
      setState(() => _error = 'Choisissez une prestation.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final amount =
          double.tryParse(_amount.text.trim().replaceAll(',', '.')) ?? 0;
      await ref.read(mobileApiProvider).saveLoyaltyReward(
            accessToken: token,
            tenantId: tenantId,
            programId: widget.programId,
            id: widget.reward?.id,
            name: name,
            description:
                _description.text.trim().isEmpty ? null : _description.text.trim(),
            rewardType: _type,
            pointsCost: cost,
            isActive: _active,
            newServiceOnly: _newOnly,
            discountPercent:
                _type == 'discount_percent' ? int.tryParse(_percent.text) : null,
            discountCents:
                _type == 'discount_fixed' ? (amount * 100).round() : null,
            serviceId: _type == 'free_service' ? _serviceId : null,
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
              widget.reward == null
                  ? 'Nouvelle récompense'
                  : 'Modifier la récompense',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _black,
              ),
            ),
            const SizedBox(height: 16),
            const _FieldLabel('Nom'),
            const SizedBox(height: 6),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.sentences,
              decoration: _fieldDecoration(hint: '−10 %'),
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Type'),
            const SizedBox(height: 8),
            Wrap(
              children: [
                for (final type in const [
                  'discount_percent',
                  'discount_fixed',
                  'free_service',
                ])
                  _ChoiceChip(
                    label: loyaltyRewardTypeLabel(type),
                    selected: _type == type,
                    onTap: () => setState(() => _type = type),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            const _FieldLabel('Coût en points'),
            const SizedBox(height: 6),
            TextField(
              controller: _cost,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration(hint: '100'),
            ),
            if (_type == 'discount_percent') ...[
              const SizedBox(height: 14),
              const _FieldLabel('Pourcentage'),
              const SizedBox(height: 6),
              TextField(
                controller: _percent,
                keyboardType: TextInputType.number,
                decoration: _fieldDecoration(hint: '10'),
              ),
            ],
            if (_type == 'discount_fixed') ...[
              const SizedBox(height: 14),
              const _FieldLabel('Montant (€)'),
              const SizedBox(height: 6),
              TextField(
                controller: _amount,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: _fieldDecoration(hint: '10'),
              ),
            ],
            if (_type == 'free_service') ...[
              const SizedBox(height: 14),
              const _FieldLabel('Prestation'),
              const SizedBox(height: 8),
              if (widget.services.isEmpty)
                const Text(
                  'Aucune prestation active.',
                  style: TextStyle(color: _muted),
                )
              else
                Wrap(
                  children: [
                    for (final service in widget.services)
                      _ChoiceChip(
                        label: service.name,
                        selected: _serviceId == service.id,
                        onTap: () => setState(() => _serviceId = service.id),
                      ),
                  ],
                ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Nouvelle prestation uniquement'),
              value: _newOnly,
              onChanged: (v) => setState(() => _newOnly = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Récompense active'),
              value: _active,
              onChanged: (v) => setState(() => _active = v),
            ),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Color(0xFFDC2626))),
            const SizedBox(height: 12),
            _SheetSubmit(
              label: 'Enregistrer',
              saving: _saving,
              onPressed: _saving ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
