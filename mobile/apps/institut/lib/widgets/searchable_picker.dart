import 'package:flutter/material.dart';

/// Item générique pour le picker cherchable.
class PickerItem {
  const PickerItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.trailing,
    this.searchKeywords,
  });

  final String id;
  final String title;
  final String? subtitle;

  /// Texte optionnel affiché à droite (durée, prix…).
  final String? trailing;

  /// Champs supplémentaires à inclure dans la recherche (téléphone, SKU…).
  final List<String>? searchKeywords;

  bool matches(String query) {
    if (query.isEmpty) return true;
    final q = query.toLowerCase();
    if (title.toLowerCase().contains(q)) return true;
    if ((subtitle ?? '').toLowerCase().contains(q)) return true;
    for (final k in searchKeywords ?? const <String>[]) {
      if (k.toLowerCase().contains(q)) return true;
    }
    return false;
  }
}

/// Champ tap-target : label au-dessus, valeur + chevron dans la ligne.
/// Ouvre un bottom sheet plein-écran avec recherche sticky.
class SearchablePickerField extends StatelessWidget {
  const SearchablePickerField({
    super.key,
    required this.label,
    required this.value,
    required this.placeholder,
    required this.onOpen,
    this.selectedSubtitle,
  });

  final String label;
  final String? value;
  final String? selectedSubtitle;
  final String placeholder;
  final Future<void> Function() onOpen;

  static const _border = Color(0xFFE5E5E5);
  static const _labelColor = Color(0xFF404040);
  static const _placeholderColor = Color(0xFF9CA3AF);
  static const _valueColor = Color(0xFF0A0A0A);
  static const _mutedColor = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    final hasValue = value != null && value!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: _labelColor,
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: const BorderSide(color: _border),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () => onOpen(),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          hasValue ? value! : placeholder,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: hasValue
                                ? FontWeight.w500
                                : FontWeight.w400,
                            color: hasValue ? _valueColor : _placeholderColor,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (hasValue &&
                            selectedSubtitle != null &&
                            selectedSubtitle!.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            selectedSubtitle!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: _mutedColor,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.unfold_more_rounded,
                    size: 18,
                    color: _mutedColor,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Action optionnelle "+ créer" dans le header du picker.
class PickerCreateAction {
  const PickerCreateAction({
    required this.label,
    required this.onCreate,
  });

  final String label;

  /// Appelé quand l'utilisateur tape "+". Peut afficher un formulaire dans un
  /// dialog / sub-sheet, faire l'appel API, et retourner le nouvel item à
  /// sélectionner (ou `null` si annulé).
  ///
  /// Le [initialQuery] est le texte actuellement tapé dans la recherche —
  /// pratique pour pré-remplir un champ nom ou téléphone.
  final Future<PickerItem?> Function(
    BuildContext sheetContext,
    String initialQuery,
  ) onCreate;
}

/// Ouvre un bottom sheet plein-écran avec recherche + liste virtualisée.
///
/// Retourne l'id sélectionné (`null` si "Aucun" ou fermé sans choisir).
/// Passer [nullOption] pour proposer une entrée "aucun/sans" en haut de liste.
/// Passer [createAction] pour afficher un bouton "+ Nouveau" dans le header.
Future<String?> showSearchablePicker({
  required BuildContext context,
  required String title,
  required List<PickerItem> items,
  String? selectedId,
  String searchHint = 'Rechercher…',
  PickerItem? nullOption,
  String emptyMessage = 'Aucun résultat.',
  PickerCreateAction? createAction,
}) {
  return showModalBottomSheet<String?>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _PickerSheet(
      title: title,
      items: items,
      selectedId: selectedId,
      searchHint: searchHint,
      nullOption: nullOption,
      emptyMessage: emptyMessage,
      createAction: createAction,
    ),
  );
}

class _PickerSheet extends StatefulWidget {
  const _PickerSheet({
    required this.title,
    required this.items,
    required this.selectedId,
    required this.searchHint,
    required this.nullOption,
    required this.emptyMessage,
    required this.createAction,
  });

  final String title;
  final List<PickerItem> items;
  final String? selectedId;
  final String searchHint;
  final PickerItem? nullOption;
  final String emptyMessage;
  final PickerCreateAction? createAction;

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  String _query = '';

  static const _border = Color(0xFFE5E5E5);
  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);
  static const _fill = Color(0xFFF5F5F5);

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _handleCreate(BuildContext sheetContext) async {
    final action = widget.createAction;
    if (action == null) return;
    final navigator = Navigator.of(sheetContext);
    final created = await action.onCreate(sheetContext, _query);
    if (!mounted) return;
    if (created != null) {
      navigator.pop<String?>(created.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.items.where((i) => i.matches(_query)).toList();
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return FractionallySizedBox(
      heightFactor: 0.88,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: Column(
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
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: _black,
                      ),
                    ),
                  ),
                  if (widget.createAction != null)
                    Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: TextButton.icon(
                        onPressed: () => _handleCreate(context),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: Text(widget.createAction!.label),
                        style: TextButton.styleFrom(
                          foregroundColor: _black,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          textStyle: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          side: const BorderSide(color: _border),
                        ),
                      ),
                    ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 22),
                    color: _muted,
                    splashRadius: 20,
                    tooltip: 'Fermer',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextField(
                controller: _searchController,
                focusNode: _focusNode,
                autofocus: true,
                onChanged: (v) => setState(() => _query = v),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: widget.searchHint,
                  hintStyle: const TextStyle(color: _muted, fontSize: 15),
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    size: 20,
                    color: _muted,
                  ),
                  suffixIcon: _query.isNotEmpty
                      ? IconButton(
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _query = '');
                            _focusNode.requestFocus();
                          },
                          icon: const Icon(Icons.close_rounded, size: 18),
                          color: _muted,
                          splashRadius: 18,
                        )
                      : null,
                  filled: true,
                  fillColor: _fill,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
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
                    borderSide: const BorderSide(color: _black, width: 1.2),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: _buildList(filtered),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(List<PickerItem> items) {
    final showNull = widget.nullOption != null && _query.isEmpty;
    if (items.isEmpty && !showNull) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.emptyMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 14),
              ),
              if (widget.createAction != null) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => _handleCreate(context),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: Text(widget.createAction!.label),
                  style: FilledButton.styleFrom(
                    backgroundColor: _black,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: items.length + (showNull ? 1 : 0),
      separatorBuilder: (_, __) => const Divider(
        height: 1,
        thickness: 1,
        color: Color(0xFFF3F4F6),
        indent: 20,
        endIndent: 20,
      ),
      itemBuilder: (context, index) {
        if (showNull && index == 0) {
          return _PickerRow(
            item: widget.nullOption!,
            selected: widget.selectedId == null,
            onTap: () => Navigator.of(context).pop<String?>(null),
            asNullOption: true,
          );
        }
        final effectiveIndex = showNull ? index - 1 : index;
        final item = items[effectiveIndex];
        return _PickerRow(
          item: item,
          selected: item.id == widget.selectedId,
          onTap: () => Navigator.of(context).pop<String?>(item.id),
        );
      },
    );
  }
}

class _PickerRow extends StatelessWidget {
  const _PickerRow({
    required this.item,
    required this.selected,
    required this.onTap,
    this.asNullOption = false,
  });

  final PickerItem item;
  final bool selected;
  final VoidCallback onTap;
  final bool asNullOption;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                      color: asNullOption ? _muted : _black,
                      fontStyle: asNullOption ? FontStyle.italic : FontStyle.normal,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (item.subtitle != null && item.subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.subtitle!,
                      style: const TextStyle(fontSize: 12, color: _muted),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            if (item.trailing != null) ...[
              const SizedBox(width: 12),
              Text(
                item.trailing!,
                style: const TextStyle(
                  fontSize: 13,
                  color: _muted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
            if (selected) ...[
              const SizedBox(width: 8),
              const Icon(
                Icons.check_rounded,
                size: 18,
                color: Color(0xFF10B981),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Parse un label du type `"Nom Prénom (email@x.com)"` en (nom, email).
/// Retourne (label, null) si le pattern ne matche pas.
({String title, String? subtitle}) splitLabelWithEmail(String label) {
  final match = RegExp(r'^(.+?)\s*\(([^)]*@[^)]*)\)\s*$').firstMatch(label);
  if (match != null) {
    return (title: match.group(1)!.trim(), subtitle: match.group(2)!.trim());
  }
  return (title: label, subtitle: null);
}
