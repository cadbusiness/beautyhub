import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../../widgets/app_sheet.dart';

const _black = Color(0xFF0A0A0A);
const _muted = Color(0xFF737373);
const _border = Color(0xFFEDEDED);
const _fill = Color(0xFFF9FAFB);

Future<SavedClientResult?> showClientEditorSheet({
  required BuildContext context,
  InstClient? client,
}) {
  return showAppSheet<SavedClientResult>(
    context: context,
    builder: (_) => _ClientEditorSheet(client: client),
  );
}

void showClientAccountCreatedSnackBar(
  BuildContext context,
  ClientAccountCredentials account,
) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 8),
      backgroundColor: _black,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Compte cliente créé',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'ID : ${account.loginId}  ·  PIN : ${account.pinCode}',
            style: const TextStyle(color: Colors.white, fontSize: 13),
          ),
        ],
      ),
      action: SnackBarAction(
        label: 'Copier',
        textColor: const Color(0xFF60A5FA),
        onPressed: () {
          Clipboard.setData(
            ClipboardData(
              text: 'ID: ${account.loginId} / PIN: ${account.pinCode}',
            ),
          );
        },
      ),
    ),
  );
}

class _ClientEditorSheet extends ConsumerStatefulWidget {
  const _ClientEditorSheet({this.client});
  final InstClient? client;

  @override
  ConsumerState<_ClientEditorSheet> createState() => _ClientEditorSheetState();
}

class _ClientEditorSheetState extends ConsumerState<_ClientEditorSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  late final TextEditingController _line1;
  late final TextEditingController _line2;
  late final TextEditingController _postal;
  late final TextEditingController _city;
  late final TextEditingController _notes;
  late final TextEditingController _tags;
  DateTime? _dob;
  bool _marketing = false;
  bool _createAccount = false;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.client != null;

  @override
  void initState() {
    super.initState();
    final c = widget.client;
    _name = TextEditingController(text: c?.fullName ?? '');
    _email = TextEditingController(text: c?.email ?? '');
    _phone = TextEditingController(text: c?.phone ?? '');
    _line1 = TextEditingController(text: c?.addressLine1 ?? '');
    _line2 = TextEditingController(text: c?.addressLine2 ?? '');
    _postal = TextEditingController(text: c?.postalCode ?? '');
    _city = TextEditingController(text: c?.city ?? '');
    _notes = TextEditingController(text: c?.notes ?? '');
    _tags = TextEditingController(text: c?.tags.join(', ') ?? '');
    _marketing = c?.marketingOptIn ?? false;
    _dob = _parseDob(c?.dateOfBirth);
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _line1.dispose();
    _line2.dispose();
    _postal.dispose();
    _city.dispose();
    _notes.dispose();
    _tags.dispose();
    super.dispose();
  }

  DateTime? _parseDob(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  String? _blank(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 30),
      firstDate: DateTime(1920),
      lastDate: now,
      locale: const Locale('fr', 'FR'),
    );
    if (picked != null) setState(() => _dob = picked);
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final email = _blank(_email.text);
    final name = _blank(_name.text);
    final phone = _blank(_phone.text);
    if (email == null && name == null && phone == null) {
      setState(() => _error = 'Renseignez au moins un nom, email ou téléphone.');
      return;
    }
    if (email != null && !email.contains('@')) {
      setState(() => _error = 'Email invalide.');
      return;
    }
    if (_createAccount && email == null) {
      setState(() => _error = 'Email requis pour créer un compte cliente.');
      return;
    }

    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) {
      setState(() => _error = 'Session expirée.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final result = await ref.read(mobileApiProvider).saveInstitutClient(
            accessToken: token,
            tenantId: tenantId,
            clientId: widget.client?.id,
            fields: {
              'fullName': name,
              'email': email,
              'phone': phone,
              'dateOfBirth': _dob == null
                  ? null
                  : DateFormat('yyyy-MM-dd').format(_dob!),
              'addressLine1': _blank(_line1.text),
              'addressLine2': _blank(_line2.text),
              'postalCode': _blank(_postal.text),
              'city': _blank(_city.text),
              'notes': _blank(_notes.text),
              'tags': _tags.text,
              'marketingOptIn': _marketing,
              if (!_isEdit || (widget.client?.hasAccount != true))
                'createAccount': _createAccount,
            },
          );
      if (!mounted) return;
      Navigator.of(context).pop(result);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _saving = false;
        });
      }
    }
  }

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
                  _isEdit ? 'Modifier la cliente' : 'Nouvelle cliente',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: _black,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              IconButton(
                onPressed: _saving ? null : () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, size: 22),
                color: _muted,
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: _border),
        Expanded(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                20,
                16,
                20,
                16 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              children: [
                const Text(
                  'Nom, email ou téléphone — au moins un champ.',
                  style: TextStyle(fontSize: 13, color: _muted, height: 1.35),
                ),
                const SizedBox(height: 16),
                const _FieldLabel('Nom complet'),
                const SizedBox(height: 6),
                TextField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: _decoration(hint: 'Marie Dubois'),
                ),
                const SizedBox(height: 14),
                const _FieldLabel('Email'),
                const SizedBox(height: 6),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: _decoration(hint: 'marie@email.fr'),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 14),
                const _FieldLabel('Téléphone'),
                const SizedBox(height: 6),
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  decoration: _decoration(hint: '06 12 34 56 78'),
                ),
                const SizedBox(height: 14),
                const _FieldLabel('Date de naissance'),
                const SizedBox(height: 6),
                InkWell(
                  onTap: _pickDob,
                  borderRadius: BorderRadius.circular(10),
                  child: InputDecorator(
                    decoration: _decoration(),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _dob == null
                                ? 'Facultatif'
                                : DateFormat('d MMMM y', 'fr_FR').format(_dob!),
                            style: TextStyle(
                              fontSize: 14,
                              color: _dob == null ? const Color(0xFFA3A3A3) : _black,
                            ),
                          ),
                        ),
                        if (_dob != null)
                          IconButton(
                            onPressed: () => setState(() => _dob = null),
                            icon: const Icon(Icons.close_rounded, size: 18),
                            color: _muted,
                            visualDensity: VisualDensity.compact,
                          )
                        else
                          const Icon(Icons.calendar_today_outlined,
                              size: 18, color: _muted),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const _FieldLabel('Adresse'),
                const SizedBox(height: 6),
                TextField(
                  controller: _line1,
                  textCapitalization: TextCapitalization.words,
                  decoration: _decoration(hint: 'Rue'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _line2,
                  decoration: _decoration(hint: 'Complément'),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: _postal,
                        keyboardType: TextInputType.number,
                        decoration: _decoration(hint: 'CP'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: _city,
                        textCapitalization: TextCapitalization.words,
                        decoration: _decoration(hint: 'Ville'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const _FieldLabel('Notes'),
                const SizedBox(height: 6),
                TextField(
                  controller: _notes,
                  maxLines: 3,
                  decoration: _decoration(hint: 'Allergies, préférences…'),
                ),
                const SizedBox(height: 14),
                const _FieldLabel('Étiquettes'),
                const SizedBox(height: 6),
                TextField(
                  controller: _tags,
                  decoration: _decoration(hint: 'VIP, soin visage…'),
                ),
                const SizedBox(height: 18),
                _SwitchTile(
                  title: 'Consentement marketing',
                  subtitle: 'Emails / SMS promotionnels.',
                  value: _marketing,
                  onChanged: (v) => setState(() => _marketing = v),
                ),
                if (!_isEdit || widget.client?.hasAccount != true) ...[
                  const SizedBox(height: 8),
                  _SwitchTile(
                    title: 'Créer un compte cliente',
                    subtitle: _email.text.trim().isEmpty
                        ? 'Ajoutez un email pour activer.'
                        : 'Génère un identifiant et un PIN.',
                    value: _createAccount,
                    enabled: _email.text.trim().isNotEmpty,
                    onChanged: (v) => setState(() => _createAccount = v),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              _error!,
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
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: _black,
                  foregroundColor: Colors.white,
                ),
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(_isEdit ? 'Enregistrer' : 'Créer la cliente'),
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

class _SwitchTile extends StatelessWidget {
  const _SwitchTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
      decoration: BoxDecoration(
        color: _fill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: enabled ? _black : _muted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: _muted),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: enabled ? onChanged : null,
          ),
        ],
      ),
    );
  }
}
