import 'dart:ui' show FontFeature;

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';

const _black = Color(0xFF0A0A0A);
const _muted = Color(0xFF737373);
const _border = Color(0xFFEDEDED);
const _fill = Color(0xFFF9FAFB);

Future<void> showInstitutIdentityEditor({
  required BuildContext context,
  required InstTenantInfo info,
}) {
  return _showEditorSheet(
    context: context,
    child: _IdentityForm(info: info),
  );
}

Future<void> showInstitutContactEditor({
  required BuildContext context,
  required InstTenantInfo info,
}) {
  return _showEditorSheet(
    context: context,
    child: _ContactForm(info: info),
  );
}

Future<void> showInstitutAddressEditor({
  required BuildContext context,
  required InstTenantInfo info,
}) {
  return _showEditorSheet(
    context: context,
    child: _AddressForm(info: info),
  );
}

Future<void> showInstitutHoursEditor({
  required BuildContext context,
  required InstTenantInfo info,
}) {
  return _showEditorSheet(
    context: context,
    child: _HoursForm(info: info),
    heightFactor: 0.92,
  );
}

Future<void> _showEditorSheet({
  required BuildContext context,
  required Widget child,
  double heightFactor = 0.88,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => FractionallySizedBox(
      heightFactor: heightFactor,
      child: child,
    ),
  );
}

class _SheetScaffold extends StatelessWidget {
  const _SheetScaffold({
    required this.title,
    required this.child,
    required this.onSave,
    required this.saving,
    this.error,
  });

  final String title;
  final Widget child;
  final VoidCallback? onSave;
  final bool saving;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 8),
        Container(
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: _border,
            borderRadius: BorderRadius.circular(99),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 8, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: _black,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              IconButton(
                onPressed: saving ? null : () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, size: 22),
                color: _muted,
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: _border),
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              20,
              16,
              20,
              16 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: child,
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              error!,
              style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13),
            ),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                onPressed: saving ? null : onSave,
                style: FilledButton.styleFrom(
                  backgroundColor: _black,
                  foregroundColor: Colors.white,
                ),
                child: saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Enregistrer'),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

InputDecoration _decoration({String? hint}) {
  return InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: Color(0xFFA3A3A3), fontSize: 14),
    filled: true,
    fillColor: _fill,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _border),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _border),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _black, width: 1.2),
    ),
  );
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: _muted,
      ),
    );
  }
}

mixin _TenantSave<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  bool saving = false;
  String? error;

  Future<void> savePatch({
    String? displayName,
    String? description,
    InstTenantContact? contact,
    InstTenantAddress? address,
    List<InstOpeningDay>? openingHours,
  }) async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      saving = true;
      error = null;
    });
    try {
      await ref.read(mobileApiProvider).updateInstitutTenant(
            accessToken: token,
            tenantId: tenantId,
            displayName: displayName,
            description: description,
            contact: contact,
            address: address,
            openingHours: openingHours,
          );
      ref.invalidate(institutTenantInfoProvider);
      ref.invalidate(tenantBrandingProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          error = '$e';
          saving = false;
        });
      }
    }
  }
}

class _IdentityForm extends ConsumerStatefulWidget {
  const _IdentityForm({required this.info});
  final InstTenantInfo info;

  @override
  ConsumerState<_IdentityForm> createState() => _IdentityFormState();
}

class _IdentityFormState extends ConsumerState<_IdentityForm>
    with _TenantSave<_IdentityForm> {
  late final TextEditingController _name;
  late final TextEditingController _description;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.info.displayName);
    _description = TextEditingController(text: widget.info.description ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Identité',
      saving: saving,
      error: error,
      onSave: () => savePatch(
        displayName: _name.text.trim(),
        description: _description.text.trim(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _FieldLabel('Nom affiché'),
          const SizedBox(height: 6),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: _decoration(hint: widget.info.name),
          ),
          const SizedBox(height: 16),
          const _FieldLabel('Présentation'),
          const SizedBox(height: 6),
          TextField(
            controller: _description,
            maxLines: 4,
            maxLength: 500,
            decoration: _decoration(
              hint: 'Quelques mots sur l’institut, visibles publiquement.',
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactForm extends ConsumerStatefulWidget {
  const _ContactForm({required this.info});
  final InstTenantInfo info;

  @override
  ConsumerState<_ContactForm> createState() => _ContactFormState();
}

class _ContactFormState extends ConsumerState<_ContactForm>
    with _TenantSave<_ContactForm> {
  late final TextEditingController _email;
  late final TextEditingController _phone;
  late final TextEditingController _website;

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: widget.info.contact.email ?? '');
    _phone = TextEditingController(text: widget.info.contact.phone ?? '');
    _website = TextEditingController(text: widget.info.contact.website ?? '');
  }

  @override
  void dispose() {
    _email.dispose();
    _phone.dispose();
    _website.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Contact',
      saving: saving,
      error: error,
      onSave: () {
        final email = _blank(_email.text);
        if (email != null && !email.contains('@')) {
          setState(() => error = 'Email invalide');
          return;
        }
        savePatch(
          contact: InstTenantContact(
            email: email,
            phone: _blank(_phone.text),
            website: _blank(_website.text),
          ),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _FieldLabel('Email'),
          const SizedBox(height: 6),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: _decoration(hint: 'contact@institut.fr'),
          ),
          const SizedBox(height: 16),
          const _FieldLabel('Téléphone'),
          const SizedBox(height: 6),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: _decoration(hint: '01 23 45 67 89'),
          ),
          const SizedBox(height: 16),
          const _FieldLabel('Site web'),
          const SizedBox(height: 6),
          TextField(
            controller: _website,
            keyboardType: TextInputType.url,
            decoration: _decoration(hint: 'https://…'),
          ),
        ],
      ),
    );
  }
}

class _AddressForm extends ConsumerStatefulWidget {
  const _AddressForm({required this.info});
  final InstTenantInfo info;

  @override
  ConsumerState<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends ConsumerState<_AddressForm>
    with _TenantSave<_AddressForm> {
  late final TextEditingController _line1;
  late final TextEditingController _line2;
  late final TextEditingController _postal;
  late final TextEditingController _city;
  late final TextEditingController _country;

  @override
  void initState() {
    super.initState();
    _line1 = TextEditingController(text: widget.info.address.line1 ?? '');
    _line2 = TextEditingController(text: widget.info.address.line2 ?? '');
    _postal = TextEditingController(text: widget.info.address.postalCode ?? '');
    _city = TextEditingController(text: widget.info.address.city ?? '');
    _country = TextEditingController(text: widget.info.address.country ?? '');
  }

  @override
  void dispose() {
    _line1.dispose();
    _line2.dispose();
    _postal.dispose();
    _city.dispose();
    _country.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Adresse',
      saving: saving,
      error: error,
      onSave: () => savePatch(
        address: InstTenantAddress(
          line1: _blank(_line1.text),
          line2: _blank(_line2.text),
          postalCode: _blank(_postal.text),
          city: _blank(_city.text),
          country: _blank(_country.text),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _FieldLabel('Rue'),
          const SizedBox(height: 6),
          TextField(
            controller: _line1,
            textCapitalization: TextCapitalization.words,
            decoration: _decoration(hint: '12 rue des Lilas'),
          ),
          const SizedBox(height: 16),
          const _FieldLabel('Complément'),
          const SizedBox(height: 6),
          TextField(
            controller: _line2,
            decoration: _decoration(hint: 'Bâtiment, étage…'),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _FieldLabel('Code postal'),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _postal,
                      keyboardType: TextInputType.number,
                      decoration: _decoration(hint: '75011'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _FieldLabel('Ville'),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _city,
                      textCapitalization: TextCapitalization.words,
                      decoration: _decoration(hint: 'Paris'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const _FieldLabel('Pays'),
          const SizedBox(height: 6),
          TextField(
            controller: _country,
            textCapitalization: TextCapitalization.words,
            decoration: _decoration(hint: 'France'),
          ),
        ],
      ),
    );
  }
}

class _DayDraft {
  _DayDraft({
    required this.weekday,
    required this.label,
    required this.slots,
  });

  final int weekday;
  final String label;
  List<InstOpeningSlot> slots;

  bool get isOpen => slots.isNotEmpty;
}

class _HoursForm extends ConsumerStatefulWidget {
  const _HoursForm({required this.info});
  final InstTenantInfo info;

  @override
  ConsumerState<_HoursForm> createState() => _HoursFormState();
}

class _HoursFormState extends ConsumerState<_HoursForm>
    with _TenantSave<_HoursForm> {
  late final List<_DayDraft> _days;

  @override
  void initState() {
    super.initState();
    final source = widget.info.openingHours;
    final byWeekday = {for (final day in source) day.weekday: day};
    _days = [1, 2, 3, 4, 5, 6, 0].map((weekday) {
      final day = byWeekday[weekday];
      return _DayDraft(
        weekday: weekday,
        label: day?.label ?? _fallbackLabel(weekday),
        slots: [...?(day?.slots)],
      );
    }).toList();
  }

  String _fallbackLabel(int weekday) {
    const labels = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    return labels[weekday];
  }

  TimeOfDay _parse(String value) {
    final parts = value.split(':');
    final hour = int.tryParse(parts.first) ?? 9;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    return TimeOfDay(hour: hour, minute: minute);
  }

  String _format(TimeOfDay time) {
    final h = time.hour.toString().padLeft(2, '0');
    final m = time.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _pickTime(_DayDraft day, int index, {required bool start}) async {
    final current = start ? day.slots[index].start : day.slots[index].end;
    final picked = await showTimePicker(
      context: context,
      initialTime: _parse(current),
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
    if (picked == null) return;
    setState(() {
      final slot = day.slots[index];
      day.slots[index] = InstOpeningSlot(
        start: start ? _format(picked) : slot.start,
        end: start ? slot.end : _format(picked),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Horaires publics',
      saving: saving,
      error: error,
      onSave: () => savePatch(
        openingHours: _days
            .map(
              (d) => InstOpeningDay(
                weekday: d.weekday,
                label: d.label,
                slots: d.slots,
              ),
            )
            .toList(growable: false),
      ),
      child: Column(
        children: [
          for (final day in _days) ...[
            _DayEditor(
              day: day,
              onToggle: (open) {
                setState(() {
                  day.slots = open
                      ? [const InstOpeningSlot(start: '09:00', end: '18:00')]
                      : [];
                });
              },
              onPickStart: (index) => _pickTime(day, index, start: true),
              onPickEnd: (index) => _pickTime(day, index, start: false),
              onAddSlot: () {
                setState(() {
                  day.slots = [
                    ...day.slots,
                    const InstOpeningSlot(start: '14:00', end: '19:00'),
                  ];
                });
              },
              onRemoveSlot: (index) {
                setState(() {
                  final next = [...day.slots]..removeAt(index);
                  day.slots = next;
                });
              },
            ),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 4),
          const Text(
            'Ces horaires s’affichent sur le site et servent de grille par défaut pour les rendez-vous.',
            style: TextStyle(fontSize: 12, color: _muted, height: 1.35),
          ),
        ],
      ),
    );
  }
}

class _DayEditor extends StatelessWidget {
  const _DayEditor({
    required this.day,
    required this.onToggle,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onAddSlot,
    required this.onRemoveSlot,
  });

  final _DayDraft day;
  final ValueChanged<bool> onToggle;
  final ValueChanged<int> onPickStart;
  final ValueChanged<int> onPickEnd;
  final VoidCallback onAddSlot;
  final ValueChanged<int> onRemoveSlot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 10),
      decoration: BoxDecoration(
        color: _fill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  day.label,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: _black,
                  ),
                ),
              ),
              Switch.adaptive(
                value: day.isOpen,
                onChanged: onToggle,
              ),
            ],
          ),
          if (!day.isOpen)
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Fermé',
                style: TextStyle(
                  fontSize: 13,
                  color: _muted,
                  fontStyle: FontStyle.italic,
                ),
              ),
            )
          else ...[
            for (var i = 0; i < day.slots.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    _TimeChip(
                      label: day.slots[i].start,
                      onTap: () => onPickStart(i),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Text('—', style: TextStyle(color: _muted)),
                    ),
                    _TimeChip(
                      label: day.slots[i].end,
                      onTap: () => onPickEnd(i),
                    ),
                    if (day.slots.length > 1)
                      IconButton(
                        onPressed: () => onRemoveSlot(i),
                        icon: const Icon(Icons.remove_circle_outline, size: 20),
                        color: _muted,
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ),
            if (day.slots.length < 3)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: onAddSlot,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Ajouter une plage'),
                  style: TextButton.styleFrom(
                    foregroundColor: _black,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _TimeChip extends StatelessWidget {
  const _TimeChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _border),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: _black,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ),
    );
  }
}

String? _blank(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}
