import 'dart:async';

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/alphabet_index.dart';
import '../../widgets/screen_scaffold.dart';
import 'client_detail_sheet.dart';
import 'client_editor_sheet.dart';

class ClientsScreen extends ConsumerStatefulWidget {
  const ClientsScreen({super.key});

  @override
  ConsumerState<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends ConsumerState<ClientsScreen> {
  static const _bg = Color(0xFFF7F7F7);
  static const _muted = Color(0xFF737373);
  static const _rowBg = Colors.white;
  static const _border = Color(0xFFEDEDED);
  static const _pageSize = 60;

  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _sectionKeys = <String, GlobalKey>{};

  Timer? _debounce;
  Timer? _letterDebounce;
  String _query = '';
  String? _fromLetter;
  List<InstClient> _items = const [];
  String? _cursor;
  bool _loading = false;
  bool _loadingMore = false;
  bool _letterLoading = false;
  String? _error;
  String? _scrubLetter;
  int _loadGen = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitial());
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _letterDebounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 320 &&
        !_loadingMore &&
        _cursor != null) {
      _loadMore();
    }
  }

  Future<void> _loadInitial() async {
    final gen = ++_loadGen;
    if (!mounted) return;
    final blocking = _items.isEmpty;
    setState(() {
      _loading = blocking;
      _letterLoading = !blocking;
      _loadingMore = false;
      _error = null;
    });
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) {
        throw StateError('Session ou institut manquant');
      }
      final page = await ref.read(mobileApiProvider).fetchInstitutClients(
            accessToken: token,
            tenantId: tenantId,
            query: _query,
            fromLetter: _fromLetter,
            limit: _pageSize,
          );
      if (!mounted || gen != _loadGen) return;
      setState(() {
        _items = [...page.items];
        _cursor = page.nextCursor;
        _loading = false;
        _letterLoading = false;
      });
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(0);
      }
    } catch (e) {
      if (!mounted || gen != _loadGen) return;
      setState(() {
        _error = e.toString();
        _loading = false;
        _letterLoading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _cursor == null) return;
    final gen = _loadGen;
    setState(() => _loadingMore = true);
    try {
      final token = ref.read(accessTokenProvider);
      final tenantId = ref.read(selectedTenantIdProvider);
      if (token == null || tenantId == null) {
        if (mounted && gen == _loadGen) {
          setState(() => _loadingMore = false);
        }
        return;
      }
      final page = await ref.read(mobileApiProvider).fetchInstitutClients(
            accessToken: token,
            tenantId: tenantId,
            query: _query,
            fromLetter: _fromLetter,
            cursor: _cursor,
            limit: _pageSize,
          );
      if (!mounted || gen != _loadGen) return;
      setState(() {
        _items = [..._items, ...page.items];
        _cursor = page.nextCursor;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted || gen != _loadGen) return;
      setState(() => _loadingMore = false);
    }
  }

  void _onQueryChanged(String v) {
    setState(() {
      _query = v;
      _fromLetter = null;
    });
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), _loadInitial);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: InstitutTopBar(
        title: 'Clientes',
        subtitle: _items.isEmpty
            ? null
            : '${_items.length}${_cursor != null ? '+' : ''} au total',
        trailing: IconButton(
          onPressed: _createClient,
          icon: const Icon(Icons.add_rounded),
          color: const Color(0xFF0A0A0A),
          tooltip: 'Nouvelle cliente',
        ),
        bottom: InstitutSearchBar(
          controller: _searchController,
          onChanged: _onQueryChanged,
          hint: 'Nom, email, téléphone…',
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _loadInitial,
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      );
    }
    if (_items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.people_outline_rounded,
                size: 44,
                color: _muted,
              ),
              const SizedBox(height: 12),
              Text(
                _query.isEmpty
                    ? 'Aucune cliente pour le moment.'
                    : 'Aucun résultat pour “$_query”.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 14),
              ),
              if (_query.isEmpty) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _createClient,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Ajouter une cliente'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0A0A0A),
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    final sections = _groupByLetter(_items);
    final bottomPad = MediaQuery.viewPaddingOf(context).bottom + 24;

    return RefreshIndicator(
      onRefresh: _loadInitial,
      child: Stack(
        children: [
          CustomScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              if (_letterLoading)
                const SliverToBoxAdapter(
                  child: LinearProgressIndicator(
                    minHeight: 2,
                    color: Color(0xFF0A0A0A),
                    backgroundColor: Color(0xFFE5E5E5),
                  ),
                ),
              for (final section in sections)
                SliverMainAxisGroup(
                  slivers: [
                    SliverPersistentHeader(
                      pinned: true,
                      delegate: _LetterHeaderDelegate(
                        letter: section.letter,
                        headerKey: _sectionKey(section.letter),
                      ),
                    ),
                    SliverList.separated(
                      itemCount: section.clients.length,
                      separatorBuilder: (context, index) => const Divider(
                        height: 1,
                        thickness: 1,
                        color: _border,
                        indent: 68,
                      ),
                      itemBuilder: (context, index) {
                        final client = section.clients[index];
                        return _ClientRow(
                          client: client,
                          onTap: () => _openDetail(client),
                        );
                      },
                    ),
                  ],
                ),
              if (_loadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
              SliverPadding(padding: EdgeInsets.only(bottom: bottomPad)),
            ],
          ),
          Positioned(
            right: 0,
            top: 4,
            bottom: bottomPad,
            child: AlphabetIndex(
              activeLetter: _fromLetter,
              onSelect: _onRailLetter,
              onDragEnd: () {
                if (_scrubLetter != null) {
                  setState(() => _scrubLetter = null);
                }
              },
            ),
          ),
          if (_scrubLetter != null) AlphabetScrubBubble(letter: _scrubLetter!),
        ],
      ),
    );
  }

  GlobalKey _sectionKey(String letter) =>
      _sectionKeys.putIfAbsent(letter, GlobalKey.new);

  List<_ClientSection> _groupByLetter(List<InstClient> items) {
    final sections = <_ClientSection>[];
    for (final client in items) {
      final letter = client.lastNameLetter;
      if (sections.isEmpty || sections.last.letter != letter) {
        sections.add(_ClientSection(letter: letter, clients: [client]));
      } else {
        sections.last.clients.add(client);
      }
    }
    return sections;
  }

  void _onRailLetter(String letter) {
    if (_scrubLetter != letter) {
      alphabetHaptic();
      setState(() => _scrubLetter = letter);
    }
    _letterDebounce?.cancel();
    _letterDebounce = Timer(const Duration(milliseconds: 70), () {
      _jumpToLetter(letter);
    });
  }

  void _jumpToLetter(String letter) {
    if (_query.isEmpty && _tryScrollToLetter(letter)) return;
    _searchController.clear();
    setState(() {
      _query = '';
      _fromLetter = letter;
    });
    unawaited(_loadInitial());
  }

  bool _tryScrollToLetter(String letter) {
    final direct = _sectionKeys[letter]?.currentContext;
    if (direct == null) return false;
    Scrollable.ensureVisible(
      direct,
      alignment: 0.0,
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
    );
    return true;
  }

  int _compareClients(InstClient a, InstClient b) {
    final byName = a.lastNameSort.compareTo(b.lastNameSort);
    if (byName != 0) return byName;
    return a.id.compareTo(b.id);
  }

  Future<void> _openDetail(InstClient client) async {
    await showClientDetailSheet(
      context: context,
      client: client,
      onChanged: _upsertClient,
    );
  }

  Future<void> _createClient() async {
    final result = await showClientEditorSheet(context: context);
    if (result == null) return;
    _upsertClient(result.client, insert: true);
    if (result.account != null && mounted) {
      showClientAccountCreatedSnackBar(context, result.account!);
    }
  }

  void _upsertClient(InstClient client, {bool insert = false}) {
    setState(() {
      final index = _items.indexWhere((c) => c.id == client.id);
      if (index >= 0) {
        final next = [..._items];
        next[index] = client;
        next.sort(_compareClients);
        _items = next;
      } else if (insert || _query.isEmpty) {
        final next = [..._items, client];
        next.sort(_compareClients);
        _items = next;
      }
    });
  }
}

class _ClientRow extends StatelessWidget {
  const _ClientRow({required this.client, required this.onTap});

  final InstClient client;
  final VoidCallback onTap;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  String _initials() {
    final name = client.fullName ?? client.email ?? client.phone ?? '?';
    if (name.isEmpty) return '?';
    final trimmed = name.trim();
    if (trimmed.contains(' ')) {
      final parts = trimmed.split(' ').where((p) => p.isNotEmpty).toList();
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
    }
    return trimmed[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _ClientsScreenState._rowBg,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 28, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _Avatar(initials: _initials()),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      client.displayName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _black,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (client.subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        client.subtitle!,
                        style: const TextStyle(fontSize: 12, color: _muted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (client.tags.isNotEmpty ||
                        client.marketingOptIn ||
                        client.hasAccount) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: [
                          if (client.hasAccount)
                            const InstitutChip(
                              label: 'Compte',
                              icon: Icons.badge_outlined,
                              color: Color(0xFF1E40AF),
                              background: Color(0xFFDBE7FE),
                            ),
                          if (client.marketingOptIn)
                            const InstitutChip(
                              label: 'Marketing',
                              icon: Icons.mail_outline_rounded,
                              color: Color(0xFF065F46),
                              background: Color(0xFFD1FAE5),
                            ),
                          ...client.tags.take(3).map(
                                (t) => InstitutChip(label: t),
                              ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFFB5B5B5),
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initials});
  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F1F1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: _ClientRow._black,
        ),
      ),
    );
  }
}

class _ClientSection {
  _ClientSection({required this.letter, required this.clients});

  final String letter;
  final List<InstClient> clients;
}

class _LetterHeaderDelegate extends SliverPersistentHeaderDelegate {
  _LetterHeaderDelegate({required this.letter, required this.headerKey});

  final String letter;
  final Key headerKey;

  @override
  double get minExtent => 28;

  @override
  double get maxExtent => 28;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return KeyedSubtree(
      key: headerKey,
      child: ColoredBox(
        color: overlapsContent ? Colors.white : const Color(0xFFF7F7F7),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 28, 0),
            child: Text(
              letter,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF737373),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _LetterHeaderDelegate oldDelegate) {
    return oldDelegate.letter != letter || oldDelegate.headerKey != headerKey;
  }
}
