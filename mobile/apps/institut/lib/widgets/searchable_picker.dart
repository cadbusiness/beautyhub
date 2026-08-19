import 'dart:async';

import 'package:flutter/material.dart';

import 'alphabet_index.dart';
import 'app_sheet.dart';

/// Item générique pour le picker cherchable.
class PickerItem {
  const PickerItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.trailing,
    this.searchKeywords,
    this.groupId,
    this.groupLabel,
  });

  final String id;
  final String title;
  final String? subtitle;

  /// Texte optionnel affiché à droite (durée, prix…).
  final String? trailing;

  /// Champs supplémentaires à inclure dans la recherche (téléphone, SKU…).
  final List<String>? searchKeywords;

  /// Catégorie pour le filtre (prestations, etc.).
  final String? groupId;
  final String? groupLabel;

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
    this.labelTrailing,
  });

  final String label;
  final String? value;
  final String? selectedSubtitle;
  final String placeholder;
  final Future<void> Function() onOpen;

  /// Petit widget affiché à droite du label (bouton X, par exemple).
  final Widget? labelTrailing;

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
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: _labelColor,
                ),
              ),
            ),
            ?labelTrailing,
          ],
        ),
        const SizedBox(height: 6),
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

/// Controller passé au formulaire de création pour piloter le picker parent.
abstract class PickerCreateController {
  /// Retour à la vue liste (annule la création en cours).
  void cancel();

  /// Confirme la création : ferme le picker et retourne [item.id].
  void confirm(PickerItem item);
}

/// Action optionnelle "+ créer" affichée dans le header du picker.
///
/// Le [builder] est appelé quand l'utilisateur tape "+" : il doit retourner
/// le widget de formulaire à afficher **à l'intérieur du même sheet**
/// (pas de nouvelle modale). Utiliser le [PickerCreateController] pour piloter.
class PickerCreateAction {
  const PickerCreateAction({
    required this.label,
    required this.title,
    required this.builder,
  });

  final String label;
  final String title;
  final Widget Function(
    BuildContext context,
    PickerCreateController controller,
    String initialQuery,
  ) builder;
}

/// Ouvre un bottom sheet plein-écran avec recherche + liste virtualisée.
///
/// [search] : si fourni, la liste est chargée à distance (debounce) au lieu
/// d’un filtre local sur [items]. Utile pour les clientes (fichier trop long).
///
/// [showAlphabet] : index A–Z à droite (saut serveur via [search] `fromLetter`).
///
/// Retourne l’item choisi, `null` si fermé sans choisir, ou l’item [nullOption]
/// si « Aucun » est tapé.
Future<PickerItem?> showSearchablePicker({
  required BuildContext context,
  required String title,
  required List<PickerItem> items,
  String? selectedId,
  String searchHint = 'Rechercher…',
  PickerItem? nullOption,
  String emptyMessage = 'Aucun résultat.',
  PickerCreateAction? createAction,
  Future<List<PickerItem>> Function(String query, {String? fromLetter})? search,
  bool showAlphabet = false,
}) {
  return showAppSheet<PickerItem?>(
    context: context,
    builder: (ctx) => _PickerSheet(
      title: title,
      items: items,
      selectedId: selectedId,
      searchHint: searchHint,
      nullOption: nullOption,
      emptyMessage: emptyMessage,
      createAction: createAction,
      search: search,
      showAlphabet: showAlphabet,
    ),
  );
}

enum _SheetMode { browse, create }

class _PickerSheet extends StatefulWidget {
  const _PickerSheet({
    required this.title,
    required this.items,
    required this.selectedId,
    required this.searchHint,
    required this.nullOption,
    required this.emptyMessage,
    required this.createAction,
    required this.search,
    required this.showAlphabet,
  });

  final String title;
  final List<PickerItem> items;
  final String? selectedId;
  final String searchHint;
  final PickerItem? nullOption;
  final String emptyMessage;
  final PickerCreateAction? createAction;
  final Future<List<PickerItem>> Function(String query, {String? fromLetter})?
      search;
  final bool showAlphabet;

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet>
    implements PickerCreateController {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  String _query = '';
  _SheetMode _mode = _SheetMode.browse;
  Timer? _debounce;
  Timer? _letterDebounce;
  List<PickerItem>? _remoteItems;
  bool _searching = false;
  int _searchGen = 0;
  String? _fromLetter;
  String? _scrubLetter;
  String? _groupId;
  bool _showGroups = true;

  static const _border = Color(0xFFE5E5E5);

  @override
  void initState() {
    super.initState();
    if (widget.search != null) {
      _runSearch('');
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _letterDebounce?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    setState(() {
      _query = value;
      _fromLetter = null;
    });
    if (widget.search == null) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), () {
      _runSearch(value);
    });
  }

  void _onLetter(String letter) {
    if (_scrubLetter != letter) {
      alphabetHaptic();
      setState(() => _scrubLetter = letter);
    }
    _letterDebounce?.cancel();
    _letterDebounce = Timer(const Duration(milliseconds: 70), () {
      _searchController.clear();
      setState(() {
        _query = '';
        _fromLetter = letter;
      });
      _focusNode.unfocus();
      _runSearch('', fromLetter: letter);
    });
  }

  Future<void> _runSearch(String value, {String? fromLetter}) async {
    final search = widget.search;
    if (search == null) return;
    final gen = ++_searchGen;
    setState(() => _searching = true);
    try {
      final items = await search(
        value,
        fromLetter: fromLetter ?? _fromLetter,
      );
      if (!mounted || gen != _searchGen) return;
      setState(() {
        _remoteItems = items;
        _searching = false;
      });
    } catch (_) {
      if (!mounted || gen != _searchGen) return;
      setState(() => _searching = false);
    }
  }

  void _goCreate() {
    if (widget.createAction == null) return;
    FocusScope.of(context).unfocus();
    setState(() => _mode = _SheetMode.create);
  }

  @override
  void cancel() {
    if (!mounted) return;
    FocusScope.of(context).unfocus();
    setState(() => _mode = _SheetMode.browse);
  }

  @override
  void confirm(PickerItem item) {
    if (!mounted) return;
    Navigator.of(context).pop<PickerItem?>(item);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final isCreate = _mode == _SheetMode.create;
    final action = widget.createAction;

    return FractionallySizedBox(
      heightFactor: 0.92,
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
            _Header(
              title: isCreate && action != null ? action.title : widget.title,
              showBack: isCreate,
              onBack: cancel,
              trailing: !isCreate && action != null
                  ? _CreateHeaderButton(
                      label: action.label,
                      onTap: _goCreate,
                    )
                  : null,
              onClose: () => Navigator.of(context).pop<PickerItem?>(null),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, animation) {
                  final offset = Tween<Offset>(
                    begin: Offset(child.key == const ValueKey('create') ? 0.06 : -0.06, 0),
                    end: Offset.zero,
                  ).animate(animation);
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(position: offset, child: child),
                  );
                },
                child: isCreate
                    ? KeyedSubtree(
                        key: const ValueKey('create'),
                        child: action != null
                            ? action.builder(context, this, _query)
                            : const SizedBox.shrink(),
                      )
                    : KeyedSubtree(
                        key: const ValueKey('browse'),
                        child: _BrowseView(
                          searchController: _searchController,
                          focusNode: _focusNode,
                          searchHint: widget.searchHint,
                          query: _query,
                          onQueryChanged: _onQueryChanged,
                          items: widget.items,
                          searchResults:
                              widget.search != null ? _remoteItems : null,
                          searching: _searching,
                          selectedId: widget.selectedId,
                          nullOption: widget.nullOption,
                          emptyMessage: widget.emptyMessage,
                          createAction: widget.createAction,
                          onCreateTap: _goCreate,
                          showAlphabet: widget.showAlphabet,
                          activeLetter: _fromLetter,
                          scrubLetter: _scrubLetter,
                          onLetter: _onLetter,
                          onLetterDragEnd: () {
                            if (_scrubLetter != null) {
                              setState(() => _scrubLetter = null);
                            }
                          },
                          autofocusSearch: !widget.showAlphabet,
                          selectedGroupId: _groupId,
                          showGroups: _showGroups,
                          onToggleGroups: () {
                            setState(() => _showGroups = !_showGroups);
                          },
                          onGroupChanged: (id) {
                            setState(() => _groupId = id);
                          },
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.showBack,
    required this.onBack,
    required this.trailing,
    required this.onClose,
  });

  final String title;
  final bool showBack;
  final VoidCallback onBack;
  final Widget? trailing;
  final VoidCallback onClose;

  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          if (showBack)
            IconButton(
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_rounded, size: 22),
              color: _black,
              splashRadius: 20,
              tooltip: 'Retour',
            )
          else
            const SizedBox(width: 8),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(left: showBack ? 0 : 8),
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: _black,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          ?trailing,
          IconButton(
            onPressed: onClose,
            icon: const Icon(Icons.close_rounded, size: 22),
            color: _muted,
            splashRadius: 20,
            tooltip: 'Fermer',
          ),
        ],
      ),
    );
  }
}

class _CreateHeaderButton extends StatelessWidget {
  const _CreateHeaderButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: TextButton.icon(
        onPressed: onTap,
        icon: const Icon(Icons.add_rounded, size: 18),
        label: Text(label),
        style: TextButton.styleFrom(
          foregroundColor: const Color(0xFF0A0A0A),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          side: const BorderSide(color: Color(0xFFE5E5E5)),
        ),
      ),
    );
  }
}

class _BrowseView extends StatelessWidget {
  const _BrowseView({
    required this.searchController,
    required this.focusNode,
    required this.searchHint,
    required this.query,
    required this.onQueryChanged,
    required this.items,
    required this.searchResults,
    required this.searching,
    required this.selectedId,
    required this.nullOption,
    required this.emptyMessage,
    required this.createAction,
    required this.onCreateTap,
    required this.showAlphabet,
    required this.activeLetter,
    required this.scrubLetter,
    required this.onLetter,
    required this.onLetterDragEnd,
    required this.autofocusSearch,
    required this.selectedGroupId,
    required this.showGroups,
    required this.onToggleGroups,
    required this.onGroupChanged,
  });

  final TextEditingController searchController;
  final FocusNode focusNode;
  final String searchHint;
  final String query;
  final ValueChanged<String> onQueryChanged;
  final List<PickerItem> items;
  final List<PickerItem>? searchResults;
  final bool searching;
  final String? selectedId;
  final PickerItem? nullOption;
  final String emptyMessage;
  final PickerCreateAction? createAction;
  final VoidCallback onCreateTap;
  final bool showAlphabet;
  final String? activeLetter;
  final String? scrubLetter;
  final ValueChanged<String> onLetter;
  final VoidCallback onLetterDragEnd;
  final bool autofocusSearch;
  final String? selectedGroupId;
  final bool showGroups;
  final VoidCallback onToggleGroups;
  final ValueChanged<String?> onGroupChanged;

  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);
  static const _fill = Color(0xFFF5F5F5);

  List<({String id, String label})> get _groups {
    final seen = <String, String>{};
    for (final item in items) {
      final id = item.groupId;
      if (id == null || id.isEmpty) continue;
      seen.putIfAbsent(
        id,
        () => (item.groupLabel != null && item.groupLabel!.isNotEmpty)
            ? item.groupLabel!
            : id,
      );
    }
    final groups = seen.entries
        .map((e) => (id: e.key, label: e.value))
        .toList()
      ..sort((a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()));
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groups;
    final source = searchResults ?? items;
    final filtered = source.where((item) {
      if (!item.matches(query)) return false;
      if (selectedGroupId != null && item.groupId != selectedGroupId) {
        return false;
      }
      return true;
    }).toList()
      ..sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: searchController,
                  focusNode: focusNode,
                  autofocus: autofocusSearch,
                  onChanged: onQueryChanged,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: searchHint,
                    hintStyle: const TextStyle(color: _muted, fontSize: 15),
                    prefixIcon: const Icon(
                      Icons.search_rounded,
                      size: 20,
                      color: _muted,
                    ),
                    suffixIcon: query.isNotEmpty
                        ? IconButton(
                            onPressed: () {
                              searchController.clear();
                              onQueryChanged('');
                              focusNode.requestFocus();
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
              if (groups.length > 1) ...[
                const SizedBox(width: 8),
                _FilterButton(
                  active: showGroups || selectedGroupId != null,
                  onTap: onToggleGroups,
                ),
              ],
            ],
          ),
        ),
        if (groups.length > 1 && showGroups) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _GroupChip(
                  label: 'Toutes',
                  selected: selectedGroupId == null,
                  onTap: () => onGroupChanged(null),
                ),
                for (final group in groups)
                  _GroupChip(
                    label: group.label,
                    selected: selectedGroupId == group.id,
                    onTap: () => onGroupChanged(
                      selectedGroupId == group.id ? null : group.id,
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 6),
        if (searching)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: LinearProgressIndicator(
              minHeight: 2,
              color: _black,
              backgroundColor: Color(0xFFE5E5E5),
            ),
          ),
        Expanded(
          child: Stack(
            children: [
              searchResults == null && searching
                  ? const Center(child: CircularProgressIndicator())
                  : _buildList(context, filtered),
              if (showAlphabet)
                Positioned(
                  right: 0,
                  top: 4,
                  bottom: 8,
                  child: AlphabetIndex(
                    activeLetter: activeLetter,
                    onSelect: onLetter,
                    onDragEnd: onLetterDragEnd,
                  ),
                ),
              if (scrubLetter != null) AlphabetScrubBubble(letter: scrubLetter!),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildList(BuildContext context, List<PickerItem> items) {
    final showNull = nullOption != null && query.isEmpty;
    if (items.isEmpty && !showNull) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 14),
              ),
              if (createAction != null) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: onCreateTap,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: Text(createAction!.label),
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
      padding: EdgeInsets.fromLTRB(0, 4, showAlphabet ? 22 : 0, 4),
      itemCount: items.length + (showNull ? 1 : 0),
      separatorBuilder: (_, index) => const Divider(
        height: 1,
        thickness: 1,
        color: Color(0xFFF3F4F6),
        indent: 20,
        endIndent: 20,
      ),
      itemBuilder: (context, index) {
        if (showNull && index == 0) {
          return _PickerRow(
            item: nullOption!,
            selected: selectedId == null,
            onTap: () => Navigator.of(context).pop<PickerItem?>(nullOption),
            asNullOption: true,
          );
        }
        final effectiveIndex = showNull ? index - 1 : index;
        final item = items[effectiveIndex];
        return _PickerRow(
          item: item,
          selected: item.id == selectedId,
          onTap: () => Navigator.of(context).pop<PickerItem?>(item),
        );
      },
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.active, required this.onTap});

  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(
            Icons.tune_rounded,
            size: 20,
            color: active ? Colors.white : const Color(0xFF0A0A0A),
          ),
        ),
      ),
    );
  }
}

class _GroupChip extends StatelessWidget {
  const _GroupChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: selected ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(99),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(99),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : const Color(0xFF0A0A0A),
              ),
            ),
          ),
        ),
      ),
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
