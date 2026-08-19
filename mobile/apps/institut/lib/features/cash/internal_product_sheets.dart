import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/app_sheet.dart';

const _black = Color(0xFF0A0A0A);
const _muted = Color(0xFF737373);
const _fill = Color(0xFFF5F5F5);
const _border = Color(0xFFE8E8E8);

Future<void> showCreateInternalProductSheet(
  BuildContext context,
  WidgetRef ref, {
  required List<PosOption> categories,
  String? defaultCategoryId,
}) async {
  final created = await showAppSheet<bool>(
    context: context,
    builder: (context) => _InternalProductSheet(
      categories: categories,
      defaultCategoryId: defaultCategoryId,
    ),
  );
  if (created == true) {
    ref.invalidate(posContextProvider);
  }
}

Future<void> showCreateInternalProductCategorySheet(
  BuildContext context,
  WidgetRef ref,
) async {
  final created = await showAppSheet<bool>(
    context: context,
    builder: (context) => const _InternalCategorySheet(),
  );
  if (created == true) {
    ref.invalidate(posContextProvider);
  }
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
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: Color(0xFFDC2626)),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: Color(0xFFDC2626)),
    ),
    disabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
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
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
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

class _InternalProductSheet extends ConsumerStatefulWidget {
  const _InternalProductSheet({
    required this.categories,
    this.defaultCategoryId,
  });

  final List<PosOption> categories;
  final String? defaultCategoryId;

  @override
  ConsumerState<_InternalProductSheet> createState() =>
      _InternalProductSheetState();
}

class _InternalProductSheetState extends ConsumerState<_InternalProductSheet> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _price = TextEditingController();
  final _stock = TextEditingController();
  final _sku = TextEditingController();
  late String? _categoryId = widget.defaultCategoryId;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _price.dispose();
    _stock.dispose();
    _sku.dispose();
    super.dispose();
  }

  int _priceCents() {
    final n = double.tryParse(_price.text.trim().replaceAll(',', '.')) ?? 0;
    if (n <= 0) return 0;
    return (n * 100).round();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final stockRaw = _stock.text.trim();
      await ref.read(mobileApiProvider).createInternalProduct(
            accessToken: token,
            tenantId: tenantId,
            name: _name.text.trim(),
            priceCents: _priceCents(),
            sku: _sku.text.trim().isEmpty ? null : _sku.text.trim(),
            stockQuantity: stockRaw.isEmpty ? null : int.tryParse(stockRaw),
            categoryId: _categoryId,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = '$e';
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
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _SheetHandle(),
              const SizedBox(height: 16),
              const Text(
                'Nouveau produit interne',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _black,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Il apparaîtra tout de suite dans l’onglet Internes, pour la vente à la caisse.',
                style: TextStyle(fontSize: 13, color: _muted, height: 1.35),
              ),
              const SizedBox(height: 18),
              const _FieldLabel('Nom'),
              const SizedBox(height: 6),
              TextFormField(
                controller: _name,
                autofocus: true,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                decoration: _fieldDecoration(hint: 'Huile visage 30 ml'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
              ),
              if (widget.categories.isNotEmpty) ...[
                const SizedBox(height: 14),
                const _FieldLabel('Catégorie'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _CategoryChip(
                      label: 'Sans catégorie',
                      selected: _categoryId == null || _categoryId!.isEmpty,
                      onTap: () => setState(() => _categoryId = null),
                    ),
                    for (final category in widget.categories)
                      _CategoryChip(
                        label: category.label,
                        selected: _categoryId == category.id,
                        onTap: () => setState(() => _categoryId = category.id),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const _FieldLabel('Prix TTC (€)'),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _price,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          textInputAction: TextInputAction.next,
                          decoration: _fieldDecoration(hint: '0,00'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const _FieldLabel('Stock'),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _stock,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.next,
                          decoration: _fieldDecoration(hint: 'Facultatif'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const _FieldLabel('SKU'),
              const SizedBox(height: 6),
              TextFormField(
                controller: _sku,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _submit(),
                decoration: _fieldDecoration(hint: 'Référence interne, facultatif'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
                ),
              ],
              const SizedBox(height: 20),
              _SheetSubmit(
                label: 'Ajouter le produit',
                saving: _saving,
                onPressed: _saving ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
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
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: selected ? _black : _border),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : _muted,
            ),
          ),
        ),
      ),
    );
  }
}

class _InternalCategorySheet extends ConsumerStatefulWidget {
  const _InternalCategorySheet();

  @override
  ConsumerState<_InternalCategorySheet> createState() =>
      _InternalCategorySheetState();
}

class _InternalCategorySheetState
    extends ConsumerState<_InternalCategorySheet> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(mobileApiProvider).createInternalProductCategory(
            accessToken: token,
            tenantId: tenantId,
            name: _name.text.trim(),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = '$e';
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
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SheetHandle(),
            const SizedBox(height: 16),
            const Text(
              'Nouvelle catégorie interne',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _black,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Pour ranger les produits internes (retail, consommables…).',
              style: TextStyle(fontSize: 13, color: _muted, height: 1.35),
            ),
            const SizedBox(height: 18),
            const _FieldLabel('Nom'),
            const SizedBox(height: 6),
            TextFormField(
              controller: _name,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: _fieldDecoration(hint: 'Retail, consommables…'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
              ),
            ],
            const SizedBox(height: 20),
            _SheetSubmit(
              label: 'Ajouter la catégorie',
              saving: _saving,
              onPressed: _saving ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
