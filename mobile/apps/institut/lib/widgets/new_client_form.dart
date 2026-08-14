import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/session_providers.dart';
import 'searchable_picker.dart';

/// Retourne un [PickerCreateAction] prêt à passer à [showSearchablePicker]
/// pour créer une cliente sans quitter le picker.
PickerCreateAction newClientPickerAction(WidgetRef ref) {
  return PickerCreateAction(
    label: 'Nouvelle',
    title: 'Nouvelle cliente',
    builder: (context, controller, initialQuery) => _NewClientForm(
      controller: controller,
      initialQuery: initialQuery,
      parentRef: ref,
    ),
  );
}

class _NewClientForm extends ConsumerStatefulWidget {
  const _NewClientForm({
    required this.controller,
    required this.initialQuery,
    required this.parentRef,
  });

  final PickerCreateController controller;
  final String initialQuery;
  final WidgetRef parentRef;

  @override
  ConsumerState<_NewClientForm> createState() => _NewClientFormState();
}

class _NewClientFormState extends ConsumerState<_NewClientForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  bool _saving = false;
  bool _marketing = false;
  bool _createAccount = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
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

    final email = _email.text.trim();
    if (_createAccount && email.isEmpty) {
      setState(() => _error = 'Email requis pour créer un compte cliente.');
      return;
    }

    final token = widget.parentRef.read(accessTokenProvider);
    final tenantId = widget.parentRef.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) {
      setState(() => _error = 'Session expirée.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final result = await widget.parentRef
          .read(mobileApiProvider)
          .createInstitutClient(
            accessToken: token,
            tenantId: tenantId,
            fullName: _name.text.trim(),
            email: email,
            phone: _phone.text.trim(),
            marketingOptIn: _marketing,
            createAccount: _createAccount,
          );
      widget.parentRef.invalidate(posContextProvider);
      if (!mounted) return;
      final split = splitLabelWithEmail(result.option.label);

      // Snackbar avec credentials si un compte a été provisionné.
      if (result.account != null) {
        _showAccountSnackBar(result.account!);
      }

      widget.controller.confirm(
        PickerItem(
          id: result.option.id,
          title: split.title,
          subtitle: split.subtitle,
          searchKeywords: [result.option.label],
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

  void _showAccountSnackBar(ClientAccountCredentials account) {
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

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Nom, email ou téléphone — au moins un champ.',
              style: TextStyle(fontSize: 13, color: _muted, height: 1.35),
            ),
            const SizedBox(height: 18),
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
              onChanged: (_) => setState(() {}),
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
            const SizedBox(height: 22),
            _OptionsGroup(
              children: [
                _SwitchTile(
                  title: 'Consentement marketing',
                  subtitle:
                      'Autoriser l’envoi d’emails / SMS promotionnels.',
                  value: _marketing,
                  onChanged: (v) => setState(() => _marketing = v),
                ),
                const _RowDivider(),
                _SwitchTile(
                  title: 'Créer un compte cliente',
                  subtitle: _email.text.trim().isEmpty
                      ? 'Ajoutez un email pour activer.'
                      : 'Génère un identifiant et un PIN pour l’app cliente.',
                  value: _createAccount,
                  enabled: _email.text.trim().isNotEmpty,
                  onChanged: (v) => setState(() => _createAccount = v),
                ),
              ],
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
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton(
                      onPressed: _saving ? null : widget.controller.cancel,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _black,
                        side: const BorderSide(color: Color(0xFFE5E5E5)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      child: const Text('Annuler'),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: SizedBox(
                    height: 48,
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
                ),
              ],
            ),
          ],
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

class _OptionsGroup extends StatelessWidget {
  const _OptionsGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE5E5E5)),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }
}

class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) => const Divider(
        height: 1,
        thickness: 1,
        color: Color(0xFFEFEFEF),
        indent: 16,
      );
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
    final titleColor = enabled ? const Color(0xFF0A0A0A) : const Color(0xFF9CA3AF);
    return InkWell(
      onTap: enabled ? () => onChanged(!value) : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF737373),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            Switch.adaptive(
              value: value && enabled,
              onChanged: enabled ? onChanged : null,
              activeThumbColor: Colors.white,
              activeTrackColor: const Color(0xFF0A0A0A),
            ),
          ],
        ),
      ),
    );
  }
}
