import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/session_providers.dart';
import 'searchable_picker.dart';

/// Ouvre un bottom sheet compact pour créer rapidement une cliente
/// (nom, email, téléphone). Retourne le PickerItem à sélectionner, ou `null`
/// si l'utilisateur annule.
///
/// [initialQuery] pré-remplit le nom (ou l'email si ça matche un email).
Future<PickerItem?> showNewClientSheet({
  required BuildContext context,
  required WidgetRef ref,
  String initialQuery = '',
}) async {
  return showModalBottomSheet<PickerItem?>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _NewClientSheet(
      initialQuery: initialQuery,
    ),
  );
}

class _NewClientSheet extends ConsumerStatefulWidget {
  const _NewClientSheet({required this.initialQuery});

  final String initialQuery;

  @override
  ConsumerState<_NewClientSheet> createState() => _NewClientSheetState();
}

class _NewClientSheetState extends ConsumerState<_NewClientSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  bool _saving = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);
  static const _fill = Color(0xFFF9FAFB);

  @override
  void initState() {
    super.initState();
    final q = widget.initialQuery.trim();
    final looksLikeEmail = q.contains('@');
    final looksLikePhone = RegExp(r'^[+0-9\s.-]{6,}$').hasMatch(q);
    _name = TextEditingController(
      text: looksLikeEmail || looksLikePhone ? '' : q,
    );
    _email = TextEditingController(text: looksLikeEmail ? q : '');
    _phone = TextEditingController(text: looksLikePhone ? q : '');
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

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
      final option = await ref.read(mobileApiProvider).createInstitutClient(
            accessToken: token,
            tenantId: tenantId,
            fullName: _name.text.trim(),
            email: _email.text.trim(),
            phone: _phone.text.trim(),
          );
      ref.invalidate(posContextProvider);
      if (!mounted) return;
      final split = splitLabelWithEmail(option.label);
      Navigator.of(context).pop(
        PickerItem(
          id: option.id,
          title: split.title,
          subtitle: split.subtitle,
          searchKeywords: [option.label],
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: _border,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Nouvelle cliente',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: _black,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded, size: 22),
                      color: _muted,
                      splashRadius: 20,
                      tooltip: 'Annuler',
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Remplissez au moins un champ. La fiche sera enrichie plus tard.',
                  style: TextStyle(fontSize: 13, color: _muted, height: 1.35),
                ),
                const SizedBox(height: 20),
                _FieldLabel('Nom complet'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _name,
                  autofocus: true,
                  textInputAction: TextInputAction.next,
                  textCapitalization: TextCapitalization.words,
                  decoration: _decoration(hint: 'Ex. Marie Dubois'),
                ),
                const SizedBox(height: 14),
                _FieldLabel('Email'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: _decoration(hint: 'facultatif'),
                  validator: (v) {
                    final t = v?.trim() ?? '';
                    if (t.isEmpty) return null;
                    if (!t.contains('@')) return 'Email invalide';
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                _FieldLabel('Téléphone'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submit(),
                  decoration: _decoration(hint: 'facultatif'),
                  validator: (_) {
                    final name = _name.text.trim();
                    final email = _email.text.trim();
                    final phone = _phone.text.trim();
                    if (name.isEmpty && email.isEmpty && phone.isEmpty) {
                      return 'Renseignez au moins un champ';
                    }
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF991B1B),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  height: 50,
                  child: FilledButton(
                    onPressed: _saving ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: _black,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
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
                        : const Text('Créer la cliente'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _decoration({required String hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
      filled: true,
      fillColor: _fill,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 14,
        vertical: 14,
      ),
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
        borderSide: const BorderSide(color: _black, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFDC2626)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.4),
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
