import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';

Future<void> showCreateInternalProductSheet(
  BuildContext context,
  WidgetRef ref, {
  required List<PosOption> categories,
  String? defaultCategoryId,
}) async {
  final created = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
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
  final created = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) => const _InternalCategorySheet(),
  );
  if (created == true) {
    ref.invalidate(posContextProvider);
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
  final _price = TextEditingController(text: '0');
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
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E5E5),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Nouveau produit interne',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Nom'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
              ),
              const SizedBox(height: 12),
              if (widget.categories.isNotEmpty) ...[
                const Text(
                  'Catégorie interne',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Sans catégorie'),
                      selected: _categoryId == null || _categoryId!.isEmpty,
                      onSelected: (_) => setState(() => _categoryId = null),
                    ),
                    for (final category in widget.categories)
                      ChoiceChip(
                        label: Text(category.label),
                        selected: _categoryId == category.id,
                        onSelected: (_) =>
                            setState(() => _categoryId = category.id),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                controller: _price,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Prix (€)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _stock,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Stock (optionnel)',
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _sku,
                decoration: const InputDecoration(
                  labelText: 'SKU (optionnel)',
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFB91C1C)),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Ajouter le produit'),
              ),
            ],
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
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E5E5),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Nouvelle catégorie interne',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Nom',
                hintText: 'Retail, consommables…',
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: Color(0xFFB91C1C)),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Ajouter la catégorie'),
            ),
          ],
        ),
      ),
    );
  }
}
